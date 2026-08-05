# 短视频模块阶段2：TTS 配音 + 按句对齐 SRT 字幕 — 设计文档

**日期：** 2026-08-05
**状态：** 已确认
**关联：** `docs/superpowers/plans/2026-08-04-video-phase1-script-workshop.md`（阶段1「脚本工坊」，已上线）、`docs/superpowers/specs/2026-08-04-video-news-integration-design.md`（资讯联动，已上线）

## 需求

为脚本工坊生成的口播稿配音，并产出按句对齐的 SRT 字幕：

1. 脚本详情页可手动「生成配音」，音色可选（预置中文音色，选择记录在脚本上）
2. 产出一个完整 mp3 + 一份按句对齐的 SRT 字幕（时间戳精确到毫秒，来自 TTS 引擎的句子边界事件，非估算）
3. 详情页提供播放器 + 同步字幕列表（播放高亮当前句、自动滚动、点击字幕行跳转播放），并可下载 mp3 / srt
4. 支持重新生成（覆盖旧音频与字幕）

## 背景调研结论（2026-08-05 实测）

1. **CosyVoice 不可用**：当前 `AI_API_KEY` 是阿里百炼 token-plan 聊天套餐。实测 `cosyvoice-v1/v2/v3-flash`、`qwen3-tts`、`sambert-zhichu-v1` 在该端点 `/audio/speech` 均返回 404 "Model not exist"；标准 DashScope 端点也不认此 key。要用 CosyVoice 需先在阿里云开通语音模型服务。
2. **Edge-TTS 可用**：Microsoft Edge TTS 端点实测 HTTP 200 连通，免费无需 key，中文音色质量高。npm 包 `msedge-tts@2.0.7`（2026-07-09 发布）支持 `sentenceBoundaryEnabled`——整段合成时返回每句的 Offset/Duration（100ns 单位），可直接生成按句对齐的 SRT。注意其 README：Read Aloud API 要求 Edge UA，服务端运行时不受影响（库内部处理）。
3. **本机无 ffmpeg**（`which ffmpeg` 为空），排除「按分镜合成再拼接」路线。
4. 项目无异步任务队列；既有脚本生成即同步请求（约 2 分钟），60 秒音频合成约 10-30 秒，同步处理有先例且耗时更短。
5. 口播稿由阶段1提示词约束在 200-260 字（约 60 秒），单次合成体量小，mp3 约 700KB。

## 方案选择

| 决策点 | 选定方案 | 理由 |
|---|---|---|
| TTS 引擎 | **Edge-TTS**（`msedge-tts`），预留 `TtsProvider` 抽象接口 | 现有 key 不支持 CosyVoice；Edge-TTS 免费、实测连通、自带句子时间戳；抽象层日后接 CosyVoice 只需加适配器 |
| 合成策略 | **整段口播稿一次合成 + 引擎句子时间戳** | 单文件、无需 ffmpeg、时间戳精确；字幕按引擎标点断句，对中文口播稿天然合适。分镜 duration 维持 AI 估算值（分镜级音频留给阶段4） |
| 音色 | **UI 可选**，预置 5 个中文音色，选择存脚本 | 不同账号定位需要不同人设声音，成本为零 |
| 生成时机 | **手动按钮**（脚本详情页「生成配音」） | 不与 2 分钟的脚本生成串联；未来支持改稿后重新配音也不冲突 |
| 展示 | **播放器 + 同步字幕列表** + 下载 mp3/srt | 「按句对齐」的价值需要直观呈现 |

## 详细设计

### 1. 数据模型

`VideoScript` 新增三个可空字段，迁移名 `video_script_audio`：

```prisma
model VideoScript {
  // ...既有字段
  voice    String?   // 使用的音色，如 zh-CN-YunxiNeural；重新生成默认沿用
  audioUrl String?   // 音频访问路径（带鉴权的 API 路径）；null = 未配音
  srt      String?   // SRT 字幕文本（约 2-4KB，直接存库）
}
```

- 不加 `audioDuration` 字段：前端播放器加载后自然有时长，列表页不展示，YAGNI。
- 重新生成覆盖同名字段与同名文件，`audioUrl` 值不变。

### 2. 服务层（`services/video/tts.ts`）

Provider 抽象（未来换引擎只动这一层）：

```ts
export interface TtsSentence { text: string; startMs: number; endMs: number; }
export interface TtsResult { audio: Buffer; sentences: TtsSentence[]; }
export interface TtsProvider {
  synthesize(text: string, voice: string): Promise<TtsResult>;
}
```

`EdgeTtsProvider` 实现要点：

- `msedge-tts` 的 `setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, { sentenceBoundaryEnabled: true })`（只开句子边界，不开词级，避免元数据膨胀）
- `toFile(临时目录, text)` 产出音频文件与 metadata 文件；读取后解析 `SentenceBoundary` 条目：`Offset / 10000 = startMs`，`(Offset + Duration) / 10000 = endMs`
- 临时目录用 `os.tmpdir()` 下按 scriptId 命名，用完清理
- 任何失败抛带中文信息的 Error，由路由统一转 502

`toSrt(sentences): string` 纯函数：标准 SRT 格式（序号 + `HH:MM:SS,mmm --> HH:MM:SS,mmm` + 文本 + 空行）。

### 3. 音色常量（`services/video/types.ts` 追加）

```ts
export const VOICES = [
  { id: "zh-CN-XiaoxiaoNeural", name: "晓晓", gender: "女", style: "温暖亲切" },
  { id: "zh-CN-XiaoyiNeural",   name: "晓伊", gender: "女", style: "活泼明快" },
  { id: "zh-CN-YunxiNeural",    name: "云希", gender: "男", style: "年轻阳光" },
  { id: "zh-CN-YunjianNeural",  name: "云健", gender: "男", style: "沉稳解说" },
  { id: "zh-CN-YunyangNeural",  name: "云扬", gender: "男", style: "新闻专业" },
] as const;
export const DEFAULT_VOICE = "zh-CN-YunxiNeural";
```

### 4. API

**POST `/api/video/projects/[id]/scripts/[scriptId]/narration` — 生成配音**

- 守卫：`requireVideoAccess` + 属主校验（script.projectId === id 且 project.userId === 当前用户；查不到 → 404）
- Body `{ voice }`：不在 `VOICES` 列表 → 400；脚本 narration 为空 → 400
- 流程：`synthesize` → 写 `code/front/storage/audio/<scriptId>.mp3`（目录不存在则创建，重新生成即覆盖）→ `toSrt` → 更新 DB `voice/audioUrl/srt`
- 顺序保证不写脏数据：TTS 失败不落库；写文件失败不落库；仅 DB 更新成功才算完成
- 成功：`200 { narration: { audioUrl, srt, voice } }`
- TTS 失败：`502 { error: "语音合成失败，请重试" }`
- `audioUrl` 存相对路径 `/api/video/projects/<id>/scripts/<scriptId>/audio`

**GET `/api/video/projects/[id]/scripts/[scriptId]/audio` — 音频下发**

- 守卫同上（文件不进 `public/`，RBAC 闭环）
- 文件不存在 → 404；存在 → `Content-Type: audio/mpeg` 全量返回
- 不实现 Range：文件约 700KB，浏览器快速全量缓冲后进度条拖拽不受影响；后续若有长音频再补
- Cookie JWT 认证 ⇒ 前端 `<a href>` 可直接下载，mp3 与 srt（srt 由前端用已拿到的文本生成 Blob 下载）均不需要 fetch 中转

**既有接口改动**

- `GET /api/video/projects/[id]`：`serializeScript` 附带 `voice/audioUrl/srt`（无则 null）
- `DELETE .../scripts/[scriptId]`：删除记录后 best-effort `fs.unlink` 音频文件（失败仅告警不影响删除）

### 5. 前端（`components/video/NarrationPanel.tsx`，ScriptDetail 新增「配音与字幕」区）

- **未配音**：音色 Select（格式「云希（男 · 年轻阳光）」，默认 `DEFAULT_VOICE` 或脚本已有 `voice`）+「生成配音」按钮（合成中显示「合成中…」并禁用，提示约需 10-30 秒）
- **已配音**：`<audio controls src={audioUrl}>` + 「重新生成」（音色 Select 保留）+ 「下载 MP3」（`<a href={audioUrl} download>`）+「下载 SRT」（SRT 文本生成 Blob 下载）
- **字幕列表**：客户端解析 SRT（`parseSrt` 小纯函数，产出 `{index, startMs, endMs, text}[]`）
  - 监听 audio `timeupdate`：当前句高亮 + `scrollIntoView({ block: "nearest" })` 自动滚动
  - 点击字幕行：`audio.currentTime = startMs / 1000` 并继续播放
- 生成成功后调工作台 `refresh()` 更新数据，按钮区切换为已配音形态

### 6. 文件存储

- 目录：`code/front/storage/audio/`，文件名 `<scriptId>.mp3`
- `.gitignore` 追加 `storage/`
- 生命周期：生成配音写入；重新生成覆盖；删除脚本时 unlink

### 7. 错误处理汇总

| 场景 | 行为 |
|---|---|
| TTS 网络/协议失败 | 502 + 前端 toast；DB 无脏数据 |
| 非法音色 / 空 narration | 400 |
| 未登录 / 无 video:use 权限 | 401 / 403（复用守卫） |
| 项目/脚本不存在或越权 | 404 |
| 删除脚本 | 级联删记录 + best-effort 删音频文件 |
| Edge-TTS 服务端协议变更 | Provider 抽象层隔离，可替换实现 |

### 8. 验证标准

1. `tsc --noEmit` / `npm run lint` / `npm run build` 通过
2. curl 冒烟：
   - POST narration（合法音色）→ 200，返回 audioUrl/srt/voice；磁盘出现 mp3（magic bytes `ID3` 或 `0xFFFB`）
   - GET audio → 200 + `audio/mpeg`
   - SRT 文本格式合法：序号递增、`HH:MM:SS,mmm --> HH:MM:SS,mmm`、句数 > 0、首句 start 为 0
   - 非法音色 → 400；他人脚本 → 404
3. UI 走查：生成配音 → 合成中状态 → 播放器可播 → 字幕随播放高亮/滚动 → 点字幕跳转 → 下载 mp3/srt 成功 → 重新生成覆盖 → 删除脚本后音频文件消失

## 不做的事（YAGNI）

- 词级（word boundary）时间戳
- 分镜级音频切分 / 回填分镜真实时长（留给阶段4 剪映导出）
- 音色试听预览
- HTTP Range 请求
- CosyVoice 实现（只留 Provider 接口）

## 风险

- Edge-TTS 是免费非官方服务，微软可能变更协议（缓解：Provider 抽象 + `msedge-tts` 社区维护活跃，2026-07 仍在发版；真失效时可转 CosyVoice 或其他实现）
