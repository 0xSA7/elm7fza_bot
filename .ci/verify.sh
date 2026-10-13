#!/usr/bin/env bash
# ═══ verify.sh — pull من جوجل ومقارنة ═══
set -euo pipefail

require() {
  test -n "${!1:-}" || { echo "::error::$1 مفقود"; exit 1; }
}

require ACCESS_TOKEN
require SCRIPT_ID

# ── 1) ننزل المحتوى الحالي من جوجل ──
curl -s \
  "https://script.googleapis.com/v1/projects/${SCRIPT_ID}/content" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" > /tmp/verify_response.json

if jq -e '.error' /tmp/verify_response.json > /dev/null 2>&1; then
  echo "::error::فشل pull للتحقق"
  jq . /tmp/verify_response.json
  exit 1
fi

# ── 2) نفك الملفات (✅ .js مش .gs — ده كان الباج) ──
mkdir -p /tmp/verify
python3 << 'PYEOF'
import json

with open('/tmp/verify_response.json', encoding='utf-8') as f:
    data = json.load(f)

for file_info in data.get('files', []):
    if file_info['type'] == 'SERVER_JS':
        path = f"/tmp/verify/{file_info['name']}.js"    # ← الاتصلح هنا
    elif file_info['type'] == 'JSON' and file_info['name'] == 'appsscript':
        path = '/tmp/verify/appsscript.json'
    else:
        continue
    with open(path, 'w', encoding='utf-8') as f:
        f.write(file_info['source'])

print(f"Extracted {len(data.get('files', []))} files")
PYEOF

# ── 3) المقارنة ──
PASS=1
COUNT=0
for f in *.js appsscript.json; do
  test -f "$f" || continue
  COUNT=$((COUNT+1))
  if [ "$f" = "appsscript.json" ]; then
    # المانيفست: مقارنة دلالية — جوجل ممكن يعيد ترتيب الحقول فب نقارن الـ JSON مش البايتس
    if ! python3 -c "
import json, sys
with open('$f') as a, open('/tmp/verify/appsscript.json') as b:
    sys.exit(0 if json.load(a) == json.load(b) else 1)
" 2>/dev/null; then
      echo "::error file=$f::المانيفست على جوجل مختلف دلالياً عن الريبو!"
      PASS=0
    fi
  else
    # ملفات الكود: مقارنة بالبايت
    if ! diff -q "$f" "/tmp/verify/$f" > /dev/null 2>&1; then
      echo "::error file=$f::الملف على جوجل مختلف عن الريبو!"
      PASS=0
    fi
  fi
done

# ملفات عندنا مش عند جوجل؟
for f in *.js; do
  test -f "/tmp/verify/$f" || {
    echo "::error::ملف $f مش موجود على جوجل أصلاً!"
    PASS=0
  }
done

test "$PASS" = "1" || exit 1
echo "✓ التحقق تم: $COUNT ملف متطابقين على جوجل"