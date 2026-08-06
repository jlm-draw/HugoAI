# 短视频模块阶段4：剪映草稿导出 — 设计文档

**日期：** 2026-08-06
**状态：** 已确认
**关联：** 阶段1「脚本工坊」、阶段2「TTS 配音 + SRT 字幕」、阶段3「Pexels 素材库」（均已上线）

## 需求

把一条完成的脚本（分镜素材 + 配音 + SRT 字幕）一键导出为**剪映草稿**，用户在剪映里打开即可直接精剪/合成发布：

1. 分镜素材（阶段3 存的 Pexels 直链）按需下载到本地，按分镜顺序铺满视频轨
2. 整段配音 mp3 铺音频轨，SRT 字幕逐句导入文本轨（与音频天然对齐）
3. 素材时间轴按比例缩放，总时长精确等于配音实际时长
4. 产物为 zip（草稿文件夹 + README 导入说明），浏览器下载后手工放入剪映草稿目录

## 背景调研结论（2026-08-06 实测/文档核对）

1. **pyJianYingDraft**（[GuanYixuan/pyJianYingDraft](https://github.com/GuanYixuan/pyJianYingDraft)，PyPI 包名 `pyjianyingdraft`）：Python 库，生成剪映草稿文件夹。核心 API：`DraftFolder(root).create_draft(name, width, height)`、`append_track(TrackSpec(...))`、`add_segment(VideoSegment/AudioSegment/TextSegment)`、`import_srt(path, track_name)`、`save()`。
2. **只接受本地文件路径**（库内部探测文件元数据），不支持网络 URL → 素材必须先下载。
3. 时间单位为微秒，`trange(start, duration)` 第二参是时长；接受 `"1.5s"` 字符串。
4. Linux 可生成草稿，仅「自动导出成片」功能不支持（依赖 Windows uiautomation）→ 与本方案无冲突，我们只生成草稿。
5. 推荐 Python 3.8/3.11；本机 Python 3.12.3，3.13 才有 uiautomation 依赖问题，3.12 预期可用（实施时以实际安装运行验证为准）。
6. 本机事实：`python3` 3.12.3 + pip 24.0 可用，PyPI 网络可达；**无 `zip` 命令，package.json 无 zip 库** → 打包用 Python 标准库 `zipfile`，不新增 npm 依赖。
7. 本服务器为 Linux，剪映只能运行在用户的 Windows/Mac 机器上 → 交付方式只能是浏览器下载 zip（用户已确认）。
8. 音频存 `storage/audio/<scriptId>.mp3`；SRT 由 Edge-TTS 句子边界时间戳生成（`services/video/tts.ts` 的 `toSrt`），存 `VideoScript.srt`——**SRT 最后一句的结束时间戳即配音时长**，无需 ffprobe。
9. `VideoShot` 无 `updatedAt` 字段；PATCH 分镜素材不会触发 `VideoScript.updatedAt` → 缓存失效需要补 touch（见 4.4）。

## 方案选择

| 决策点 | 选定方案 | 理由 |
|---|---|---|
| 交付方式 | **浏览器下载 zip**（草稿文件夹 + README.txt） | 服务器是 Linux，剪映在用户 Windows/Mac 上，无共享目录；zip 最通用 |
| 技术路线 | **Node 编排 + Python 子进程**（pyJianYingDraft） | Node 复用鉴权/校验/下载设施；Python 只做它独有的事（拼草稿 JSON + zipfile 打包）；JSON manifest 为契约 |
| 备选：Python 统包 | ❌ 不选 | 鉴权/归属校验要写两份，Python 还得连库，重复建设 |
| 备选：纯 Node 手写草稿格式 | ❌ 不选 | 剪映 draft 格式复杂且随版本演进，pyJianYingDraft 的价值正是持续跟进该格式 |
| 时间轴对齐 | **各分镜按 AI 估算时长比例缩放到配音实际时长** | 节奏比例不变，画面与配音严丝合缝 |
| 配音时长来源 | **解析 SRT 最后一句结束时间戳** | SRT 与 mp3 同源（Edge-TTS 边界事件），零新依赖 |
| 缺素材的分镜 | **拒绝导出，400 列出缺失分镜号** | 保证草稿质量，实现最简单 |
| 素材不足时长 | **钳制到素材实际时长 + 告警写入 README** | 不阻断导出；Pexels 素材多数 10s+，缩放后分镜通常 3~8s，罕见不足 |
| 打包 | **Python 标准库 zipfile**（紧跟草稿生成之后） | 系统无 zip 命令、无 npm zip 库，零新依赖 |
| 缓存 | **`storage/exports/<scriptId>/` 目录级缓存，`script.updatedAt` 统一失效** | 避免重复下载 11 个视频；配合 PATCH shot 补 touch updatedAt |
| 分镜级音频切分 | **不切**（阶段2 遗留的「届时评估」结论） | 口播是连贯整体，切分只在重排分镜时有意义，而重排必然打乱口播顺序，价值低；整轨便于在剪映整体调音量/淡入淡出 |

## 详细设计

### 1. 总体架构与数据流

```
ScriptDetail 页面
   └─ 「导出剪映草稿」按钮 → GET /api/video/projects/[id]/scripts/[scriptId]/export
                              ↓ （Node route handler）
   ① 鉴权 + 归属校验（复用 getOwnedProject）
   ② 校验：配音已生成（audioUrl + srt 非空、音频文件在盘）；所有分镜 materialUrl 为 https
   ③ 缓存检查：storage/exports/<scriptId>/manifest.json 新于 script.updatedAt → 直跳到 ⑤
   ④ 构建（重建缓存目录）：
        audio.mp3    ← 复制 storage/audio/<scriptId>.mp3
        subtitle.srt ← script.srt（DB）写盘
        materials/01.mp4, 02.mp4, … ← Node 流式下载 Pexels 直链（按分镜 sort 命名，单文件超时 120s）
        manifest.json ← 时间轴计算结果（见 4.2）
      → child_process 调起：
        code/export/.venv/bin/python code/export/build_draft.py storage/exports/<scriptId>
        Python：读 manifest → DraftFolder 建 1080×1920 草稿
          · 视频轨：每分镜一段 VideoSegment（本地 mp4，起止取 manifest）
          · 音频轨：整段 audio.mp3
          · 文本轨：import_srt(subtitle.srt)
        → save() 生成草稿文件夹 → 素材时长不足写 report.json 告警
        → 生成 README.txt（导入说明 + manifest 素材清单 + report.json 告警合并）
        → zipfile 打包「草稿文件夹 + README.txt」为 <标题>-剪映草稿.zip
   ⑤ Node 流式返回 zip（Content-Disposition: attachment）
```

分工：**Node 管鉴权/校验/下载/编排/流式下发；Python 只管拼草稿与打 zip**。进程间契约只有 manifest.json、report.json 与退出码。

### 2. 新增文件结构

```
code/export/                        # 新增目录（入库）
├── requirements.txt                # pyJianYingDraft 锁版本
├── setup.sh                        # python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
└── build_draft.py                  # 读 manifest.json → 生成草稿文件夹 → report.json → 打 zip
code/export/.venv/                  # 根 .gitignore 追加忽略
storage/exports/<scriptId>/         # 缓存目录（storage/* 已被忽略）
├── manifest.json  subtitle.srt  audio.mp3
├── materials/01.mp4 …
├── report.json                     # Python 产出：告警列表（可空）
├── <草稿文件夹>/                    # pyJianYingDraft 产物
└── <标题>-剪映草稿.zip              # 最终产物
code/front/src/
├── services/video/export/
│   ├── manifest.ts                 # SRT 解析 + 时间轴缩放计算
│   ├── materials.ts                # 素材下载（流式写盘）与缓存目录管理
│   └── runner.ts                   # venv 探测、child_process 调 build_draft.py、超时控制
├── app/api/video/projects/[id]/scripts/[scriptId]/export/route.ts
└── components/video/ScriptDetail.tsx   # + 导出按钮
```

### 3. 数据模型

**无迁移**。不新增表/字段；仅在 PATCH 分镜素材路由补一行 touch（见 4.4）。

### 4. 关键机制

#### 4.1 配音时长

解析 `script.srt` 最后一个句子的结束时间戳（自家 `toSrt` 生成的格式，正则提取 `HH:MM:SS,mmm --> HH:MM:SS,mmm` 的右侧，取全篇最大值）。mp3 尾部可能多出几百毫秒静音，忽略。

#### 4.2 时间轴缩放（Node 侧）

```
scale = audioDurationMs / Σ(shot.duration × 1000)

cum_i = 前 i 个分镜估算秒数之和
end_i = round(cum_i / Σ估算秒数 × audioDurationMs)   // 累积比例，避免逐项舍入漂移
start_i = end_{i-1}；duration_i = end_i - start_i
最后一镜 end 恒等于 audioDurationMs
```

#### 4.3 manifest.json（Node → Python 唯一契约）

```json
{
  "draftName": "脚本标题",
  "canvas": { "width": 1080, "height": 1920 },
  "audio": { "file": "audio.mp3", "durationMs": 61200 },
  "subtitle": "subtitle.srt",
  "shots": [
    { "file": "materials/01.mp4", "startMs": 0,    "durationMs": 5400 },
    { "file": "materials/02.mp4", "startMs": 5400, "durationMs": 6100 }
  ]
}
```

Python 侧对每个素材探测实际时长：需求时长超出则钳制到实际时长，并向 `report.json` 追加告警（如「分镜 5 需 12s，素材仅 8s，已截断」）；告警同时合入 zip 内 README.txt。

#### 4.4 缓存与失效

- `storage/exports/<scriptId>/` 整个目录即缓存单元；`manifest.json` 的 mtime 为缓存时间戳
- 有效判定：manifest mtime ≥ `script.updatedAt` → 直接流式返回已有 zip
- **失效信号统一为 `script.updatedAt`**：重新配音/改脚本自带 `@updatedAt`；PATCH 分镜素材路由补一行 `prisma.videoScript.update({ where: { id: scriptId }, data: { updatedAt: new Date() } })`（显式 touch——空 `data: {}` 可能被 Prisma 跳过不触发 `@updatedAt`）——一处小改闭环
- 并发：进程内 `Map<scriptId, Promise>` 去重，同脚本并发导出复用同一次构建（个人系统足够）
- 重建时先删旧目录再构建，避免残留

#### 4.5 草稿参数

- 画布：1080×1920（短视频 9:16；素材横竖屏混杂由剪映画面缩放处理，若 pyJianYingDraft 支持铺满/裁剪参数则用之，实施时核对库 API）
- 草稿名：`script.title`（剪映草稿列表里可认）
- 字幕：`import_srt` 默认样式导入（白字，位置/字体可在剪映里批量调）
- zip 名：`<标题清洗>-剪映草稿.zip`（剔除 `\/:*?"<>|`、截断 50 字符）

### 5. 错误处理

路由返回 JSON `{ "error": "中文消息" }`：

| 场景 | 状态码 | 消息 |
|---|---|---|
| 项目/脚本不存在或非本人 | 404 | 复用 getOwnedProject 既有行为 |
| 未生成配音（audioUrl/srt 为空） | 400 | 「请先合成配音」 |
| 音频文件不在盘 | 400 | 「音频文件缺失，请重新合成配音」 |
| 存在未选素材的分镜 | 400 | 「分镜 3、7 未选择素材，请先选择」（列全部缺失号） |
| 素材下载失败/超时（120s/个） | 502 | 「分镜 N 素材下载失败，请重试或更换素材」 |
| venv 未初始化 | 500 | 「导出环境未初始化，请先运行 code/export/setup.sh」 |
| Python 非零退出 | 500 | 「草稿生成失败：<stderr 尾部截断 500 字>」 |
| Python 超时（60s） | 500 | 「草稿生成超时，请重试」 |

### 6. 前端交互

- ScriptDetail 配音区旁加「导出剪映草稿」按钮（次级样式）
- 未合成配音：按钮 disabled，title 提示
- 点击 → fetch 同路由 → blob 触发浏览器下载；期间按钮显示「导出中…」（素材下载约 10~60s）
- 失败：展示路由返回的 error 文案（沿用 ScriptDetail 现有错误提示方式）

zip 内 **README.txt** 内容：① 解压得到草稿文件夹；② 整个文件夹放入剪映草稿根目录（Windows 默认 `%LOCALAPPDATA%\JianyingPro\User Data\Projects\com.lveditor.draft`，Mac 为 `~/Movies/JianyingPro/User Data/Projects/com.lveditor.draft`）；③ 打开（或重启）剪映即可在草稿列表看到，若不出现则进出任一已有草稿刷新；④ 素材清单与时长钳制告警（若有）。

### 7. 验证标准

1. `tsc --noEmit` / `npm run lint` / `npm run build` 通过
2. `setup.sh` 建 venv 成功；用样例 manifest 单跑 `build_draft.py`：草稿文件夹结构正确（draft_content.json、draft_info.json 等）且 zip 可解包
3. API 冒烟：
   - 未配音 → 400；缺素材 → 400 且消息列出分镜号；越权项目 → 404
   - 正常导出 → 200、`Content-Type: application/zip`；`unzip -l` 可见草稿文件夹 + README.txt
   - **draft_content.json 内：视频轨总时长 = 音频时长、音频轨存在、字幕条数 = SRT 句数**
4. 缓存：紧接着二次导出秒回（不重新下载）；PATCH 换素材后再导出触发重建
5. UI 走查：按钮状态正确 → 点击导出 → loading → zip 下载成功
6. 人工步骤（用户 Windows 机器）：zip 导入剪映草稿目录后能打开、三轨齐全——服务器侧验证到草稿结构正确为止

## 不做的事（YAGNI）

- BGM、转场、特效、标题贴纸——留白给用户在剪映创作
- 导出参数面板（画布/字幕样式等写死默认值）
- 素材自动补选（缺素材直接拒绝，见方案选择）
- 缓存自动清理（storage/exports 手工删即可）
- 分镜级音频切分（评估结论见方案选择）
- 剪映自动导出成片（Linux 不支持，且超出本阶段范围）

## 风险

- **剪映版本兼容**：pyJianYingDraft 跟随主流剪映版本维护，但草稿格式偶有变动。缓解：requirements.txt 锁版本；用户侧打开失败时升级库重试。
- **素材直链失效/限流**：Pexels CDN 链接长期稳定，真失效则 502 提示更换素材；下载不走 Pexels API（直链 CDN），不消耗 API 限流额度。
- **大文件下载耗时**：11 个素材约 50~150MB，首次导出 10~60s 属预期；缓存后秒回。
- **Python 3.12 与库的兼容性**：文档推荐 3.8/3.11，3.12 预期无碍；实施第一步即装库跑样例验证，若不行则在 venv 内用 pyenv/源码方式解决（不影响架构）。
