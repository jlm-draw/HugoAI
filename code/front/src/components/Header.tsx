import Link from "next/link";
import { LogOut, UserCircle, Shield } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function UserMenu() {
  const tokenUser = await getCurrentUser();
  if (!tokenUser) return null;

  const user = await prisma.user.findUnique({
    where: { id: tokenUser.userId },
    select: { username: true, displayName: true, isSuperAdmin: true },
  });

  if (!user) return null;

  const displayName = user.displayName || user.username;

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-gray-500 hidden sm:inline">
        {new Date().toLocaleDateString("zh-CN", {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "long",
        })}
      </span>
      {user.isSuperAdmin && (
        <span className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
          <Shield className="size-3" />
          超级管理员
        </span>
      )}
      <div className="flex items-center gap-2 text-sm">
        <UserCircle className="size-5 text-gray-400" />
        <span className="text-gray-700 font-medium">{displayName}</span>
      </div>
      <form action="/api/auth/logout" method="POST">
        <button
          type="submit"
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 transition-colors"
        >
          <LogOut className="size-4" />
          <span className="hidden sm:inline">退出</span>
        </button>
      </form>
    </div>
  );
}

export function Header() {
  return (
    <header className="h-14 bg-white border-b border-gray-200 px-6 flex items-center justify-between flex-shrink-0">
      <div />
      <UserMenu />
    </header>
  );
}
