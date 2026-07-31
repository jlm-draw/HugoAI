# HugoAI

本地运行的 AI 工作生活辅助平台。

## 功能

- **用户认证与权限管理**（已完成）— JWT 登录认证、强密码策略、基于 RBAC 的角色权限控制
- **人员管理**（已完成）— 用户账号的增删改查、角色分配、启用/禁用
- **角色权限管理**（已完成）— 角色 CRUD、权限分配，预置管理员/编辑者/普通用户三种角色
- **菜单管理**（已完成）— 导航菜单的增删改查、支持多级菜单、可见性控制
- **AI 资讯**（已完成）— 每日自动抓取机器之心、量子位、36氪AI、The Decoder 的最新AI资讯
- **PPT 生成**（开发中）
- **小说写作**（开发中）
- **视频生成**（开发中）

## 安全规范

> **严禁将 `.env`、`.env.local`、`.env.*.local` 等包含密码、密钥的文件上传到 Git 仓库。**
>
> 这些文件包含数据库密码、JWT 密钥、API Key 等敏感信息，泄露将导致严重安全风险。
>
> - 使用 `.env.example` 作为配置模板（不含真实密码）
> - `.gitignore` 已配置排除所有 `.env` 文件
> - 提交代码前务必检查 `git status`，确认无敏感文件被暂存

## 快速启动

### 1. 启动数据库（Docker）

```bash
docker compose up -d
```

这会启动 PostgreSQL（端口 29981）和 Redis（端口 37488）。

### 2. 配置环境变量

复制并编辑 `.env.local`：

```bash
cp .env.example .env.local
```

必要配置项：

```env
# JWT 密钥（生产环境请使用随机强密钥）
JWT_SECRET="your-random-secret-key"

# AI 模型 (OpenAI 兼容接口)
AI_API_KEY="sk-xxx"
AI_API_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"  # 通义千问
AI_MODEL="qwen-max"
```

### 3. 初始化数据库

```bash
npm install
npm run db:push      # 同步数据库表结构
npm run db:seed      # 初始化默认数据（超管账户、角色、权限、菜单）
```

### 4. 启动应用

```bash
npm run dev
```

访问 http://localhost:18867/login 登录系统。

**初始超级管理员账户：**
- 用户名：`superadmin`
- 密码：`Jlm2026.Hugo.com@1qaz`

> 密码要求：至少12位，包含大小写字母、数字和特殊字符。

### 5. 数据库管理（可选）

```bash
npx prisma studio  # 可视化管理数据
```

## 系统管理功能说明

登录超级管理员账户后，左侧导航栏会出现「系统管理」模块：

| 功能 | 路径 | 说明 |
|------|------|------|
| 人员管理 | `/admin/users` | 管理用户账号，分配角色，重置密码，启用/禁用 |
| 角色权限 | `/admin/roles` | 管理角色，为角色分配功能权限 |
| 菜单管理 | `/admin/menus` | 管理系统导航菜单，支持多级层级 |

### RBAC 权限模型

```
用户 (User) → 用户角色 (UserRole) → 角色 (Role) → 角色权限 (RolePermission) → 权限 (Permission)
角色 (Role) → 角色菜单 (RoleMenu) → 菜单 (Menu)
```

预置权限码：
- `system:user:*` — 用户管理（查看/创建/编辑/删除/重置密码）
- `system:role:*` — 角色管理
- `system:permission:view` — 权限查看
- `system:menu:*` — 菜单管理
- `news:*` / `ppt:use` / `novel:use` / `video:use` — 业务功能权限

## 端口说明

| 服务 | 端口 |
|------|------|
| Next.js 应用 | 18867 |
| PostgreSQL | 29981 |
| Redis | 37488 |

## 技术栈

- Next.js 16 + React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui (base-nova)
- PostgreSQL + Prisma ORM
- Redis（缓存/任务队列）
- JWT 认证（jose）+ bcrypt 密码哈希
- 通义千问/DeepSeek AI API
- node-cron 定时任务
