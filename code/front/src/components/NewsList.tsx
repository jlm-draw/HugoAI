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
  "机器之心": "bg-blue-100 text-blue-700 hover:bg-blue-100",
  "量子位": "bg-green-100 text-green-700 hover:bg-green-100",
  "36氪AI": "bg-orange-100 text-orange-700 hover:bg-orange-100",
  "The Decoder": "bg-purple-100 text-purple-700 hover:bg-purple-100",
};

export function NewsList() {
  const [data, setData] = useState<NewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [crawling, setCrawling] = useState(false);
  const [page, setPage] = useState(1);

  // loading 初值为 true；await 前不做同步 setState（react-hooks/set-state-in-effect）
  async function fetchNews(p: number) {
    try {
      const res = await fetch(`/api/news?page=${p}&pageSize=20`);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  async function handleCrawl() {
    setCrawling(true);
    try {
      await fetch("/api/crawl", { method: "POST" });
      setPage(1);
      await fetchNews(1);
    } finally {
      setCrawling(false);
    }
  }

  useEffect(() => {
    fetchNews(page);
  }, [page]);

  if (loading && !data) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 animate-pulse" />
            <div className="h-3 bg-gray-100 rounded w-1/4 animate-pulse" />
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
        <Button onClick={handleCrawl} disabled={crawling} size="sm" className="gap-1.5">
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
                className={`text-xs ${sourceColors[article.source] || "bg-gray-100 text-gray-700 hover:bg-gray-100"}`}
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

        {data?.articles.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            暂无资讯，点击「立即刷新」开始抓取
          </div>
        )}
      </div>

      {data && data.total > data.pageSize && (
        <div className="flex justify-center gap-2 mt-6">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
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
