# 短视频模块阶段3「Pexels 素材库」实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为分镜配真实视频素材：AI 生成脚本时预生成每个镜头的英文搜索词（materialQuery），分镜表加「素材」列，弹框内用关键词搜 Pexels（服务端代理）、缩略图网格挑选/预览/确认，选定素材以链接存库。

**Architecture:** 复用既有模式——Prisma 加字段、Route Handlers、客户端组件。新增 Pexels 搜索代理服务（API key 只存服务端 `.env.local`）；素材只存 URL 不落本地（阶段4 导出时再下载）。

**Tech Stack:** Next.js 16 App Router（`params` 是 Promise）、TypeScript、Prisma 5 + PostgreSQL 16、Pexels Videos API（`GET https://api.pexels.com/v1/videos/search`，头 `Authorization: <key>`，限流 200 次/小时）、Tailwind + shadcn/ui 风格组件。

**验证方式说明：** 本项目无测试框架，沿用「typecheck + lint + build + API 冒烟 + UI 走查」既定模式。注意：**素材搜索冒烟依赖用户提供 `PEXELS_API_KEY`**（.env.local）；若无 key，验证 503 分支与其余逻辑，真实搜索留待 key 就位。

**重要环境事项（踩坑记录，务必遵守）：**
1. prisma 命令前必须 `set -a && source .env.local && set +a`。
2. `prisma migrate dev` 需伪终端：`printf 'y\n' | script -qec "npx prisma migrate dev --name xxx" /dev/null | tr -d '\r' | tail -8`。
3. Prisma Client 重新生成后必须重启 dev server。
4. 绝不提交 `.env*`；`PEXELS_API_KEY` 由用户配置。
5. 在 `code/front` 目录执行 git 时记得用 `git -C /jlm/cc-workspace/HugoAI` 或先切到仓库根。

**设计文档：** `docs/superpowers/specs/2026-08-05-video-phase3-pexels-materials-design.md`

---

## 文件结构概览

```
HugoAI/
├── code/backend/prisma/
│   └── schema.prisma                                  # VideoShot 加 materialQuery/materialUrl/materialThumb
├── code/front/src/
│   ├── services/video/
│   │   ├── types.ts                                   # VideoShotItem 加素材三字段
│   │   ├── serialize.ts                               # serializeShot 附带素材字段
│   │   ├── prompts.ts                                 # shots JSON 加 materialQuery 要求
│   │   ├── ai.ts                                      # generateScript 解析 materialQuery
│   │   └── pexels.ts                                  # 新增：Pexels 搜索服务（含错误类型）
│   ├── app/api/video/
│   │   ├── materials/search/route.ts                  # 新增：搜索代理 GET
│   │   └── projects/[id]/scripts/
│   │       ├── route.ts                               # 修改：create shots 带 materialQuery
│   │       └── [scriptId]/shots/[shotId]/route.ts     # 新增：PATCH 更新分镜素材
│   └── components/video/
│       ├── MaterialPicker.tsx                         # 新增：素材选择对话框
│       └── ScriptDetail.tsx                           # 修改：分镜表素材列 + 弹框接线
└── docs/superpowers/plans/
    └── 2026-08-05-video-phase3-pexels-materials.md    # 本文件
```

---

### Task 1: Prisma 数据模型（VideoShot 素材字段）

**Files:**
- Modify: `code/backend/prisma/schema.prisma`
- Migration: `code/backend/prisma/migrations/<timestamp>_video_shot_material/`

- [ ] **Step 1: VideoShot 加三个可空字段**

`model VideoShot` 中 `duration  Int      @default(3)` 之后加：

```prisma
  materialQuery String?
  materialUrl   String?
  materialThumb String?
```

- [ ] **Step 2: 生成并应用迁移**

```bash
cd /jlm/cc-workspace/HugoAI/code/front
set -a && source .env.local && set +a
printf 'y\n' | script -qec "npx prisma migrate dev --name video_shot_material" /dev/null | tr -d '\r' | tail -8
```

Expected: `migrations/*_video_shot_material/` 应用成功，client 重新生成。

- [ ] **Step 3: Commit**

```bash
git -C /jlm/cc-workspace/HugoAI add code/backend/prisma/schema.prisma code/backend/prisma/migrations
git -C /jlm/cc-workspace/HugoAI commit -m "feat(video): VideoShot 新增素材字段 materialQuery/materialUrl/materialThumb"
```

---

### Task 2: 类型与序列化（素材三字段）

**Files:**
- Modify: `code/front/src/services/video/types.ts`
- Modify: `code/front/src/services/video/serialize.ts`

- [ ] **Step 1: types.ts 的 VideoShotItem 加字段**

`VideoShotItem` 接口 `duration: number;` 之后加：

```ts
  /** AI 预生成的英文素材搜索词（旧脚本为 null） */
  materialQuery: string | null;
  /** 选定素材的视频直链（未选为 null） */
  materialUrl: string | null;
  /** 素材缩略图链接（未选为 null） */
  materialThumb: string | null;
```

- [ ] **Step 2: serialize.ts 附带素材字段**

`serializeShot` 的参数类型中 `duration: number;` 之后加：

```ts
  materialQuery: string | null;
  materialUrl: string | null;
  materialThumb: string | null;
```

返回对象 `duration: shot.duration,` 之后加：

```ts
    materialQuery: shot.materialQuery,
    materialUrl: shot.materialUrl,
    materialThumb: shot.materialThumb,
```

- [ ] **Step 3: 类型检查 + Commit**

```bash
cd /jlm/cc-workspace/HugoAI/code/front && npx tsc --noEmit
```
Expected: 无输出

```bash
git -C /jlm/cc-workspace/HugoAI add code/front/src/services/video/types.ts code/front/src/services/video/serialize.ts
git -C /jlm/cc-workspace/HugoAI commit -m "feat(video): 分镜素材字段类型与序列化"
```

---

### Task 3: 生成链路接入 materialQuery

**Files:**
- Modify: `code/front/src/services/video/prompts.ts`
- Modify: `code/front/src/services/video/ai.ts`
- Modify: `code/front/src/app/api/video/projects/[id]/scripts/route.ts`

- [ ] **Step 1: prompts.ts 加 materialQuery 要求**

1. shots JSON 示例行从：

```
    { "visual": "画面描述：这个镜头应出现什么画面/素材，要具体到可以直接搜索或生成", "line": "该镜头对应的口播台词", "duration": 5 }
```

改为：

```
    { "visual": "画面描述：这个镜头应出现什么画面/素材，要具体到可以直接搜索或生成", "line": "该镜头对应的口播台词", "duration": 5, "materialQuery": "2-4个英文搜索关键词" }
```

2. 「要求」列表中 `- 每个 shot 的 duration 为 3-8 秒的整数，总和接近口播时长` 之后加一行：

```
- 每个 shot 的 materialQuery 为 2-4 个英文关键词，能直接用于免版权素材库（如 Pexels）搜到该画面，简洁具体（如 city night timelapse），不要长句
```

- [ ] **Step 2: ai.ts 解析 materialQuery**

1. `GeneratedScript` 接口的 shots 类型从：

```ts
  shots: Array<{ visual: string; line: string; duration: number }>;
```

改为：

```ts
  shots: Array<{ visual: string; line: string; duration: number; materialQuery: string | null }>;
```

2. shots 解析的 map 回调参数与返回值：

```ts
    ? parsed.shots.slice(0, 30).map((s: { visual?: unknown; line?: unknown; duration?: unknown; materialQuery?: unknown }) => ({
        visual: str(s?.visual).trim(),
        line: str(s?.line).trim(),
        duration: clampDuration(s?.duration),
        materialQuery: str(s?.materialQuery).trim().slice(0, 80) || null,
      }))
```

- [ ] **Step 3: scripts/route.ts create 带上 materialQuery**

`code/front/src/app/api/video/projects/[id]/scripts/route.ts` 中 shots create 映射：

```ts
          create: generated.shots.map((s, i) => ({
            sort: i + 1,
            visual: s.visual,
            line: s.line,
            duration: s.duration,
          })),
```

改为：

```ts
          create: generated.shots.map((s, i) => ({
            sort: i + 1,
            visual: s.visual,
            line: s.line,
            duration: s.duration,
            materialQuery: s.materialQuery,
          })),
```

- [ ] **Step 4: 类型检查 + Commit**

```bash
cd /jlm/cc-workspace/HugoAI/code/front && npx tsc --noEmit
```
Expected: 无输出

```bash
git -C /jlm/cc-workspace/HugoAI add code/front/src/services/video/prompts.ts code/front/src/services/video/ai.ts "code/front/src/app/api/video/projects/[id]/scripts/route.ts"
git -C /jlm/cc-workspace/HugoAI commit -m "feat(video): AI 生成分镜时预生成素材搜索词 materialQuery"
```

---

### Task 4: Pexels 搜索服务（services/video/pexels.ts）

**Files:**
- Create: `code/front/src/services/video/pexels.ts`

- [ ] **Step 1: 创建 pexels.ts**

```ts
/**
 * Pexels 视频搜索服务：服务端代理，API key 只存在服务端环境变量。
 * 文档：https://www.pexels.com/api/documentation/
 */

export interface PexelsVideo {
  id: string;
  thumb: string;
  duration: number;
  files: Array<{ quality: string; width: number; height: number; link: string }>;
}

/** 带 HTTP 状态语义的错误，由路由映射为对应响应 */
export class PexelsError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

interface RawFile {
  quality?: string;
  width?: number;
  height?: number;
  link?: string;
  file_type?: string;
}

/** 每个视频最多保留 2 个文件：优先 hd 次选 sd（uhd 过大，不传给前端） */
function pickFiles(raw: RawFile[]): PexelsVideo["files"] {
  const vids = raw.filter((f) => (f.file_type ?? "video/mp4") === "video/mp4" && f.link);
  const hd = vids.find((f) => f.quality === "hd");
  const sd = vids.find((f) => f.quality === "sd");
  return [hd, sd]
    .filter((f): f is RawFile => Boolean(f))
    .map((f) => ({
      quality: f.quality ?? "sd",
      width: f.width ?? 0,
      height: f.height ?? 0,
      link: f.link as string,
    }));
}

export async function searchPexelsVideos(opts: {
  query: string;
  orientation: "portrait" | "landscape" | "square" | "all";
  page: number;
}): Promise<{ videos: PexelsVideo[]; nextPage: number | null }> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) {
    throw new PexelsError(503, "未配置 PEXELS_API_KEY，请在 .env.local 中添加");
  }

  const url = new URL("https://api.pexels.com/v1/videos/search");
  url.searchParams.set("query", opts.query);
  url.searchParams.set("per_page", "12");
  url.searchParams.set("size", "medium");
  url.searchParams.set("page", String(opts.page));
  if (opts.orientation !== "all") url.searchParams.set("orientation", opts.orientation);

  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: { Authorization: key },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new PexelsError(502, "素材获取失败，请稍后再试");
  }

  if (!resp.ok) {
    const message =
      resp.status === 429 ? "素材请求过于频繁（Pexels 限流），请稍后再试" : "素材获取失败，请稍后再试";
    throw new PexelsError(502, message);
  }

  const data = (await resp.json()) as {
    videos?: Array<{ id?: number; duration?: number; image?: string; video_files?: RawFile[] }>;
    next_page?: string | number | null;
  };

  const videos: PexelsVideo[] = (data.videos ?? [])
    .filter((v) => v.id !== undefined)
    .map((v) => ({
      id: String(v.id),
      thumb: v.image ?? "",
      duration: v.duration ?? 0,
      files: pickFiles(v.video_files ?? []),
    }));

  const next = Number(data.next_page);
  return { videos, nextPage: Number.isFinite(next) && next > opts.page ? next : null };
}
```

- [ ] **Step 2: 类型检查 + Commit**

```bash
cd /jlm/cc-workspace/HugoAI/code/front && npx tsc --noEmit
```
Expected: 无输出

```bash
git -C /jlm/cc-workspace/HugoAI add code/front/src/services/video/pexels.ts
git -C /jlm/cc-workspace/HugoAI commit -m "feat(video): Pexels 视频搜索服务（服务端代理+文件筛选）"
```

---

### Task 5: 素材搜索 API（GET materials/search）

**Files:**
- Create: `code/front/src/app/api/video/materials/search/route.ts`

- [ ] **Step 1: 创建 route.ts**

```ts
import { NextResponse } from "next/server";
import { requireVideoAccess } from "@/services/video/guard";
import { PexelsError, searchPexelsVideos } from "@/services/video/pexels";

const ORIENTATIONS = ["portrait", "landscape", "square", "all"] as const;

/** GET /api/video/materials/search — Pexels 视频搜索代理（key 不出服务端） */
export async function GET(request: Request) {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "请输入搜索关键词" }, { status: 400 });
  }
  if (query.length > 80) {
    return NextResponse.json({ error: "关键词不能超过 80 字" }, { status: 400 });
  }

  const orientation = searchParams.get("orientation") ?? "portrait";
  if (!ORIENTATIONS.includes(orientation as (typeof ORIENTATIONS)[number])) {
    return NextResponse.json({ error: "无效的画面方向" }, { status: 400 });
  }

  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  try {
    const result = await searchPexelsVideos({
      query,
      orientation: orientation as (typeof ORIENTATIONS)[number],
      page,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PexelsError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "素材获取失败，请稍后再试" }, { status: 502 });
  }
}
```

- [ ] **Step 2: 类型检查 + Commit**

```bash
cd /jlm/cc-workspace/HugoAI/code/front && npx tsc --noEmit
```
Expected: 无输出

```bash
git -C /jlm/cc-workspace/HugoAI add code/front/src/app/api/video/materials/search/route.ts
git -C /jlm/cc-workspace/HugoAI commit -m "feat(video): Pexels 素材搜索代理 API"
```

---

### Task 6: 分镜素材更新 API（PATCH shots/[shotId]）

**Files:**
- Create: `code/front/src/app/api/video/projects/[id]/scripts/[scriptId]/shots/[shotId]/route.ts`

- [ ] **Step 1: 创建 route.ts**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireVideoAccess } from "@/services/video/guard";
import { serializeShot } from "@/services/video/serialize";

/** PATCH /api/video/projects/[id]/scripts/[scriptId]/shots/[shotId] — 更新分镜素材/搜索词 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; scriptId: string; shotId: string }> }
) {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;
  const { id, scriptId, shotId } = await params;

  const shot = await prisma.videoShot.findFirst({
    where: { id: shotId, scriptId },
    select: { id: true, script: { select: { projectId: true, project: { select: { userId: true } } } } },
  });
  if (!shot || shot.script.project.userId !== check.userId || shot.script.projectId !== id) {
    return NextResponse.json({ error: "分镜不存在" }, { status: 404 });
  }

  let body: { materialUrl?: unknown; materialThumb?: unknown; materialQuery?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const data: { materialUrl?: string | null; materialThumb?: string | null; materialQuery?: string | null } = {};

  if (body.materialUrl !== undefined) {
    if (body.materialUrl === null) {
      data.materialUrl = null;
      data.materialThumb = null;
    } else if (typeof body.materialUrl === "string" && body.materialUrl.startsWith("https://")) {
      data.materialUrl = body.materialUrl.slice(0, 500);
    } else {
      return NextResponse.json({ error: "素材链接必须是 https 地址" }, { status: 400 });
    }
  }
  if (body.materialThumb !== undefined && data.materialUrl !== null) {
    if (body.materialThumb === null) {
      data.materialThumb = null;
    } else if (typeof body.materialThumb === "string" && body.materialThumb.startsWith("https://")) {
      data.materialThumb = body.materialThumb.slice(0, 500);
    } else {
      return NextResponse.json({ error: "缩略图链接必须是 https 地址" }, { status: 400 });
    }
  }
  if (body.materialQuery !== undefined) {
    if (body.materialQuery === null) {
      data.materialQuery = null;
    } else if (typeof body.materialQuery === "string") {
      data.materialQuery = body.materialQuery.trim().slice(0, 80);
    } else {
      return NextResponse.json({ error: "搜索词必须是字符串" }, { status: 400 });
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "没有可更新的字段" }, { status: 400 });
  }

  const updated = await prisma.videoShot.update({ where: { id: shotId }, data });
  return NextResponse.json({ shot: serializeShot(updated) });
}
```

- [ ] **Step 2: 类型检查 + Commit**

```bash
cd /jlm/cc-workspace/HugoAI/code/front && npx tsc --noEmit
```
Expected: 无输出

```bash
git -C /jlm/cc-workspace/HugoAI add "code/front/src/app/api/video/projects/[id]/scripts/[scriptId]/shots/[shotId]/route.ts"
git -C /jlm/cc-workspace/HugoAI commit -m "feat(video): 分镜素材更新 API（选择/清除/改搜索词）"
```

---

### Task 7: 素材选择对话框（MaterialPicker.tsx）

**Files:**
- Create: `code/front/src/components/video/MaterialPicker.tsx`

- [ ] **Step 1: 创建 MaterialPicker.tsx**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Clapperboard, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface MaterialVideo {
  id: string;
  thumb: string;
  duration: number;
  files: Array<{ quality: string; width: number; height: number; link: string }>;
}

const ORIENTATIONS = [
  { code: "portrait", name: "竖屏" },
  { code: "landscape", name: "横屏" },
  { code: "all", name: "全部" },
] as const;

interface Props {
  projectId: string;
  scriptId: string;
  shot: { id: string; sort: number; visual: string; materialQuery: string | null };
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function MaterialPicker({ projectId, scriptId, shot, open, onClose, onSaved }: Props) {
  const [query, setQuery] = useState("");
  const [orientation, setOrientation] = useState<string>("portrait");
  const [videos, setVideos] = useState<MaterialVideo[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [preview, setPreview] = useState<MaterialVideo | null>(null);
  const [saving, setSaving] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async (page: number, append: boolean, q: string, ori: string) => {
    if (!q.trim()) {
      toast.add({ type: "error", title: "请输入搜索关键词" });
      return;
    }
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await fetch(
        `/api/video/materials/search?query=${encodeURIComponent(q.trim())}&orientation=${ori}&page=${page}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "搜索失败");
      setVideos((prev) => (append ? [...prev, ...(json.videos ?? [])] : json.videos ?? []));
      setNextPage(json.nextPage ?? null);
      setPreview(null);
      setSearched(true);
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : "搜索失败" });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // 打开时重置状态；有 AI 预生成关键词则自动搜一次
  useEffect(() => {
    if (!open) return;
    setQuery(shot.materialQuery ?? "");
    setOrientation("portrait");
    setVideos([]);
    setPreview(null);
    setNextPage(null);
    setSearched(false);
    if (shot.materialQuery?.trim()) {
      void doSearch(1, false, shot.materialQuery, "portrait");
    }
  }, [open, shot.id, shot.materialQuery, doSearch]);

  async function confirmPick(video: MaterialVideo) {
    const file = video.files[0];
    if (!file) {
      toast.add({ type: "error", title: "该素材没有可用的视频文件" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/video/projects/${projectId}/scripts/${scriptId}/shots/${shot.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            materialUrl: file.link,
            materialThumb: video.thumb,
            materialQuery: query.trim() || null,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存失败");
      await onSaved();
      toast.add({ type: "success", title: "素材已选择" });
      onClose();
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : "保存失败" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>选择素材 — 镜头 #{shot.sort}</DialogTitle>
          <p className="line-clamp-1 text-xs text-gray-400">画面：{shot.visual}</p>
        </DialogHeader>

        <div className="space-y-3">
          {/* 搜索栏 */}
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void doSearch(1, false, query, orientation);
              }}
              placeholder="英文关键词，如 city night timelapse"
              maxLength={80}
              className="min-w-40 flex-1"
            />
            <div className="flex gap-1">
              {ORIENTATIONS.map((o) => (
                <button
                  key={o.code}
                  onClick={() => setOrientation(o.code)}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs",
                    orientation === o.code
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  {o.name}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              className="gap-1"
              disabled={loading}
              onClick={() => void doSearch(1, false, query, orientation)}
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              搜索
            </Button>
          </div>

          {/* 预览区 */}
          {preview && (
            <div className="space-y-2 rounded-lg border bg-gray-50 p-3">
              <video
                src={preview.files[0]?.link}
                controls
                autoPlay
                muted
                loop
                className="max-h-56 w-full rounded bg-black object-contain"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  {preview.duration} 秒 · {(preview.files[0]?.quality ?? "").toUpperCase()}
                </p>
                <Button size="sm" disabled={saving} onClick={() => confirmPick(preview)}>
                  {saving ? "保存中…" : "使用此素材"}
                </Button>
              </div>
            </div>
          )}

          {/* 结果区 */}
          {loading ? (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-md bg-gray-100" />
              ))}
            </div>
          ) : videos.length === 0 && searched ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Clapperboard size={28} className="mb-2 text-gray-300" />
              <p className="text-xs text-gray-400">没搜到素材，换个关键词试试</p>
            </div>
          ) : videos.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-xs text-gray-400">
              输入关键词点「搜索」（推荐用 AI 预生成的英文关键词）
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              <div className="grid grid-cols-3 gap-2">
                {videos.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setPreview(v)}
                    className={cn(
                      "relative overflow-hidden rounded-md border",
                      preview?.id === v.id
                        ? "border-blue-400 ring-1 ring-blue-200"
                        : "hover:border-gray-300"
                    )}
                  >
                    <img src={v.thumb} alt="" loading="lazy" className="h-28 w-full object-cover" />
                    <span className="absolute right-1 bottom-1 rounded bg-black/60 px-1 text-[10px] text-white">
                      {v.duration}s
                    </span>
                  </button>
                ))}
              </div>
              {nextPage && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  disabled={loadingMore}
                  onClick={() => void doSearch(nextPage, true, query, orientation)}
                >
                  {loadingMore ? "加载中…" : "加载更多"}
                </Button>
              )}
            </div>
          )}
        </div>

        <p className="text-right text-[10px] text-gray-400">
          素材来自{" "}
          <a
            href="https://www.pexels.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            Pexels ↗
          </a>
        </p>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: 类型检查 + Commit**

```bash
cd /jlm/cc-workspace/HugoAI/code/front && npx tsc --noEmit
```
Expected: 无输出

```bash
git -C /jlm/cc-workspace/HugoAI add code/front/src/components/video/MaterialPicker.tsx
git -C /jlm/cc-workspace/HugoAI commit -m "feat(video): 素材选择对话框（搜索/方向切换/网格/预览/加载更多）"
```

---

### Task 8: 分镜表素材列 + 弹框接线（ScriptDetail）

**Files:**
- Modify: `code/front/src/components/video/ScriptDetail.tsx`

- [ ] **Step 1: import 与状态**

1. import 修改：

```tsx
import { trackEmoji, trackName, type VideoScriptItem } from "@/services/video/types";
import { NarrationPanel } from "./NarrationPanel";
```

改为：

```tsx
import {
  trackEmoji,
  trackName,
  type VideoScriptItem,
  type VideoShotItem,
} from "@/services/video/types";
import { MaterialPicker } from "./MaterialPicker";
import { NarrationPanel } from "./NarrationPanel";
```

2. 组件内 `const totalDuration = ...` 之前加状态：

```tsx
  const [pickerShot, setPickerShot] = useState<VideoShotItem | null>(null);
```

3. 文件顶部补 react 导入（ScriptDetail 目前没用 react hooks）：

```tsx
import { useState } from "react";
```

- [ ] **Step 2: 素材移除函数**

`copy` 函数之后加：

```tsx
  async function removeMaterial(shotId: string) {
    try {
      const res = await fetch(
        `/api/video/projects/${projectId}/scripts/${script.id}/shots/${shotId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ materialUrl: null }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "移除失败");
      await onChanged();
      toast.add({ type: "success", title: "素材已移除" });
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : "移除失败" });
    }
  }
```

- [ ] **Step 3: 分镜表加「素材」列**

表头行 `<th className="w-14 px-2 py-1.5 text-right font-medium">秒</th>` 之后加：

```tsx
                  <th className="w-16 px-2 py-1.5 text-left font-medium">素材</th>
```

表体行 `<td className="px-2 py-1.5 text-right text-gray-500">{s.duration}</td>` 之后加：

```tsx
                    <td className="px-2 py-1.5">
                      {s.materialUrl ? (
                        <div className="group/mat relative h-16 w-9">
                          <img
                            src={s.materialThumb ?? ""}
                            alt=""
                            className="h-16 w-9 rounded object-cover"
                          />
                          <div className="absolute inset-0 hidden flex-col items-center justify-center gap-0.5 rounded bg-black/50 group-hover/mat:flex">
                            <button
                              onClick={() => setPickerShot(s)}
                              className="text-[10px] text-white hover:underline"
                            >
                              换
                            </button>
                            <button
                              onClick={() => removeMaterial(s.id)}
                              className="text-[10px] text-white hover:underline"
                            >
                              移除
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPickerShot(s)}
                          className="rounded border border-dashed px-1.5 py-1 text-[11px] text-gray-400 hover:border-blue-300 hover:text-blue-500"
                        >
                          选素材
                        </button>
                      )}
                    </td>
```

- [ ] **Step 4: 渲染 MaterialPicker**

`<NarrationPanel projectId={projectId} script={script} onGenerated={onChanged} />` 之后、组件最外层 `</div>` 之前加：

```tsx
      {pickerShot && (
        <MaterialPicker
          projectId={projectId}
          scriptId={script.id}
          shot={pickerShot}
          open
          onClose={() => setPickerShot(null)}
          onSaved={onChanged}
        />
      )}
```

- [ ] **Step 5: 类型检查 + lint + Commit**

```bash
cd /jlm/cc-workspace/HugoAI/code/front && npx tsc --noEmit && npm run lint
```
Expected: tsc 无输出；lint 无 error

```bash
git -C /jlm/cc-workspace/HugoAI add code/front/src/components/video/ScriptDetail.tsx
git -C /jlm/cc-workspace/HugoAI commit -m "feat(video): 分镜表素材列与素材选择弹框接线"
```

---

### Task 9: 端到端验证与收尾

**Files:** 无新增

- [ ] **Step 1: 完整构建**

Run: `cd /jlm/cc-workspace/HugoAI/code/front && npm run build`
Expected: 成功；路由列表出现 `/api/video/materials/search` 与 `.../shots/[shotId]`

- [ ] **Step 2: 重启 dev server（加载新 Prisma Client）**

```bash
pkill -f "[n]ext dev" 2>/dev/null; sleep 2
cd /jlm/cc-workspace/HugoAI/code/front && rm -f /tmp/hugoai-dev.log && (npm run dev > /tmp/hugoai-dev.log 2>&1 &)
for i in $(seq 1 60); do code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:18867/login); [ "$code" = "200" ] && break; sleep 2; done; echo "login page: $code"
```

Expected: `login page: 200`

- [ ] **Step 3: 检查 PEXELS_API_KEY 是否就位**

```bash
grep -q "^PEXELS_API_KEY=" /jlm/cc-workspace/HugoAI/code/front/.env.local && echo "KEY-READY" || echo "KEY-MISSING"
```

- KEY-READY → 执行 Step 4 全部
- KEY-MISSING → 只做 Step 4 的 1)、6)、7)（无 key 分支），其余留给 key 就位后；并提醒用户申请

- [ ] **Step 4: API 冒烟**

```bash
BASE=http://localhost:18867
curl -s -c /tmp/hugoai-cookies.txt -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Jlm2026.Hugo.com@1qaz"}' > /dev/null

# 1) 参数校验与鉴权（不依赖 key）
curl -s -w " [%{http_code}]\n" -b /tmp/hugoai-cookies.txt "$BASE/api/video/materials/search"
# Expected: {"error":"请输入搜索关键词"} [400]
curl -s -w " [%{http_code}]\n" -b /tmp/hugoai-cookies.txt "$BASE/api/video/materials/search?query=city&orientation=bad"
# Expected: {"error":"无效的画面方向"} [400]
curl -s -o /dev/null -w "no-cookie search: %{http_code}\n" "$BASE/api/video/materials/search?query=city"
# Expected: 307（Proxy 拦截跳登录）

# 2) 真实搜索（需 KEY-READY；无 key 时应返回 503 提示文案）
curl -s -w "\nHTTP=%{http_code}\n" -b /tmp/hugoai-cookies.txt \
  "$BASE/api/video/materials/search?query=city%20night&orientation=portrait" | head -c 600
# KEY-READY Expected: HTTP=200，videos 数组非空，每项含 thumb/duration/files（quality 为 hd/sd）
# KEY-MISSING Expected: HTTP=503 {"error":"未配置 PEXELS_API_KEY..."}

# 3) orientation=all 与翻页
curl -s -b /tmp/hugoai-cookies.txt "$BASE/api/video/materials/search?query=ocean&orientation=all&page=1" | \
  python3 -c "import json,sys; d=json.load(sys.stdin); print('videos:',len(d.get('videos',[])),'nextPage:',d.get('nextPage'))"

# 4) 生成带 materialQuery 的脚本（真实 AI 调用约 2 分钟）
PROJECT_ID=$(curl -s -b /tmp/hugoai-cookies.txt -X POST $BASE/api/video/projects -H "Content-Type: application/json" \
  -d '{"name":"素材冒烟测试"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['project']['id'])")
SCRIPT_ID=$(curl -s -m 240 -b /tmp/hugoai-cookies.txt -X POST $BASE/api/video/projects/$PROJECT_ID/scripts \
  -H "Content-Type: application/json" -d '{"track":"general","topic":"新手如何开始学习 AI"}' | \
  python3 -c "import json,sys; print(json.load(sys.stdin)['script']['id'])")
curl -s -b /tmp/hugoai-cookies.txt $BASE/api/video/projects/$PROJECT_ID | \
  python3 -c "
import json,sys
s=json.load(sys.stdin)['scripts'][0]
qs=[(x['sort'], x['materialQuery']) for x in s['shots']]
print(qs)
assert all(q for _,q in qs), '存在空 materialQuery'
print('materialQuery all present, shots:', len(qs))
"

# 5) PATCH 选素材/清素材往返（拿搜索结果第一条的 link/thumb）
SHOT_ID=$(curl -s -b /tmp/hugoai-cookies.txt $BASE/api/video/projects/$PROJECT_ID | \
  python3 -c "import json,sys; print(json.load(sys.stdin)['scripts'][0]['shots'][0]['id'])")
FIRST=$(curl -s -b /tmp/hugoai-cookies.txt "$BASE/api/video/materials/search?query=city%20night" | \
  python3 -c "import json,sys; v=json.load(sys.stdin)['videos'][0]; print(v['files'][0]['link'], v['thumb'])")
LINK=$(echo $FIRST | cut -d' ' -f1); THUMB=$(echo $FIRST | cut -d' ' -f2)
curl -s -w "\n[%{http_code}]\n" -b /tmp/hugoai-cookies.txt -X PATCH \
  $BASE/api/video/projects/$PROJECT_ID/scripts/$SCRIPT_ID/shots/$SHOT_ID \
  -H "Content-Type: application/json" \
  -d '{"materialUrl":"'$LINK'","materialThumb":"'$THUMB'","materialQuery":"city night"}'
# Expected: 200，shot.materialUrl/materialThumb 非空
curl -s -b /tmp/hugoai-cookies.txt -X PATCH \
  $BASE/api/video/projects/$PROJECT_ID/scripts/$SCRIPT_ID/shots/$SHOT_ID \
  -H "Content-Type: application/json" -d '{"materialUrl":"http://insecure.example/x.mp4"}' -w " [%{http_code}]\n"
# Expected: {"error":"素材链接必须是 https 地址"} [400]
curl -s -b /tmp/hugoai-cookies.txt -X PATCH \
  $BASE/api/video/projects/$PROJECT_ID/scripts/$SCRIPT_ID/shots/$SHOT_ID \
  -H "Content-Type: application/json" -d '{"materialUrl":null}' | \
  python3 -c "import json,sys; s=json.load(sys.stdin)['shot']; print('cleared:', s['materialUrl'] is None and s['materialThumb'] is None)"
# Expected: cleared: True

# 6) 清理：删项目
curl -s -b /tmp/hugoai-cookies.txt -X DELETE $BASE/api/video/projects/$PROJECT_ID
# Expected: {"success":true}
```

- [ ] **Step 5: UI 走查（需 KEY-READY；无 key 时只验证状态文案）**

访问 `/video`（先登录）：
1. 进有脚本的项目 → 分镜表出现「素材」列，未选项显示「选素材」虚线按钮
2. 点「选素材」→ 弹框打开，自动用 AI 预生成的英文词搜索（KEY-READY 时出现缩略图网格+时长角标）
3. 点缩略图 → 出现预览播放器（静音自动播放）→ 点「使用此素材」→ 表格该行出现竖版缩略图
4. hover 缩略图出现「换/移除」；「移除」后恢复「选素材」按钮
5. 手改关键词 + 切「横屏/全部」重搜正常；「加载更多」追加结果
6. 弹框底部有「素材来自 Pexels ↗」署名链接
7. 无 key 时：搜索出 toast 提示「未配置 PEXELS_API_KEY…」，页面不崩

- [ ] **Step 6: 收尾提交（如有修复）**

```bash
cd /jlm/cc-workspace/HugoAI
git add <相关文件>
git commit -m "fix(video): <修复内容>"
```

---

## 阶段 4+ 预告（不在本计划范围内）

- 阶段 4：pyJianYingDraft 剪映草稿导出（届时按需下载素材到本地，配音+SRT+素材对轨）
- 阶段 5：发布记录与数据看板

## 自查记录（Self-Review）

- 规格覆盖：设计文档 6 节逐一对应——数据模型→T1，生成链路→T2/T3，搜索服务与 API→T4/T5，PATCH→T6，前端弹框与素材列→T7/T8，验证→T9；署名要求落在 MaterialPicker 底部。
- 无占位符：所有代码步骤给出完整代码与精确插入位置。
- 类型一致性：`materialQuery/materialUrl/materialThumb` 在 schema（T1）/types+serialize（T2）/ai+prompt+route（T3）/PATCH（T6）/MaterialPicker+ScriptDetail（T7/T8）各处命名与可空语义一致；`PexelsVideo/PexelsError` 在 pexels.ts 定义、search route 引用。
- 与既有代码对齐：守卫判别联合、`params: Promise`、toast/Dialog/Select 用法均复刻现有 video 组件。
