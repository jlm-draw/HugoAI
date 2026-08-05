# 短视频模块阶段3：Pexels 素材库 — 设计文档

**日期：** 2026-08-05
**状态：** 已确认
**关联：** 阶段1「脚本工坊」、阶段2「TTS 配音 + SRT 字幕」（均已上线）

## 需求

为分镜表里的每个镜头配上真实视频素材（Pexels 免版权素材库）：

1. AI 生成脚本时同步产出每个分镜的英文素材搜索词（`materialQuery`）
2. 分镜表加「素材」列：点「选素材」弹框，自动用预生成关键词搜索 Pexels，缩略图网格挑选、预览、确认
3. 选定的素材以链接形式存库（不下载本地，阶段4 剪映导出时再按需下载）
4. 关键词可手改重搜；方向默认竖屏（短视频 9:16），可切换横屏/全部

## 背景调研结论（2026-08-05 实测/文档核对）

1. **Pexels 视频搜索 API**：`GET https://api.pexels.com/videos/search`，请求头 `Authorization: <API key>`；参数 `query`（必填）、`per_page`（≤80）、`orientation`（portrait/landscape/square）、`page`、`size`。
2. 响应中每个 video 含 `id`、`duration`、`image`（缩略图）、`video_files[]`（`quality`/`width`/`height`/`link`/`file_type`）。
3. **免费额度**：200 次请求/小时、20000 次/月——个人使用绰绰有余。
4. **署名条款**：使用 API 的页面需展示指向 Pexels 的显著链接（弹框底部加署名行满足）。
5. API key 需用户自行在 pexels.com/api 免费申请，配置于 `code/front/.env.local` 的 `PEXELS_API_KEY`（不入库）。
6. 分镜的「画面描述」（visual）是中文长句，直接搜 Pexels 效果差，故由 AI 预生成英文搜索词。

## 方案选择

| 决策点 | 选定方案 | 理由 |
|---|---|---|
| 搜索关键词 | **AI 随脚本生成时预生成**（materialQuery 入 VideoShot），UI 可手改 | 搜索质量最高、选素材时零等待；旧脚本无字段时退回手输 |
| 选择交互 | **分镜表加「素材」列 + 弹框缩略图网格** | 网格挑选需要空间，弹框最合适；表格只显示结果缩略图 |
| 素材存储 | **只存链接**（视频直链 + 缩略图链），导出时再下载 | 零磁盘占用；Pexels 链接长期有效；阶段4 才需要本地文件 |
| 画面方向 | **默认 portrait，可切横屏/全部** | 抖音/视频号竖屏 9:16 |

## 详细设计

### 1. 数据模型

`VideoShot` 新增三个可空字段，迁移名 `video_shot_material`：

```prisma
model VideoShot {
  // ...既有字段
  materialQuery String?   // AI 预生成的英文搜索词，可在弹框手改后回存
  materialUrl   String?   // 选定素材的视频直链（优先 hd）；null = 未选
  materialThumb String?   // 素材缩略图链接（分镜表展示）
}
```

### 2. 脚本生成链路改造

- `prompts.ts`：shots JSON 每项增加 `materialQuery` 字段要求——「2-4 个英文搜索关键词，能直接用于免版权素材库搜到该画面，简洁具体（如 city night timelapse），不带修饰长句」
- `ai.ts` 的 `generateScript` 解析：`materialQuery` trim、截断 80 字符；AI 未返回时置 null
- 兜底：旧脚本/字段缺失 → materialQuery 为 null，前端搜索框为空由用户手输，不阻塞

### 3. API

**GET `/api/video/materials/search` — 素材搜索代理（key 不出服务端）**

- 守卫：`requireVideoAccess`
- 参数：`query`（必填，trim，≤80 字符）、`orientation`（`portrait`/`landscape`/`square`/`all`，默认 `portrait`；`all` = 不向 Pexels 传该参数）、`page`（默认 1）
- 内部：fetch Pexels（`Authorization: Bearer $PEXELS_API_KEY`，10 秒超时，`per_page=12`，`size=medium`）
- 精简返回：

```json
{ "videos": [ { "id": "...", "thumb": "...", "duration": 12,
  "files": [ { "quality": "hd", "width": 1080, "height": 1920, "link": "https://...mp4" } ] } ],
  "nextPage": 2 }
```

- files 过滤：每个视频最多保留 2 个文件，优先 `hd` 次选 `sd`（uhd 过大不传前端）
- 错误：未配置 `PEXELS_API_KEY` → 503 + 提示文案；Pexels 4xx/5xx/429/超时 → 502「素材获取失败，请稍后再试」

**PATCH `/api/video/projects/[id]/scripts/[scriptId]/shots/[shotId]` — 更新分镜素材**

- 守卫 + 属主校验（shot → script → project → 当前用户，查不到 → 404）
- Body：`{ materialUrl?, materialThumb?, materialQuery? }`，至少一个字段，否则 400
  - `materialUrl: null` → 清除素材（materialThumb 一并清空）
  - `materialUrl` 非空但非 `https://` 前缀 → 400
  - `materialQuery` trim、≤80 字符
- 返回更新后的 shot（serializeShot）

**权限与配置**：沿用 `video:use`，无新权限码；`PEXELS_API_KEY` 在 `.env.local`，绝不入库。

### 4. 序列化与类型

- `VideoShotItem` 加 `materialQuery/materialUrl/materialThumb: string | null`
- `serializeShot` 附带三字段（guard 的 shots include 无需改，都是标量）

### 5. 前端

**分镜表「素材」列**（ScriptDetail 表格最后一列）：

- 未选：「选素材」小按钮
- 已选：竖版缩略图（约 36×64）+ hover 出现「换」「移除」操作

**新组件 `components/video/MaterialPicker.tsx`**（Dialog）：

- 打开：自动以该分镜 `materialQuery` 发起搜索（无关键词则展示空输入框）
- 顶部：关键词输入框 + 方向切换（竖屏/横屏/全部，默认竖屏）+「搜索」按钮
- 中部：缩略图网格（3 列，带时长角标）；底部「加载更多」（page+1 追加结果）
- 点缩略图：切换大预览（`<video>` 静音自动播放）+「使用此素材」按钮
- 确认：PATCH shot → 刷新工作台（onChanged）→ 表格出现缩略图
- 底部署名行：「素材来自 Pexels ↗」（链接 pexels.com，条款要求）
- 状态文案：搜索中骨架、空结果提示重换关键词、未配置 key 的 503 提示、429 限流提示

### 6. 验证标准

1. `tsc --noEmit` / `npm run lint` / `npm run build` 通过
2. 生成新脚本 → 各分镜 `materialQuery` 非空（英文 2-4 词）
3. curl 冒烟（需有效 PEXELS_API_KEY）：
   - search → 200，videos 数组含 thumb/duration/files，files 均为 hd/sd
   - `orientation=all` 正常；空 query → 400；未配置 key → 503
   - PATCH 选素材（materialUrl/materialThumb）→ 工作台返回的 shot 含链接；PATCH `{materialUrl: null}` 清除；越权 shotId → 404
4. UI 走查：分镜「选素材」→ 弹框自动搜索出网格 → 预览播放 → 「使用此素材」→ 表格出缩略图 → 移除恢复；手改关键词重搜正常

## 不做的事（YAGNI）

- 素材本地下载（阶段4 导出时按需）
- 自制素材上传 / 素材收藏库
- 批量自动为全部镜头选素材
- 素材视频画质自选（自动 hd/sd 即可）

## 风险

- Pexels 免费限流（200 次/小时）：个人使用远远够；超限走 502 提示稍后再试
- AI 生成的英文关键词偶尔不精准：弹框支持手改重搜，闭环在 UI 内解决
- 外链失效：Pexels CDN 链接长期稳定；真失效时重新选择即可
