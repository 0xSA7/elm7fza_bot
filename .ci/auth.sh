#!/usr/bin/env bash
# ═══ auth.sh — استخراج التوكن من CLASPRC_JSON ═══
# المدخل : CLASPRC_JSON (env)
# المخرج : ACCESS_TOKEN + SCRIPT_ID (env — تصدير)
set -euo pipefail

require() {
  test -n "${!1:-}" || { echo "::error::$1 مفقود — راجع الـ secrets"; exit 1; }
}

require CLASPRC_JSON

CLIENT_ID=$(echo "$CLASPRC_JSON" | jq -r '.client_id // .token.client_id // empty')
CLIENT_SECRET=$(echo "$CLASPRC_JSON" | jq -r '.client_secret // .token.client_secret // empty')
REFRESH_TOKEN=$(echo "$CLASPRC_JSON" | jq -r '.refresh_token // .token.refresh_token // empty')

test -n "$CLIENT_ID" && test -n "$CLIENT_SECRET" && test -n "$REFRESH_TOKEN" \
  || { echo "::error::CLASPRC_JSON بنيته مش متوقعة — ابعت أسماء المفاتيح للمهندس"; exit 1; }

RESPONSE=$(curl -s -X POST https://oauth2.googleapis.com/token \
  -d "client_id=${CLIENT_ID}" \
  -d "client_secret=${CLIENT_SECRET}" \
  -d "refresh_token=${REFRESH_TOKEN}" \
  -d "grant_type=refresh_token")

ACCESS_TOKEN=$(echo "$RESPONSE" | jq -r '.access_token // empty')
test -n "$ACCESS_TOKEN" || {
  echo "::error::فشل تبديل التوكن — رد جوجل:"
  echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
  exit 1
}

# الـ Script ID من .clasp.json
test -f .clasp.json || { echo "::error::.clasp.json مش في الريبو"; exit 1; }
SCRIPT_ID=$(jq -r '.scriptId' .clasp.json)
test -n "$SCRIPT_ID" || { echo "::error::scriptId فاضي في .clasp.json"; exit 1; }

# التصدير للخطوات التالية
echo "ACCESS_TOKEN=${ACCESS_TOKEN}" >> "$GITHUB_ENV"
echo "SCRIPT_ID=${SCRIPT_ID}" >> "$GITHUB_ENV"
echo "✓ التوكن جاهز (مشروع: ${SCRIPT_ID:0:20}...)"