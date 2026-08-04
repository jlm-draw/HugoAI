# 短视频脚本生成联动 AI 资讯 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 脚本工坊选「AI/科技资讯解读」赛道时，可从 AI 资讯里选一条新闻：标题自动填入选题，生成时实时抓取原文正文作为素材注入 AI，脚本详情展示来源原文链接。

**Architecture:** 方案 B（设计文档 `docs/superpowers/specs/2026-08-04-video-news-integration-design.md`）。`VideoScript.newsId` 关联 `NewsArticle`；新增抓取原文素材的服务函数（失败降级为仅标题）；生成路由注入素材；前端生成面板加新闻选择器。

**Tech Stack:** 既有栈（Prisma / Next.js Route Handlers / cheerio 已是依赖 / 通义千问）。

**验证方式：** 本项目无测试框架，沿用「typecheck + lint + build + API 冒烟」既定模式。

**环境要点：**
1. prisma 命令前必须 `set -a && source .env.local && set +a`
2. `prisma migrate dev` 需伪终端 + 自动确认：`printf 'y\n' | script -qec "..." /dev/null`
3. Prisma Client 重新生成后，**必须重启 dev server** 才能加载新模型
4. 提交只 add 源码，绝不提交 .env*

---

## 文件结构概览

```
code/backend/prisma/schema.prisma                          # VideoScript.newsId + NewsArticle 反向关系
code/front/src/
├── services/video/
│   ├── types.ts                                           # VideoScriptItem 加 news 字段
│   ├── guard.ts                                           # include 加 news
│   ├── prompts.ts                                         # system prompt 加素材约束
│   ├── ai.ts                                              # generateScript 加 material 参数
│   ├── serialize.ts                                       # 序列化附带 news
│   └── news-material.ts                                   # 新增：抓取原文素材
├── app/api/video/projects/[id]/scripts/route.ts           # 接受 newsId，抓素材，入库
└── components/video/
    ├── VideoWorkspace.tsx                                 # 新闻选择器
    └── ScriptDetail.tsx                                   # 来源链接
```

---

### Task 1: 数据模型（VideoScript.newsId）

**Files:**
- Modify: `code/backend/prisma/schema.prisma`

- [ ] **Step 1: NewsArticle 加反向关系**

在 `model NewsArticle` 的 `createdAt DateTime @default(now())` 之后、索引之前加：

```prisma
  videoScripts VideoScript[]
```

- [ ] **Step 2: VideoScript 加 newsId**

`model VideoScript` 中 `narration` 之后加字段：

```prisma
  newsId    String?
```

`shots   VideoShot[]` 之后加关系：

```prisma
  news    NewsArticle? @relation(fields: [newsId], references: [id], onDelete: SetNull)
```

`@@index([projectId])` 之后加：

```prisma
  @@index([newsId])
```

- [ ] **Step 3: 迁移**

```bash
cd /jlm/cc-workspace/HugoAI/code/front
set -a && source .env.local && set +a
printf 'y\n' | script -qec "npx prisma migrate dev --name video_script_news_ref" /dev/null | tr -d '\r' | tail -8
```
Expected: 生成 `migrations/*_video_script_news_ref/`，数据库同步，client 重新生成

- [ ] **Step 4: Commit**

```bash
git -C /jlm/cc-workspace/HugoAI add code/backend/prisma/schema.prisma code/backend/prisma/migrations
git -C /jlm/cc-workspace/HugoAI commit -m "feat(video): VideoScript 关联来源新闻 newsId"
```

---

### Task 2: 原文素材抓取服务（news-material.ts）

**Files:**
- Create: `code/front/src/services/video/news-material.ts`

- [ ] **Step 1: 创建文件**

```ts
import * as cheerio from "cheerio";

const UA = "Mozilla/5.0 (compatible; HugoAI/1.0)";
const MAX_MATERIAL_CHARS = 1200;

/** 抓取新闻原文正文作为生成素材；任何失败返回 null（降级为仅标题生成） */
export async function fetchArticleMaterial(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;

    const $ = cheerio.load(await resp.text());
    $("script, style, noscript, nav, header, footer, aside, form, iframe").remove();

    // 优先常见正文容器里的段落
    let text = $(
      "article p, .article-content p, .post-content p, .article_content p, main p"
    )
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((t) => t.length > 20)
      .join("\n");

    // 容器选择器未命中时退回全部 p 标签
    if (text.length < 100) {
      text = $("p")
        .map((_, el) => $(el).text().trim())
        .get()
        .filter((t) => t.length > 20)
        .join("\n");
    }

    // 仍不足时用 meta description
    if (text.length < 50) {
      text = (
        $('meta[property="og:description"]').attr("content") ||
        $('meta[name="description"]').attr("content") ||
        ""
      ).trim();
    }

    text = text.trim().slice(0, MAX_MATERIAL_CHARS);
    return text || null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: 类型检查 + Commit**

Run: `cd /jlm/cc-workspace/HugoAI/code/front && npx tsc --noEmit`
Expected: 无输出

```bash
git -C /jlm/cc-workspace/HugoAI add code/front/src/services/video/news-material.ts
git -C /jlm/cc-workspace/HugoAI commit -m "feat(video): 新闻原文素材抓取（失败自动降级）"
```

---

### Task 3: 类型 / 守卫 / 提示词 / 生成服务接线

**Files:**
- Modify: `code/front/src/services/video/types.ts`
- Modify: `code/front/src/services/video/guard.ts`
- Modify: `code/front/src/services/video/serialize.ts`
- Modify: `code/front/src/services/video/prompts.ts`
- Modify: `code/front/src/services/video/ai.ts`

- [ ] **Step 1: types.ts**

`VideoScriptItem` 接口中 `createdAt: string;` 之后加：

```ts
  /** 来源新闻（无则为 null） */
  news: { title: string; url: string; source: string } | null;
```

- [ ] **Step 2: guard.ts**

`getOwnedProject` 的 scripts include 改为同时带 news：

```ts
      scripts: {
        orderBy: { createdAt: "desc" },
        include: { shots: { orderBy: { sort: "asc" } }, news: true },
      },
```

- [ ] **Step 3: serialize.ts**

类型与返回值加 news：

```ts
type ScriptWithShots = Prisma.VideoScriptGetPayload<{
  include: { shots: true; news: true };
}>;
```

`serializeScript` 返回对象中 `shots: ...` 之后加：

```ts
    news: script.news
      ? { title: script.news.title, url: script.news.url, source: script.news.source }
      : null,
```

- [ ] **Step 4: prompts.ts**

`systemScriptGenerate` 返回字符串的最后一行 `- 口播稿节奏：钩子开场 → 主体内容（信息密度高）→ 结尾互动引导` 之后追加：

```
- 若提供了新闻素材，口播稿须基于素材解读和展开，不得编造素材中不存在的事实、数据与引语`;
```

（注意把原来结尾的反引号移到新行末尾）

- [ ] **Step 5: ai.ts**

`GeneratedScript` 接口之后加素材类型：

```ts
/** 注入生成流程的新闻素材 */
export interface NewsMaterial {
  newsTitle: string;
  source: string;
  content: string | null;
}
```

`generateScript` 签名改为：

```ts
export async function generateScript(
  track: TrackCode,
  topic: string,
  positioning: string | null,
  material?: NewsMaterial | null
): Promise<GeneratedScript> {
  const parts = [`选题：${topic}`];
  if (material) {
    parts.push(`【新闻素材】\n标题：${material.newsTitle}\n来源：${material.source}`);
    if (material.content) {
      parts.push(`正文：${material.content}`);
    }
  }
  parts.push("请策划完整的短视频脚本。");

  const result = await chat(
    [
      {
        role: "user",
        content: parts.join("\n"),
      },
    ],
    {
      systemPrompt: systemScriptGenerate(trackName(track), positioning),
      temperature: 0.8,
      maxTokens: 4000,
    }
  );
```

（函数体其余部分不变）

- [ ] **Step 6: 类型检查 + Commit**

Run: `npx tsc --noEmit`
Expected: 无输出

```bash
git -C /jlm/cc-workspace/HugoAI add code/front/src/services/video/
git -C /jlm/cc-workspace/HugoAI commit -m "feat(video): 生成服务接入新闻素材（类型/守卫/提示词/序列化）"
```

---

### Task 4: 生成路由接受 newsId

**Files:**
- Modify: `code/front/src/app/api/video/projects/[id]/scripts/route.ts`

- [ ] **Step 1: 修改路由**

import 追加：

```ts
import { fetchArticleMaterial } from "@/services/video/news-material";
import type { NewsMaterial } from "@/services/video/ai";
```

body 类型与解析追加 `newsId`：

```ts
  let body: { track?: unknown; topic?: unknown; newsId?: unknown };
```

参数校验段（topic 长度校验）之后加：

```ts
  const newsId = typeof body.newsId === "string" ? body.newsId : null;
  let material: NewsMaterial | null = null;
  if (newsId) {
    const article = await prisma.newsArticle.findFirst({ where: { id: newsId } });
    if (!article) {
      return NextResponse.json({ error: "新闻不存在" }, { status: 400 });
    }
    const content = await fetchArticleMaterial(article.url);
    material = { newsTitle: article.title, source: article.source, content };
  }
```

`generateScript` 调用加第四参数 `material`；`prisma.videoScript.create` 的 data 中加 `newsId`，include 加 `news: true`：

```ts
    const script = await prisma.videoScript.create({
      data: {
        projectId: id,
        track,
        topic,
        newsId,
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
      include: { shots: { orderBy: { sort: "asc" } }, news: true },
    });
```

- [ ] **Step 2: 类型检查 + Commit**

```bash
cd /jlm/cc-workspace/HugoAI/code/front && npx tsc --noEmit
git -C /jlm/cc-workspace/HugoAI add "code/front/src/app/api/video/projects/[id]/scripts/route.ts"
git -C /jlm/cc-workspace/HugoAI commit -m "feat(video): 生成接口支持 newsId（校验+抓素材+入库）"
```

---

### Task 5: 前端新闻选择器与来源展示

**Files:**
- Modify: `code/front/src/components/video/VideoWorkspace.tsx`
- Modify: `code/front/src/components/video/ScriptDetail.tsx`

- [ ] **Step 1: VideoWorkspace 加新闻状态与加载**

state 追加：

```tsx
  const [newsList, setNewsList] = useState<
    Array<{ id: string; title: string; source: string; createdAt: string }>
  >([]);
  const [newsId, setNewsId] = useState<string | null>(null);
```

加载新闻的 effect（track 为 ai-news 时拉一次）：

```tsx
  useEffect(() => {
    if (track !== "ai-news" || newsList.length > 0) return;
    let ignore = false;
    async function loadNews() {
      try {
        const res = await fetch("/api/news?page=1&pageSize=50");
        const json = await res.json();
        if (!ignore && res.ok) setNewsList(json.articles ?? []);
      } catch {
        // 加载失败保持空列表
      }
    }
    loadNews();
    return () => {
      ignore = true;
    };
  }, [track, newsList.length]);
```

选择新闻的回调（自动填选题）：

```tsx
  function handleSelectNews(id: string | null) {
    setNewsId(id ?? null);
    const article = newsList.find((n) => n.id === id);
    if (article) setTopic(article.title);
  }
```

赛道切换时清空已选新闻：`handleSelectNews` 之外，在 Select 赛道的 `onValueChange` 里改为：

```tsx
            <Select
              value={track}
              onValueChange={(v: string | null) => {
                setTrack(v ?? "");
                setNewsId(null);
              }}
            >
```

生成请求 body 加 `newsId: newsId || undefined`；生成成功后清空：`setNewsId(null)`。

- [ ] **Step 2: VideoWorkspace 生成面板加选择器行**

在「视频选题」那一行（`<div className="flex-1 space-y-1.5">`）**之前**插入：

```tsx
          {track === "ai-news" && (
            <div className="w-full space-y-1.5 sm:w-72">
              <Label>选择新闻（自动带标题和原文素材）</Label>
              {newsList.length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-2 text-xs text-gray-400">
                  暂无资讯，请先去{" "}
                  <Link href="/news" className="text-blue-600 hover:underline">
                    AI 资讯
                  </Link>{" "}
                  页抓取
                </p>
              ) : (
                <Select value={newsId ?? ""} onValueChange={handleSelectNews}>
                  <SelectTrigger>
                    <SelectValue placeholder="从最近资讯中选择一条" />
                  </SelectTrigger>
                  <SelectContent>
                    {newsList.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.title}（{n.source} · {formatDate(n.createdAt)}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
```

- [ ] **Step 3: ScriptDetail 加来源链接**

`选题：{script.topic} · {formatDate(script.createdAt)}` 那个 `<p>` 之后加：

```tsx
          {script.news && (
            <a
              href={script.news.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 block truncate text-xs text-blue-600 hover:underline"
              title={script.news.title}
            >
              来源：{script.news.source} · {script.news.title} ↗
            </a>
          )}
```

- [ ] **Step 4: 类型检查 + lint + Commit**

```bash
cd /jlm/cc-workspace/HugoAI/code/front && npx tsc --noEmit && npm run lint
git -C /jlm/cc-workspace/HugoAI add code/front/src/components/video/
git -C /jlm/cc-workspace/HugoAI commit -m "feat(video): 生成面板新闻选择器与脚本来源展示"
```

---

### Task 6: 端到端验证

**Files:** 无新增

- [ ] **Step 1: build**

Run: `cd /jlm/cc-workspace/HugoAI/code/front && npm run build`
Expected: 成功

- [ ] **Step 2: 重启 dev server（加载新 Prisma Client）**

```bash
kill $(pgrep -f "next dev" | head -1) 2>/dev/null; sleep 2
cd /jlm/cc-workspace/HugoAI/code/front && (npm run dev > /tmp/hugoai-dev.log 2>&1 &)
# 轮询直到 http://localhost:18867/login 返回 200
```

- [ ] **Step 3: API 冒烟**

```bash
BASE=http://localhost:18867
curl -s -c /tmp/hugoai-cookies.txt -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Jlm2026.Hugo.com@1qaz"}' > /dev/null
# 建项目
curl -s -b /tmp/hugoai-cookies.txt -X POST $BASE/api/video/projects -H "Content-Type: application/json" \
  -d '{"name":"资讯联动测试","positioning":"AI 资讯解读"}'
# 取一条新闻 id
NEWS_ID=$(docker exec hugoai-postgres psql -U hugoai -d hugoai -t -A -c "SELECT id FROM \"NewsArticle\" ORDER BY \"publishedAt\" DESC NULLS LAST LIMIT 1;")
# 带 newsId 生成（约 2 分钟）
curl -s -w "\nHTTP=%{http_code}\n" -b /tmp/hugoai-cookies.txt -X POST $BASE/api/video/projects/<PROJECT_ID>/scripts \
  -H "Content-Type: application/json" \
  -d '{"track":"ai-news","topic":"<该新闻标题>","newsId":"'$NEWS_ID'"}'
# Expected: 201；script.news 非空且 url/source 正确；口播稿围绕该新闻内容
# 非法 newsId → 400
curl -s -w " [%{http_code}]" -b /tmp/hugoai-cookies.txt -X POST $BASE/api/video/projects/<PROJECT_ID>/scripts \
  -H "Content-Type: application/json" -d '{"track":"ai-news","topic":"x","newsId":"nonexistent"}'
```

- [ ] **Step 4: UI 走查**

`/video` → 进项目 → 赛道选「AI/科技资讯解读」→ 出现新闻选择器 → 选中后选题自动填标题 → 生成 → 详情页出现「来源：xxx ↗」可点。

- [ ] **Step 5: 清理冒烟数据（可选，若用户要保留展示则跳过）**

---

## 自查记录（Self-Review）

- 规格覆盖：设计文档 6 节全部有对应任务（数据模型→T1，抓取→T2，提示词/生成→T3，API→T4，前端→T5，验证标准→T6）。
- 无占位符：代码步骤均给出完整代码片段与插入位置。
- 类型一致性：`NewsMaterial` 在 ai.ts 定义、route.ts 引入；`news` 字段在 types/serialize/guard/route/ScriptDetail 五处签名一致。
- 已验证的前置事实：/api/news 返回 `{articles,...}`；量子位列表页无摘要（故抓取原文）；migrate dev 需伪终端配方；Prisma client 更新需重启 dev server。
