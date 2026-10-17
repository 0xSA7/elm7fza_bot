#!/usr/bin/env bash
# deploy.sh — TESTS -> BUMP -> COMMIT -> PUSH
# Fail-fast contract:
#   * any failing gate = full stop with exit code 1
#   * version is bumped ONLY after tests pass
#   * nothing is committed or pushed unless every earlier gate passed
#
# Usage:
#   ./deploy.sh "short description of this change"

set -Eeuo pipefail

MSG="${1:-update}"

say()   { printf '\n==> %s\n' "$*"; }
ok()    { printf '[ok]    %s\n' "$*"; }
abort() { printf '[ABORT] %s\n' "$*" >&2; exit 1; }

# Any unexpected failure anywhere (including inside pipes) stops the deploy
# and reports the exact line. -E makes the trap fire inside functions too.
trap 'printf "[ABORT] unexpected failure at line %s — deploy stopped, nothing was pushed\n" "$LINENO" >&2' ERR

# ---------------------------------------------------------------------------
# Gate 0 — preflight: verify everything we depend on actually exists
# ---------------------------------------------------------------------------
say "Preflight"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 \
  || abort "not inside a git repository"

command -v node >/dev/null 2>&1 \
  || abort "node not found in PATH"

[ -f tests/run.js ] || abort "tests/run.js not found (run me from the repo root)"

VERSION_FILE=""
for f in Config.js src/Config.js app/Config.js; do
  if [ -f "$f" ]; then VERSION_FILE="$f"; break; fi
done
[ -n "$VERSION_FILE" ] || abort "VERSION file not found (looked in ./ src/ app/ — edit VERSION_FILE list if yours lives elsewhere)"
ok "version lives in: $VERSION_FILE"

# ---------------------------------------------------------------------------
# Gate 1 — tests: the hard gate. No bump / commit / push if this fails.
# ---------------------------------------------------------------------------
say "Running test suite"

if ! node tests/run.js; then
  abort "tests failed — version NOT bumped, nothing committed, nothing pushed"
fi
ok "all tests green"

# ---------------------------------------------------------------------------
# Gate 2 — bump the version (only reached if tests passed)
# ---------------------------------------------------------------------------
say "Bumping version"

read_version() {
  grep -m1 -oP "\bVERSION\b[[:space:]]*[:=][[:space:]]*[\"']?v?[0-9]+([.][0-9]+)*" "$1" \
    | grep -oP "[0-9]+([.][0-9]+)*" \
    | head -n1
}

OLD="$(read_version "$VERSION_FILE")"
[ -n "${OLD:-}" ] || abort "could not read VERSION from $VERSION_FILE — check its syntax"

bump() {
  local v="$1" last rest
  last="${v##*.}"
  rest="${v%.*}"
  if [ "$rest" = "$v" ]; then
    echo "$(( v + 1 ))"            # single number: 41 -> 42
  else
    echo "$rest.$(( last + 1 ))"   # dotted: 2.4 -> 2.5 / 2.4.1 -> 2.4.2
  fi
}

NEW="$(bump "$OLD")"

# escape dots so sed treats the old value literally
OLD_ESC="$(printf '%s' "$OLD" | sed 's/[.]/\\./g')"

# rewrite ONLY the VERSION constant, keep quotes / v-prefix intact.
# \b guards so APP_VERSION or SCHEMA_VERSION can never be touched.
sed -i -E "/\bVERSION\b/ s/(\bVERSION\b[[:space:]]*[:=][[:space:]]*[\"']?v?)${OLD_ESC}/\1${NEW}/" "$VERSION_FILE"

# verify the bump actually stuck (protects against silent sed no-ops)
CHECK="$(read_version "$VERSION_FILE")"
[ "$CHECK" = "$NEW" ] \
  || abort "version bump did not stick (found '$CHECK', expected '$NEW')"

ok "version: ${OLD} -> ${NEW}"

# ---------------------------------------------------------------------------
# Gate 3 — commit everything (the bump guarantees there is always a change,
# so a failing commit here is a real error, not "nothing to commit")
# ---------------------------------------------------------------------------
say "Committing"

git add -A
git commit -m "v${NEW}: ${MSG}" \
  || abort "git commit failed"

ok "committed: v${NEW}: ${MSG}"

# ---------------------------------------------------------------------------
# Gate 4 — push (this is what triggers GitHub Actions -> Apps Script)
# ---------------------------------------------------------------------------
say "Pushing to GitHub"

git push origin HEAD \
  || abort "git push failed — CI was NOT triggered. Fix the error and run me again."

ok "pushed — GitHub Actions will deploy and confirm on Telegram"

printf '\nDone: v%s — deploy pipeline triggered.\n' "$NEW"