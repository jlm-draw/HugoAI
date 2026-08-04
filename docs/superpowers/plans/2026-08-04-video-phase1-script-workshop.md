# 短视频模块 阶段1「脚本工坊」实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现短视频模块阶段1「脚本工坊」：用户输入选题，AI 一次性生成 5 个爆款标题 + 60 秒口播脚本 + 分镜表，并提供项目/脚本的管理界面，替换现有 `/video` 占位页。

**Architecture:** 复用小说模块的成熟模式——Prisma 新增 `VideoProject → VideoScript → VideoShot` 三层模型；`services/video/` 服务层（守卫、prompts、AI 调用、序列化）；Next.js Route Handlers 提供 REST API；React 客户端组件渲染列表与工作台。脚本生成为**结构化 JSON 输出**（对齐 `generateOutline` 的非流式模式），不走 SSE——因为产物需要整体解析入库并结构化展示，流式输出 JSON 无 UX 收益。

**Tech Stack:** Next.js 16 App Router（注意：`params` 是 Promise，见 `node_modules/next/dist/docs/`）、TypeScript、Prisma 5 + PostgreSQL 16、通义千问（OpenAI 兼容接口，`lib/ai.ts`）、Tailwind CSS v4 + shadcn/ui 风格组件。

**验证方式说明：** 本项目没有安装任何测试框架（无 vitest/jest），既有代码与既有计划文档均以「typecheck + lint + build + 手动/API 冒烟验证」作为验证手段，本计划沿用该既定模式。

**重要环境事项（踩坑记录，务必遵守）：**
1. **Prisma CLI 不读 `.env.local`**：数据库连接串在 `code/front/.env.local`，执行任何 prisma 命令前必须先加载它：`set -a && source .env.local && set +a`，否则报 `P1012 Environment variable not found: DATABASE_URL`。
2. **绝不提交 `.env*` 文件**（项目铁律）。提交时只 add 本计划列出的源码文件。
3. Next.js 16 中路由的 `params` 是 `Promise`，必须 `await params`（参考 `api/novel/[id]/route.ts` 的写法）。
4. 权限码 `video:use` 与菜单 `/video` 已在 `seed.ts` 中预置，**无需改 seed**。

---

## 文件结构概览

```
HugoAI/
├── code/backend/prisma/
│   └── schema.prisma                      # 修改：User 加 videoProjects 关系；新增 VideoProject/VideoScript/VideoShot
├── code/front/src/
│   ├── lib/
│   │   └── ai.ts                          # 修改：导出通用 extractJson（从 novel/ai.ts 提取）
│   ├── services/
│   │   ├── novel/ai.ts                    # 修改：改用 lib/ai 的 extractJson
│   │   └── video/                         # 新增目录
│   │       ├── types.ts                   # 赛道常量 + 前后端共享类型
│   │       ├── guard.ts                   # video:use 权限守卫 + 属主校验
│   │       ├── prompts.ts                 # 脚本生成 system prompt
│   │       ├── ai.ts                      # generateScript()
│   │       └── serialize.ts               # Prisma 实体 → API DTO
│   ├── app/
│   │   ├── api/video/projects/
│   │   │   ├── route.ts                   # GET 列表 / POST 新建项目
│   │   │   └── [id]/
│   │   │       ├── route.ts               # GET 工作台数据 / PATCH 改名 / DELETE
│   │   │       └── scripts/
│   │   │           ├── route.ts           # POST AI 生成脚本
│   │   │           └── [scriptId]/route.ts # DELETE 删除单个脚本
│   │   └── (dashboard)/video/
│   │       ├── page.tsx                   # 修改：占位页 → 项目列表
│   │       └── [id]/page.tsx              # 新增：工作台页面
│   └── components/video/                  # 新增目录
│       ├── VideoProjectList.tsx           # 项目卡片列表 + 编辑/删除
│       ├── VideoCreateDialog.tsx          # 新建项目对话框
│       ├── VideoWorkspace.tsx             # 工作台：生成面板 + 脚本列表
│       └── ScriptDetail.tsx               # 脚本详情：标题/口播稿/分镜表
└── docs/superpowers/plans/
    └── 2026-08-04-video-phase1-script-workshop.md   # 本文件
```

---

### Task 1: 通用 extractJson 提取到 lib/ai.ts（DRY 重构）

`services/novel/ai.ts` 里有一个私有 `extractJson`（从 AI 输出中抠出 JSON，兼容 markdown 代码块）。视频模块的脚本生成同样需要它，提取到 `lib/ai.ts` 共享。

**Files:**
- Modify: `code/front/src/lib/ai.ts`（末尾追加导出函数）
- Modify: `code/front/src/services/novel/ai.ts`（删本地函数，改 import）

- [ ] **Step 1: 在 lib/ai.ts 末尾追加 extractJson**

在 `code/front/src/lib/ai.ts` 文件末尾（`export { model as currentModel, client };` 之后）追加：

```ts
/** 从模型输出中提取 JSON（兼容 markdown 代码块与前后多余文字） */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```/g, "");
  const starts = [cleaned.indexOf("{"), cleaned.indexOf("[")].filter((i) => i >= 0);
  if (starts.length === 0) throw new Error("AI 输出格式异常，请重试");
  const start = Math.min(...starts);
  const end = cleaned[start] === "{" ? cleaned.lastIndexOf("}") : cleaned.lastIndexOf("]");
  if (end <= start) throw new Error("AI 输出格式异常，请重试");
  return JSON.parse(cleaned.slice(start, end + 1));
}
```

- [ ] **Step 2: novel/ai.ts 改用共享版本**

`code/front/src/services/novel/ai.ts`：
1. 把第 1 行 `import { chat, chatStream } from "@/lib/ai";` 改为：

```ts
import { chat, chatStream, extractJson } from "@/lib/ai";
```

2. 删除文件中的本地 `extractJson` 函数定义（`/** 从模型输出中提取 JSON（兼容 markdown 代码块与前后多余文字） */` 及其下方整个函数体）。

- [ ] **Step 3: 类型检查验证**

Run: `cd /jlm/cc-workspace/HugoAI/code/front && npx tsc --noEmit`
Expected: 无输出（无类型错误）

- [ ] **Step 4: Commit**

```bash
cd /jlm/cc-workspace/HugoAI
git add code/front/src/lib/ai.ts code/front/src/services/novel/ai.ts
git commit -m "refactor(ai): 提取 extractJson 到 lib/ai.ts 供多模块复用"
```

---

### Task 2: Prisma 数据模型（VideoProject / VideoScript / VideoShot）

**Files:**
- Modify: `code/backend/prisma/schema.prisma`
- Migration: `code/backend/prisma/migrations/<timestamp>_video_script_workshop/`（自动生成）

- [ ] **Step 1: User 模型加反向关系**

在 `code/backend/prisma/schema.prisma` 的 `model User` 中，`novels Novel[]` 一行之后加：

```prisma
  videoProjects VideoProject[]
```

- [ ] **Step 2: 追加三个视频模型**

在 `schema.prisma` 文件末尾追加：

```prisma
model VideoProject {
  id          String   @id @default(cuid())
  userId      String
  name        String
  positioning String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user    User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  scripts VideoScript[]

  @@index([userId])
}

model VideoScript {
  id        String   @id @default(cuid())
  projectId String
  track     String
  topic     String
  title     String
  titles    Json
  narration String   @default("")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  project VideoProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  shots   VideoShot[]

  @@index([projectId])
}

model VideoShot {
  id        String   @id @default(cuid())
  scriptId  String
  sort      Int
  visual    String
  line      String
  duration  Int      @default(3)
  createdAt DateTime @default(now())

  script VideoScript @relation(fields: [scriptId], references: [id], onDelete: Cascade)

  @@index([scriptId, sort])
}
```

字段说明（供理解，非代码）：
- `VideoScript.track`：赛道代码（`ai-news`/`novel-promo`/`emotion`/`general`）
- `VideoScript.titles`：AI 生成的 5 个候选标题（Json 数组）；`title`：采用的主标题（默认取第一个）
- `VideoShot`：分镜，`visual` 画面描述、`line` 对应台词、`duration` 秒数

- [ ] **Step 3: 生成并应用迁移**

```bash
cd /jlm/cc-workspace/HugoAI/code/front
set -a && source .env.local && set +a
npx prisma migrate dev --name video_script_workshop
```

Expected:
- `Generated Prisma Client`
- `The following migration(s) have been created and applied from new schema changes:` → `migrations/*_video_script_workshop/`
- `Your database is now in sync with your schema.`

> 若报 `P1012 Environment variable not found: DATABASE_URL`，说明 Step 3 的 source 没执行成功，先重新 source 再跑。

- [ ] **Step 4: Commit**

```bash
cd /jlm/cc-workspace/HugoAI
git add code/backend/prisma/schema.prisma code/backend/prisma/migrations
git commit -m "feat(video): 新增 VideoProject/VideoScript/VideoShot 数据模型"
```

---

### Task 3: 共享类型与权限守卫（services/video/types.ts、guard.ts）

**Files:**
- Create: `code/front/src/services/video/types.ts`
- Create: `code/front/src/services/video/guard.ts`

- [ ] **Step 1: 创建 types.ts**

```ts
/**
 * 短视频模块共享类型与常量（前后端通用，勿引入服务端依赖）。
 */

/** 短视频赛道（内容方向） */
export const TRACKS = [
  { code: "ai-news", name: "AI/科技资讯解读", emoji: "🤖" },
  { code: "novel-promo", name: "小说推文", emoji: "📚" },
  { code: "emotion", name: "情感/知识口播", emoji: "💡" },
  { code: "general", name: "通用", emoji: "🎬" },
] as const;

export type TrackCode = (typeof TRACKS)[number]["code"];

export function trackName(code: string): string {
  return TRACKS.find((t) => t.code === code)?.name ?? code;
}

export function trackEmoji(code: string): string {
  return TRACKS.find((t) => t.code === code)?.emoji ?? "🎬";
}

/** 单个分镜 */
export interface VideoShotItem {
  id: string;
  sort: number;
  visual: string;
  line: string;
  duration: number;
}

/** 脚本（含分镜；列表与详情共用） */
export interface VideoScriptItem {
  id: string;
  track: string;
  topic: string;
  /** 采用的主标题（默认是 titles[0]） */
  title: string;
  /** AI 生成的候选标题（5 个） */
  titles: string[];
  /** 完整口播稿 */
  narration: string;
  createdAt: string;
  shots: VideoShotItem[];
}

/** 项目卡片摘要 */
export interface VideoProjectSummary {
  id: string;
  name: string;
  positioning: string | null;
  scriptCount: number;
  updatedAt: string;
}

/** GET /api/video/projects/[id] 返回的工作台全量数据 */
export interface VideoWorkspaceData {
  project: VideoProjectSummary;
  scripts: VideoScriptItem[];
}
```

- [ ] **Step 2: 创建 guard.ts**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserWithPerms, hasPermission } from "@/lib/rbac";

/**
 * 短视频模块统一守卫：登录态 + video:use 权限。
 * 用法对齐 requireNovelAccess 的判别联合模式：
 *   const check = await requireVideoAccess();
 *   if ("error" in check) return check.error;
 */
export async function requireVideoAccess(): Promise<{ error: NextResponse } | { userId: string }> {
  const user = await getCurrentUserWithPerms();
  if (!user) {
    return { error: NextResponse.json({ error: "未认证" }, { status: 401 }) };
  }
  if (!hasPermission(user, "video:use")) {
    return { error: NextResponse.json({ error: "没有短视频功能的使用权限" }, { status: 403 }) };
  }
  return { userId: user.id };
}

/**
 * 属主校验：只返回属于当前用户的视频项目（连同脚本与分镜）；查不到返回 null。
 * 路由中一律以 404 回应 null（兼防越权探测）。
 */
export async function getOwnedProject(projectId: string, userId: string) {
  return prisma.videoProject.findFirst({
    where: { id: projectId, userId },
    include: {
      scripts: {
        orderBy: { createdAt: "desc" },
        include: { shots: { orderBy: { sort: "asc" } } },
      },
    },
  });
}
```

- [ ] **Step 3: 类型检查验证**

Run: `cd /jlm/cc-workspace/HugoAI/code/front && npx tsc --noEmit`
Expected: 无输出

- [ ] **Step 4: Commit**

```bash
cd /jlm/cc-workspace/HugoAI
git add code/front/src/services/video/types.ts code/front/src/services/video/guard.ts
git commit -m "feat(video): 新增共享类型与 video:use 权限守卫"
```

---

### Task 4: AI 脚本生成服务（prompts.ts、ai.ts、serialize.ts）

**Files:**
- Create: `code/front/src/services/video/prompts.ts`
- Create: `code/front/src/services/video/ai.ts`
- Create: `code/front/src/services/video/serialize.ts`

- [ ] **Step 1: 创建 prompts.ts**

```ts
/**
 * 短视频模块 AI 能力的 system prompt。
 */

/** 脚本生成：输入选题 → 输出标题/口播稿/分镜的结构化 JSON */
export function systemScriptGenerate(track: string, positioning: string | null): string {
  const positioningLine = positioning?.trim()
    ? `该账号的定位与目标受众：${positioning.trim()}。`
    : "";
  return `你是一位资深短视频内容策划，精通抖音、视频号等平台的流量机制。
请根据用户给出的选题，策划一条不露脸口播类短视频脚本。内容赛道：${track}。${positioningLine}
严格按照以下 JSON 格式输出，不要输出 JSON 以外的任何内容：
{
  "titles": ["爆款标题1", "爆款标题2", "爆款标题3", "爆款标题4", "爆款标题5"],
  "narration": "完整口播稿，200-260字（约60秒语速），口语化，开头5秒必须有强钩子，结尾有关注/点赞引导",
  "shots": [
    { "visual": "画面描述：这个镜头应出现什么画面/素材，要具体到可以直接搜索或生成", "line": "该镜头对应的口播台词", "duration": 5 }
  ]
}
要求：
- titles 恰好 5 条，每条不超过 20 字，运用悬念、数字、对比、反常识等钩子技巧
- shots 按口播的自然停顿拆成 6-12 个镜头，所有 shot 的 line 按顺序拼接必须与 narration 完全一致，不增不减
- 每个 shot 的 duration 为 3-8 秒的整数，总和接近口播时长
- 口播稿节奏：钩子开场 → 主体内容（信息密度高）→ 结尾互动引导`;
}
```

- [ ] **Step 2: 创建 ai.ts**

```ts
import { chat, extractJson } from "@/lib/ai";
import { systemScriptGenerate } from "./prompts";
import { trackName, type TrackCode } from "./types";

/** AI 生成的一条脚本（入库前的中间结构） */
export interface GeneratedScript {
  titles: string[];
  narration: string;
  shots: Array<{ visual: string; line: string; duration: number }>;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function clampDuration(v: unknown): number {
  const n = typeof v === "number" ? Math.round(v) : Number(v);
  if (!Number.isFinite(n)) return 5;
  return Math.min(30, Math.max(1, n));
}

/** AI 脚本生成：选题 → 5 个标题 + 60 秒口播稿 + 分镜表 */
export async function generateScript(
  track: TrackCode,
  topic: string,
  positioning: string | null
): Promise<GeneratedScript> {
  const result = await chat(
    [
      {
        role: "user",
        content: `选题：${topic}\n请策划完整的短视频脚本。`,
      },
    ],
    {
      systemPrompt: systemScriptGenerate(trackName(track), positioning),
      temperature: 0.8,
      maxTokens: 4000,
    }
  );

  const parsed = extractJson(result) as {
    titles?: unknown;
    narration?: unknown;
    shots?: unknown;
  };

  const titles = Array.isArray(parsed?.titles)
    ? parsed.titles
        .slice(0, 5)
        .map((t) => str(t).trim())
        .filter(Boolean)
    : [];

  const narration = str(parsed?.narration).trim();

  const shots = Array.isArray(parsed?.shots)
    ? parsed.shots.slice(0, 30).map((s: { visual?: unknown; line?: unknown; duration?: unknown }) => ({
        visual: str(s?.visual).trim(),
        line: str(s?.line).trim(),
        duration: clampDuration(s?.duration),
      }))
    : [];

  if (titles.length === 0 || !narration) {
    throw new Error("AI 输出格式异常，请重试");
  }

  return { titles, narration, shots };
}
```

- [ ] **Step 3: 创建 serialize.ts**

```ts
import type { Prisma } from "@prisma/client";
import type { VideoScriptItem, VideoShotItem } from "./types";

type ScriptWithShots = Prisma.VideoScriptGetPayload<{ include: { shots: true } }>;

export function serializeShot(shot: {
  id: string;
  sort: number;
  visual: string;
  line: string;
  duration: number;
}): VideoShotItem {
  return {
    id: shot.id,
    sort: shot.sort,
    visual: shot.visual,
    line: shot.line,
    duration: shot.duration,
  };
}

export function serializeScript(script: ScriptWithShots): VideoScriptItem {
  return {
    id: script.id,
    track: script.track,
    topic: script.topic,
    title: script.title,
    titles: Array.isArray(script.titles) ? (script.titles as unknown as string[]) : [],
    narration: script.narration,
    createdAt: script.createdAt.toISOString(),
    shots: [...script.shots].sort((a, b) => a.sort - b.sort).map(serializeShot),
  };
}
```

- [ ] **Step 4: 类型检查验证**

Run: `cd /jlm/cc-workspace/HugoAI/code/front && npx tsc --noEmit`
Expected: 无输出

- [ ] **Step 5: Commit**

```bash
cd /jlm/cc-workspace/HugoAI
git add code/front/src/services/video/prompts.ts code/front/src/services/video/ai.ts code/front/src/services/video/serialize.ts
git commit -m "feat(video): AI 脚本生成服务（标题+口播稿+分镜）"
```

---

### Task 5: 项目列表 / 新建 API（api/video/projects/route.ts）

**Files:**
- Create: `code/front/src/app/api/video/projects/route.ts`

- [ ] **Step 1: 创建 route.ts**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireVideoAccess } from "@/services/video/guard";
import type { VideoProjectSummary } from "@/services/video/types";

/** GET /api/video/projects — 当前用户的视频项目列表（含脚本数） */
export async function GET() {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;

  const projects = await prisma.videoProject.findMany({
    where: { userId: check.userId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { scripts: true } } },
  });

  const list: VideoProjectSummary[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    positioning: p.positioning,
    scriptCount: p._count.scripts,
    updatedAt: p.updatedAt.toISOString(),
  }));

  return NextResponse.json({ projects: list });
}

/** POST /api/video/projects — 新建视频项目 */
export async function POST(request: Request) {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;

  let body: { name?: unknown; positioning?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "请填写项目名称" }, { status: 400 });
  }
  if (name.length > 50) {
    return NextResponse.json({ error: "项目名称不能超过 50 字" }, { status: 400 });
  }

  const positioning =
    typeof body.positioning === "string" ? body.positioning.trim().slice(0, 200) : null;

  const project = await prisma.videoProject.create({
    data: {
      userId: check.userId,
      name,
      positioning: positioning || null,
    },
  });

  return NextResponse.json({ project: { id: project.id } }, { status: 201 });
}
```

- [ ] **Step 2: 类型检查验证**

Run: `cd /jlm/cc-workspace/HugoAI/code/front && npx tsc --noEmit`
Expected: 无输出

- [ ] **Step 3: Commit**

```bash
cd /jlm/cc-workspace/HugoAI
git add code/front/src/app/api/video/projects/route.ts
git commit -m "feat(video): 项目列表与新建 API"
```

---

### Task 6: 项目详情 / 改名 / 删除 API（api/video/projects/[id]/route.ts）

**Files:**
- Create: `code/front/src/app/api/video/projects/[id]/route.ts`

- [ ] **Step 1: 创建 route.ts**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOwnedProject, requireVideoAccess } from "@/services/video/guard";
import { serializeScript } from "@/services/video/serialize";
import type { VideoWorkspaceData } from "@/services/video/types";

/** GET /api/video/projects/[id] — 工作台全量数据（项目 + 全部脚本与分镜） */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;
  const { id } = await params;

  const project = await getOwnedProject(id, check.userId);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  const data: VideoWorkspaceData = {
    project: {
      id: project.id,
      name: project.name,
      positioning: project.positioning,
      scriptCount: project.scripts.length,
      updatedAt: project.updatedAt.toISOString(),
    },
    scripts: project.scripts.map(serializeScript),
  };

  return NextResponse.json(data);
}

/** PATCH /api/video/projects/[id] — 修改项目名称 / 账号定位 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;
  const { id } = await params;

  const existing = await prisma.videoProject.findFirst({
    where: { id, userId: check.userId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  let body: { name?: unknown; positioning?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const data: { name?: string; positioning?: string | null } = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 50) {
      return NextResponse.json({ error: "项目名称需在 1-50 字之间" }, { status: 400 });
    }
    data.name = name;
  }
  if (body.positioning !== undefined) {
    data.positioning =
      typeof body.positioning === "string"
        ? body.positioning.trim().slice(0, 200) || null
        : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "没有可更新的字段" }, { status: 400 });
  }

  const project = await prisma.videoProject.update({ where: { id }, data });
  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      positioning: project.positioning,
    },
  });
}

/** DELETE /api/video/projects/[id] — 删除项目（级联删除脚本与分镜） */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;
  const { id } = await params;

  const existing = await prisma.videoProject.findFirst({
    where: { id, userId: check.userId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  await prisma.videoProject.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: 类型检查验证**

Run: `cd /jlm/cc-workspace/HugoAI/code/front && npx tsc --noEmit`
Expected: 无输出

- [ ] **Step 3: Commit**

```bash
cd /jlm/cc-workspace/HugoAI
git add "code/front/src/app/api/video/projects/[id]/route.ts"
git commit -m "feat(video): 项目详情/改名/删除 API"
```

---

### Task 7: 脚本生成 / 删除 API（scripts 路由）

**Files:**
- Create: `code/front/src/app/api/video/projects/[id]/scripts/route.ts`
- Create: `code/front/src/app/api/video/projects/[id]/scripts/[scriptId]/route.ts`

- [ ] **Step 1: 创建脚本生成路由**

`code/front/src/app/api/video/projects/[id]/scripts/route.ts`：

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateScript } from "@/services/video/ai";
import { getOwnedProject, requireVideoAccess } from "@/services/video/guard";
import { serializeScript } from "@/services/video/serialize";
import { TRACKS, type TrackCode } from "@/services/video/types";

/** POST /api/video/projects/[id]/scripts — AI 生成脚本（非流式，整体返回） */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;
  const { id } = await params;

  const project = await getOwnedProject(id, check.userId);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  let body: { track?: unknown; topic?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const track = typeof body.track === "string" ? body.track : "";
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (!TRACKS.some((t) => t.code === track)) {
    return NextResponse.json({ error: "请选择有效的内容赛道" }, { status: 400 });
  }
  if (!topic) {
    return NextResponse.json({ error: "请填写视频选题" }, { status: 400 });
  }
  if (topic.length > 200) {
    return NextResponse.json({ error: "选题不能超过 200 字" }, { status: 400 });
  }

  try {
    const generated = await generateScript(track as TrackCode, topic, project.positioning);

    const script = await prisma.videoScript.create({
      data: {
        projectId: id,
        track,
        topic,
        title: generated.titles[0],
        titles: generated.titles,
        narration: generated.narration,
        shots: {
          create: generated.shots.map((s, i) => ({
            sort: i + 1,
            visual: s.visual,
            line: s.line,
            duration: s.duration,
          })),
        },
      },
      include: { shots: { orderBy: { sort: "asc" } } },
    });

    return NextResponse.json({ script: serializeScript(script) }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "生成失败，请重试";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: 创建脚本删除路由**

`code/front/src/app/api/video/projects/[id]/scripts/[scriptId]/route.ts`：

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireVideoAccess } from "@/services/video/guard";

/** DELETE /api/video/projects/[id]/scripts/[scriptId] — 删除单个脚本（级联删除分镜） */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; scriptId: string }> }
) {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;
  const { id, scriptId } = await params;

  const script = await prisma.videoScript.findFirst({
    where: { id: scriptId, projectId: id },
    select: { id: true, project: { select: { userId: true } } },
  });
  if (!script || script.project.userId !== check.userId) {
    return NextResponse.json({ error: "脚本不存在" }, { status: 404 });
  }

  await prisma.videoScript.delete({ where: { id: scriptId } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: 类型检查验证**

Run: `cd /jlm/cc-workspace/HugoAI/code/front && npx tsc --noEmit`
Expected: 无输出

- [ ] **Step 4: Commit**

```bash
cd /jlm/cc-workspace/HugoAI
git add "code/front/src/app/api/video/projects/[id]/scripts"
git commit -m "feat(video): AI 脚本生成与删除 API"
```

---

### Task 8: 前端项目列表页（替换占位页）

**Files:**
- Modify: `code/front/src/app/(dashboard)/video/page.tsx`（整个替换）
- Create: `code/front/src/components/video/VideoProjectList.tsx`
- Create: `code/front/src/components/video/VideoCreateDialog.tsx`

- [ ] **Step 1: 替换 video/page.tsx**

```tsx
import { VideoProjectList } from "@/components/video/VideoProjectList";

export default function VideoPage() {
  return <VideoProjectList />;
}
```

- [ ] **Step 2: 创建 VideoCreateDialog.tsx**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function VideoCreateDialog({ open, onClose }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [positioning, setPositioning] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setPositioning("");
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function handleCreate() {
    if (!name.trim()) {
      setError("请填写项目名称");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/video/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          positioning: positioning.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "创建失败");
      close();
      router.push(`/video/${json.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
      setCreating(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新建短视频项目</DialogTitle>
          <DialogDescription>一个项目对应一个账号定位，AI 会结合定位生成脚本</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>项目名称</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：AI资讯每日解读"
              maxLength={50}
            />
          </div>
          <div className="space-y-1.5">
            <Label>账号定位（可选）</Label>
            <Textarea
              value={positioning}
              onChange={(e) => setPositioning(e.target.value)}
              rows={3}
              maxLength={200}
              placeholder="目标受众、内容方向、人设…… 如：面向职场人的实用 AI 工具推荐"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={creating}>
            取消
          </Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? "创建中…" : "创建项目"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: 创建 VideoProjectList.tsx**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Clapperboard, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import type { VideoProjectSummary } from "@/services/video/types";
import { VideoCreateDialog } from "./VideoCreateDialog";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

const COVER_GRADIENTS = [
  "from-blue-100 to-indigo-200",
  "from-amber-100 to-orange-200",
  "from-emerald-100 to-teal-200",
  "from-rose-100 to-pink-200",
  "from-violet-100 to-purple-200",
];

function gradientFor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  return COVER_GRADIENTS[hash % COVER_GRADIENTS.length];
}

export function VideoProjectList() {
  const [projects, setProjects] = useState<VideoProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  // 编辑对话框
  const [editing, setEditing] = useState<VideoProjectSummary | null>(null);
  const [editName, setEditName] = useState("");
  const [editPositioning, setEditPositioning] = useState("");
  const [saving, setSaving] = useState(false);

  // 删除确认
  const [deleting, setDeleting] = useState<VideoProjectSummary | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/video/projects");
      const json = await res.json();
      if (res.ok) setProjects(json.projects ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch("/api/video/projects");
        const json = await res.json();
        if (!ignore && res.ok) setProjects(json.projects ?? []);
      } catch {
        // 网络异常时保持空列表
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  function openEdit(project: VideoProjectSummary) {
    setEditing(project);
    setEditName(project.name);
    setEditPositioning(project.positioning ?? "");
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/video/projects/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          positioning: editPositioning.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存失败");
      setEditing(null);
      await fetchProjects();
      toast.add({ type: "success", title: "项目信息已保存" });
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : "保存失败" });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      const res = await fetch(`/api/video/projects/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "删除失败");
      }
      setDeleting(null);
      await fetchProjects();
      toast.add({ type: "success", title: "项目已删除" });
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : "删除失败" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">短视频工坊</h1>
          <p className="text-xs text-gray-400">AI 脚本生成：选题 → 爆款标题 + 口播稿 + 分镜表</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus size={14} /> 新建项目
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl border bg-white" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
          <Clapperboard size={32} className="mb-3 text-gray-300" />
          <p className="mb-1 text-sm text-gray-500">还没有项目</p>
          <p className="mb-4 text-xs text-gray-400">创建一个项目，开始生成短视频脚本</p>
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={13} /> 创建第一个项目
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="group relative overflow-hidden rounded-xl border bg-white transition-shadow hover:shadow-md"
            >
              <Link href={`/video/${project.id}`} className="block">
                <div
                  className={`flex h-20 w-full items-center justify-center bg-gradient-to-br ${gradientFor(
                    project.id
                  )}`}
                >
                  <span className="text-3xl">🎬</span>
                </div>
                <div className="space-y-1.5 p-3.5">
                  <h2 className="truncate text-sm font-semibold text-gray-800">{project.name}</h2>
                  {project.positioning && (
                    <p className="line-clamp-2 text-xs text-gray-400">{project.positioning}</p>
                  )}
                  <p className="pt-1 text-[11px] text-gray-400">
                    {project.scriptCount} 个脚本 · 更新于 {formatDate(project.updatedAt)}
                  </p>
                </div>
              </Link>
              <div className="absolute top-1.5 right-1.5 hidden gap-1 group-hover:flex">
                <button
                  onClick={() => openEdit(project)}
                  className="rounded-md bg-white/90 p-1.5 text-gray-500 shadow hover:text-blue-600"
                  title="编辑信息"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => setDeleting(project)}
                  className="rounded-md bg-white/90 p-1.5 text-gray-500 shadow hover:text-red-500"
                  title="删除"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <VideoCreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* 编辑项目信息 */}
      <Dialog
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑项目信息</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>名称</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={50}
              />
            </div>
            <div className="space-y-1.5">
              <Label>账号定位（可选）</Label>
              <Textarea
                value={editPositioning}
                onChange={(e) => setEditPositioning(e.target.value)}
                rows={3}
                maxLength={200}
                placeholder="如：面向小白的 AI 工具测评，目标受众是想用 AI 提效的职场人"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              取消
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <Dialog
        open={deleting !== null}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>删除项目</DialogTitle>
            <DialogDescription>
              确定删除「{deleting?.name}」吗？其下所有脚本将一并删除，无法恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 4: 类型检查验证**

Run: `cd /jlm/cc-workspace/HugoAI/code/front && npx tsc --noEmit`
Expected: 无输出

- [ ] **Step 5: Commit**

```bash
cd /jlm/cc-workspace/HugoAI
git add "code/front/src/app/(dashboard)/video/page.tsx" code/front/src/components/video/VideoProjectList.tsx code/front/src/components/video/VideoCreateDialog.tsx
git commit -m "feat(video): 项目列表页与新建项目对话框"
```

---

### Task 9: 前端工作台页面（生成面板 + 脚本列表 + 详情）

**Files:**
- Create: `code/front/src/app/(dashboard)/video/[id]/page.tsx`
- Create: `code/front/src/components/video/VideoWorkspace.tsx`
- Create: `code/front/src/components/video/ScriptDetail.tsx`

- [ ] **Step 1: 创建 video/[id]/page.tsx**

```tsx
import { VideoWorkspace } from "@/components/video/VideoWorkspace";

export default async function VideoWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <VideoWorkspace projectId={id} />;
}
```

- [ ] **Step 2: 创建 ScriptDetail.tsx**

```tsx
"use client";

import { Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { trackEmoji, trackName, type VideoScriptItem } from "@/services/video/types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function ScriptDetail({ script }: { script: VideoScriptItem }) {
  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.add({ type: "success", title: `${label}已复制到剪贴板` });
    } catch {
      toast.add({ type: "error", title: "复制失败，请手动选择复制" });
    }
  }

  const totalDuration = script.shots.reduce((sum, s) => sum + s.duration, 0);
  // 中文口播语速约 4.5 字/秒，估算时长
  const estimatedSeconds = Math.round(script.narration.length / 4.5);

  return (
    <div className="space-y-4 rounded-xl border bg-white p-4">
      {/* 标题区 */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-bold text-gray-800">{script.title}</h2>
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {trackEmoji(script.track)} {trackName(script.track)}
            </Badge>
          </div>
          <p className="mt-1 truncate text-xs text-gray-400">
            选题：{script.topic} · {formatDate(script.createdAt)}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1"
          onClick={() => copy(script.narration, "口播稿")}
        >
          <Copy size={13} /> 复制口播稿
        </Button>
      </div>

      {/* 候选标题 */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-gray-500">爆款标题（5 选 1，蓝色为采用项，点击复制）</p>
        <div className="flex flex-wrap gap-1.5">
          {script.titles.map((t, i) => (
            <button
              key={i}
              onClick={() => copy(t, "标题")}
              title="点击复制"
              className={
                i === 0
                  ? "rounded-full bg-blue-600 px-2.5 py-1 text-xs text-white"
                  : "rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-200"
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* 口播稿 */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-gray-500">
          口播稿（{script.narration.length} 字 · 约 {estimatedSeconds} 秒）
        </p>
        <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm leading-6 text-gray-700">
          {script.narration}
        </div>
      </div>

      {/* 分镜表 */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-gray-500">
          分镜表（{script.shots.length} 个镜头 · 共约 {totalDuration} 秒）
        </p>
        {script.shots.length === 0 ? (
          <p className="text-xs text-gray-400">AI 未返回分镜数据</p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="w-10 px-2 py-1.5 text-left font-medium">#</th>
                  <th className="px-2 py-1.5 text-left font-medium">画面</th>
                  <th className="px-2 py-1.5 text-left font-medium">台词</th>
                  <th className="w-14 px-2 py-1.5 text-right font-medium">秒</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {script.shots.map((s) => (
                  <tr key={s.id} className="align-top">
                    <td className="px-2 py-1.5 text-gray-400">{s.sort}</td>
                    <td className="px-2 py-1.5 text-gray-600">{s.visual}</td>
                    <td className="px-2 py-1.5 text-gray-700">{s.line}</td>
                    <td className="px-2 py-1.5 text-right text-gray-500">{s.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建 VideoWorkspace.tsx**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clapperboard, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  TRACKS,
  trackEmoji,
  trackName,
  type VideoWorkspaceData,
} from "@/services/video/types";
import { ScriptDetail } from "./ScriptDetail";

interface Props {
  projectId: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function VideoWorkspace({ projectId }: Props) {
  const [data, setData] = useState<VideoWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [track, setTrack] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState<{ id: string; topic: string } | null>(null);

  /** 静默刷新（不动 loading，避免生成后整页闪骨架屏） */
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/video/projects/${projectId}`);
      const json = await res.json();
      if (res.ok) setData(json as VideoWorkspaceData);
    } catch {
      // 刷新失败保持当前数据
    }
  }, [projectId]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch(`/api/video/projects/${projectId}`);
        const json = await res.json();
        if (!ignore && res.ok) {
          setData(json as VideoWorkspaceData);
          setSelectedId(json.scripts?.[0]?.id ?? null);
        }
      } catch {
        // 网络异常时保持空状态
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [projectId]);

  async function handleGenerate() {
    if (!track) {
      toast.add({ type: "error", title: "请先选择内容赛道" });
      return;
    }
    if (!topic.trim()) {
      toast.add({ type: "error", title: "请填写视频选题" });
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(`/api/video/projects/${projectId}/scripts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track, topic: topic.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "生成失败");
      await refresh();
      setSelectedId(json.script?.id ?? null);
      setTopic("");
      toast.add({ type: "success", title: "脚本已生成" });
    } catch (err) {
      toast.add({
        type: "error",
        title: err instanceof Error ? err.message : "生成失败",
      });
    } finally {
      setGenerating(false);
    }
  }

  async function confirmDeleteScript() {
    if (!deleting) return;
    try {
      const res = await fetch(
        `/api/video/projects/${projectId}/scripts/${deleting.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "删除失败");
      }
      const removedId = deleting.id;
      setDeleting(null);
      await refresh();
      setSelectedId((cur) => (cur === removedId ? null : cur));
      toast.add({ type: "success", title: "脚本已删除" });
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : "删除失败" });
    }
  }

  const selected = data?.scripts.find((s) => s.id === selectedId) ?? null;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded-lg border bg-white" />
        <div className="h-32 animate-pulse rounded-xl border bg-white" />
        <div className="h-96 animate-pulse rounded-xl border bg-white" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Clapperboard size={32} className="mb-3 text-gray-300" />
        <p className="text-sm text-gray-500">项目不存在或加载失败</p>
        <Link href="/video" className="mt-3 text-xs text-blue-600 hover:underline">
          返回项目列表
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 页头 */}
      <div className="flex items-center gap-3">
        <Link
          href="/video"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <ArrowLeft size={13} /> 返回
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-gray-800">{data.project.name}</h1>
          {data.project.positioning && (
            <p className="truncate text-xs text-gray-400">{data.project.positioning}</p>
          )}
        </div>
      </div>

      {/* 生成新脚本 */}
      <div className="space-y-3 rounded-xl border bg-white p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <Sparkles size={14} className="text-blue-500" /> 生成新脚本
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full space-y-1.5 sm:w-44">
            <Label>内容赛道</Label>
            <Select value={track} onValueChange={(v: string | null) => setTrack(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="选择赛道" />
              </SelectTrigger>
              <SelectContent>
                {TRACKS.map((t) => (
                  <SelectItem key={t.code} value={t.code}>
                    {t.emoji} {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1.5">
            <Label>视频选题</Label>
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder="这条视频想讲什么？如：GPT-5 发布了，普通人怎么用它提升效率"
            />
          </div>
          <Button onClick={handleGenerate} disabled={generating} className="gap-1.5 sm:w-32">
            {generating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {generating ? "AI 写作中…" : "生成脚本"}
          </Button>
        </div>
        <p className="text-[11px] text-gray-400">
          生成约需 10-30 秒，产出 5 个爆款标题 + 60 秒口播稿 + 分镜表
        </p>
      </div>

      {/* 脚本列表 + 详情 */}
      {data.scripts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
          <Clapperboard size={32} className="mb-3 text-gray-300" />
          <p className="mb-1 text-sm text-gray-500">还没有脚本</p>
          <p className="text-xs text-gray-400">在上方输入选题，点「生成脚本」产出第一条</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
          <div className="space-y-2">
            {data.scripts.map((s) => (
              <div
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={cn(
                  "group cursor-pointer rounded-lg border bg-white p-3 transition-colors",
                  selectedId === s.id
                    ? "border-blue-400 ring-1 ring-blue-200"
                    : "hover:border-gray-300"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 flex-1 text-sm font-medium text-gray-700">
                    {s.topic}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleting({ id: s.id, topic: s.topic });
                    }}
                    className="hidden shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 group-hover:block"
                    title="删除脚本"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-gray-400">
                  {trackEmoji(s.track)} {trackName(s.track)} · {formatDate(s.createdAt)}
                </p>
              </div>
            ))}
          </div>
          <div>
            {selected ? (
              <ScriptDetail script={selected} />
            ) : (
              <div className="flex items-center justify-center rounded-xl border border-dashed py-16 text-sm text-gray-400">
                在左侧选择一个脚本查看详情
              </div>
            )}
          </div>
        </div>
      )}

      {/* 删除脚本确认 */}
      <Dialog
        open={deleting !== null}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>删除脚本</DialogTitle>
            <DialogDescription>
              确定删除选题「{deleting?.topic}」的脚本吗？删除后无法恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDeleteScript}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 4: 类型检查 + lint 验证**

Run:
```bash
cd /jlm/cc-workspace/HugoAI/code/front
npx tsc --noEmit
npm run lint
```
Expected: tsc 无输出；lint 无 error（warning 可接受）

- [ ] **Step 5: Commit**

```bash
cd /jlm/cc-workspace/HugoAI
git add "code/front/src/app/(dashboard)/video/[id]/page.tsx" code/front/src/components/video/VideoWorkspace.tsx code/front/src/components/video/ScriptDetail.tsx
git commit -m "feat(video): 脚本工作台页面（生成面板+脚本列表+详情展示）"
```

---

### Task 10: 端到端验证与收尾

**Files:** 无新增（纯验证 + 构建）

- [ ] **Step 1: 完整构建验证**

Run: `cd /jlm/cc-workspace/HugoAI/code/front && npm run build`
Expected: 构建成功，`/video` 与 `/video/[id]` 出现在路由列表中

- [ ] **Step 2: 启动 dev server（若未运行）**

```bash
cd /jlm/cc-workspace/HugoAI/code/front
npm run dev    # 端口 18867；如已在运行则跳过本步
```

- [ ] **Step 3: API 冒烟测试（curl 全流程）**

```bash
BASE=http://localhost:18867

# 1) 登录（密码见 prisma/seed.ts 的 SUPERADMIN_PASSWORD）
curl -s -c /tmp/hugoai-cookies.txt -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Jlm2026.Hugo.com@1qaz"}'
# Expected: {"user":{"username":"superadmin",...}}

# 2) 创建项目
curl -s -b /tmp/hugoai-cookies.txt -X POST $BASE/api/video/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"冒烟测试项目","positioning":"面向小白的 AI 资讯解读"}'
# Expected: {"project":{"id":"<PROJECT_ID>"}} —— 记下这个 id

# 3) 列表
curl -s -b /tmp/hugoai-cookies.txt $BASE/api/video/projects
# Expected: projects 数组含刚建项目，scriptCount=0

# 4) AI 生成脚本（真实调用通义千问，需 .env.local 里 AI_API_KEY 有效）
curl -s -b /tmp/hugoai-cookies.txt -X POST $BASE/api/video/projects/<PROJECT_ID>/scripts \
  -H "Content-Type: application/json" \
  -d '{"track":"ai-news","topic":"新手如何开始学习 AI"}'
# Expected: 201，返回 script：titles 为 5 条、narration 非空（约200-260字）、
#           shots 为 6-12 条且每条有 visual/line/duration

# 5) 工作台数据
curl -s -b /tmp/hugoai-cookies.txt $BASE/api/video/projects/<PROJECT_ID>
# Expected: scripts 数组含刚生成脚本（含 shots）

# 6) 参数校验
curl -s -b /tmp/hugoai-cookies.txt -X POST $BASE/api/video/projects/<PROJECT_ID>/scripts \
  -H "Content-Type: application/json" -d '{"track":"bad-track","topic":"x"}'
# Expected: 400 {"error":"请选择有效的内容赛道"}

# 7) 清理：删脚本、删项目
curl -s -b /tmp/hugoai-cookies.txt -X DELETE $BASE/api/video/projects/<PROJECT_ID>/scripts/<SCRIPT_ID>
curl -s -b /tmp/hugoai-cookies.txt -X DELETE $BASE/api/video/projects/<PROJECT_ID>
# Expected: 均返回 {"success":true}
```

- [ ] **Step 4: 浏览器 UI 走查**

访问 `http://localhost:18867/video`（先登录）：
1. 空态显示「还没有项目」，点「新建项目」→ 填写后跳转工作台
2. 选赛道、填选题、点「生成脚本」→ 按钮进入「AI 写作中…」，约 10-30 秒后左侧出现脚本卡片并自动选中
3. 右侧详情：5 个标题 chips（首个蓝色）、口播稿（字数/估时正确）、分镜表（镜头数与总秒数合理）
4. 点「复制口播稿」出 toast；删除脚本出确认框并可正常删除
5. 返回项目列表，卡片显示「N 个脚本」；编辑/删除项目正常

- [ ] **Step 5: 清理冒烟数据并 Commit（如有收尾改动）**

若验证中发现并修复了问题，提交修复：
```bash
cd /jlm/cc-workspace/HugoAI
git add <相关文件>
git commit -m "fix(video): <修复内容>"
```
若无改动则跳过。

---

## 阶段 2+ 预告（不在本计划范围内）

- 阶段 2：CosyVoice/Edge-TTS 配音 + 按句对齐 SRT 字幕（`VideoScript` 加 `audioUrl`/`srt` 字段）
- 阶段 3：Pexels 素材库（`VideoShot` 加 `materialUrl`）
- 阶段 4：pyJianYingDraft 剪映草稿导出
- 阶段 5：发布记录与数据看板

## 自查记录（Self-Review）

- 规格覆盖：方案第七节 MVP =「脚本工坊 + 配音」，本计划完整覆盖脚本工坊（模型/API/前端全链路）；配音属于阶段 2，单独出计划（两个子系统独立交付，符合 scope 要求）。
- 无占位符：所有代码步骤均给出完整代码；验证步骤给出具体命令与预期输出。
- 类型一致性：`serializeScript`/`VideoScriptItem`/`VideoWorkspaceData` 在 Task 3-9 中字段名一致（`titles`/`title`/`narration`/`shots`）；路由路径 `api/video/projects/[id]/scripts/[scriptId]` 前后端一致。
- 与既有代码对齐：守卫模式、判别联合错误返回、`params: Promise` 用法、toast/Dialog/Select 组件用法均复刻自 novel 模块。
