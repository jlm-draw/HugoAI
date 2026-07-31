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
        <Link href="/news" className="text-xs text-blue-600 hover:text-blue-700">
          查看全部 →
        </Link>
      </div>
      {articles.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">
          暂无资讯，正在抓取中...
        </p>
      ) : (
        <ul className="space-y-0">
          {articles.map((article: { id: string; title: string; url: string; source: string; publishedAt: Date | null }) => (
            <li key={article.id} className="py-2.5 border-b border-gray-50 last:border-0">
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-700 hover:text-blue-600 line-clamp-1 block"
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
