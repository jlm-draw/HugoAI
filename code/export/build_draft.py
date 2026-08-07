#!/usr/bin/env python3
"""阶段4：从导出目录构建剪映草稿。

用法: .venv/bin/python build_draft.py <export-dir>

导出目录需包含（Node 侧准备）:
  manifest.json   时间轴与文件清单（见 services/video/export/manifest.ts）
  audio.mp3       整段配音
  subtitle.srt    SRT 字幕
  materials/*.mp4 分镜素材

产出（均在导出目录内）:
  drafts/<draftName>/        剪映草稿文件夹
  report.json                {"warnings": [...]}（时长钳制告警，可为空）
  <draftName>-剪映草稿.zip    最终交付物（草稿文件夹 + README.txt）

退出码: 0 成功；1 构建失败（stderr 有原因）；2 用法错误
"""
import json
import os
import sys
import zipfile

import pyJianYingDraft as jy

README_TEMPLATE = """【剪映草稿导入说明】
1. 解压本压缩包，得到草稿文件夹「{draft_name}」
2. 将整个文件夹复制到剪映草稿根目录：
   Windows: %LOCALAPPDATA%\\JianyingPro\\User Data\\Projects\\com.lveditor.draft
   Mac:     ~/Movies/JianyingPro/User Data/Projects/com.lveditor.draft
3. 打开（或重启）剪映，草稿列表即可看到；若不出现，进出任一已有草稿一次即可刷新。

【轨道构成】
- 视频轨：{shot_count} 段分镜素材，时间轴已按配音时长（共 {audio_sec:.1f} 秒）等比排布
- 音频轨：整段配音（素材原声已静音）
- 文本轨：按句对齐字幕（SRT 导入，样式/位置可在剪映批量调整）

【素材清单】
{material_list}
{warnings_section}"""


def main() -> int:
    if len(sys.argv) != 2:
        print("用法: build_draft.py <export-dir>", file=sys.stderr)
        return 2
    root = os.path.abspath(sys.argv[1])
    try:
        with open(os.path.join(root, "manifest.json"), encoding="utf-8") as f:
            manifest = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        print(f"manifest.json 读取失败: {e}", file=sys.stderr)
        return 1

    draft_name = manifest["draftName"]
    warnings = []

    try:
        draft_root = os.path.join(root, "drafts")
        os.makedirs(draft_root, exist_ok=True)
        folder = jy.DraftFolder(draft_root)
        script = folder.create_draft(
            draft_name,
            manifest["canvas"]["width"],
            manifest["canvas"]["height"],
            allow_replace=True,
        )

        script.append_track(jy.TrackSpec(jy.TrackType.video, "video"))
        script.append_track(jy.TrackSpec(jy.TrackType.audio, "audio"))

        # 视频轨：每分镜一段；需求时长超出素材实际时长则钳制并告警
        for shot in manifest["shots"]:
            material = jy.VideoMaterial(os.path.join(root, shot["file"]))
            target_us = shot["durationMs"] * 1000
            if material.duration < target_us:
                warnings.append(
                    f"分镜 {shot['sort']}：时间轴需 {shot['durationMs'] / 1000:.1f}s，"
                    f"素材仅 {material.duration / 1_000_000:.1f}s，已按素材时长截断"
                )
                target_us = material.duration
            script.add_segment(
                jy.VideoSegment(material, jy.trange(shot["startMs"] * 1000, target_us), volume=0.0),
                track="video",
            )

        # 音频轨：整段配音
        audio = manifest["audio"]
        script.add_segment(
            jy.AudioSegment(os.path.join(root, audio["file"]), jy.trange(0, audio["durationMs"] * 1000)),
            track="audio",
        )

        # 文本轨：SRT 字幕（库默认样式即模仿剪映自带字幕导入）
        script.import_srt(os.path.join(root, manifest["subtitle"]), "subtitle")

        script.save()
    except Exception as e:
        print(f"草稿构建失败: {e}", file=sys.stderr)
        return 1

    with open(os.path.join(root, "report.json"), "w", encoding="utf-8") as f:
        json.dump({"warnings": warnings}, f, ensure_ascii=False, indent=2)

    material_list = "\n".join(
        f"- 分镜 {s['sort']}：{s['file']}（{s['durationMs'] / 1000:.1f}s，自 {s['startMs'] / 1000:.1f}s 起）"
        for s in manifest["shots"]
    )
    warnings_section = (
        "\n【时长告警】\n" + "\n".join(f"- {w}" for w in warnings) if warnings else ""
    )
    readme = README_TEMPLATE.format(
        draft_name=draft_name,
        shot_count=len(manifest["shots"]),
        audio_sec=manifest["audio"]["durationMs"] / 1000,
        material_list=material_list,
        warnings_section=warnings_section,
    )

    zip_path = os.path.join(root, f"{draft_name}-剪映草稿.zip")
    draft_dir = os.path.join(draft_root, draft_name)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for dirpath, _, filenames in os.walk(draft_dir):
            for name in filenames:
                full = os.path.join(dirpath, name)
                zf.write(full, os.path.relpath(full, draft_root))
        zf.writestr("README.txt", readme)

    print(f"OK: {zip_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
