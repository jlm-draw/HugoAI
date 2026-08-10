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
  Users,
  Shield,
  Menu as MenuIcon,
} from "lucide-react";

const navItems = [
  { href: "/", label: "首页", icon: Home },
  { href: "/ppt", label: "PPT 生成", icon: FileText },
  { href: "/novel", label: "小说写作", icon: BookOpen },
  { href: "/video", label: "视频生成", icon: Video },
  { href: "/news", label: "资讯库", icon: Newspaper },
];

const adminItems = [
  { href: "/admin/users", label: "人员管理", icon: Users },
  { href: "/admin/roles", label: "角色权限", icon: Shield },
  { href: "/admin/menus", label: "菜单管理", icon: MenuIcon },
];

interface SidebarProps {
  isSuperAdmin?: boolean;
}

export function Sidebar({ isSuperAdmin }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-48 min-h-screen bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
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

        {isSuperAdmin && (
          <>
            <div className="my-3 px-4 py-1">
              <div className="border-t border-gray-100" />
              <p className="text-xs text-gray-400 mt-3 mb-1 font-medium uppercase tracking-wider">
                系统管理
              </p>
            </div>
            {adminItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
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
          </>
        )}
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
