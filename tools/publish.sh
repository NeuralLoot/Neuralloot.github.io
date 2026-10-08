#!/usr/bin/env bash
# Push main to GitHub with $NEURALLOOT_GH_TOKEN (never printed or stored), wait for the Pages build
# of HEAD, check HTTP 200 on the given paths, then screenshot them (desktop + mobile).
#   tools/publish.sh [/path ...]        default paths: /
# Env: NEURALLOOT_GH_TOKEN (required), SHOTS_DIR (default /workspace/neuralloot/site-shots), PY (python with playwright)
set -euo pipefail
cd "$(dirname "$0")/.."
: "${NEURALLOOT_GH_TOKEN:?NEURALLOOT_GH_TOKEN is not set}"
REPO="NeuralLoot/Neuralloot.github.io"; SITE="https://neuralloot.github.io"
SHOTS_DIR="${SHOTS_DIR:-/workspace/neuralloot/site-shots}"; PY="${PY:-/workspace/.venv-pw/bin/python}"
paths=("$@"); [ ${#paths[@]} -eq 0 ] && paths=(/)
api() { printf 'Authorization: Bearer %s\n' "$NEURALLOOT_GH_TOKEN" | curl -fsS -H @- -H "Accept: application/vnd.github+json" "https://api.github.com/repos/$REPO$1"; }

git remote set-url origin "https://github.com/$REPO.git"          # keep the token out of .git/config
git -c credential.helper= \
    -c credential.helper='!f() { echo username=x-access-token; echo "password=${NEURALLOOT_GH_TOKEN}"; }; f' \
    push origin main
HEAD_SHA=$(git rev-parse HEAD); echo "pushed $HEAD_SHA"

for i in $(seq 1 60); do                                            # up to ~10 min
  read -r status commit < <(api /pages/builds/latest | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("status"),d.get("commit"))')
  echo "pages build: $status ($commit)"
  if [ "$commit" = "$HEAD_SHA" ] && [ "$status" = "built" ]; then break; fi
  if [ "$commit" = "$HEAD_SHA" ] && [ "$status" = "errored" ]; then echo "Pages build errored" >&2; exit 1; fi
  sleep 10
done
[ "$commit" = "$HEAD_SHA" ] && [ "$status" = "built" ] || { echo "timed out waiting for Pages build" >&2; exit 1; }

fail=0
for p in "${paths[@]}"; do
  for try in 1 2 3 4 5 6; do                                        # CDN can lag a few seconds after "built"
    code=$(curl -s -o /dev/null -w '%{http_code}' "$SITE$p?v=$HEAD_SHA"); [ "$code" = 200 ] && break; sleep 10
  done
  echo "HTTP $code  $SITE$p"; [ "$code" = 200 ] || fail=1
done
"$PY" tools/shoot.py "$SITE" "$SHOTS_DIR" "${paths[@]}" || fail=1
exit $fail
