# 短视频模块阶段4「剪映草稿导出」实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 脚本详情页一键把「分镜素材 + 配音 + SRT 字幕」导出为剪映草稿 zip（浏览器下载），放入剪映草稿目录即可打开精剪。

**Architecture:** Node 编排（鉴权/校验/下载/缓存/流式下发）+ Python 子进程（pyJianYingDraft 拼草稿 + 标准库 zipfile 打包），进程间契约是 manifest.json / report.json + 退出码。素材时间轴按分镜估算时长比例缩放到配音实际时长（取自 SRT 尾句时间戳）。缓存目录 `storage/exports/<scriptId>/`，失效信号统一为 `script.updatedAt`。

**Tech Stack:** 既有栈（Next.js Route Handlers / Prisma）+ 新增 `code/export/`（Python 3.12 venv、pyjianyingdraft 0.3.0，零新 npm 依赖）。

**验证方式：** 本项目无测试框架，沿用「typecheck + lint + build + API 冒烟 + UI 走查」既定模式。

**环境要点：**
1. 本机 Python 3.12.3；`python3 -m venv` 依赖 `python3.12-venv`（已于 2026-08-06 `apt-get install` 装好；setup.sh 会检测并提示）
2. 系统无 zip 命令、package.json 无 zip 库 → 打包在 Python 侧用标准库 zipfile
3. Next.js 16：路由 `params` 是 Promise（`const { id } = await params`），照抄既有路由写法
4. prisma 命令前必须 `set -a && source .env.local && set +a`（本计划无迁移，仅备查）
5. 提交只 add 源码，绝不提交 .env*；`.venv` 加入 .gitignore

**已验证的前置事实（2026-08-06 实测 pyjianyingdraft 0.3.0）：**
1. `jy.DraftFolder(root)`：root 必须已存在；`create_draft(name, w, h, allow_replace=True)` 在 root 下建草稿文件夹并返回 ScriptFile
2. `script.append_track(jy.TrackSpec(jy.TrackType.video, "video"))` 命名轨道；`script.add_segment(seg, track="video")`
3. `jy.VideoMaterial(path)` 自动探测时长，单位**微秒**（纯 Python 解析，不依赖 ffmpeg；实测 flower.mp4 → 5005000）
4. `jy.VideoSegment(material, jy.trange(start_us, duration_us), volume=0.0)`；`source_timerange` 缺省为从头等长截取，超出素材时长会抛 ValueError → 需先用 `material.duration` 钳制
5. `jy.AudioSegment(path_or_material, jy.trange(start_us, duration_us))` 同型
6. `script.import_srt(srt_path, "subtitle")`：自动创建文本轨，默认样式模仿剪映自带字幕导入（size=5、底部 transform_y=-0.8）
7. `script.save()` 落 draft_content.json；草稿文件夹另含库拷贝的 draft_meta_info.json
8. 实测 3.12 下「建草稿 + 视频轨 + 音频轨 + save」全链路 SMOKE OK

---

## 文件结构概览

```
code/export/                                     # 新增 Python 导出程序
├── requirements.txt                             # pyjianyingdraft==0.3.0
├── setup.sh                                     # 建 venv + 装依赖（一次性）
└── build_draft.py                               # manifest.json → 草稿文件夹 → report.json → zip
code/front/src/
├── services/video/
│   ├── srt.ts                                   # 新增：parseSrt/SrtCue 从 NarrationPanel 提取（共用）
│   └── export/
│       ├── manifest.ts                          # 时间轴缩放 + manifest 构建
│       ├── materials.ts                         # 缓存判定 + 素材下载 + 资产准备
│       └── runner.ts                            # venv 探测 + 子进程调 build_draft.py
├── app/api/video/projects/[id]/scripts/[scriptId]/export/route.ts   # 新增：GET → zip
├── app/api/video/projects/[id]/scripts/[scriptId]/shots/[shotId]/route.ts  # 补 touch updatedAt
└── components/video/NarrationPanel.tsx          # 提取 parseSrt + 导出按钮
.gitignore                                       # + code/export/.venv/
```

---

### Task 1: Python 环境（code/export 脚手架 + setup.sh）

**Files:**
- Create: `code/export/requirements.txt`
- Create: `code/export/setup.sh`
- Modify: `.gitignore`

- [ ] **Step 1: requirements.txt**

```
pyjianyingdraft==0.3.0
```

- [ ] **Step 2: setup.sh**

```bash
#!/usr/bin/env bash
# 剪映草稿导出环境一次性初始化：venv + pyJianYingDraft
set -euo pipefail
cd "$(dirname "$0")"

if ! python3 -c "import ensurepip" >/dev/null 2>&1; then
  echo "错误：缺少 python3 venv 支持，请先执行：apt-get install -y python3.12-venv" >&2
  exit 1
fi

python3 -m venv .venv
.venv/bin/pip install --quiet --upgrade pip
.venv/bin/pip install --quiet -r requirements.txt
.venv/bin/python -c "import pyJianYingDraft" && echo "OK: pyJianYingDraft 就绪（code/export/.venv）"
```

- [ ] **Step 3: .gitignore 追加**

在 `# === Backend ===` 段之后加：

```
# === Python export env ===
code/export/.venv/
```

- [ ] **Step 4: 运行 setup 并验证**

Run:
```bash
chmod +x code/export/setup.sh && code/export/setup.sh
code/export/.venv/bin/python -c "import pyJianYingDraft as j; print(j.__name__)"
```
Expected: `OK: pyJianYingDraft 就绪…`；第二行输出 `pyJianYingDraft`

- [ ] **Step 5: Commit**

```bash
git add code/export/requirements.txt code/export/setup.sh .gitignore
git commit -m "chore(video): 阶段4 剪映导出 Python 环境脚手架（venv + pyJianYingDraft）"
```

---

### Task 2: build_draft.py（草稿构建 + README + 打包）

**Files:**
- Create: `code/export/build_draft.py`

- [ ] **Step 1: 创建 build_draft.py**

```python
#!/usr/bin/env python3
"""阶段4：从导出目录构建剪映草稿。

用法: .venv/bin/python build_draft.py <export-dir>

导出目录需包含（Node 侧准备）:
  manifest.json   时间轴与文件清单（见 services/video/export/manifest.ts）
  audio.mp3       整段配音
  subtitle.srt    SRT 字幕
  materials/*.mp4 分镜素材

产出（均在导出目录内）:
  drafts/<draftName>/        剪映草稿文件夹
  report.json                {"warnings": [...]}（时长钳制告警，可为空）
  <draftName>-剪映草稿.zip    最终交付物（草稿文件夹 + README.txt）

退出码: 0 成功；1 构建失败（stderr 有原因）；2 用法错误
"""
import json
import os
import sys
import zipfile

import pyJianYingDraft as jy

README_TEMPLATE = """【剪映草稿导入说明】
1. 解压本压缩包，得到草稿文件夹「{draft_name}」
2. 将整个文件夹复制到剪映草稿根目录：
   Windows: %LOCALAPPDATA%\\JianyingPro\\User Data\\Projects\\com.lveditor.draft
   Mac:     ~/Movies/JianyingPro/User Data/Projects/com.lveditor.draft
3. 打开（或重启）剪映，草稿列表即可看到；若不出现，进出任一已有草稿一次即可刷新。

【轨道构成】
- 视频轨：{shot_count} 段分镜素材，时间轴已按配音时长（共 {audio_sec:.1f} 秒）等比排布
- 音频轨：整段配音（素材原声已静音）
- 文本轨：按句对齐字幕（SRT 导入，样式/位置可在剪映批量调整）

【素材清单】
{material_list}
{warnings_section}"""


def main() -> int:
    if len(sys.argv) != 2:
        print("用法: build_draft.py <export-dir>", file=sys.stderr)
        return 2
    root = os.path.abspath(sys.argv[1])
    try:
        with open(os.path.join(root, "manifest.json"), encoding="utf-8") as f:
            manifest = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        print(f"manifest.json 读取失败: {e}", file=sys.stderr)
        return 1

    draft_name = manifest["draftName"]
    warnings = []

    try:
        draft_root = os.path.join(root, "drafts")
        os.makedirs(draft_root, exist_ok=True)
        folder = jy.DraftFolder(draft_root)
        script = folder.create_draft(
            draft_name,
            manifest["canvas"]["width"],
            manifest["canvas"]["height"],
            allow_replace=True,
        )

        script.append_track(jy.TrackSpec(jy.TrackType.video, "video"))
        script.append_track(jy.TrackSpec(jy.TrackType.audio, "audio"))

        # 视频轨：每分镜一段；需求时长超出素材实际时长则钳制并告警
        for shot in manifest["shots"]:
            material = jy.VideoMaterial(os.path.join(root, shot["file"]))
            target_us = shot["durationMs"] * 1000
            if material.duration < target_us:
                warnings.append(
                    f"分镜 {shot['sort']}：时间轴需 {shot['durationMs'] / 1000:.1f}s，"
                    f"素材仅 {material.duration / 1_000_000:.1f}s，已按素材时长截断"
                )
                target_us = material.duration
            script.add_segment(
                jy.VideoSegment(material, jy.trange(shot["startMs"] * 1000, target_us), volume=0.0),
                track="video",
            )

        # 音频轨：整段配音
        audio = manifest["audio"]
        script.add_segment(
            jy.AudioSegment(os.path.join(root, audio["file"]), jy.trange(0, audio["durationMs"] * 1000)),
            track="audio",
        )

        # 文本轨：SRT 字幕（库默认样式即模仿剪映自带字幕导入）
        script.import_srt(os.path.join(root, manifest["subtitle"]), "subtitle")

        script.save()
    except Exception as e:
        print(f"草稿构建失败: {e}", file=sys.stderr)
        return 1

    with open(os.path.join(root, "report.json"), "w", encoding="utf-8") as f:
        json.dump({"warnings": warnings}, f, ensure_ascii=False, indent=2)

    material_list = "\n".join(
        f"- 分镜 {s['sort']}：{s['file']}（{s['durationMs'] / 1000:.1f}s，自 {s['startMs'] / 1000:.1f}s 起）"
        for s in manifest["shots"]
    )
    warnings_section = (
        "\n【时长告警】\n" + "\n".join(f"- {w}" for w in warnings) if warnings else ""
    )
    readme = README_TEMPLATE.format(
        draft_name=draft_name,
        shot_count=len(manifest["shots"]),
        audio_sec=manifest["audio"]["durationMs"] / 1000,
        material_list=material_list,
        warnings_section=warnings_section,
    )

    zip_path = os.path.join(root, f"{draft_name}-剪映草稿.zip")
    draft_dir = os.path.join(draft_root, draft_name)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for dirpath, _, filenames in os.walk(draft_dir):
            for name in filenames:
                full = os.path.join(dirpath, name)
                zf.write(full, os.path.relpath(full, draft_root))
        zf.writestr("README.txt", readme)

    print(f"OK: {zip_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: 独立冒烟——用样例素材跑通全链路**

准备样例（下载 1 个免版权小 mp4 + 复用现有配音 + 手写 2 句 SRT）：

```bash
SMOKE=/tmp/jy-smoke && rm -rf $SMOKE && mkdir -p $SMOKE/materials
curl -sL -o $SMOKE/materials/01.mp4 https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4
cp storage/audio/cmsegubbc000i116zb5lw85b8.mp3 $SMOKE/audio.mp3
printf '1\n00:00:00,000 --> 00:00:02,000\n第一句字幕\n\n2\n00:00:02,000 --> 00:00:04,000\n第二句字幕\n' > $SMOKE/subtitle.srt
cat > $SMOKE/manifest.json <<'EOF'
{
  "draftName": "冒烟测试草稿",
  "canvas": { "width": 1080, "height": 1920 },
  "audio": { "file": "audio.mp3", "durationMs": 4000 },
  "subtitle": "subtitle.srt",
  "shots": [
    { "file": "materials/01.mp4", "sourceUrl": "https://example.com/x.mp4", "sort": 1, "startMs": 0, "durationMs": 4000 }
  ]
}
EOF
code/export/.venv/bin/python code/export/build_draft.py $SMOKE
```
Expected: 末行 `OK: /tmp/jy-smoke/冒烟测试草稿-剪映草稿.zip`

- [ ] **Step 3: 验证 zip 与草稿结构**

```bash
code/export/.venv/bin/python - <<'EOF'
import json, zipfile, os
smoke = "/tmp/jy-smoke"
zips = [f for f in os.listdir(smoke) if f.endswith(".zip")]
assert len(zips) == 1, zips
names = zipfile.ZipFile(os.path.join(smoke, zips[0])).namelist()
assert "README.txt" in names and any(n.endswith("draft_content.json") for n in names), names
dc = json.load(open(os.path.join(smoke, "drafts", "冒烟测试草稿", "draft_content.json")))
tracks = {t["type"]: t for t in dc["tracks"]}
assert len(tracks["video"]["segments"]) == 1
assert len(tracks["audio"]["segments"]) == 1
assert len(tracks["text"]["segments"]) == 2, "字幕应为 2 句"
print("SMOKE OK", zips[0])
EOF
```
Expected: `SMOKE OK 冒烟测试草稿-剪映草稿.zip`（注：若 draft_content.json 内 tracks 结构与断言字段名有出入，用 `python -m json.tool` 查看实际结构后按实际字段修正断言——核心是视频/音频/文本三轨齐全且段数正确）

- [ ] **Step 4: 失败路径冒烟**

```bash
code/export/.venv/bin/python code/export/build_draft.py /nonexistent; echo "exit=$?"
```
Expected: stderr 有 `manifest.json 读取失败`，`exit=1`

```bash
rm -rf /tmp/jy-smoke
```

- [ ] **Step 5: Commit**

```bash
git add code/export/build_draft.py
git commit -m "feat(video): 剪映草稿构建脚本（pyJianYingDraft + README + zipfile 打包）"
```

---

### Task 3: srt.ts 提取 + manifest.ts（时间轴计算）

**Files:**
- Create: `code/front/src/services/video/srt.ts`
- Modify: `code/front/src/components/video/NarrationPanel.tsx`
- Create: `code/front/src/services/video/export/manifest.ts`

- [ ] **Step 1: 创建 srt.ts（从 NarrationPanel 原样提取）**

```ts
/** SRT 字幕条目 */
export interface SrtCue {
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
```

- [ ] **Step 2: NarrationPanel 改为从 srt.ts 导入**

删除 NarrationPanel.tsx 中的 `interface SrtCue`、`timeToMs`、`parseSrt` 三段定义，在 import 区加：

```ts
import { parseSrt, type SrtCue } from "@/services/video/srt";
```

（其余代码不动；`fmtTime`、`seekTo` 等保留原处）

- [ ] **Step 3: 创建 export/manifest.ts**

```ts
import { parseSrt } from "@/services/video/srt";

/** 导出清单中的分镜（对应 Python build_draft.py 读取的字段） */
export interface ManifestShot {
  file: string; // 相对路径 materials/NN.mp4
  sourceUrl: string; // Pexels 直链（下载用）
  sort: number; // 分镜号（告警/清单展示用）
  startMs: number;
  durationMs: number;
}

export interface ExportManifest {
  draftName: string;
  canvas: { width: number; height: number };
  audio: { file: string; durationMs: number };
  subtitle: string;
  shots: ManifestShot[];
}

/** 导出所需的脚本结构（Prisma VideoScript+shots 的结构子集） */
export interface ExportableScript {
  id: string;
  title: string;
  srt: string | null;
  shots: Array<{ sort: number; duration: number; materialUrl: string | null }>;
}

/** 竖屏短视频画布 9:16 */
export const CANVAS = { width: 1080, height: 1920 } as const;

/** 清洗剪映草稿文件夹名（= zip 名）中的非法字符 */
export function sanitizeDraftName(title: string): string {
  return title.replace(/[\\/:*?"<>|\r\n\t]/g, "").trim().slice(0, 50) || "剪映草稿";
}

/** 配音时长 = SRT 各句结束时间戳最大值（SRT 与 mp3 同源于 Edge-TTS 边界事件） */
export function audioDurationFromSrt(srt: string): number {
  return parseSrt(srt).reduce((max, c) => Math.max(max, c.endMs), 0);
}

/**
 * 构建导出清单：各分镜时长按估算比例缩放到配音实际时长。
 * 用累积比例计算 end，避免逐项舍入漂移；最后一镜 end 恒等于配音时长。
 */
export function buildManifest(script: ExportableScript): ExportManifest {
  if (!script.srt) throw new Error("请先合成配音");
  const audioDurationMs = audioDurationFromSrt(script.srt);
  if (audioDurationMs <= 0) throw new Error("字幕时间轴异常，请重新合成配音");
  const missing = script.shots.filter((s) => !s.materialUrl);
  if (missing.length > 0) {
    throw new Error(`分镜 ${missing.map((s) => s.sort).join("、")} 未选择素材`);
  }

  const totalSec = script.shots.reduce((sum, s) => sum + s.duration, 0);
  let prevEnd = 0;
  let cum = 0;
  const shots: ManifestShot[] = script.shots.map((s, i) => {
    cum += s.duration;
    const end =
      i === script.shots.length - 1
        ? audioDurationMs
        : Math.round((cum / Math.max(totalSec, 1)) * audioDurationMs);
    const seg: ManifestShot = {
      file: `materials/${String(s.sort).padStart(2, "0")}.mp4`,
      sourceUrl: s.materialUrl as string,
      sort: s.sort,
      startMs: prevEnd,
      durationMs: Math.max(200, end - prevEnd),
    };
    prevEnd = end;
    return seg;
  });

  return {
    draftName: sanitizeDraftName(script.title),
    canvas: { ...CANVAS },
    audio: { file: "audio.mp3", durationMs: audioDurationMs },
    subtitle: "subtitle.srt",
    shots,
  };
}
```

- [ ] **Step 4: 类型检查 + lint + Commit**

Run: `cd code/front && npx tsc --noEmit && npm run lint`
Expected: 无错误

```bash
git add code/front/src/services/video/srt.ts code/front/src/services/video/export/manifest.ts code/front/src/components/video/NarrationPanel.tsx
git commit -m "feat(video): SRT 解析提取为共用模块 + 导出时间轴计算（manifest）"
```

---

### Task 4: materials.ts（缓存判定 + 素材下载 + 资产准备）

**Files:**
- Create: `code/front/src/services/video/export/materials.ts`

- [ ] **Step 1: 创建 materials.ts**

```ts
import { copyFile, mkdir, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { audioFilePath } from "@/services/video/audio-store";
import type { ExportManifest } from "./manifest";

/**
 * 导出缓存根目录：仓库根 storage/exports/（storage/* 已被 .gitignore 忽略）。
 * Next.js 进程 cwd 为 code/front，向上两级到仓库根（对齐 audio-store 的写法）。
 */
const EXPORTS_ROOT = path.join(process.cwd(), "..", "..", "storage", "exports");

const UA = "Mozilla/5.0 (compatible; HugoAI/1.0)";

/** 某脚本的导出缓存目录 */
export function exportDir(scriptId: string): string {
  return path.join(EXPORTS_ROOT, scriptId);
}

/** 最终 zip 路径（与 build_draft.py 的产出命名一致） */
export function zipPath(scriptId: string, draftName: string): string {
  return path.join(exportDir(scriptId), `${draftName}-剪映草稿.zip`);
}

/**
 * 缓存命中判定：manifest.json 的 mtime 不早于 script.updatedAt 且 zip 存在。
 * 命中返回 zip 路径，否则 null。
 */
export async function cachedZip(
  scriptId: string,
  draftName: string,
  scriptUpdatedAt: Date
): Promise<string | null> {
  try {
    const m = await stat(path.join(exportDir(scriptId), "manifest.json"));
    if (m.mtime < scriptUpdatedAt) return null;
    const zip = zipPath(scriptId, draftName);
    await stat(zip);
    return zip;
  } catch {
    return null;
  }
}

/** 分镜素材下载失败（消息含分镜号，路由层转 502） */
export class MaterialDownloadError extends Error {
  constructor(
    readonly sort: number,
    reason: string
  ) {
    super(`分镜 ${sort} 素材下载失败（${reason}），请重试或更换素材`);
  }
}

async function downloadMaterial(url: string, dest: string, sort: number): Promise<void> {
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(120_000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = Buffer.from(await resp.arrayBuffer());
    if (data.length < 10_000) throw new Error("响应过小，疑似无效");
    await writeFile(dest, data);
  } catch (err) {
    throw new MaterialDownloadError(sort, err instanceof Error ? err.message : "未知错误");
  }
}

/**
 * 重建缓存目录：删旧目录 → 写 SRT/manifest → 复制配音 → 逐个下载分镜素材。
 * 任一素材下载失败抛 MaterialDownloadError（目录保持不完整状态，下次导出会整体重建）。
 */
export async function prepareAssets(
  script: { id: string; srt: string | null },
  manifest: ExportManifest
): Promise<void> {
  if (!script.srt) throw new Error("请先合成配音");
  const dir = exportDir(script.id);
  await rm(dir, { recursive: true, force: true });
  await mkdir(path.join(dir, "materials"), { recursive: true });

  await writeFile(path.join(dir, "subtitle.srt"), script.srt, "utf-8");
  await writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");
  await copyFile(audioFilePath(script.id), path.join(dir, "audio.mp3"));

  for (const shot of manifest.shots) {
    await downloadMaterial(shot.sourceUrl, path.join(dir, shot.file), shot.sort);
  }
}
```

- [ ] **Step 2: 类型检查 + Commit**

Run: `cd code/front && npx tsc --noEmit`
Expected: 无输出

```bash
git add code/front/src/services/video/export/materials.ts
git commit -m "feat(video): 导出缓存判定与素材下载（storage/exports 目录级缓存）"
```

---

### Task 5: runner.ts（Python 子进程调用）

**Files:**
- Create: `code/front/src/services/video/export/runner.ts`

- [ ] **Step 1: 创建 runner.ts**

```ts
import { execFile } from "child_process";
import { existsSync } from "fs";
import path from "path";

/** code/export 目录（cwd=code/front，上一级即仓库根） */
const EXPORT_PROG_DIR = path.join(process.cwd(), "..", "code", "export");
const PYTHON_BIN = path.join(EXPORT_PROG_DIR, ".venv", "bin", "python");
const BUILD_SCRIPT = path.join(EXPORT_PROG_DIR, "build_draft.py");

/** 导出环境未初始化（venv 缺失） */
export class ExportEnvError extends Error {
  constructor() {
    super("导出环境未初始化，请先在服务器运行 code/export/setup.sh");
  }
}

/**
 * 调起 code/export/build_draft.py 构建草稿并打 zip。
 * 超时 60s（kill 子进程）；失败抛带中文原因的 Error。
 */
export function runBuildDraft(exportDirectory: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!existsSync(PYTHON_BIN) || !existsSync(BUILD_SCRIPT)) {
      reject(new ExportEnvError());
      return;
    }
    execFile(
      PYTHON_BIN,
      [BUILD_SCRIPT, exportDirectory],
      { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 },
      (err, _stdout, stderr) => {
        if (!err) {
          resolve();
          return;
        }
        if (err.killed) {
          reject(new Error("草稿生成超时，请重试"));
        } else {
          const detail = (stderr || err.message).trim().slice(-500);
          reject(new Error(`草稿生成失败：${detail}`));
        }
      }
    );
  });
}
```

- [ ] **Step 2: 类型检查 + Commit**

Run: `cd code/front && npx tsc --noEmit`
Expected: 无输出

```bash
git add code/front/src/services/video/export/runner.ts
git commit -m "feat(video): 剪映草稿构建子进程调用（venv 探测 + 60s 超时）"
```

---

### Task 6: 导出路由 + PATCH 素材 touch updatedAt

**Files:**
- Create: `code/front/src/app/api/video/projects/[id]/scripts/[scriptId]/export/route.ts`
- Modify: `code/front/src/app/api/video/projects/[id]/scripts/[scriptId]/shots/[shotId]/route.ts`

- [ ] **Step 1: 创建导出路由**

```ts
import { readFile, stat } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireVideoAccess } from "@/services/video/guard";
import { audioFilePath } from "@/services/video/audio-store";
import { buildManifest } from "@/services/video/export/manifest";
import {
  cachedZip,
  exportDir,
  MaterialDownloadError,
  prepareAssets,
  zipPath,
} from "@/services/video/export/materials";
import { ExportEnvError, runBuildDraft } from "@/services/video/export/runner";

type ScriptWithShots = Prisma.VideoScriptGetPayload<{
  include: { shots: { orderBy: { sort: "asc" } }; project: { select: { userId: true } } };
}>;

/** 同一脚本进行中的构建任务（并发请求复用同一次构建） */
const building = new Map<string, Promise<string>>();

/** GET /api/video/projects/[id]/scripts/[scriptId]/export — 导出剪映草稿 zip */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; scriptId: string }> }
) {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;
  const { id, scriptId } = await params;

  const script = await prisma.videoScript.findFirst({
    where: { id: scriptId, projectId: id },
    include: { shots: { orderBy: { sort: "asc" } }, project: { select: { userId: true } } },
  });
  if (!script || script.project.userId !== check.userId) {
    return NextResponse.json({ error: "脚本不存在" }, { status: 404 });
  }

  if (!script.audioUrl || !script.srt) {
    return NextResponse.json({ error: "请先合成配音" }, { status: 400 });
  }
  try {
    await stat(audioFilePath(scriptId));
  } catch {
    return NextResponse.json({ error: "音频文件缺失，请重新合成配音" }, { status: 400 });
  }
  const missing = script.shots.filter((s) => !s.materialUrl);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `分镜 ${missing.map((s) => s.sort).join("、")} 未选择素材，请先选择` },
      { status: 400 }
    );
  }

  try {
    const zip = await getOrBuild(script);
    const data = await readFile(zip);
    return new Response(data, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(zip))}`,
        "Cache-Control": "private, max-age=0",
      },
    });
  } catch (err) {
    const status = err instanceof MaterialDownloadError ? 502 : 500;
    const message = err instanceof Error ? err.message : "导出失败，请重试";
    return NextResponse.json({ error: message }, { status });
  }
}

/** 缓存命中直接返回 zip；否则构建（同脚本并发复用） */
async function getOrBuild(script: ScriptWithShots): Promise<string> {
  const manifest = buildManifest(script);
  const cached = await cachedZip(script.id, manifest.draftName, script.updatedAt);
  if (cached) return cached;

  const running = building.get(script.id);
  if (running) return running;

  const task = (async () => {
    try {
      await prepareAssets(script, manifest);
      await runBuildDraft(exportDir(script.id));
      return zipPath(script.id, manifest.draftName);
    } finally {
      building.delete(script.id);
    }
  })();
  building.set(script.id, task);
  return task;
}
```

注：`ExportEnvError` 是 Error 子类，落入 500 分支，消息即其构造文案，无需单独分支。

- [ ] **Step 2: PATCH 素材路由补 touch updatedAt**

在 shots/[shotId]/route.ts 的 `const updated = await prisma.videoShot.update(...)` 之后、`return` 之前加：

```ts
  // 素材变更影响导出缓存：显式 touch script.updatedAt（缓存统一失效信号）
  await prisma.videoScript.update({ where: { id: scriptId }, data: { updatedAt: new Date() } });
```

- [ ] **Step 3: 类型检查 + Commit**

Run: `cd code/front && npx tsc --noEmit`
Expected: 无输出

```bash
git add "code/front/src/app/api/video/projects/[id]/scripts/[scriptId]/export/route.ts" "code/front/src/app/api/video/projects/[id]/scripts/[scriptId]/shots/[shotId]/route.ts"
git commit -m "feat(video): 剪映草稿导出 API（缓存/构建/zip 下发）+ 素材变更 touch 缓存信号"
```

---

### Task 7: NarrationPanel 导出按钮

**Files:**
- Modify: `code/front/src/components/video/NarrationPanel.tsx`

- [ ] **Step 1: 状态与导出回调**

`import { Download, Loader2, Mic, RefreshCw } from "lucide-react";` 改为：

```ts
import { Download, Film, Loader2, Mic, RefreshCw } from "lucide-react";
```

`const [activeIndex, setActiveIndex] = useState(-1);` 之后加：

```ts
  const [exporting, setExporting] = useState(false);
```

`downloadSrt` 函数之后加：

```ts
  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(`/api/video/projects/${projectId}/scripts/${script.id}/export`);
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "导出失败");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${script.title}-剪映草稿.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.add({ type: "success", title: "已导出，按压缩包内 README 导入剪映" });
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : "导出失败" });
    } finally {
      setExporting(false);
    }
  }
```

- [ ] **Step 2: 按钮（放入音色/生成按钮那一行末尾，hasAudio 下载按钮组之后）**

在 `{hasAudio && (<div className="flex gap-1.5">…</div>)}` 那个条件块**之后**插入：

```tsx
          <button
            onClick={handleExport}
            disabled={!hasAudio || exporting}
            title={hasAudio ? "导出为剪映草稿（素材 + 配音 + 字幕）" : "请先合成配音"}
            className="inline-flex h-8 items-center gap-1 rounded-lg border bg-white px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <Film size={13} />}
            {exporting ? "导出中…" : "导出剪映草稿"}
          </button>
```

- [ ] **Step 3: 类型检查 + lint + Commit**

Run: `cd code/front && npx tsc --noEmit && npm run lint`
Expected: 无错误

```bash
git add code/front/src/components/video/NarrationPanel.tsx
git commit -m "feat(video): 配音面板加「导出剪映草稿」按钮（blob 下载 + 状态提示）"
```

---

### Task 8: 端到端验证（build + API 冒烟 + 缓存 + UI 走查）

**Files:** 无新增（验证）

- [ ] **Step 1: build**

Run: `cd code/front && npm run build`
Expected: 成功

- [ ] **Step 2: 重启 dev server**

```bash
kill $(pgrep -f "next dev" | head -1) 2>/dev/null; sleep 2
cd /jlm/cc-workspace/HugoAI/code/front && (npm run dev > /tmp/hugoai-dev.log 2>&1 &)
# 轮询直到 http://localhost:18867/login 返回 200
```

- [ ] **Step 3: 登录 + 造一条完整数据（脚本 + 素材 + 配音）**

```bash
BASE=http://localhost:18867
curl -s -c /tmp/hugoai-cookies.txt -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Jlm2026.Hugo.com@1qaz"}' > /dev/null

# 建项目 + 生成脚本（约 2 分钟）
PROJECT_ID=$(curl -s -b /tmp/hugoai-cookies.txt -X POST $BASE/api/video/projects -H "Content-Type: application/json" \
  -d '{"name":"阶段4导出测试","positioning":"导出验证"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['project']['id'])")
SCRIPT_ID=$(curl -s -b /tmp/hugoai-cookies.txt -X POST $BASE/api/video/projects/$PROJECT_ID/scripts \
  -H "Content-Type: application/json" -d '{"track":"ai-news","topic":"新手如何开始学习 AI"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['script']['id'])")
```

为每个分镜选素材（搜索取第一条 hd 文件）：

```bash
for SHOT in $(docker exec hugoai-postgres psql -U hugoai -d hugoai -t -A -c \
  "SELECT id || '|' || COALESCE(\"materialQuery\",'city') FROM \"VideoShot\" WHERE \"scriptId\"='$SCRIPT_ID' ORDER BY sort;"); do
  SHOT_ID=${SHOT%%|*}; QUERY=${SHOT##*|}
  FILE=$(curl -s -b /tmp/hugoai-cookies.txt "$BASE/api/video/materials/search?query=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$QUERY")&orientation=portrait&pageSize=1" \
    | python3 -c "import sys,json;print(json.load(sys.stdin)['videos'][0]['files'][0]['link'])")
  curl -s -b /tmp/hugoai-cookies.txt -X PATCH "$BASE/api/video/projects/$PROJECT_ID/scripts/$SCRIPT_ID/shots/$SHOT_ID" \
    -H "Content-Type: application/json" -d '{"materialUrl":"'$FILE'"}' > /dev/null
done
# 验证全部分镜已有素材
docker exec hugoai-postgres psql -U hugoai -d hugoai -t -A -c \
  "SELECT COUNT(*) FILTER (WHERE \"materialUrl\" IS NULL) FROM \"VideoShot\" WHERE \"scriptId\"='$SCRIPT_ID';"
# Expected: 0
```

合成配音（约 10-30 秒）：

```bash
curl -s -b /tmp/hugoai-cookies.txt -X POST "$BASE/api/video/projects/$PROJECT_ID/scripts/$SCRIPT_ID/narration" \
  -H "Content-Type: application/json" -d '{"voice":"zh-CN-XiaoxiaoNeural"}' | head -c 200
# Expected: {"narration":{"audioUrl":...,"srt":"1\n00:00:00,000 --> ...
```

- [ ] **Step 4: 验证门禁（先测失败路径）**

```bash
# 未选素材的分镜（临时清掉一个）
SHOT_ONE=$(docker exec hugoai-postgres psql -U hugoai -d hugoai -t -A -c \
  "SELECT id FROM \"VideoShot\" WHERE \"scriptId\"='$SCRIPT_ID' ORDER BY sort LIMIT 1;")
curl -s -b /tmp/hugoai-cookies.txt -X PATCH "$BASE/api/video/projects/$PROJECT_ID/scripts/$SCRIPT_ID/shots/$SHOT_ONE" \
  -H "Content-Type: application/json" -d '{"materialUrl":null}' > /dev/null
curl -s -w " [%{http_code}]" -b /tmp/hugoai-cookies.txt "$BASE/api/video/projects/$PROJECT_ID/scripts/$SCRIPT_ID/export"
# Expected: {"error":"分镜 1 未选择素材，请先选择"} [400]
# 恢复该分镜素材（复用 Step 3 循环逻辑补回）后继续
```

- [ ] **Step 5: 正常导出 + 结构验证**

```bash
time curl -s -b /tmp/hugoai-cookies.txt -o /tmp/export-test.zip \
  "$BASE/api/video/projects/$PROJECT_ID/scripts/$SCRIPT_ID/export" -w " [%{http_code}]\n"
# Expected: [200]，首次耗时含素材下载（10-60s）
python3 - <<'EOF'
import zipfile, json
z = zipfile.ZipFile("/tmp/export-test.zip")
names = z.namelist()
assert "README.txt" in names, names
dc_path = next(n for n in names if n.endswith("draft_content.json"))
dc = json.loads(z.read(dc_path))
tracks = {t["type"]: t for t in dc["tracks"]}
print("video segs:", len(tracks["video"]["segments"]))
print("audio segs:", len(tracks["audio"]["segments"]))
print("text segs:", len(tracks["text"]["segments"]))
print("README head:", z.read("README.txt").decode("utf-8").splitlines()[0])
EOF
# Expected: video/audio 段数=分镜数/1，text 段数=SRT 句数
```

- [ ] **Step 6: 缓存验证**

```bash
time curl -s -b /tmp/hugoai-cookies.txt -o /tmp/export-test2.zip \
  "$BASE/api/video/projects/$PROJECT_ID/scripts/$SCRIPT_ID/export" -w " [%{http_code}]\n"
# Expected: [200] 且耗时显著缩短（秒级，不重新下载）
# PATCH 换素材后再导出应重建（耗时回到下载量级）——抽查一个分镜重选素材后验证
```

- [ ] **Step 7: UI 走查（playwright）**

`/video` → 进「阶段4导出测试」项目 → 打开脚本详情：配音面板按钮行出现「导出剪映草稿」→ 点击 → 按钮变「导出中…」→ 恢复后 toast「已导出，按压缩包内 README 导入剪映」→ 浏览器下载到 zip。未配音的脚本上按钮为 disabled 且 hover 提示「请先合成配音」。

- [ ] **Step 8: 清理 + 进度快照 + Commit**

删除测试项目（API DELETE）；更新 `docs/superpowers/status/2026-08-06-video-phase4-progress.md` 为收尾状态（含验证记录、环境恢复命令需运行 `code/export/setup.sh`、遗留事项：剪映侧打开验证需用户在本机执行）。

```bash
git add docs/superpowers/status/2026-08-06-video-phase4-progress.md
git commit -m "docs(video): 阶段4 验证收尾快照"
```

---

## 自查记录（Self-Review）

- 规格覆盖：设计文档 7 节全部有对应任务——架构/分工（T1-T6）、时间轴与 manifest（T3）、缓存与 touch（T4/T6）、错误处理表（T6 路由逐条对应）、UI（T7）、验证标准 1-5（T8；标准 6 剪映实开为用户人工步骤，已在快照遗留事项注明）、YAGNI 各项未引入。
- 无占位符：所有代码步骤给出完整代码与插入位置；冒烟命令均为可直接执行的完整命令。
- 类型一致性：`ManifestShot`（含 sort 字段）在 manifest.ts 定义、materials.ts 下载/报错、build_draft.py 读取三处一致；`MaterialDownloadError`/`ExportEnvError` 定义与路由引用一致；`parseSrt/SrtCue` 提取后 NarrationPanel 与 manifest.ts 同源导入。
- 已验证的前置事实：pyjianyingdraft 0.3.0 全链路冒烟通过（见头部第 1-8 条）；python3.12-venv 已 apt 安装；无 zip 命令故 Python 打包；Next 16 params 为 Promise（照抄既有路由）。
- 风险兜底：T8 Step 3 的 JSON 字段名（如 `json['project']['id']`、`json['script']['id']`、搜索接口返回结构）若与实际响应有出入，先 `curl` 打印实际响应按实调整选择器，不改流程。
