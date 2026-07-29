import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SUPERADMIN_USERNAME = "superadmin";
const SUPERADMIN_PASSWORD = "Jlm2026.Hugo.com@1qaz";

async function main() {
  console.log("🌱 开始初始化数据库...");

  // 1. 创建超级管理员
  const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 12);

  const superadmin = await prisma.user.upsert({
    where: { username: SUPERADMIN_USERNAME },
    update: {},
    create: {
      username: SUPERADMIN_USERNAME,
      passwordHash,
      displayName: "超级管理员",
      isActive: true,
      isSuperAdmin: true,
    },
  });
  console.log(`✅ 超级管理员已创建: ${superadmin.username}`);

  // 2. 创建默认权限
  const permissions = [
    // 系统管理模块
    { module: "system", name: "查看用户", code: "system:user:view", description: "查看用户列表" },
    { module: "system", name: "创建用户", code: "system:user:create", description: "创建新用户" },
    { module: "system", name: "编辑用户", code: "system:user:edit", description: "编辑用户信息" },
    { module: "system", name: "删除用户", code: "system:user:delete", description: "删除用户" },
    { module: "system", name: "重置密码", code: "system:user:reset-password", description: "重置用户密码" },
    { module: "system", name: "查看角色", code: "system:role:view", description: "查看角色列表" },
    { module: "system", name: "管理角色", code: "system:role:manage", description: "创建/编辑/删除角色" },
    { module: "system", name: "查看权限", code: "system:permission:view", description: "查看权限列表" },
    { module: "system", name: "查看菜单", code: "system:menu:view", description: "查看菜单列表" },
    { module: "system", name: "管理菜单", code: "system:menu:manage", description: "创建/编辑/删除菜单" },

    // 业务模块
    { module: "business", name: "查看新闻", code: "news:view", description: "查看AI资讯" },
    { module: "business", name: "爬取新闻", code: "news:crawl", description: "手动触发新闻爬取" },
    { module: "business", name: "PPT生成", code: "ppt:use", description: "使用PPT生成功能" },
    { module: "business", name: "小说写作", code: "novel:use", description: "使用小说写作功能" },
    { module: "business", name: "视频生成", code: "video:use", description: "使用视频生成功能" },
  ];

  const createdPerms: Record<string, string> = {};
  for (const perm of permissions) {
    const p = await prisma.permission.upsert({
      where: { code: perm.code },
      update: perm,
      create: perm,
    });
    createdPerms[perm.code] = p.id;
  }
  console.log(`✅ ${permissions.length} 个权限已就绪`);

  // 3. 创建默认角色
  const adminRole = await prisma.role.upsert({
    where: { code: "admin" },
    update: {
      name: "管理员",
      description: "系统管理员，拥有系统管理权限",
      isSystem: true,
    },
    create: {
      name: "管理员",
      code: "admin",
      description: "系统管理员，拥有系统管理权限",
      isSystem: true,
    },
  });

  const editorRole = await prisma.role.upsert({
    where: { code: "editor" },
    update: {
      name: "编辑者",
      description: "内容编辑者，可使用业务功能",
      isSystem: true,
    },
    create: {
      name: "编辑者",
      code: "editor",
      description: "内容编辑者，可使用业务功能",
      isSystem: true,
    },
  });

  const viewerRole = await prisma.role.upsert({
    where: { code: "viewer" },
    update: {
      name: "普通用户",
      description: "只读用户，仅可查看",
      isSystem: true,
    },
    create: {
      name: "普通用户",
      code: "viewer",
      description: "只读用户，仅可查看",
      isSystem: true,
    },
  });
  console.log("✅ 3 个默认角色已创建");

  // 4. 为角色分配权限
  const adminPerms = Object.keys(createdPerms);
  const editorPerms = ["news:view", "news:crawl", "ppt:use", "novel:use", "video:use"];
  const viewerPerms = ["news:view"];

  async function syncRolePerms(roleId: string, permCodes: string[]) {
    await prisma.rolePermission.deleteMany({ where: { roleId } });
    for (const code of permCodes) {
      const permId = createdPerms[code];
      if (permId) {
        await prisma.rolePermission.create({
          data: { roleId, permissionId: permId },
        });
      }
    }
  }

  await syncRolePerms(adminRole.id, adminPerms);
  await syncRolePerms(editorRole.id, editorPerms);
  await syncRolePerms(viewerRole.id, viewerPerms);
  console.log("✅ 角色权限已分配");

  // 5. 创建默认菜单
  const menus = [
    { name: "首页", path: "/", icon: "Home", sort: 1 },
    { name: "PPT 生成", path: "/ppt", icon: "FileText", sort: 2 },
    { name: "小说写作", path: "/novel", icon: "BookOpen", sort: 3 },
    { name: "视频生成", path: "/video", icon: "Video", sort: 4 },
    { name: "AI 资讯", path: "/news", icon: "Newspaper", sort: 5 },
  ];

  const menuRecords = [];
  for (const m of menus) {
    const existing = m.path
      ? await prisma.menu.findFirst({ where: { path: m.path } })
      : null;
    if (existing) {
      const menu = await prisma.menu.update({ where: { id: existing.id }, data: m });
      menuRecords.push(menu);
    } else {
      const menu = await prisma.menu.create({ data: m });
      menuRecords.push(menu);
    }
  }

  // 创建系统管理父菜单
  let adminMenu = await prisma.menu.findFirst({
    where: { name: "系统管理", parentId: null },
  });
  if (!adminMenu) {
    adminMenu = await prisma.menu.create({
      data: {
        name: "系统管理",
        icon: "Settings",
        sort: 100,
        isVisible: true,
      },
    });
  }

  const adminChildren = [
    { name: "人员管理", path: "/admin/users", icon: "Users", sort: 1 },
    { name: "角色权限", path: "/admin/roles", icon: "Shield", sort: 2 },
    { name: "菜单管理", path: "/admin/menus", icon: "Menu", sort: 3 },
  ];

  for (const child of adminChildren) {
    const existing = await prisma.menu.findFirst({ where: { path: child.path } });
    if (existing) {
      await prisma.menu.update({
        where: { id: existing.id },
        data: { ...child, parentId: adminMenu.id },
      });
    } else {
      await prisma.menu.create({
        data: { ...child, parentId: adminMenu.id },
      });
    }
  }
  console.log("✅ 默认菜单已创建");

  console.log("\n🎉 数据库初始化完成！");
  console.log(`   用户名: ${SUPERADMIN_USERNAME}`);
  console.log(`   密码: ${SUPERADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error("❌ 初始化失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
