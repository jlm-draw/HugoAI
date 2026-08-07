#!/usr/bin/env bash
# 剪映草稿导出环境一次性初始化：venv + pyJianYingDraft
set -euo pipefail
cd "$(dirname "$0")"

if ! python3 -c "import ensurepip" >/dev/null 2>&1; then
  echo "错误：缺少 python3 venv 支持，请先执行：apt-get install -y python3.12-venv" >&2
  exit 1
fi

python3 -m venv .venv
.venv/bin/pip install --quiet --upgrade pip
.venv/bin/pip install --quiet -r requirements.txt
.venv/bin/python -c "import pyJianYingDraft" && echo "OK: pyJianYingDraft 就绪（code/export/.venv）"
