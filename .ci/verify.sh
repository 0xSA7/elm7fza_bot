#!/usr/bin/env bash
# ═══ verify.sh — pull من جوجل ومقارنة بالبايت مع الريبو ═══
# المدخل : ACCESS_TOKEN + SCRIPT_ID (env) + الملفات المحلية
# المخرج : خروج بـ 1 لو فيه اختلاف
set -euo pipefail

require() {
  test -n "${!1:-}" || { echo "::error::$1 مفقود"; exit 1; }
}

require ACCESS_TOKEN
require SCRIPT_ID

# ننزل المحتوى الحالي من جوجل
mkdir -p /tmp/verify
RESPONSE=$(curl -s \
  "https://script.googleapis.com/v1/projects/${SCRIPT_ID}/content" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
  echo "::error::فشل pull للتحقق"
  echo "$RESPONSE" | jq . 2>/dev/null
  exit 1
fi

# نفك كل ملف ونحفظه بنفس الاسم المحلي
echo "$RESPONSE" | jq -r '.files[] | select(.type == "SERVER_JS") | .name' | while read -r NAME; do
  echo "$RESPONSE" | jq -r --arg n "$NAME" '.files[] | select(.name == $n and .type == "SERVER_JS") | .source' > "/tmp/verify/${NAME}.gs"
done
echo "$RESPONSE" | jq -r '.files[] | select(.type == "JSON" and .name == "appsscript") | .source' > /tmp/verify/appsscript.json

# المقارنة ملف بملف
PASS=1
COUNT=0
for f in *.gs appsscript.json; do
  test -f "$f" || continue
  COUNT=$((COUNT+1))
  if ! diff -q "$f" "/tmp/verify/$f" > /dev/null 2>&1; then
    echo "::error file=$f::الملف على جوجل مختلف عن الريبو!"
    PASS=0
  fi
done

# ملفات عند جوجل مش عندنا؟ (من المفروض مستحيل بعد الاستبدال الكامل — بس احتياط)
for f in /tmp/verify/*.gs; do
  BASE=$(basename "$f")
  test -f "$BASE" || {
    echo "::error::ملف على جوجل مش في الريبو: $BASE"
    PASS=0
  }
done

test "$PASS" = "1" || exit 1
echo "✓ التحقق تم: $COUNT ملف متطابقين بالبايت على جوجل"