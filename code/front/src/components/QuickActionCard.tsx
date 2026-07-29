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
