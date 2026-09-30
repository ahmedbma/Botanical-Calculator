#!/usr/bin/env bash
# Everything CI checks, runnable before you push.
#
#   tools/check.sh
#
# There is no test suite and no bundler here, so these are the things that have
# actually gone wrong: generated data drifting from its source, the ?v= cache
# buster bumped in one place and not the other, and the counts quoted in the
# README and the page falling behind the data they describe.
set -uo pipefail
cd "$(dirname "$0")/.."

fail=0
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  ok    %s\n' "$1"; }
bad()  { printf '  FAIL  %s\n' "$1"; fail=1; }

step "JavaScript parses"
for f in js/*.js; do
  if node --check "$f" >/dev/null 2>&1; then ok "$f"; else bad "$f does not parse"; fi
done

step "JSON parses"
for f in data/*.json; do
  if node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" 2>/dev/null; then ok "$f"
  else bad "$f is not valid JSON"; fi
done

step "Generated data is in sync with data/*.json"
if node tools/build-data.js --check; then ok "js/*data.js match their sources"
else bad "run: node tools/build-data.js"; fi

step "Consistency checks"
node tools/check-consistency.js || fail=1

if [ "$fail" -ne 0 ]; then
  printf '\n\033[31mcheck failed\033[0m\n'; exit 1
fi
printf '\n\033[32mall checks passed\033[0m\n'
