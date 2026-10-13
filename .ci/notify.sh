#!/usr/bin/env bash
# ═══ notify.sh — تقرير الحالة على تليجرام ═══
# المدخل : STATUS (success|failure) + BOT_TOKEN + MY_CHAT_ID + متغيرات السياق
set -euo pipefail

# ── الإعدادات ──
BOT_TOKEN="${BOT_TOKEN:-}"
MY_CHAT_ID="${MY_CHAT_ID:-}"
STATUS="${1:-success}"

COMMIT_SHA="${GITHUB_SHA:0:7}"
COMMIT_MSG="${COMMIT_MSG:-N/A}"
APP_VERSION="${APP_VERSION:-?}"
FILES_COUNT="${FILES_COUNT:-?}"
BOT_NAME="${BOT_NAME:-?}"
RUN_URL="${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"

test -n "$BOT_TOKEN" && test -n "$MY_CHAT_ID" \
  || { echo "⚠️ متجنس أش أرسل التقرير — BOT_TOKEN أو MY_CHAT_ID ناقص"; exit 0; }

# ── بناء الرسالة ──
if [ "$STATUS" = "success" ]; then
  TEXT=$(printf '✅ Deploy ناجح — Version %s\n\n📦 %s — %s\n☁️ Google Apps Script: %s ملف وصلوا ومطابقين 100%%\n🤖 البوت @%s: حي وشغال\n🔗 %s' \
    "$APP_VERSION" "$COMMIT_SHA" "$COMMIT_MSG" "$FILES_COUNT" "$BOT_NAME" "$RUN_URL")
else
  TEXT=$(printf '🚨 Deploy فشل!\n\n📦 %s — %s\n⚠️ الكود على جوجل ممكن يكون قديم — راجع السجل\n🔗 %s' \
    "$COMMIT_SHA" "$COMMIT_MSG" "$RUN_URL")
fi

curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${MY_CHAT_ID}" \
  --data-urlencode "text=${TEXT}" > /dev/null

echo "✓ التقرير اتبعت على تليجرام"