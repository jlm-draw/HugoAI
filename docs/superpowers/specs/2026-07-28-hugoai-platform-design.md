# HugoAI 工作生活辅助平台 - 设计文档

日期：2026-07-28（2026-07-29 更新：新增用户认证与系统管理模块）

## 概述

HugoAI 是一个本地运行的个人工作生活辅助平台，集成AI驱动的PPT生成、小说写作、视频生成和AI资讯聚合功能。采用模块化设计，方便后续功能扩展。系统支持多用户，内置完善的 RBAC 权限管理体系。

## 技术栈

- **前端 + 后端**：Next.js 16 (React 19, App Router, TypeScript)
- **数据库**：PostgreSQL 16（Docker部署）
- **缓存/队列**：Redis 7（Docker部署）
- **ORM**：Prisma
- **AI文本模型**：通义千问 Qwen-Max（主要）/ DeepSeek V3（备选）/ Kimi Moonshot（长文本备选），通过OpenAI兼容接口调用，支持灵活切换
- **视频生成API**：可灵(Kling) / 通义万相
- **PPT文件生成**：pptxgenjs
- **定时任务**：node-cron
- **UI框架**：Tailwind CSS v4 + shadcn/ui (base-nova, @base-ui/react)
- **认证**：JWT (jose) + bcrypt 密码哈希，Next.js Proxy (原 middleware) 路由保护
- **权限模型**：RBAC（用户-角色-权限），超级管理员旁路
- **编辑器**：Tiptap（小说富文本编辑器）
- **部署方式**：本地 Docker Compose 一键启动

## 系统架构

```
浏览器 (localhost:18867)
    ↕ HTTP / SSE
Next.js Proxy (JWT 验证 / 路由保护)
    ↕
Next.js 前端 (React)
  - 登录页
  - Dashboard 首页
  - PPT 生成器
  - 小说编辑器
  - 视频生成器
  - AI 资讯列表
  - 系统管理（用户/角色/菜单）
    ↕ API Routes
Next.js 后端 (API层)
  - 认证服务（登录/登出/会话）
  - 用户/角色/权限/菜单管理
  - PPT 生成服务
  - 小说写作服务
  - 视频生成服务
  - 资讯爬取服务
  - AI 模型调用
    ↕
PostgreSQL  Redis  外部AI API  本地文件存储  定时任务
```

## UI 设计

- **布局**：左侧固定导航栏 + 右侧主内容区
- **风格**：清爽蓝白主题（蓝色主色调 #2563eb，白色背景，浅灰分隔线）
- **首页 Dashboard**：
  - 顶部：Logo + 日期 + 设置入口
  - 欢迎语 + 4个快捷功能卡片（PPT/小说/视频/资讯）
  - 今日AI资讯预览（显示5条，可点击查看全部）

## 功能模块

### 模块0：用户认证与系统管理（已完成）

#### 登录认证
- JWT Cookie 认证，令牌有效期24小时
- 强密码策略：至少12位，必须包含大小写字母、数字和特殊字符
- 登录页面 `/login`，独立于主布局的简洁登录界面
- Next.js Proxy（原 middleware）全局路由保护，未登录自动跳转登录页
- 初始超级管理员账户：`superadmin` / `Jlm2026.Hugo.com@1qaz`

#### RBAC 权限模型
```
User (用户)
 ├── UserRole (用户-角色关联，多对多)
 └── Role (角色)
      ├── RolePermission (角色-权限关联，多对多)
      └── Permission (权限)
Role (角色)
 └── RoleMenu (角色-菜单关联，多对多)
      └── Menu (菜单，支持树形层级)
```

特殊字段：`User.isSuperAdmin` — 超级管理员标志，旁路所有权限检查，拥有 `["*"]` 全权限。

#### 人员管理 (`/admin/users`)
- 用户增删改查，含用户名、显示名称、邮箱
- 密码重置（创建/编辑时强制强密码验证）
- 角色多选用 Badge 交互分配
- 账户启用/禁用开关
- 搜索过滤（用户名、显示名称、邮箱）
- 超级管理员账户不可删除
- API：`GET/POST /api/admin/users`、`PATCH/DELETE /api/admin/users/[id]`

#### 角色权限管理 (`/admin/roles`)
- 角色增删改查（系统角色不可删除/改名）
- 权限按模块（system/business）分组展示，用 Checkbox 多选分配
- 预置三个系统角色：
  - **管理员**：拥有全部权限
  - **编辑者**：业务功能使用权限（新闻/PPT/小说/视频）
  - **普通用户**：仅查看资讯
- API：`GET/POST /api/admin/roles`、`PATCH/DELETE /api/admin/roles/[id]`、`GET /api/admin/permissions`

#### 菜单管理 (`/admin/menus`)
- 无限级树形菜单结构（parentId 自引用）
- 支持排序（sort 字段）、可见性开关、图标（lucide 图标名）、权限码
- 树形表格展示，子节点缩进，支持展开/折叠
- 防止环形引用（不能将自身或后代设为父节点）
- 级联删除（删除父菜单自动删除子菜单）
- API：`GET/POST /api/admin/menus`、`PATCH/DELETE /api/admin/menus/[id]`

#### 预置权限码（15项）
| 模块 | 权限码 | 说明 |
|------|--------|------|
| system | system:user:view/create/edit/delete/reset-password | 用户管理 |
| system | system:role:view/manage | 角色管理 |
| system | system:permission:view | 权限查看 |
| system | system:menu:view/manage | 菜单管理 |
| business | news:view/crawl | AI 资讯 |
| business | ppt:use / novel:use / video:use | 业务功能 |

---

### 模块1：AI 资讯（已完成）

- 每日定时爬取多个AI资讯源：
  - 中文：机器之心、量子位、36氪AI频道
  - 英文：The Decoder、Hugging Face Daily Papers、VentureBeat AI
- 列表展示：标题 + 摘要 + 来源标签 + 发布时间 + 原文链接
- 每日首次打开自动刷新，手动可触发刷新
- 支持按日期浏览历史资讯
- 数据结构：id, title, summary, url, source, published_at, created_at

### 模块2：PPT 生成（第二阶段实现）

**两种模式**：
1. **选择模板生成**：用户从内置模板库选择模板，输入主题/大纲，AI填充内容
2. **热门模板推荐**：内置一批精选模板分类展示（商务汇报、工作总结、产品发布、培训课件等）

**功能细节**：
- 模板库：预置10-20套精品模板（不同配色/布局风格）
- AI生成流程：输入主题 → AI生成大纲 → 用户确认/编辑大纲 → AI逐页生成内容 → 在线预览 → 导出.pptx
- 支持二次编辑：在网页上直接修改文字内容
- 模板定义：用JSON配置页面布局、配色、占位符，pptxgenjs渲染

### 模块3：小说写作（第三阶段实现）

**结构化管理**：
- 小说项目：名称、简介、类型、封面
- 世界观设定：背景设定、时间线、地理设定
- 人物管理：姓名、头像、性格、背景、关系图
- 章节管理：大纲列表，支持拖排序，指定章节续写

**AI辅助功能**：
- 新建小说：AI根据类型/主题生成世界观和人物建议
- 续写：选中已有内容，AI继续往下写（保持风格一致）
- 指定章节：跳到任意章节，可让AI写特定场景
- 润色：改写选中文字（调整风格/精简/扩写）
- 对话生成：根据人物性格生成对话
- 一致性检查：标记与已有设定矛盾的地方

**编辑器**：Tiptap富文本编辑器，支持章节切换、字数统计、自动保存

### 模块4：视频生成（第四阶段实现）

**两种模式**：
1. 文生视频：输入文字描述，AI生成视频
2. 图生视频：上传图片，AI根据图片+文字描述生成动态视频

**功能细节**：
- 对接可灵/通义万相API
- 参数设置：视频时长、分辨率(1080p/4K)、风格、帧率
- 生成是异步任务：提交后进入队列，通过SSE推送进度，生成完成后通知
- 历史记录：所有生成的视频可回看、下载
- 视频文件存储在本地 `./storage/videos/` 目录

## 数据库设计（核心表）

```
users             - 用户（username, email, passwordHash, displayName, isActive, isSuperAdmin）
roles             - 角色（name, code, description, isSystem）
permissions       - 权限（name, code, module, description）
menus             - 菜单（name, path, icon, sort, parentId, isVisible, permissionCode）
user_roles        - 用户-角色关联（userId, roleId 联合主键）
role_permissions  - 角色-权限关联（roleId, permissionId 联合主键）
role_menus        - 角色-菜单关联（roleId, menuId 联合主键）
novels            - 小说项目
characters        - 小说人物
world_settings    - 世界观设定
chapters          - 小说章节
ppt_templates     - PPT模板
ppt_projects      - PPT项目
video_jobs        - 视频生成任务
news_articles     - AI资讯文章
```

## 开发阶段规划

### 阶段0：用户认证与系统管理（已完成 2026-07-29）
1. 数据库模型：User/Role/Permission/Menu 及关联表
2. JWT 认证 + bcrypt 密码哈希 + 强密码验证
3. Next.js Proxy 路由保护（Next.js 16 新 API）
4. 登录页面与登出功能
5. 人员/角色权限/菜单管理三个后台页面及 API
6. Prisma seed 脚本初始化超管账户、默认角色、权限和菜单

### 第一阶段：基础框架 + AI资讯（已完成）
1. Docker Compose 配置（PostgreSQL + Redis）
2. Next.js 项目初始化（TypeScript、Tailwind、shadcn/ui）
3. Prisma schema + 数据库迁移
4. 基础布局：侧边栏导航 + Dashboard首页
5. AI SDK 封装（统一的Claude API调用接口）
6. 资讯爬虫模块（多源抓取，去重，存入PG）
7. Redis定时任务配置（每日自动爬取）
8. 资讯列表页 + Dashboard资讯预览

### 第二阶段：PPT生成（预计2-3天）
1. PPT模板JSON定义规范
2. 内置10-20套模板
3. 模板选择页 + 模板预览
4. AI大纲生成流程
5. 内容生成 + 在线预览页
6. pptxgenjs导出.pptx功能

### 第三阶段：小说写作（预计3-4天）
1. 小说项目CRUD
2. 世界观/人物管理界面
3. Tiptap编辑器集成
4. 章节管理（排序、大纲）
5. AI续写/润色/对话生成接口
6. 自动保存 + 字数统计

### 第四阶段：视频生成（预计2-3天）
1. 视频生成API对接（可灵等）
2. 文生视频/图生视频表单界面
3. Redis任务队列（处理异步生成）
4. SSE进度推送
5. 视频预览/下载/历史记录

## 后续扩展方向
- 模板社区（用户上传分享PPT模板）
- 微信/邮件推送每日AI摘要
- 更多AI工具（文案生成、翻译、思维导图等）
- 资讯信息收集改用 DuckDuckGo MCP 搜索聚合
- 本地模型支持（Ollama）
