# GLITCH_ARCHIVE / launch.sh — 在恢复环境里"打开"一个项目
# 说明:这个脚本在归档时是能跑的;现在盘坏了,它只剩样子。
# 真要用:先 recover <项目文件夹>,再 cat <项目文件夹>/README.md
#!/bin/sh
set -e
DIR="${1:-.}"
if [ ! -d "$DIR" ]; then
    echo "launch.sh: no such directory: $DIR" >&2
    exit 1
fi
echo "[launch] mounting view for $DIR (read-only)"
cat "$DIR/README.md"
echo "[launch] done. (this disk is not bootable)"
