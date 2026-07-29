import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tokenUser = await getCurrentUser();
  if (!tokenUser) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: tokenUser.userId },
    select: { isSuperAdmin: true },
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar isSuperAdmin={user?.isSuperAdmin} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
