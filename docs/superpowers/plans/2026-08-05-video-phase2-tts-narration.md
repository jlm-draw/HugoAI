# 短视频模块阶段2「TTS 配音 + 按句对齐 SRT 字幕」实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为脚本工坊的口播稿生成 TTS 配音（Edge-TTS，音色可选）与按句对齐的 SRT 字幕：脚本详情页提供「生成配音」按钮、音频播放器、随播放高亮滚动的字幕列表、mp3/srt 下载与重新生成。

**Architecture:** 复用阶段1成熟模式——同步请求（无任务队列）、`services/video/` 服务层、Next.js Route Handlers。新增 `TtsProvider` 抽象层（当前唯一实现 `EdgeTtsProvider`，基于 `msedge-tts` 的句子边界时间戳，日后接 CosyVoice 只加适配器）；整段口播稿一次合成，产出单个 mp3 存 `storage/audio/`（仓库根目录，已被 .gitignore 忽略），SRT 文本直接存库；音频经带鉴权的 Route Handler 下发。

**Tech Stack:** Next.js 16 App Router（`params` 是 Promise，见 `node_modules/next/dist/docs/`）、TypeScript、Prisma 5 + PostgreSQL 16、`msedge-tts@2.0.7`（已实测端点连通）、Tailwind + shadcn/ui 风格组件、Node v24。

**验证方式说明：** 本项目没有安装任何测试框架（无 vitest/jest），既有计划文档均以「typecheck + lint + build + 手动/API 冒烟验证」作为验证手段，本计划沿用该既定模式。

**重要环境事项（踩坑记录，务必遵守）：**
1. **Prisma CLI 不读 `.env.local`**：执行任何 prisma 命令前必须先加载：`set -a && source .env.local && set +a`。
2. **`prisma migrate dev` 需伪终端 + 自动确认**：`printf 'y\n' | script -qec "npx prisma migrate dev --name xxx" /dev/null | tr -d '\r' | tail -8`。
3. **Prisma Client 重新生成后，必须重启 dev server** 才能加载新模型。
4. **绝不提交 `.env*` 文件**（项目铁律）。提交时只 add 计划列出的文件。
5. 音频存储目录为**仓库根目录** `storage/audio/`（根 `.gitignore` 已有 `storage/*` + `!storage/.gitkeep` 规则）。Next.js 进程 cwd 是 `code/front`，故代码里用 `path.join(process.cwd(), "..", "..", "storage", "audio")` 定位。
6. Edge-TTS 是免费非官方服务，`msedge-tts` 库内部已处理 Edge UA 要求（2025-12 起的变更），服务端调用无需额外处理。

**设计文档：** `docs/superpowers/specs/2026-08-05-video-phase2-tts-design.md`

---

## 文件结构概览

```
HugoAI/
├── storage/
│   └── .gitkeep                                       # 新增：音频目录占位（storage/* 已被忽略）
├── code/backend/prisma/
│   └── schema.prisma                                  # 修改：VideoScript 加 voice/audioUrl/srt
├── code/front/
│   ├── package.json / package-lock.json               # 修改：新增依赖 msedge-tts
│   └── src/
│       ├── services/video/
│       │   ├── types.ts                               # 修改：VOICES 常量 + VideoScriptItem 加配音字段
│       │   ├── serialize.ts                           # 修改：序列化附带 voice/audioUrl/srt
│       │   ├── tts.ts                                 # 新增：TtsProvider 抽象 + EdgeTtsProvider + toSrt
│       │   └── audio-store.ts                         # 新增：音频文件读写/路径/删除
│       ├── app/api/video/projects/[id]/scripts/[scriptId]/
│       │   ├── route.ts                               # 修改：DELETE 后清理音频文件
│       │   ├── narration/route.ts                     # 新增：POST 生成配音
│       │   └── audio/route.ts                         # 新增：GET 下发 mp3（带鉴权）
│       └── components/video/
│           ├── NarrationPanel.tsx                     # 新增：音色选择+生成按钮+播放器+同步字幕
│           ├── ScriptDetail.tsx                       # 修改：接入 NarrationPanel
│           └── VideoWorkspace.tsx                     # 修改：向 ScriptDetail 传 projectId 与 refresh
└── docs/superpowers/plans/
    └── 2026-08-05-video-phase2-tts-narration.md       # 本文件
```

---

### Task 1: 安装 msedge-tts 依赖

**Files:**
- Modify: `code/front/package.json`、`code/front/package-lock.json`（npm 自动）

- [ ] **Step 1: 安装依赖**

```bash
cd /jlm/cc-workspace/HugoAI/code/front && npm install msedge-tts@2.0.7
```

Expected: `added N packages`；`package.json` 的 dependencies 出现 `"msedge-tts": "2.0.7"`（或 `^2.0.7`）。

- [ ] **Step 2: Commit**

```bash
cd /jlm/cc-workspace/HugoAI
git add code/front/package.json code/front/package-lock.json
git commit -m "chore(video): 引入 msedge-tts 依赖（阶段2配音）"
```

---

### Task 2: Prisma 数据模型（VideoScript 加配音字段）

**Files:**
- Modify: `code/backend/prisma/schema.prisma`
- Migration: `code/backend/prisma/migrations/<timestamp>_video_script_audio/`（自动生成）

- [ ] **Step 1: VideoScript 加三个可空字段**

在 `code/backend/prisma/schema.prisma` 的 `model VideoScript` 中，`newsId    String?` 一行之后加：

```prisma
  voice    String?
  audioUrl String?
  srt      String?
```

字段说明（供理解，非代码）：
- `voice`：配音使用的音色 id（如 `zh-CN-YunxiNeural`），重新生成时默认沿用
- `audioUrl`：音频访问路径（带鉴权的 API 相对路径）；null 表示未配音
- `srt`：SRT 字幕文本（约 2-4KB，直接存库不落文件）

- [ ] **Step 2: 生成并应用迁移**

```bash
cd /jlm/cc-workspace/HugoAI/code/front
set -a && source .env.local && set +a
printf 'y\n' | script -qec "npx prisma migrate dev --name video_script_audio" /dev/null | tr -d '\r' | tail -8
```

Expected:
- `Generated Prisma Client`
- `migrations/*_video_script_audio/` 创建并应用
- `Your database is now in sync with your schema.`

> 若报 `P1012 Environment variable not found: DATABASE_URL`，说明 source 没生效，重新执行 Step 2 开头两行再跑。

- [ ] **Step 3: Commit**

```bash
cd /jlm/cc-workspace/HugoAI
git add code/backend/prisma/schema.prisma code/backend/prisma/migrations
git commit -m "feat(video): VideoScript 新增配音字段 voice/audioUrl/srt"
```

---

### Task 3: 音色常量与类型/序列化接线

**Files:**
- Modify: `code/front/src/services/video/types.ts`
- Modify: `code/front/src/services/video/serialize.ts`

- [ ] **Step 1: types.ts 加 VOICES 常量**

在 `code/front/src/services/video/types.ts` 中，`trackEmoji` 函数之后、`/** 单个分镜 */` 之前插入：

```ts
/** 可选配音音色（Microsoft Edge TTS 中文音色） */
export const VOICES = [
  { id: "zh-CN-XiaoxiaoNeural", name: "晓晓", gender: "女", style: "温暖亲切" },
  { id: "zh-CN-XiaoyiNeural", name: "晓伊", gender: "女", style: "活泼明快" },
  { id: "zh-CN-YunxiNeural", name: "云希", gender: "男", style: "年轻阳光" },
  { id: "zh-CN-YunjianNeural", name: "云健", gender: "男", style: "沉稳解说" },
  { id: "zh-CN-YunyangNeural", name: "云扬", gender: "男", style: "新闻专业" },
] as const;

export const DEFAULT_VOICE = "zh-CN-YunxiNeural";
```

- [ ] **Step 2: types.ts 的 VideoScriptItem 加配音字段**

`VideoScriptItem` 接口中 `news: { title: string; url: string; source: string } | null;` 之后加：

```ts
  /** 配音音色 id（未配音为 null） */
  voice: string | null;
  /** 音频访问路径（未配音为 null） */
  audioUrl: string | null;
  /** SRT 字幕文本（未配音为 null） */
  srt: string | null;
```

- [ ] **Step 3: serialize.ts 附带配音字段**

`code/front/src/services/video/serialize.ts` 的 `serializeScript` 返回对象中，`news: ...` 之后加：

```ts
    voice: script.voice,
    audioUrl: script.audioUrl,
    srt: script.srt,
```

（`ScriptWithShots` 类型基于 `Prisma.VideoScriptGetPayload`，字段自动带出，无需改。）

- [ ] **Step 4: 类型检查验证**

Run: `cd /jlm/cc-workspace/HugoAI/code/front && npx tsc --noEmit`
Expected: 无输出（无类型错误）

- [ ] **Step 5: Commit**

```bash
cd /jlm/cc-workspace/HugoAI
git add code/front/src/services/video/types.ts code/front/src/services/video/serialize.ts
git commit -m "feat(video): 音色常量与配音字段类型/序列化"
```

---

### Task 4: TTS 服务层（services/video/tts.ts）

**Files:**
- Create: `code/front/src/services/video/tts.ts`

- [ ] **Step 1: 创建 tts.ts**

```ts
import { mkdtemp, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

/** 字幕句子：文本 + 起止毫秒时间戳 */
export interface TtsSentence {
  text: string;
  startMs: number;
  endMs: number;
}

/** 一次合成的产物：音频二进制 + 句子时间戳 */
export interface TtsResult {
  audio: Buffer;
  sentences: TtsSentence[];
}

/**
 * TTS 引擎抽象：日后接入 CosyVoice/其他引擎只需新增实现并在 getTtsProvider 切换。
 */
export interface TtsProvider {
  synthesize(text: string, voice: string): Promise<TtsResult>;
}

/** msedge-tts 元数据中的边界事件（只列用到的字段） */
interface EdgeBoundary {
  Type: string;
  Data?: {
    Offset: number; // 单位 100ns
    Duration: number; // 单位 100ns
    text?: { Text?: string };
  };
}

/** Edge-TTS 实现：整段合成 + 句子边界时间戳 */
export class EdgeTtsProvider implements TtsProvider {
  async synthesize(text: string, voice: string): Promise<TtsResult> {
    const tts = new MsEdgeTTS();
    const dir = await mkdtemp(path.join(os.tmpdir(), "hugoai-tts-"));
    try {
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {
        sentenceBoundaryEnabled: true,
      });
      const { audioFilePath, metadataFilePath } = await tts.toFile(dir, text);
      const audio = await readFile(audioFilePath);

      let sentences: TtsSentence[] = [];
      if (metadataFilePath) {
        try {
          const meta = JSON.parse(await readFile(metadataFilePath, "utf-8")) as {
            Metadata?: EdgeBoundary[];
          };
          sentences = (meta.Metadata ?? [])
            .filter((m) => m.Type === "SentenceBoundary" && m.Data)
            .map((m) => ({
              text: m.Data?.text?.Text?.trim() ?? "",
              startMs: Math.round((m.Data?.Offset ?? 0) / 10000),
              endMs: Math.round(((m.Data?.Offset ?? 0) + (m.Data?.Duration ?? 0)) / 10000),
            }))
            .filter((s) => s.text.length > 0);
        } catch {
          // 元数据缺失/解析异常：走下方单句降级
        }
      }

      // 降级：拿不到句子边界时，用估算时长产出整段单句字幕（保证音频仍可用）
      if (sentences.length === 0) {
        const estimatedMs = Math.max(1000, Math.round((text.length / 4.5) * 1000));
        sentences = [{ text, startMs: 0, endMs: estimatedMs }];
      }

      return { audio, sentences };
    } catch (err) {
      throw new Error(err instanceof Error ? `语音合成失败：${err.message}` : "语音合成失败，请重试");
    } finally {
      tts.close();
      await rm(dir, { recursive: true, force: true });
    }
  }
}

/** 当前 TTS 实现（未来接入 CosyVoice 时在此按配置切换） */
export function getTtsProvider(): TtsProvider {
  return new EdgeTtsProvider();
}

function pad(n: number, len: number): string {
  return String(n).padStart(len, "0");
}

/** 毫秒 → SRT 时间戳 `HH:MM:SS,mmm` */
export function srtTime(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const h = Math.floor(safe / 3600000);
  const m = Math.floor((safe % 3600000) / 60000);
  const s = Math.floor((safe % 60000) / 1000);
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(safe % 1000, 3)}`;
}

/** 句子时间戳 → 标准 SRT 文本（序号 + 时间轴 + 文本，块间空行） */
export function toSrt(sentences: TtsSentence[]): string {
  return sentences
    .map((s, i) => `${i + 1}\n${srtTime(s.startMs)} --> ${srtTime(s.endMs)}\n${s.text}\n`)
    .join("\n");
}
```

- [ ] **Step 2: 类型检查验证**

Run: `cd /jlm/cc-workspace/HugoAI/code/front && npx tsc --noEmit`
Expected: 无输出

- [ ] **Step 3: Commit**

```bash
cd /jlm/cc-workspace/HugoAI
git add code/front/src/services/video/tts.ts
git commit -m "feat(video): TTS 服务层（TtsProvider 抽象 + Edge-TTS 实现 + SRT 生成）"
```

---

### Task 5: 音频文件存储（services/video/audio-store.ts + storage 目录）

**Files:**
- Create: `code/front/src/services/video/audio-store.ts`
- Create: `storage/.gitkeep`

- [ ] **Step 1: 创建 audio-store.ts**

```ts
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

/**
 * 音频文件存储：仓库根目录 storage/audio/（根 .gitignore 已忽略 storage/*）。
 * Next.js 进程 cwd 为 code/front，故向上两级到仓库根。
 */
const AUDIO_DIR = path.join(process.cwd(), "..", "..", "storage", "audio");

/** 某脚本的音频文件绝对路径（<scriptId>.mp3） */
export function audioFilePath(scriptId: string): string {
  return path.join(AUDIO_DIR, `${scriptId}.mp3`);
}

/** 写入音频文件（目录不存在则创建，重新生成即覆盖），返回绝对路径 */
export async function saveAudio(scriptId: string, data: Buffer): Promise<string> {
  await mkdir(AUDIO_DIR, { recursive: true });
  const filePath = audioFilePath(scriptId);
  await writeFile(filePath, data);
  return filePath;
}

/** 删除音频文件；文件不存在或删除失败均静默（不影响主流程） */
export async function deleteAudio(scriptId: string): Promise<void> {
  try {
    await unlink(audioFilePath(scriptId));
  } catch {
    // best-effort
  }
}
```

- [ ] **Step 2: 创建 storage/.gitkeep**

```bash
mkdir -p /jlm/cc-workspace/HugoAI/storage && touch /jlm/cc-workspace/HugoAI/storage/.gitkeep
```

（根 `.gitignore` 已有 `storage/*` 与 `!storage/.gitkeep`，只有 .gitkeep 会入库。）

- [ ] **Step 3: 类型检查验证**

Run: `cd /jlm/cc-workspace/HugoAI/code/front && npx tsc --noEmit`
Expected: 无输出

- [ ] **Step 4: Commit**

```bash
cd /jlm/cc-workspace/HugoAI
git add code/front/src/services/video/audio-store.ts storage/.gitkeep
git commit -m "feat(video): 音频文件存储服务（storage/audio）"
```

---

### Task 6: 生成配音 API（POST narration）

**Files:**
- Create: `code/front/src/app/api/video/projects/[id]/scripts/[scriptId]/narration/route.ts`

- [ ] **Step 1: 创建 narration/route.ts**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireVideoAccess } from "@/services/video/guard";
import { saveAudio } from "@/services/video/audio-store";
import { getTtsProvider, toSrt } from "@/services/video/tts";
import { VOICES } from "@/services/video/types";

/** POST /api/video/projects/[id]/scripts/[scriptId]/narration — 生成 TTS 配音 + SRT 字幕（同步，约 10-30 秒） */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; scriptId: string }> }
) {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;
  const { id, scriptId } = await params;

  const script = await prisma.videoScript.findFirst({
    where: { id: scriptId, projectId: id },
    select: { id: true, narration: true, project: { select: { userId: true } } },
  });
  if (!script || script.project.userId !== check.userId) {
    return NextResponse.json({ error: "脚本不存在" }, { status: 404 });
  }

  let body: { voice?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const voice = typeof body.voice === "string" ? body.voice : "";
  if (!VOICES.some((v) => v.id === voice)) {
    return NextResponse.json({ error: "请选择有效的音色" }, { status: 400 });
  }
  if (!script.narration.trim()) {
    return NextResponse.json({ error: "该脚本没有口播稿，无法配音" }, { status: 400 });
  }

  try {
    const { audio, sentences } = await getTtsProvider().synthesize(script.narration, voice);
    await saveAudio(scriptId, audio);
    const srt = toSrt(sentences);
    const audioUrl = `/api/video/projects/${id}/scripts/${scriptId}/audio`;

    await prisma.videoScript.update({
      where: { id: scriptId },
      data: { voice, audioUrl, srt },
    });

    return NextResponse.json({ narration: { audioUrl, srt, voice } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "语音合成失败，请重试";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
```

- [ ] **Step 2: 类型检查验证**

Run: `cd /jlm/cc-workspace/HugoAI/code/front && npx tsc --noEmit`
Expected: 无输出

- [ ] **Step 3: Commit**

```bash
cd /jlm/cc-workspace/HugoAI
git add "code/front/src/app/api/video/projects/[id]/scripts/[scriptId]/narration/route.ts"
git commit -m "feat(video): 生成配音 API（TTS 合成+SRT+入库）"
```

---

### Task 7: 音频下发 API 与删除清理

**Files:**
- Create: `code/front/src/app/api/video/projects/[id]/scripts/[scriptId]/audio/route.ts`
- Modify: `code/front/src/app/api/video/projects/[id]/scripts/[scriptId]/route.ts`

- [ ] **Step 1: 创建 audio/route.ts**

```ts
import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireVideoAccess } from "@/services/video/guard";
import { audioFilePath } from "@/services/video/audio-store";

/** GET /api/video/projects/[id]/scripts/[scriptId]/audio — 下发配音 mp3（带鉴权） */
export async function GET(
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

  try {
    const data = await readFile(audioFilePath(scriptId));
    return new Response(data, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `inline; filename="${scriptId}.mp3"`,
        "Cache-Control": "private, max-age=0",
      },
    });
  } catch {
    return NextResponse.json({ error: "音频文件不存在，请重新生成配音" }, { status: 404 });
  }
}
```

- [ ] **Step 2: 脚本删除路由清理音频文件**

`code/front/src/app/api/video/projects/[id]/scripts/[scriptId]/route.ts`：

1. import 追加一行：

```ts
import { deleteAudio } from "@/services/video/audio-store";
```

2. `await prisma.videoScript.delete({ where: { id: scriptId } });` 之后、`return` 之前加：

```ts
  await deleteAudio(scriptId);
```

- [ ] **Step 3: 类型检查验证**

Run: `cd /jlm/cc-workspace/HugoAI/code/front && npx tsc --noEmit`
Expected: 无输出

- [ ] **Step 4: Commit**

```bash
cd /jlm/cc-workspace/HugoAI
git add "code/front/src/app/api/video/projects/[id]/scripts/[scriptId]/audio/route.ts" "code/front/src/app/api/video/projects/[id]/scripts/[scriptId]/route.ts"
git commit -m "feat(video): 音频鉴权下发接口；删除脚本时清理音频文件"
```

---

### Task 8: 配音面板组件（NarrationPanel.tsx）

**Files:**
- Create: `code/front/src/components/video/NarrationPanel.tsx`

- [ ] **Step 1: 创建 NarrationPanel.tsx**

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, Mic, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { DEFAULT_VOICE, VOICES, type VideoScriptItem } from "@/services/video/types";

/** SRT 字幕条目 */
interface SrtCue {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

function timeToMs(h: string, m: string, s: string, ms: string): number {
  return Number(h) * 3600000 + Number(m) * 60000 + Number(s) * 1000 + Number(ms);
}

/** 解析 SRT 文本为字幕条目；格式异常的分块直接跳过 */
export function parseSrt(srt: string): SrtCue[] {
  const cues: SrtCue[] = [];
  for (const block of srt.split(/\n\s*\n/)) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;
    const index = Number(lines[0]);
    const m = lines[1].match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    );
    if (!Number.isFinite(index) || !m) continue;
    cues.push({
      index,
      startMs: timeToMs(m[1], m[2], m[3], m[4]),
      endMs: timeToMs(m[5], m[6], m[7], m[8]),
      text: lines.slice(2).join(" "),
    });
  }
  return cues;
}

function fmtTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
}

interface Props {
  projectId: string;
  script: VideoScriptItem;
  /** 配音生成成功后调用（工作台刷新数据） */
  onGenerated: () => Promise<void>;
}

export function NarrationPanel({ projectId, script, onGenerated }: Props) {
  const [voice, setVoice] = useState<string>(script.voice ?? DEFAULT_VOICE);
  const [generating, setGenerating] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cues = useMemo(() => (script.srt ? parseSrt(script.srt) : []), [script.srt]);
  const hasAudio = Boolean(script.audioUrl);

  // 播放进度 → 当前字幕行
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !hasAudio) return;
    function onTime() {
      const ms = audio.currentTime * 1000;
      setActiveIndex(cues.findIndex((c) => ms >= c.startMs && ms < c.endMs));
    }
    audio.addEventListener("timeupdate", onTime);
    return () => audio.removeEventListener("timeupdate", onTime);
  }, [hasAudio, cues, script.audioUrl]);

  // 当前行变化时滚动到可见区域
  useEffect(() => {
    if (activeIndex < 0) return;
    document
      .getElementById(`srt-line-${script.id}-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, script.id]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(
        `/api/video/projects/${projectId}/scripts/${script.id}/narration`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voice }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "配音生成失败");
      await onGenerated();
      toast.add({ type: "success", title: "配音已生成" });
    } catch (err) {
      toast.add({
        type: "error",
        title: err instanceof Error ? err.message : "配音生成失败",
      });
    } finally {
      setGenerating(false);
    }
  }

  function downloadSrt() {
    if (!script.srt) return;
    const blob = new Blob([script.srt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${script.title}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function seekTo(cue: SrtCue) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = cue.startMs / 1000;
    void audio.play();
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-gray-500">配音与字幕</p>
      <div className="space-y-3 rounded-lg bg-gray-50 p-3">
        {/* 音色选择 + 生成/重新生成 + 下载 */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label className="text-[11px] text-gray-400">音色</Label>
            <Select
              value={voice}
              onValueChange={(v: string | null) => setVoice(v ?? DEFAULT_VOICE)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="选择音色" />
              </SelectTrigger>
              <SelectContent>
                {VOICES.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}（{v.gender} · {v.style}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleGenerate} disabled={generating} size="sm" className="gap-1.5">
            {generating ? (
              <Loader2 size={13} className="animate-spin" />
            ) : hasAudio ? (
              <RefreshCw size={13} />
            ) : (
              <Mic size={13} />
            )}
            {generating ? "合成中…" : hasAudio ? "重新生成配音" : "生成配音"}
          </Button>
          {hasAudio && (
            <div className="flex gap-1.5">
              <a
                href={script.audioUrl ?? undefined}
                download={`${script.title}.mp3`}
                className="inline-flex h-8 items-center gap-1 rounded-lg border bg-white px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                <Download size={13} /> 下载 MP3
              </a>
              <button
                onClick={downloadSrt}
                className="inline-flex h-8 items-center gap-1 rounded-lg border bg-white px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                <Download size={13} /> 下载 SRT
              </button>
            </div>
          )}
        </div>

        {generating && (
          <p className="text-[11px] text-gray-400">正在合成语音，约需 10-30 秒，请勿关闭页面…</p>
        )}

        {hasAudio ? (
          <>
            <audio
              ref={audioRef}
              controls
              src={script.audioUrl ?? undefined}
              preload="metadata"
              className="w-full"
            />
            {cues.length > 0 && (
              <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-md border bg-white p-1.5">
                {cues.map((c, i) => (
                  <button
                    key={c.index}
                    id={`srt-line-${script.id}-${i}`}
                    onClick={() => seekTo(c)}
                    className={cn(
                      "block w-full rounded px-2 py-1 text-left text-xs",
                      i === activeIndex
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <span className="mr-1.5 font-mono text-[10px] text-gray-400">
                      {fmtTime(c.startMs)}
                    </span>
                    {c.text}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          !generating && (
            <p className="text-[11px] text-gray-400">
              选择音色后点「生成配音」，产出 mp3 音频与按句对齐的 SRT 字幕
            </p>
          )
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 类型检查验证**

Run: `cd /jlm/cc-workspace/HugoAI/code/front && npx tsc --noEmit`
Expected: 无输出

- [ ] **Step 3: Commit**

```bash
cd /jlm/cc-workspace/HugoAI
git add code/front/src/components/video/NarrationPanel.tsx
git commit -m "feat(video): 配音面板组件（音色选择+生成+播放器+同步字幕）"
```

---

### Task 9: ScriptDetail / VideoWorkspace 接线

**Files:**
- Modify: `code/front/src/components/video/ScriptDetail.tsx`
- Modify: `code/front/src/components/video/VideoWorkspace.tsx`

- [ ] **Step 1: ScriptDetail 接收新 props 并渲染 NarrationPanel**

`code/front/src/components/video/ScriptDetail.tsx`：

1. import 追加一行（放在 `import { toast } ...` 之后）：

```tsx
import { NarrationPanel } from "./NarrationPanel";
```

2. 组件签名从：

```tsx
export function ScriptDetail({ script }: { script: VideoScriptItem }) {
```

改为：

```tsx
export function ScriptDetail({
  script,
  projectId,
  onChanged,
}: {
  script: VideoScriptItem;
  projectId: string;
  /** 配音生成成功后刷新工作台数据 */
  onChanged: () => Promise<void>;
}) {
```

3. 在「分镜表」区块结束处（`分镜表` 那个 `<div className="space-y-1.5">...</div>` 闭合之后、组件最外层 `</div>` 之前）插入：

```tsx
      {/* 配音与字幕 */}
      <NarrationPanel projectId={projectId} script={script} onGenerated={onChanged} />
```

- [ ] **Step 2: VideoWorkspace 传递 projectId 与 refresh**

`code/front/src/components/video/VideoWorkspace.tsx` 中：

```tsx
            {selected ? (
              <ScriptDetail script={selected} />
            ) : (
```

改为：

```tsx
            {selected ? (
              <ScriptDetail script={selected} projectId={projectId} onChanged={refresh} />
            ) : (
```

- [ ] **Step 3: 类型检查 + lint 验证**

Run:
```bash
cd /jlm/cc-workspace/HugoAI/code/front
npx tsc --noEmit
npm run lint
```
Expected: tsc 无输出；lint 无 error（warning 可接受）

- [ ] **Step 4: Commit**

```bash
cd /jlm/cc-workspace/HugoAI
git add code/front/src/components/video/ScriptDetail.tsx code/front/src/components/video/VideoWorkspace.tsx
git commit -m "feat(video): 脚本详情接入配音面板"
```

---

### Task 10: 端到端验证与收尾

**Files:** 无新增（纯验证）

- [ ] **Step 1: 完整构建验证**

Run: `cd /jlm/cc-workspace/HugoAI/code/front && npm run build`
Expected: 构建成功；路由列表出现 `/api/video/projects/[id]/scripts/[scriptId]/narration` 与 `.../audio`

- [ ] **Step 2: 重启 dev server（加载新 Prisma Client）**

```bash
kill $(pgrep -f "next dev" | head -1) 2>/dev/null; sleep 2
cd /jlm/cc-workspace/HugoAI/code/front && (npm run dev > /tmp/hugoai-dev.log 2>&1 &)
# 轮询直到 http://localhost:18867/login 返回 200：
for i in $(seq 1 60); do code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:18867/login); [ "$code" = "200" ] && break; sleep 2; done; echo "login page: $code"
```

Expected: `login page: 200`

- [ ] **Step 3: API 冒烟测试（curl 全流程）**

```bash
BASE=http://localhost:18867

# 1) 登录
curl -s -c /tmp/hugoai-cookies.txt -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Jlm2026.Hugo.com@1qaz"}' > /dev/null

# 2) 建项目
PROJECT_ID=$(curl -s -b /tmp/hugoai-cookies.txt -X POST $BASE/api/video/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"配音冒烟测试","positioning":"测试"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['project']['id'])")
echo "PROJECT_ID=$PROJECT_ID"

# 3) 生成一条脚本（真实调通义千问，约 2 分钟）
SCRIPT_ID=$(curl -s -b /tmp/hugoai-cookies.txt -X POST $BASE/api/video/projects/$PROJECT_ID/scripts \
  -H "Content-Type: application/json" \
  -d '{"track":"general","topic":"新手如何开始学习 AI"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['script']['id'])")
echo "SCRIPT_ID=$SCRIPT_ID"

# 4) 生成配音（真实调 Edge-TTS，约 10-30 秒）
curl -s -w "\nHTTP=%{http_code}\n" -b /tmp/hugoai-cookies.txt -X POST \
  $BASE/api/video/projects/$PROJECT_ID/scripts/$SCRIPT_ID/narration \
  -H "Content-Type: application/json" \
  -d '{"voice":"zh-CN-YunxiNeural"}'
# Expected: HTTP=200，返回 narration.audioUrl 为 /api/video/projects/.../audio、srt 非空且含 "-->"、voice 为所选音色

# 5) 音频文件落盘检查
ls -la /jlm/cc-workspace/HugoAI/storage/audio/$SCRIPT_ID.mp3
head -c 3 /jlm/cc-workspace/HugoAI/storage/audio/$SCRIPT_ID.mp3 | xxd | head -1
# Expected: 文件存在（约几百 KB）；开头为 "ID3"（49 44 33）或 mp3 帧同步（ff fb 等）

# 6) GET 音频
curl -s -o /tmp/narration.mp3 -w "HTTP=%{http_code} type=%{content_type}\n" \
  -b /tmp/hugoai-cookies.txt $BASE/api/video/projects/$PROJECT_ID/scripts/$SCRIPT_ID/audio
# Expected: HTTP=200 type=audio/mpeg；/tmp/narration.mp3 可播放（ffprobe 无则跳过时长检查）

# 7) SRT 格式抽查（取工作台数据里的 srt 前 300 字符）
curl -s -b /tmp/hugoai-cookies.txt $BASE/api/video/projects/$PROJECT_ID | \
  python3 -c "import json,sys; d=json.load(sys.stdin); s=d['scripts'][0]; print('voice:',s['voice']); print('audioUrl:',s['audioUrl']); print(s['srt'][:300])"
# Expected: voice/audioUrl 非 null；SRT 首块形如 "1\n00:00:00,000 --> 00:00:xx,xxx\n句子文本"

# 8) 参数校验与越权
curl -s -w " [%{http_code}]" -b /tmp/hugoai-cookies.txt -X POST \
  $BASE/api/video/projects/$PROJECT_ID/scripts/$SCRIPT_ID/narration \
  -H "Content-Type: application/json" -d '{"voice":"bad-voice"}'
# Expected: {"error":"请选择有效的音色"} [400]
curl -s -o /dev/null -w "no-cookie audio: %{http_code}\n" $BASE/api/video/projects/$PROJECT_ID/scripts/$SCRIPT_ID/audio
# Expected: no-cookie audio: 401

# 9) 清理：删脚本（音频文件应一并删除）、删项目
curl -s -b /tmp/hugoai-cookies.txt -X DELETE $BASE/api/video/projects/$PROJECT_ID/scripts/$SCRIPT_ID > /dev/null
ls /jlm/cc-workspace/HugoAI/storage/audio/$SCRIPT_ID.mp3 2>&1
# Expected: ls 报 No such file（文件已被清理）
curl -s -b /tmp/hugoai-cookies.txt -X DELETE $BASE/api/video/projects/$PROJECT_ID
# Expected: {"success":true}
```

- [ ] **Step 4: 浏览器 UI 走查**

访问 `http://localhost:18867/video`（先登录）：
1. 进一个有脚本的项目，脚本详情底部出现「配音与字幕」区：音色下拉（默认云希）+「生成配音」按钮
2. 点「生成配音」→ 按钮变「合成中…」并禁用，出现「正在合成语音…」提示，约 10-30 秒后面板切换：出现播放器、下载按钮、字幕列表
3. 播放音频：字幕当前行蓝色高亮并自动滚动；点击任一字幕行跳转到该句播放
4. 「下载 MP3」「下载 SRT」均可正常下载，SRT 内容与列表一致
5. 换音色点「重新生成配音」→ 覆盖成功，播放器与字幕更新
6. 删除该脚本 → `storage/audio/` 下对应文件消失

- [ ] **Step 5: 收尾提交（如有修复）**

若验证中发现并修复了问题：

```bash
cd /jlm/cc-workspace/HugoAI
git add <相关文件>
git commit -m "fix(video): <修复内容>"
```

若无改动则跳过。

---

## 阶段 3+ 预告（不在本计划范围内）

- 阶段 3：Pexels 素材库（`VideoShot` 加 `materialUrl`）
- 阶段 4：pyJianYingDraft 剪映草稿导出（届时可评估分镜级音频切分）
- 阶段 5：发布记录与数据看板

## 自查记录（Self-Review）

- 规格覆盖：设计文档 8 节逐一对应——数据模型→T2，服务层/音色→T3/T4，存储→T5，narration API→T6，audio 下发+删除清理→T7，前端面板与同步字幕→T8/T9，验证标准→T10；「不做的事」全部未引入。
- 无占位符：所有代码步骤给出完整代码与精确插入位置；验证步骤给出具体命令与预期输出。
- 类型一致性：`TtsSentence/TtsResult/TtsProvider`（T4）与 narration 路由（T6）一致；`voice/audioUrl/srt` 三字段在 schema（T2）/types（T3）/serialize（T3）/路由（T6/T7）/NarrationPanel（T8）五处命名一致；`parseSrt` 的 SrtCue 字段与 `toSrt` 输出格式（`HH:MM:SS,mmm`）互相对齐。
- 与既有代码对齐：守卫判别联合、`params: Promise` 用法、Select/toast/Button 用法均复刻自现有 video 组件；`new Response(buffer)` 模式与 `lib/sse.ts` 一致。
