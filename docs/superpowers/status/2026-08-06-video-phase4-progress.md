# 阶段4「剪映草稿导出」进度快照（2026-08-06）

> 新开会话先让 Claude 读本文件即可无缝继续。

## 当前状态：设计已确认并提交，等待用户审阅 spec → 下一步 writing-plans

## 已完成

- 需求澄清（用户已确认 3 项决策）：zip 浏览器下载交付、时间轴按比例缩放到配音时长、缺素材拒绝导出并列分镜号
- 技术路线已选定：Node 编排 + Python 子进程（pyJianYingDraft），Python 标准库 zipfile 打包
- 设计文档：`docs/superpowers/specs/2026-08-06-video-phase4-jianying-export-design.md`（commit `bc36d61`）

## 关键事实（设计调研所得，写计划时直接用）

- pyJianYingDraft：PyPI 包名 `pyjianyingdraft`，仓库 GuanYixuan/pyJianYingDraft；API：`DraftFolder(root).create_draft(name, w, h)`、`append_track(TrackSpec(...))`、`VideoSegment/AudioSegment` + `trange(start, duration)`（微秒，第二参是时长）、`import_srt(path, track_name)`、`save()`；只接受本地文件路径
- 本机：Python 3.12.3 + pip 24.0，PyPI 可达；无 zip 命令、package.json 无 zip 库 → Python zipfile 打包
- 配音时长 = SRT 最后一句结束时间戳（无需 ffprobe）；音频在 `storage/audio/<scriptId>.mp3`
- VideoShot 无 updatedAt：缓存失效靠在 PATCH shot 路由补 `prisma.videoScript.update({ data: { updatedAt: new Date() } })` 显式 touch（空 data 会被 Prisma 跳过）
- 导出缓存目录 `storage/exports/<scriptId>/`，manifest.json mtime ≥ script.updatedAt 即命中
- 路由：`GET /api/video/projects/[id]/scripts/[scriptId]/export` → zip 流式下载
- 新目录：`code/export/`（requirements.txt + setup.sh + build_draft.py），`.venv` 需加入 .gitignore

## 下一步

1. 用户审阅 spec（可能有修改）
2. 调 writing-plans 技能写实施计划 → `docs/superpowers/plans/2026-08-06-video-phase4-jianying-export.md`
3. 按计划逐任务实施（subagent-driven-development / executing-plans）

## 遗留约定（沿用）

- 工作区保留两个历史未跟踪文件 `code/front/test-prisma*.ts`，不动
- prisma 命令需 `set -a && source .env.local && set +a`；提交绝不 add .env*
