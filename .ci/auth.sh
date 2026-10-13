#!/usr/bin/env bash
# ═══ auth.sh — استخراج التوكن من CLASPRC_JSON ═══
set -euo pipefail

require() {
  test -n "${!1:-}" || { echo "::error::$1 مفقود — راجع الـ secrets"; exit 1; }
}

require CLASPRC_JSON

# ── استخراج من كل البُنى المعروفة ──
REFRESH_TOKEN=$(echo "$CLASPRC_JSON" | jq -r '
  .tokens.default.refresh_token //
  .refresh_token //
  .token.refresh_token //
  empty')

CLIENT_ID=$(echo "$CLASPRC_JSON" | jq -r '
  .tokens.default.client_id //
  .client_id //
  .oauth2ClientSettings.clientId //
  empty')

CLIENT_SECRET=$(echo "$CLASPRC_JSON" | jq -r '
  .tokens.default.client_secret //
  .client_secret //
  .oauth2ClientSettings.clientSecret //
  empty')

# ── لو فشل الاستخراج — نطبع البنية (المسارات بس، القيم مخفية) ──
if [ -z "$REFRESH_TOKEN" ] || [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
  echo "::error::CLASPRC_JSON بنيته مش متوقعة"
  echo ""
  echo "📋 المسارات الموجودة في الملف (القيم مخفية — آمن للمشاركة):"
  echo "$CLASPRC_JSON" | jq -r 'paths(scalars) | join(" → ")' | sort -u | head -30
  echo ""
  echo "📌 انسخ المسارات دي وابعتهاله — وهظبطلك السكربت فوراً"
  exit 1
fi

# ── تبديل refresh token بـ access token ──
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

# ── الـ Script ID من .clasp.json ──
test -f .clasp.json || { echo "::error::.clasp.json مش في الريبو"; exit 1; }
SCRIPT_ID=$(jq -r '.scriptId' .clasp.json)
test -n "$SCRIPT_ID" || { echo "::error::scriptId فاضي في .clasp.json"; exit 1; }

# ── التصدير (في CI بس — محلياً بنجاح بس من غير تصدير) ──
if [ -n "${GITHUB_ENV:-}" ]; then
  echo "ACCESS_TOKEN=${ACCESS_TOKEN}" >> "$GITHUB_ENV"
  echo "SCRIPT_ID=${SCRIPT_ID}" >> "$GITHUB_ENV"
fi
echo "✓ التوكن جاهز"