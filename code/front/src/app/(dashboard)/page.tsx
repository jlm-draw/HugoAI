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
        <h1 className="text-2xl font-bold text-gray-800">{greeting}，欢迎回来</h1>
        <p className="text-sm text-gray-500 mt-1">今天想做点什么？</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <QuickActionCard href="/news" icon={Newspaper} title="AI 资讯" emoji="📰" />
        <QuickActionCard href="/ppt" icon={FileText} title="生成 PPT" emoji="📊" comingSoon />
        <QuickActionCard href="/novel" icon={BookOpen} title="写小说" emoji="✍️" />
        <QuickActionCard href="/video" icon={Video} title="生成视频" emoji="🎬" comingSoon />
      </div>

      <NewsPreview />
    </div>
  );
}
