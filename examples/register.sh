#!/usr/bin/env bash
# ============================================================
# 一键注册脚本 — 将新 skill 添加到 catalog.json
# ============================================================
# 用法:
#   ./register.sh <skill-id> <name> <description> <category> [trigger1] [trigger2] ...
#
# 示例:
#   ./register.sh "my-translate" "My Translator" "多语言翻译工具" "content-gen" "翻译" "translate"
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CATALOG_PATH="$(dirname "$SCRIPT_DIR")/catalog.json"

if [ $# -lt 4 ]; then
  echo "用法: $0 <skill-id> <name> <description> <category> [trigger1] [trigger2] ..."
  echo ""
  echo "示例:"
  echo "  $0 \"my-translate\" \"My Translator\" \"多语言翻译工具\" \"content-gen\" \"翻译\" \"translate\""
  exit 1
fi

SKILL_ID="$1"
SKILL_NAME="$2"
SKILL_DESC="$3"
SKILL_CATEGORY="$4"
TRIGGERS=("${@:5}")

# 构建 triggers JSON 数组
TRIGGERS_JSON="["
for i in "${!TRIGGERS[@]}"; do
  if [ $i -gt 0 ]; then
    TRIGGERS_JSON+=", "
  fi
  TRIGGERS_JSON+="\"${TRIGGERS[$i]}\""
done
TRIGGERS_JSON+="]"

# 检查 jq 是否可用
if ! command -v jq &> /dev/null; then
  echo "错误: 需要安装 jq (https://jqlang.github.io/jq/)"
  exit 1
fi

# 读取现有 catalog
if [ ! -f "$CATALOG_PATH" ]; then
  echo '{"version":"1.0","skills":{}}' > "$CATALOG_PATH"
fi

# 添加新 skill
jq --arg id "$SKILL_ID" \
   --arg name "$SKILL_NAME" \
   --arg desc "$SKILL_DESC" \
   --arg cat "$SKILL_CATEGORY" \
   --argjson trigs "$TRIGGERS_JSON" \
   '.skills[$id] = {
     "id": $id,
     "name": $name,
     "description": $desc,
     "category": $cat,
     "triggers": $trigs,
     "confidence_threshold": 0.7,
     "requires_setup": false,
     "setup_notes": null
   }' "$CATALOG_PATH" > "${CATALOG_PATH}.tmp"

mv "${CATALOG_PATH}.tmp" "$CATALOG_PATH"

echo "✅ 已注册 skill: ${SKILL_ID}"
echo "   名称: ${SKILL_NAME}"
echo "   类别: ${SKILL_CATEGORY}"
echo "   触发词: ${TRIGGERS[*]}"
