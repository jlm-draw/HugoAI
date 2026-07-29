# HugoAI 第一阶段：基础框架 + AI资讯 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建HugoAI平台基础框架（Docker环境、Next.js项目、数据库、布局组件），实现AI资讯的定时爬取、存储和展示功能。

**Architecture:** Next.js 15 App Router 全栈架构，PostgreSQL via Prisma 存数据，Redis 用于缓存和定时任务调度，node-cron 执行每日资讯爬取，cheerio 解析HTML抓取资讯。

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Prisma, PostgreSQL 16, Redis 7, Docker Compose, node-cron, cheerio, Vercel AI SDK (OpenAI兼容模式)

---

## 文件结构概览

```
hugoai/
├── docker-compose.yml            # PG + Redis + App 服务编排
├── Dockerfile                    # Next.js 应用镜像
├── .env.example                  # 环境变量模板
├── .env.local                    # 本地环境变量（不提交）
├── prisma/
│   └── schema.prisma             # 数据库模型定义
├── src/
│   ├── app/
│   │   ├── layout.tsx            # 根布局（侧边栏+主内容）
│   │   ├── page.tsx              # Dashboard首页
│   │   ├── news/
│   │   │   └── page.tsx          # AI资讯列表页
│   │   ├── api/
│   │   │   ├── news/
│   │   │   │   └── route.ts      # 资讯CRUD API
│   │   │   └── crawl/
│   │   │       └── route.ts      # 手动触发爬取API
│   │   └── globals.css           # 全局样式
│   ├── components/
│   │   ├── Sidebar.tsx           # 侧边栏导航
│   │   ├── Header.tsx            # 顶部栏
│   │   ├── QuickActionCard.tsx   # 快捷功能卡片
│   │   └── NewsPreview.tsx       # 首页资讯预览组件
│   ├── lib/
│   │   ├── db.ts                 # Prisma客户端单例
│   │   ├── redis.ts              # Redis客户端
│   │   └── ai.ts                 # AI模型调用封装(OpenAI兼容)
│   ├── services/
│   │   └── news/
│   │       ├── types.ts          # 资讯相关类型
│   │       ├── crawlers/
│   │       │   ├── index.ts      # 爬虫注册/调度
│   │       │   ├── jiqizhixin.ts # 机器之心爬虫
│   │       │   ├── liangziwei.ts # 量子位爬虫
│   │       │   ├── 36kr.ts       # 36氪AI频道爬虫
│   │       │   └── decoder.ts    # The Decoder爬虫
│   │       └── crawler.ts        # 爬虫核心逻辑（抓取、解析、去重、存储）
│   └── jobs/
│       └── scheduler.ts          # node-cron定时任务注册
└── storage/                      # 本地文件存储目录（gitignore）
    └── .gitkeep
```

---

## Task 1: 项目初始化与Docker环境

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `storage/.gitkeep`

- [ ] **Step 1: 创建 docker-compose.yml**

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: hugoai-postgres
    environment:
      POSTGRES_USER: hugoai
      POSTGRES_PASSWORD: hugoai123
      POSTGRES_DB: hugoai
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: hugoai-redis
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    restart: unless-stopped

volumes:
  pgdata:
  redisdata:
```

- [ ] **Step 2: 创建 .env.example**

```env
# 数据库
DATABASE_URL="postgresql://hugoai:hugoai123@localhost:5432/hugoai?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# AI 模型 (OpenAI 兼容接口)
# 通义千问: https://dashscope.aliyuncs.com/compatible-mode/v1
AI_API_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
AI_API_KEY="your-api-key-here"
AI_MODEL="qwen-max"

# 应用配置
NEXT_PUBLIC_APP_NAME="HugoAI"
PORT=3000
```

- [ ] **Step 3: 创建 storage/.gitkeep 并复制环境变量文件**

```bash
mkdir -p /jlm/cc-workspace/HugoAI/storage
touch /jlm/cc-workspace/HugoAI/storage/.gitkeep
cp /jlm/cc-workspace/HugoAI/.env.example /jlm/cc-workspace/HugoAI/.env.local
```

- [ ] **Step 4: 启动Docker服务**

```bash
cd /jlm/cc-workspace/HugoAI
docker compose up -d
```

Expected: postgres 和 redis 容器成功启动，`docker compose ps` 显示两个服务状态为 running。

- [ ] **Step 5: 初始化Next.js项目**

```bash
cd /jlm/cc-workspace/HugoAI
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

当提示是否覆盖已有文件时，选择 "No"（保留 docker-compose.yml 等文件）。实际上由于create-next-app检测到非空目录会提示确认，按回车确认即可。

- [ ] **Step 6: 安装核心依赖**

```bash
cd /jlm/cc-workspace/HugoAI
npm install prisma @prisma/client ioredis node-cron cheerio ai openai
npm install -D @types/node-cron ts-node
```

- [ ] **Step 7: 初始化shadcn/ui**

```bash
cd /jlm/cc-workspace/HugoAI
npx shadcn@latest init -d
```

选择默认配置（New York风格，Slate基色，CSS变量）。

- [ ] **Step 8: 添加shadcn/ui组件**

```bash
npx shadcn@latest add card badge button separator scroll-area avatar skeleton
```

- [ ] **Step 9: 验证开发服务器启动**

```bash
npm run dev
```

Expected: 访问 http://localhost:3000 能看到Next.js默认页面。Ctrl+C停止。

- [ ] **Step 10: Commit**

```bash
git init
echo "node_modules/\n.env.local\nstorage/*\n!.gitkeep\n.superpowers/\n.next/\n*.log" > .gitignore
git add .
git commit -m "feat: initialize Next.js project with Docker, Prisma, shadcn/ui setup"
```

---

## Task 2: 数据库模型定义与迁移

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`
- Create: `src/lib/redis.ts`

- [ ] **Step 1: 创建 prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model NewsArticle {
  id           String   @id @default(cuid())
  title        String
  summary      String?
  url          String   @unique
  source       String
  publishedAt  DateTime?
  createdAt    DateTime @default(now())

  @@index([source])
  @@index([publishedAt])
  @@index([createdAt])
}
```

- [ ] **Step 2: 创建 src/lib/db.ts (Prisma单例)**

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 3: 创建 src/lib/redis.ts**

```typescript
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

export { redis };
```

- [ ] **Step 4: 运行数据库迁移**

```bash
npx prisma migrate dev --name init
npx prisma generate
```

Expected: 迁移成功，数据库中创建 NewsArticle 表。

- [ ] **Step 5: 验证数据库连接**

```bash
npx ts-node -e "
const { prisma } = require('./src/lib/db');
prisma.\$queryRaw\`SELECT 1\`.then(r => { console.log('DB connected:', r); process.exit(0); });
"
```

Expected: 输出 `DB connected: [ { '?column?': 1 } ]`

- [ ] **Step 6: Commit**

```bash
git add prisma/ src/lib/
git commit -m "feat: add Prisma schema for news articles with Redis client"
```

---

## Task 3: 全局布局组件（侧边栏 + 顶部栏）

**Files:**
- Create: `src/components/Sidebar.tsx`
- Create: `src/components/Header.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: 创建 src/components/Sidebar.tsx**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  FileText,
  BookOpen,
  Video,
  Newspaper,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/", label: "首页", icon: Home },
  { href: "/ppt", label: "PPT 生成", icon: FileText },
  { href: "/novel", label: "小说写作", icon: BookOpen },
  { href: "/video", label: "视频生成", icon: Video },
  { href: "/news", label: "AI 资讯", icon: Newspaper },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-48 min-h-screen bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-100">
        <h1 className="text-lg font-bold text-blue-600">HugoAI</h1>
      </div>
      <nav className="flex-1 py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600 font-medium"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="py-3 border-t border-gray-100">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:text-gray-600"
        >
          <Settings size={16} />
          设置
        </Link>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: 创建 src/components/Header.tsx**

```tsx
export function Header() {
  const today = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <header className="h-14 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
      <span className="text-sm text-gray-500">{today}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full">
          本地模式
        </span>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: 修改 src/app/layout.tsx**

```tsx
import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "HugoAI - 工作生活辅助平台",
  description: "AI驱动的个人工作生活辅助平台",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <Header />
            <main className="flex-1 p-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: 修改 src/app/globals.css 清理默认样式**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply text-gray-900;
  }
}
```

- [ ] **Step 5: 安装 lucide-react 图标库**

```bash
npm install lucide-react
```

- [ ] **Step 6: 验证布局**

```bash
npm run dev
```

访问 http://localhost:3000 ，确认左侧导航栏和顶部栏正确渲染，侧边栏"首页"处于激活状态。

- [ ] **Step 7: Commit**

```bash
git add src/components/ src/app/layout.tsx src/app/globals.css
git commit -m "feat: add sidebar navigation and header layout components"
```

---

## Task 4: AI模型调用封装

**Files:**
- Create: `src/lib/ai.ts`

- [ ] **Step 1: 创建 src/lib/ai.ts**

```typescript
import OpenAI from "openai";

const apiKey = process.env.AI_API_KEY;
const baseURL = process.env.AI_API_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
const model = process.env.AI_MODEL || "qwen-max";

const client = apiKey
  ? new OpenAI({ apiKey, baseURL })
  : null;

export interface ChatOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function chat(
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  options: ChatOptions = {}
): Promise<string> {
  if (!client) {
    throw new Error("AI_API_KEY 未配置，请在 .env.local 中设置");
  }

  const { systemPrompt, temperature = 0.7, maxTokens } = options;
  const allMessages = systemPrompt
    ? [{ role: "system" as const, content: systemPrompt }, ...messages]
    : messages;

  const response = await client.chat.completions.create({
    model,
    messages: allMessages,
    temperature,
    max_tokens: maxTokens,
  });

  return response.choices[0]?.message?.content ?? "";
}

export { model as currentModel, client };
```

- [ ] **Step 2: 验证AI调用（需要配置API Key）**

在 `.env.local` 中设置你的通义千问/DeepSeek API Key后运行：

```bash
npx ts-node -e "
const { chat } = require('./src/lib/ai');
chat([{ role: 'user', content: '你好，用一句话介绍自己' }]).then(r => console.log('AI response:', r));
"
```

Expected: 输出一行中文回复。如果没有配置API Key，跳过此步（后续配置后再测试）。

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai.ts
git commit -m "feat: add AI client wrapper with OpenAI-compatible interface"
```

---

## Task 5: 资讯爬虫服务

**Files:**
- Create: `src/services/news/types.ts`
- Create: `src/services/news/crawler.ts`
- Create: `src/services/news/crawlers/index.ts`
- Create: `src/services/news/crawlers/jiqizhixin.ts`
- Create: `src/services/news/crawlers/liangziwei.ts`
- Create: `src/services/news/crawlers/36kr.ts`
- Create: `src/services/news/crawlers/decoder.ts`

- [ ] **Step 1: 创建 src/services/news/types.ts**

```typescript
export interface NewsItem {
  title: string;
  summary?: string;
  url: string;
  source: string;
  publishedAt?: Date;
}

export interface CrawlerResult {
  source: string;
  items: NewsItem[];
  error?: string;
}

export interface NewsCrawler {
  source: string;
  crawl(): Promise<CrawlerResult>;
}
```

- [ ] **Step 2: 创建 src/services/news/crawler.ts（爬虫核心逻辑）**

```typescript
import { prisma } from "@/lib/db";
import { redis } from "@/lib/redis";
import type { NewsItem, NewsCrawler, CrawlerResult } from "./types";

const LAST_CRAWL_KEY = "news:last_crawl";

export async function runCrawlers(crawlers: NewsCrawler[]): Promise<{
  totalNew: number;
  totalFetched: number;
  results: CrawlerResult[];
}> {
  const results: CrawlerResult[] = [];
  let totalNew = 0;
  let totalFetched = 0;

  for (const crawler of crawlers) {
    try {
      console.log(`[crawler] Fetching from ${crawler.source}...`);
      const result = await crawler.crawl();
      results.push(result);
      totalFetched += result.items.length;

      for (const item of result.items) {
        const existing = await prisma.newsArticle.findUnique({
          where: { url: item.url },
        });
        if (!existing) {
          await prisma.newsArticle.create({
            data: {
              title: item.title,
              summary: item.summary ?? null,
              url: item.url,
              source: item.source,
              publishedAt: item.publishedAt ?? null,
            },
          });
          totalNew++;
        }
      }
      console.log(`[crawler] ${crawler.source}: ${result.items.length} fetched, ${result.items.length} total`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[crawler] ${crawler.source} error:`, msg);
      results.push({ source: crawler.source, items: [], error: msg });
    }
  }

  await redis.set(LAST_CRAWL_KEY, new Date().toISOString());
  return { totalNew, totalFetched, results };
}

export async function getLastCrawlTime(): Promise<Date | null> {
  const val = await redis.get(LAST_CRAWL_KEY);
  return val ? new Date(val) : null;
}
```

- [ ] **Step 3: 创建机器之心爬虫 src/services/news/crawlers/jiqizhixin.ts**

```typescript
import * as cheerio from "cheerio";
import type { NewsCrawler, NewsItem } from "../types";

export const jiqizhixinCrawler: NewsCrawler = {
  source: "机器之心",
  async crawl(): Promise<{ source: string; items: NewsItem[] }> {
    const url = "https://www.jiqizhixin.com";
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HugoAI/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    const $ = cheerio.load(html);
    const items: NewsItem[] = [];

    $(".article-item, .article__title, a[href*='/articles/']").each((_, el) => {
      const $el = $(el);
      const title = $el.text().trim();
      let href = $el.attr("href") || "";
      if (href.startsWith("/")) href = url + href;
      if (title && href.includes("/articles/") && title.length > 5) {
        items.push({ title, url: href, source: "机器之心" });
      }
    });

    return { source: "机器之心", items: items.slice(0, 20) };
  },
};
```

- [ ] **Step 4: 创建量子位爬虫 src/services/news/crawlers/liangziwei.ts**

```typescript
import * as cheerio from "cheerio";
import type { NewsCrawler, NewsItem } from "../types";

export const liangziweiCrawler: NewsCrawler = {
  source: "量子位",
  async crawl(): Promise<{ source: string; items: NewsItem[] }> {
    const url = "https://www.qbitai.com";
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HugoAI/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    const $ = cheerio.load(html);
    const items: NewsItem[] = [];

    $("article h2 a, .post-title a, h3 a").each((_, el) => {
      const $el = $(el);
      const title = $el.text().trim();
      const href = $el.attr("href") || "";
      if (title && href.startsWith("http") && title.length > 5) {
        items.push({ title, url: href, source: "量子位" });
      }
    });

    return { source: "量子位", items: items.slice(0, 20) };
  },
};
```

- [ ] **Step 5: 创建36氪爬虫 src/services/news/crawlers/36kr.ts**

```typescript
import * as cheerio from "cheerio";
import type { NewsCrawler, NewsItem } from "../types";

export const kr36Crawler: NewsCrawler = {
  source: "36氪AI",
  async crawl(): Promise<{ source: string; items: NewsItem[] }> {
    const url = "https://36kr.com/information/AI/";
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HugoAI/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    const $ = cheerio.load(html);
    const items: NewsItem[] = [];

    $(".article-item-title a, a.article-item-title").each((_, el) => {
      const $el = $(el);
      const title = $el.text().trim();
      let href = $el.attr("href") || "";
      if (href.startsWith("/")) href = "https://36kr.com" + href;
      if (title && href.includes("/p/") && title.length > 5) {
        items.push({ title, url: href, source: "36氪AI" });
      }
    });

    return { source: "36氪AI", items: items.slice(0, 20) };
  },
};
```

- [ ] **Step 6: 创建The Decoder爬虫 src/services/news/crawlers/decoder.ts**

```typescript
import * as cheerio from "cheerio";
import type { NewsCrawler, NewsItem } from "../types";

export const decoderCrawler: NewsCrawler = {
  source: "The Decoder",
  async crawl(): Promise<{ source: string; items: NewsItem[] }> {
    const url = "https://the-decoder.com";
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HugoAI/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    const $ = cheerio.load(html);
    const items: NewsItem[] = [];

    $("article h2 a, .post-title a, h3.entry-title a").each((_, el) => {
      const $el = $(el);
      const title = $el.text().trim();
      const href = $el.attr("href") || "";
      if (title && href.startsWith("http") && title.length > 10) {
        items.push({ title, url: href, source: "The Decoder" });
      }
    });

    return { source: "The Decoder", items: items.slice(0, 20) };
  },
};
```

- [ ] **Step 7: 创建爬虫注册入口 src/services/news/crawlers/index.ts**

```typescript
import type { NewsCrawler } from "../types";
import { jiqizhixinCrawler } from "./jiqizhixin";
import { liangziweiCrawler } from "./liangziwei";
import { kr36Crawler } from "./36kr";
import { decoderCrawler } from "./decoder";

export const allCrawlers: NewsCrawler[] = [
  jiqizhixinCrawler,
  liangziweiCrawler,
  kr36Crawler,
  decoderCrawler,
];

export { jiqizhixinCrawler, liangziweiCrawler, kr36Crawler, decoderCrawler };
```

- [ ] **Step 8: 手动测试爬虫**

```bash
npx ts-node -e "
const { allCrawlers } = require('./src/services/news/crawlers');
const { runCrawlers } = require('./src/services/news/crawler');
runCrawlers(allCrawlers).then(r => {
  console.log('Fetched:', r.totalFetched, 'New:', r.totalNew);
  r.results.forEach(res => console.log(res.source, ':', res.items.length, 'items', res.error ? 'ERROR: '+res.error : ''));
  process.exit(0);
});
"
```

Expected: 每个来源应该能抓取到一些文章（具体数量取决于网站结构，部分可能因反爬失败，这是正常的）。检查数据库中是否有数据写入：

```bash
npx prisma studio
```

访问 http://localhost:5555 查看 NewsArticle 表中的数据。

- [ ] **Step 9: Commit**

```bash
git add src/services/news/
git commit -m "feat: add news crawlers for jiqizhixin, qbitai, 36kr, the-decoder with dedup storage"
```

---

## Task 6: 资讯API路由

**Files:**
- Create: `src/app/api/news/route.ts`
- Create: `src/app/api/crawl/route.ts`

- [ ] **Step 1: 创建 GET API - 资讯列表 src/app/api/news/route.ts**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "20");
  const source = searchParams.get("source");
  const skip = (page - 1) * pageSize;

  const where = source ? { source } : {};
  const [articles, total] = await Promise.all([
    prisma.newsArticle.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
    }),
    prisma.newsArticle.count({ where }),
  ]);

  return NextResponse.json({ articles, total, page, pageSize });
}
```

- [ ] **Step 2: 创建手动爬取API src/app/api/crawl/route.ts**

```typescript
import { NextResponse } from "next/server";
import { runCrawlers } from "@/services/news/crawler";
import { allCrawlers } from "@/services/news/crawlers";

export async function POST() {
  try {
    const result = await runCrawlers(allCrawlers);
    return NextResponse.json({
      success: true,
      newArticles: result.totalNew,
      totalFetched: result.totalFetched,
      sources: result.results.map((r) => ({
        source: r.source,
        count: r.items.length,
        error: r.error,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 3: 测试API**

启动dev server：

```bash
npm run dev
```

测试资讯列表API：

```bash
curl http://localhost:3000/api/news
```

Expected: JSON返回文章列表。

测试手动爬取：

```bash
curl -X POST http://localhost:3000/api/crawl
```

Expected: JSON返回爬取统计。

- [ ] **Step 4: Commit**

```bash
git add src/app/api/
git commit -m "feat: add news list API and manual crawl trigger API"
```

---

## Task 7: 定时任务调度

**Files:**
- Create: `src/jobs/scheduler.ts`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: 创建 src/jobs/scheduler.ts**

```typescript
import cron from "node-cron";
import { runCrawlers, getLastCrawlTime } from "@/services/news/crawler";
import { allCrawlers } from "@/services/news/crawlers";

let initialized = false;

export function initScheduler() {
  if (initialized || process.env.NODE_ENV === "production_build") return;
  initialized = true;

  // 每天早上8点执行资讯爬取
  cron.schedule("0 8 * * *", async () => {
    console.log("[scheduler] Running daily news crawl at", new Date().toISOString());
    const result = await runCrawlers(allCrawlers);
    console.log(`[scheduler] Crawl complete: ${result.totalNew} new articles`);
  });

  // 启动时检查：如果今天还没爬取过，立即执行一次
  (async () => {
    const last = await getLastCrawlTime();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!last || last < today) {
      console.log("[scheduler] No crawl today yet, running initial crawl...");
      const result = await runCrawlers(allCrawlers);
      console.log(`[scheduler] Initial crawl complete: ${result.totalNew} new articles`);
    } else {
      console.log("[scheduler] Already crawled today, skipping initial crawl");
    }
  })();

  console.log("[scheduler] Initialized - daily crawl at 8:00 AM");
}
```

- [ ] **Step 2: 在 src/app/layout.tsx 中注册定时任务（服务端）**

注意：不能直接在layout.tsx（客户端组件可能渲染两次）中调用，需要在服务端初始化。创建一个instrumentation文件：

创建 `src/instrumentation.ts`：

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initScheduler } = await import("@/jobs/scheduler");
    initScheduler();
  }
}
```

- [ ] **Step 3: 在 next.config.ts 中启用instrumentation**

读取现有 next.config 文件并修改：

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
```

如果项目用的是 `next.config.mjs`，对应改为：

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
```

- [ ] **Step 4: 重启dev server验证定时任务**

```bash
npm run dev
```

Expected: 终端日志中应该看到 `[scheduler] Initialized` 消息，以及首次启动时的initial crawl日志。

- [ ] **Step 5: Commit**

```bash
git add src/jobs/ src/instrumentation.ts next.config.*
git commit -m "feat: add daily cron scheduler for news crawling with startup check"
```

---

## Task 8: Dashboard首页

**Files:**
- Create: `src/components/QuickActionCard.tsx`
- Create: `src/components/NewsPreview.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: 创建快捷功能卡片 src/components/QuickActionCard.tsx**

```tsx
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface QuickActionCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  emoji?: string;
  comingSoon?: boolean;
}

export function QuickActionCard({
  href,
  icon: Icon,
  title,
  emoji,
  comingSoon,
}: QuickActionCardProps) {
  const content = (
    <div className="bg-white border border-gray-200 rounded-xl p-5 text-center hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group">
      <div className="text-3xl mb-2">{emoji}</div>
      <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-gray-800 group-hover:text-blue-600">
        <Icon size={14} />
        {title}
      </div>
      {comingSoon && (
        <span className="text-xs text-gray-400 mt-1 block">即将推出</span>
      )}
    </div>
  );

  if (comingSoon) {
    return <div className="opacity-60">{content}</div>;
  }

  return <Link href={href}>{content}</Link>;
}
```

- [ ] **Step 2: 创建资讯预览组件 src/components/NewsPreview.tsx**

```tsx
import Link from "next/link";
import { prisma } from "@/lib/db";

export async function NewsPreview() {
  const articles = await prisma.newsArticle.findMany({
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 5,
  });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">今日 AI 资讯</h2>
        <Link
          href="/news"
          className="text-xs text-blue-600 hover:text-blue-700"
        >
          查看全部 →
        </Link>
      </div>
      {articles.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">
          暂无资讯，正在抓取中...
        </p>
      ) : (
        <ul className="space-y-0">
          {articles.map((article) => (
            <li
              key={article.id}
              className="py-2.5 border-b border-gray-50 last:border-0"
            >
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-700 hover:text-blue-600 line-clamp-1"
              >
                {article.title}
              </a>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded">
                  {article.source}
                </span>
                {article.publishedAt && (
                  <span className="text-xs text-gray-400">
                    {new Date(article.publishedAt).toLocaleDateString("zh-CN")}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 重写 src/app/page.tsx (Dashboard首页)**

```tsx
import { FileText, BookOpen, Video, Newspaper } from "lucide-react";
import { QuickActionCard } from "@/components/QuickActionCard";
import { NewsPreview } from "@/components/NewsPreview";

export default function HomePage() {
  const hour = new Date().getHours();
  const greeting =
    hour < 6 ? "夜深了" : hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          {greeting}，欢迎回来
        </h1>
        <p className="text-sm text-gray-500 mt-1">今天想做点什么？</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <QuickActionCard
          href="/news"
          icon={Newspaper}
          title="AI 资讯"
          emoji="📰"
        />
        <QuickActionCard
          href="/ppt"
          icon={FileText}
          title="生成 PPT"
          emoji="📊"
          comingSoon
        />
        <QuickActionCard
          href="/novel"
          icon={BookOpen}
          title="写小说"
          emoji="✍️"
          comingSoon
        />
        <QuickActionCard
          href="/video"
          icon={Video}
          title="生成视频"
          emoji="🎬"
          comingSoon
        />
      </div>

      <NewsPreview />
    </div>
  );
}
```

- [ ] **Step 4: 验证首页**

启动dev server访问 http://localhost:3000，确认：
- 欢迎语随时间变化正确显示
- 4个快捷卡片正确渲染（AI资讯可点击，其他显示"即将推出"）
- 资讯预览显示5条最新文章
- 整体蓝白风格与设计一致

- [ ] **Step 5: Commit**

```bash
git add src/components/ src/app/page.tsx
git commit -m "feat: implement dashboard homepage with quick actions and news preview"
```

---

## Task 9: AI资讯列表页

**Files:**
- Create: `src/app/news/page.tsx`
- Create: `src/components/NewsList.tsx`

- [ ] **Step 1: 创建资讯列表组件 src/components/NewsList.tsx**

```tsx
"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface Article {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  source: string;
  publishedAt: string | null;
  createdAt: string;
}

interface NewsResponse {
  articles: Article[];
  total: number;
  page: number;
  pageSize: number;
}

const sourceColors: Record<string, string> = {
  机器之心: "bg-blue-100 text-blue-700",
  量子位: "bg-green-100 text-green-700",
  "36氪AI": "bg-orange-100 text-orange-700",
  "The Decoder": "bg-purple-100 text-purple-700",
};

export function NewsList() {
  const [data, setData] = useState<NewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [crawling, setCrawling] = useState(false);
  const [page, setPage] = useState(1);

  async function fetchNews(p = page) {
    setLoading(true);
    const res = await fetch(`/api/news?page=${p}&pageSize=20`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  async function handleCrawl() {
    setCrawling(true);
    await fetch("/api/crawl", { method: "POST" });
    setCrawling(false);
    setPage(1);
    fetchNews(1);
  }

  useEffect(() => {
    fetchNews(page);
  }, [page]);

  if (loading && !data) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse"
          >
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-1/4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">AI 资讯</h1>
          <p className="text-sm text-gray-500">
            共 {data?.total ?? 0} 篇文章 · 第 {data?.page ?? 1} 页
          </p>
        </div>
        <Button
          onClick={handleCrawl}
          disabled={crawling}
          size="sm"
          className="gap-1.5"
        >
          <RefreshCw size={14} className={crawling ? "animate-spin" : ""} />
          {crawling ? "抓取中..." : "立即刷新"}
        </Button>
      </div>

      <div className="space-y-3">
        {data?.articles.map((article) => (
          <a
            key={article.id}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <h3 className="text-sm font-medium text-gray-800 hover:text-blue-600 mb-2">
              {article.title}
            </h3>
            <div className="flex items-center gap-2">
              <Badge
                className={`text-xs ${sourceColors[article.source] || "bg-gray-100 text-gray-700"}`}
                variant="secondary"
              >
                {article.source}
              </Badge>
              <span className="text-xs text-gray-400">
                {article.publishedAt
                  ? new Date(article.publishedAt).toLocaleDateString("zh-CN")
                  : new Date(article.createdAt).toLocaleDateString("zh-CN")}
              </span>
            </div>
          </a>
        ))}
      </div>

      {data && data.total > data.pageSize && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            上一页
          </Button>
          <span className="text-sm text-gray-500 py-1.5">
            {page} / {Math.ceil(data.total / data.pageSize)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= Math.ceil(data.total / data.pageSize)}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 创建资讯页面 src/app/news/page.tsx**

```tsx
import { NewsList } from "@/components/NewsList";

export default function NewsPage() {
  return <NewsList />;
}
```

- [ ] **Step 3: 为其他未完成的功能创建占位页面**

创建 `src/app/ppt/page.tsx`:

```tsx
export default function PptPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="text-5xl mb-4">📊</div>
      <h1 className="text-xl font-bold text-gray-800 mb-2">PPT 生成</h1>
      <p className="text-sm text-gray-500">即将推出，敬请期待</p>
    </div>
  );
}
```

创建 `src/app/novel/page.tsx`:

```tsx
export default function NovelPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="text-5xl mb-4">✍️</div>
      <h1 className="text-xl font-bold text-gray-800 mb-2">小说写作</h1>
      <p className="text-sm text-gray-500">即将推出，敬请期待</p>
    </div>
  );
}
```

创建 `src/app/video/page.tsx`:

```tsx
export default function VideoPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="text-5xl mb-4">🎬</div>
      <h1 className="text-xl font-bold text-gray-800 mb-2">视频生成</h1>
      <p className="text-sm text-gray-500">即将推出，敬请期待</p>
    </div>
  );
}
```

- [ ] **Step 4: 验证资讯列表页**

访问 http://localhost:3000/news 确认：
- 文章列表正确加载
- 来源标签颜色区分显示
- "立即刷新"按钮可以触发爬取并更新列表
- 分页功能正常
- 侧边栏"AI 资讯"处于激活状态

- [ ] **Step 5: Commit**

```bash
git add src/app/news/ src/app/ppt/ src/app/novel/ src/app/video/ src/components/NewsList.tsx
git commit -m "feat: add news list page with pagination, refresh, and placeholder pages for upcoming features"
```

---

## Task 10: Docker部署配置与最终验证

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Modify: `docker-compose.yml`

- [ ] **Step 1: 创建 Dockerfile**

```dockerfile
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

- [ ] **Step 2: 创建 .dockerignore**

```
node_modules
.next
.env.local
.env
.git
.superpowers
storage/*
!storage/.gitkeep
*.log
```

- [ ] **Step 3: 在 next.config 中启用 standalone output**

修改 nextConfig：

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
```

- [ ] **Step 4: 更新 docker-compose.yml 添加app服务**

在现有 docker-compose.yml 的 services 中添加：

```yaml
  app:
    build: .
    container_name: hugoai-app
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://hugoai:hugoai123@postgres:5432/hugoai?schema=public
      - REDIS_URL=redis://redis:6379
      - AI_API_BASE_URL=${AI_API_BASE_URL:-https://dashscope.aliyuncs.com/compatible-mode/v1}
      - AI_API_KEY=${AI_API_KEY:-}
      - AI_MODEL=${AI_MODEL:-qwen-max}
    depends_on:
      - postgres
      - redis
    volumes:
      - ./storage:/app/storage
    restart: unless-stopped
```

- [ ] **Step 5: 创建 README.md 启动说明**

```markdown
# HugoAI

本地运行的AI工作生活辅助平台。

## 快速启动

1. 复制环境变量文件：
```bash
cp .env.example .env.local
```

2. 在 `.env.local` 中配置你的 AI API Key（通义千问/DeepSeek等OpenAI兼容接口）

3. 启动所有服务（开发模式）：
```bash
docker compose up -d postgres redis
npm install
npm run dev
```

4. 访问 http://localhost:3000

## 功能
- AI 资讯聚合（已完成）
- PPT 生成（开发中）
- 小说写作（开发中）
- 视频生成（开发中）
```

- [ ] **Step 6: 最终端到端验证**

1. 确保Docker中postgres和redis正在运行：`docker compose ps`
2. 运行 `npm run dev`
3. 访问 http://localhost:3000 — 首页显示欢迎语、4个功能卡片、资讯预览
4. 点击"AI资讯"或左侧导航 — 进入资讯列表页，能看到抓取的文章
5. 点击"立即刷新"按钮 — 触发爬取，数据更新
6. 点击其他功能（PPT/小说/视频）— 显示"即将推出"占位页
7. 检查日志确认定时任务已初始化

- [ ] **Step 7: 最终Commit**

```bash
git add Dockerfile .dockerignore docker-compose.yml next.config.* README.md
git commit -m "feat: add Docker production build config and README"
```

---

## 验收检查清单

- [ ] Docker Compose 启动 PG + Redis 正常
- [ ] Next.js dev server 启动无报错
- [ ] 首页 Dashboard 正确渲染（侧边栏、顶部栏、欢迎语、快捷卡片、资讯预览）
- [ ] 定时任务启动日志可见，启动时自动爬取一次资讯
- [ ] GET /api/news 返回分页文章列表
- [ ] POST /api/crawl 触发爬虫并存储新文章（URL去重）
- [ ] 资讯列表页：分页、来源标签、手动刷新、骨架屏加载态
- [ ] 蓝白主题风格一致，shadcn/ui组件正常工作
- [ ] PPT/小说/视频页面显示"即将推出"占位，侧边栏导航正确高亮
