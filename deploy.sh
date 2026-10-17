#!/bin/bash
# ═══ deploy.sh — الاختبار → الإصدار → الرفع (fail-safe) ═══
# أي خطأ في أي خطوة → يقف فوراً ويرجّع الدنيا زي ما كانت

set -euo pipefail
cd "$(dirname "$0")"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
NC='\033[0m'
fail() { echo -e "${RED}❌ $1${NC}"; exit 1; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
info() { echo -e "${CYAN}$1${NC}"; }

trap 'echo -e "${RED}❌ فشل غير متوقع (سطر $LINENO) — اتوقفنا قبل إكمال الرفع${NC}"' ERR

# ── 0) فحوصات مبدئية ──
command -v node >/dev/null 2>&1 || fail "node مش موجود"
[ -f tests/run.js ] || fail "tests/run.js مش موجود"
[ -f Config.js ]    || fail "Config.js مش موجود"
[ -f .clasp.json ]  || fail ".clasp.json مش موجود"
ok "الفحوصات المبدئية"

# ── 1) لازم نكون على main (الـ CI شغال هناك بس) ──
BRANCH=$(git branch --show-current)
[ "$BRANCH" = "main" ] || fail "انت على branch '$BRANCH' — الـ CI بيشتغل على main بس"
ok "على branch main"

# ── 2) لازم يكون فيه تغييرات ──
if git diff --quiet && git diff --cached --quiet \
   && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  fail "مفيش أي تغييرات — عدّل الأول وبعدين deploy"
fi
ok "فيه تغييرات جاهزة"

# ── 3) الاختبارات — لو فشلت نقف هنا، قبل ما نلمس أي حاجة ──
info "🧪 Running tests..."
node tests/run.js || fail "الاختبارات فشلت — صلّحها الأول (مفيش حاجة اتلمست)"
ok "الاختبارات عدّت كلها"

# ── 4) زيادة الإصدار (بعد نجاح الاختبارات بس) ──
VERSION=$(grep -oE 'VERSION:[[:space:]]*[0-9]+' Config.js | grep -oE '[0-9]+' | head -1)
[ -n "$VERSION" ] || fail "مش لاقي VERSION في Config.js"
NEW_VERSION=$((VERSION + 1))
info "📌 Version: ${VERSION} → ${NEW_VERSION}"

sed -i "s/VERSION:[[:space:]]*${VERSION}/VERSION: ${NEW_VERSION}/" Config.js
grep -q "VERSION:[[:space:]]*${NEW_VERSION}" Config.js || fail "تعديل الإصدار فشل"
ok "الإصدار اتحدّث"

# ── 5) Commit ──
MSG="${1:-release}"
git add -A
git commit -m "v${NEW_VERSION} — ${MSG}" || fail "الـ commit فشل"
ok "Commit اتعمل"

# ── 6) Push — ولو فشل: رجوع كامل ونضيف ──
info "🚀 Pushing..."
if ! git push; then
  echo -e "${YELLOW}⚠️ الـ push فشل — بنرجّع الإصدار والـ commit زي ما كانوا${NC}"
  git reset --soft HEAD~1                        # فك الـ commit (التغييراتفضل staged)
  sed -i "s/VERSION:[[:space:]]*${NEW_VERSION}/VERSION: ${VERSION}/" Config.js
  git add Config.js                              # الإصدار القديم رجع
  fail "الـ push فشل (شبكة؟ صلاحيات؟ جرّب git pull وبعدين شغّل deploy.sh تاني)"
fi
ok "Push اتعمل"

echo ""
echo -e "${GREEN}🚀 v${NEW_VERSION} اترفعت!${NC}"
echo "📱 استنى رسالة ✅ على تليجرام خلال دقيقة"
