# 阶段3「Pexels 素材库」进度快照（2026-08-05 下班暂停点）

> 回家后新开会话，先让 Claude 读本文件即可无缝继续。

## 当前状态：代码 100% 完成并提交，剩「配置 key + 真实联调验证」

## 已完成（全部已 commit 到 main）

- 设计文档：`docs/superpowers/specs/2026-08-05-video-phase3-pexels-materials-design.md`
- 实施计划：`docs/superpowers/plans/2026-08-05-video-phase3-pexels-materials.md`（Task 1-8 全部执行完毕）
- 代码提交链（从旧到新）：
  1. `feat(video): VideoShot 新增素材字段 materialQuery/materialUrl/materialThumb`（迁移已应用）
  2. `feat(video): 分镜素材字段类型与序列化`
  3. `feat(video): AI 生成分镜时预生成素材搜索词 materialQuery`
  4. `feat(video): Pexels 视频搜索服务（服务端代理+文件筛选）`
  5. `feat(video): Pexels 素材搜索代理 API`
  6. `feat(video): 分镜素材更新 API（选择/清除/改搜索词）`
  7. `feat(video): 素材选择对话框（搜索/方向切换/网格/预览/加载更多）`
  8. `feat(video): 分镜表素材列与素材选择弹框接线`
  9. `fix(video): 素材弹框初始搜索改为挂载时异步拉取`
- 已通过的验证：tsc / lint（0 error）/ build 通过；API 参数校验冒烟通过（空 query→400、非法方向→400、未配置 key→503 提示正确、未登录→307 拦截）

## 待办（回家继续）

1. **配置 Pexels API key**（阻塞项，免费申请：https://www.pexels.com/api/）：
   - 家里机器与本机都需要：`code/front/.env.local` 追加一行 `PEXELS_API_KEY=你的key`（此文件不入库）
2. 配置后完成计划 Task 9 的剩余验证（见实施计划 Task 9 Step 3-5）：
   - `GET /api/video/materials/search?query=city night&orientation=portrait` → 200 + videos 数组
   - `orientation=all` 与翻页 nextPage
   - 生成一条新脚本（AI 约 2 分钟）→ 断言每个分镜 `materialQuery` 非空
   - PATCH 选素材/清素材/非 https 拒绝 往返
   - UI 走查：分镜「选素材」→ 弹框自动搜索 → 缩略图网格 → 预览 → 使用 → 表格出现缩略图 → 换/移除 → 署名链接
3. 若发现小问题，修复后 `git commit -m "fix(video): ..."`

## 环境恢复命令（家里的机器）

```bash
cd <HugoAI仓库>
git pull                       # 拉取今天的所有提交
docker compose up -d           # PostgreSQL + Redis
cd code/front
# 确认 .env.local 有 DATABASE_URL / AI_API_KEY / PEXELS_API_KEY
npm run dev                    # 端口 18867
```

本机当前 dev server 还在跑（18867），数据库为 docker 容器 hugoai-postgres。

## 遗留事项（非阻塞，用户决定优先级）

- **配音 AI 味优化**（用户说先放一下）：方案 A=Edge-TTS 语速/音高免费调优；方案 B=开通阿里百炼 CosyVoice（代码侧 TtsProvider 抽象已留好适配器位置，`code/front/src/services/video/tts.ts`）
- 工作区有两个历史遗留未跟踪文件 `code/front/test-prisma-simple.ts`、`code/front/test-prisma.ts`（未提交，保留原样）
