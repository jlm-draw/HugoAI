# 短视频脚本生成联动 AI 资讯 — 设计文档

**日期：** 2026-08-04
**状态：** 已确认（方案 B）
**关联：** `docs/superpowers/plans/2026-08-04-video-phase1-script-workshop.md`（脚本工坊，已上线）

## 需求

在脚本工作台生成脚本时，赛道选「AI/科技资讯解读」后，可以直接从 AI 资讯模块挑选一条新闻：
1. 新闻标题自动填入"视频选题"
2. 新闻的实际内容自动带给 AI 作为素材，生成的口播稿围绕真实新闻展开，不编造

## 背景调研结论（2026-08-04 实测）

1. **资讯库只有标题**：爬虫只抓标题+链接，`summary` 全为空；实测量子位首页，列表页上也没有摘要文字可抓。因此"内容带过来"必须去原文抓。
2. 资讯接口 `GET /api/news?page=&pageSize=` 已存在（当前无鉴权，返回 `{articles,total,...}`）。
3. 脚本生成为非流式 JSON 调用，单次约 2 分钟；相比之下抓一篇原文 2-5 秒可忽略。

## 方案选择

| 方案 | 说明 | 结论 |
|---|---|---|
| A 只带标题 | 选题填标题，AI 自由发挥 | ❌ AI 会编造新闻细节，资讯解读赛道硬伤 |
| **B 生成时实时抓原文** | 点生成时服务端抓取选中新闻的正文作素材 | ✅ **选定** |
| C 爬虫增强抓正文 | 每天抓 40+ 篇正文存库 | ⏸ 抓取慢 20 倍、4 站点结构各异，后续再议 |

## 详细设计（方案 B）

### 1. 数据模型

`VideoScript` 新增 `newsId String?`，关联 `NewsArticle`（`onDelete: SetNull`，新闻被清理时脚本保留）：

```prisma
model VideoScript {
  // ...既有字段
  newsId String?
  news   NewsArticle? @relation(fields: [newsId], references: [id], onDelete: SetNull)
}

model NewsArticle {
  // ...既有字段
  videoScripts VideoScript[]
}
```

迁移名：`video_script_news_ref`。

### 2. 原文素材抓取

新增 `services/video/news-material.ts`：

- `fetchArticleMaterial(url: string): Promise<string | null>`
- 逻辑：fetch（UA + 10 秒超时）→ cheerio 移除 script/style/nav 等噪音 → 优先正文段落（`article p` / `.article-content p` / `main p` / `p`，取长度>20 的段落拼接），正文不足时用 `og:description` / `meta description` → 截断到 1200 字
- **任何失败（超时、404、解析不出）返回 null，不抛错**——降级为仅标题生成

### 3. AI 提示词与生成流程

- `generateScript(track, topic, positioning, material?)` 新增可选素材参数；素材以【新闻素材】块拼入 user 消息（标题 + 来源 + 正文）
- system prompt 追加约束：**若提供了新闻素材，口播稿须基于素材解读，不得编造素材中不存在的事实、数据与引语**（无素材时该约束自然不生效）
- API `POST /api/video/projects/[id]/scripts` 请求体新增可选 `newsId`：
  - 校验新闻存在（不存在 → 400）
  - 调 `fetchArticleMaterial` 抓素材（失败降级）
  - 入库时写入 `newsId`

### 4. 序列化与展示

- `serializeScript` 附带 `news: { title, url, source } | null`（guard 的 include 同步加 `news`）
- 脚本详情页：选题行下方显示"来源：{source} ↗"，点击新窗口打开原文链接

### 5. 前端交互（VideoWorkspace 生成面板）

- 赛道选「AI/科技资讯解读」时，生成面板在"视频选题"上方出现一行**新闻选择器**（最近 50 条，格式：标题（来源 · 日期）），其他赛道隐藏该行
- 选中新闻 → 选题输入框自动填入新闻标题（用户仍可编辑）
- 生成请求携带 `newsId`；生成成功后清空选题与新闻选择
- 边界：
  - 资讯为空 → 选择器禁用并提示"暂无资讯，去 AI 资讯页抓取"（链接到 /news）
  - 抓取原文失败 → 不阻塞，按仅标题生成（后端行为）
  - 切换赛道 → 清空已选新闻

### 6. 验证标准

1. typecheck / lint / build 通过
2. curl 冒烟：带 `newsId` 生成 → 返回 201，`script.news` 非空，口播稿内容围绕该新闻
3. 无 `newsId` 的旧流程不受影响；`newsId` 非法 → 400
4. UI：选赛道出现选择器、选题自动带入、详情页来源链接可点

## 不做的事（YAGNI）

- 爬虫抓正文（方案 C）
- 新闻搜索/筛选（最近 50 条够用）
- 素材内容在 UI 上的预览展示
