#!/usr/bin/env bash
# ═══ push.sh — PUT استبدال كامل للمحتوى على جوجل ═══
# المدخل : ACCESS_TOKEN + SCRIPT_ID (env) + /tmp/payload.json
# المخرج : FILES_COUNT (env — تصدير)
set -euo pipefail

require() {
  test -n "${!1:-}" || { echo "::error::$1 مفقود — شغّل auth.sh الأول"; exit 1; }
}

require ACCESS_TOKEN
require SCRIPT_ID
test -f /tmp/payload.json || { echo "::error::/tmp/payload.json مش موجود — شغّل build-payload.py الأول"; exit 1; }

FILES_COUNT=$(jq '.files | length' /tmp/payload.json)
echo "→ Pushing ${FILES_COUNT} files to Google..."

RESPONSE=$(curl -s -X PUT \
  "https://script.googleapis.com/v1/projects/${SCRIPT_ID}/content" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d @/tmp/payload.json)

if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
  echo "::error::API push فشل — الرد من جوجل:"
  echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
  exit 1
fi

echo "FILES_COUNT=${FILES_COUNT}" >> "$GITHUB_ENV"
echo "✓ ${FILES_COUNT} ملف اترفعوا لجوجل — استبدال كامل"