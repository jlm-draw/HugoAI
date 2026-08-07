import { execFile } from "child_process";
import { existsSync } from "fs";
import path from "path";

/** code/export 目录（cwd=code/front，上两级即仓库根） */
const EXPORT_PROG_DIR = path.join(process.cwd(), "..", "..", "code", "export");
const PYTHON_BIN = path.join(EXPORT_PROG_DIR, ".venv", "bin", "python");
const BUILD_SCRIPT = path.join(EXPORT_PROG_DIR, "build_draft.py");

/** 导出环境未初始化（venv 缺失） */
export class ExportEnvError extends Error {
  constructor() {
    super("导出环境未初始化，请先在服务器运行 code/export/setup.sh");
  }
}

/**
 * 调起 code/export/build_draft.py 构建草稿并打 zip。
 * 超时 60s（kill 子进程）；失败抛带中文原因的 Error。
 */
export function runBuildDraft(exportDirectory: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!existsSync(PYTHON_BIN) || !existsSync(BUILD_SCRIPT)) {
      reject(new ExportEnvError());
      return;
    }
    execFile(
      PYTHON_BIN,
      [BUILD_SCRIPT, exportDirectory],
      { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 },
      (err, _stdout, stderr) => {
        if (!err) {
          resolve();
          return;
        }
        if (err.killed) {
          reject(new Error("草稿生成超时，请重试"));
        } else {
          const detail = (stderr || err.message).trim().slice(-500);
          reject(new Error(`草稿生成失败：${detail}`));
        }
      }
    );
  });
}
