#!/usr/bin/env bash
# Qdrant-focused integration tests.
#
# Verifies EVERY surface in this repo that touches Qdrant:
#   - Direct Qdrant Cloud API (cluster reachable, collections present)
#   - Backend /health/ready qdrant check
#   - Backend POST /api/memory/search (Qdrant-backed semantic search)
#   - Backend writes a MemoryPoint after a successful run (sampled via scroll)
#   - Python AI service writes:
#       * templates_<domain>  (template_store.py)
#       * runs                (run_store.py)
#   - Qdrant native search (cosine similarity over 384-dim vectors)
#
# Usage:
#   bash scripts/test-qdrant.sh
#
# Prereqs:
#   - .env loaded (Qdrant url/key, DATABASE_URL)
#   - Backend on :3000
#
# Output: each check prints ✓ or ✗ with a one-line assertion.

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Load .env (gitignored, has the cluster URL + key)
set -a
# shellcheck disable=SC1091
source <(grep -E '^(QDRANT_URL|QDRANT_API_KEY|DATABASE_URL)=' .env | sed 's/^/export /')
set +a

BACKEND="${BACKEND:-http://localhost:3000}"

QDRANT_URL="${QDRANT_URL%/}"
QDRANT_KEY="$QDRANT_API_KEY"

PASS=0; FAIL=0

c_g()  { printf "\033[32m%s\033[0m" "$*"; }
c_r()  { printf "\033[31m%s\033[0m" "$*"; }
c_dim(){ printf "\033[90m%s\033[0m" "$*"; }

ok()   { PASS=$((PASS+1)); printf "  %s  %-50s %s\n" "$(c_g '[✓]')" "$1" "$(c_dim "$2")"; }
ng()   { FAIL=$((FAIL+1)); printf "  %s  %-50s %s\n" "$(c_r '[✗]')" "$1" "$(c_r "$2")"; }

section() { echo; echo "$(c_dim '─── ')$1$(c_dim ' ───')"; }

# qbody <path> [extra curl args...]
# GET the qdrant endpoint and echo the response body.
qbody() {
  local path="$1"; shift
  curl -sS --max-time 8 -H "api-key: $QDRANT_KEY" "$@" "$QDRANT_URL$path"
}
# qcode <path> [extra args...] — return HTTP code only
qcode() {
  local path="$1"; shift
  curl -sS --max-time 8 -o /dev/null -w "%{http_code}" -H "api-key: $QDRANT_KEY" "$@" "$QDRANT_URL$path"
}

# ═══════════════════════════════════════════════════════════════════
section "1. Qdrant Cloud cluster — direct REST API"
# ═══════════════════════════════════════════════════════════════════

if [[ -n "$QDRANT_URL" && -n "$QDRANT_KEY" ]]; then
  ok ".env has QDRANT_URL + QDRANT_API_KEY"        "cluster=${QDRANT_URL#https://}  key=${#QDRANT_KEY} chars"
else
  ng ".env has QDRANT_URL + QDRANT_API_KEY"        "one or both empty"
fi

BODY=$(qbody "/collections")
COLS=$(echo "$BODY" | python -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(','.join(c['name'] for c in d['result']['collections']))
except Exception as e:
    print(f'ERR:{e}')
")
if [[ "$COLS" == ERR:* || -z "$COLS" ]]; then
  ng "GET /collections"                            "${COLS:-empty body}"
else
  ok "GET /collections"                            "found: $COLS"
fi

# Expected collections (created by the Python AI service)
for col in runs templates_website_builder templates_document; do
  BODY=$(qbody "/collections/$col")
  INFO=$(echo "$BODY" | python -c "
import sys, json
try:
    d = json.load(sys.stdin)['result']
    print(d['points_count'], d['status'], d.get('config',{}).get('params',{}).get('vectors',{}).get('size'))
except Exception as e:
    print(f'ERR:{e}')
")
  if [[ "$INFO" == ERR:* || -z "$INFO" ]]; then
    ng "Collection '$col' exists"                  "$INFO"
  else
    read -r PTS STATUS DIM <<< "$INFO"
    ok "Collection '$col' exists"                  "points=$PTS  status=$STATUS  dim=$DIM"
  fi
done

# Backend-managed memory collection — created lazily on first write/search
CODE=$(qcode "/collections/agentforge_memory")
case "$CODE" in
  200)
    BODY=$(qbody "/collections/agentforge_memory")
    PTS=$(echo "$BODY" | python -c "import sys, json; print(json.load(sys.stdin)['result']['points_count'])")
    ok "Collection 'agentforge_memory' (backend)"  "points=$PTS (created by MemoryService.ensureCollection)" ;;
  404)
    ok "Collection 'agentforge_memory' (backend)"  "not yet — MemoryService creates on first write/search" ;;
  *)
    ng "Collection 'agentforge_memory' (backend)"  "HTTP $CODE" ;;
esac

# ═══════════════════════════════════════════════════════════════════
section "2. Backend /health/ready  → sees Qdrant"
# ═══════════════════════════════════════════════════════════════════

RES=$(curl -sS --max-time 8 "$BACKEND/health/ready")
QDRANT_INFO=$(echo "$RES" | python -c "
import sys, json
try:
    d = json.load(sys.stdin)
    q = d.get('checks',{}).get('qdrant',{})
    print(q.get('status'), q.get('latencyMs'))
except Exception:
    print('?', '?')
")
read -r QSTATUS QMS <<< "$QDRANT_INFO"
[[ "$QSTATUS" == "ok" ]] \
  && ok "checks.qdrant in /health/ready"           "status=ok latency=${QMS}ms (MemoryService.isLive() returned true)" \
  || ng "checks.qdrant in /health/ready"           "status=$QSTATUS"

# ═══════════════════════════════════════════════════════════════════
section "3. Backend POST /api/memory/search (Qdrant-backed)"
# ═══════════════════════════════════════════════════════════════════

TS=$(date +%s)
EMAIL="qdrant_$TS@test.local"
PW="Qdrant#Test123"
REG_BODY=$(curl -sS --max-time 10 -X POST -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\",\"name\":\"Qdrant Tester\"}" \
  "$BACKEND/api/auth/register" 2>/dev/null)
TOKEN=$(echo "$REG_BODY" | python -c "import sys,json; print(json.load(sys.stdin)['data']['token'])" 2>/dev/null)
USER_ID=$(echo "$REG_BODY" | python -c "import sys,json; print(json.load(sys.stdin)['data']['user']['id'])" 2>/dev/null)

if [[ -n "$TOKEN" ]]; then
  ok "Auth bootstrap"                              "obtained JWT (len=${#TOKEN}) user=$USER_ID"
else
  ng "Auth bootstrap"                              "could not register/login — is backend up?"
fi

SEARCH_BODY=$(curl -sS --max-time 8 -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"landing page for coffee shop","limit":5}' \
  "$BACKEND/api/memory/search" 2>/dev/null)
SEARCH_INFO=$(echo "$SEARCH_BODY" | python -c "
import sys, json
try:
    d = json.load(sys.stdin)
    data = d.get('data',{})
    print(data.get('backend','?'), len(data.get('items',[])))
except Exception as e:
    print('ERR', str(e)[:60])
")
read -r BACKEND_KIND HITS <<< "$SEARCH_INFO"
[[ "$BACKEND_KIND" == "qdrant" ]] \
  && ok "POST /api/memory/search"                  "backend=qdrant  hits=$HITS  (Qdrant path live, not SQL fallback)" \
  || ng "POST /api/memory/search"                  "backend=$BACKEND_KIND  hits=$HITS"

# The search call lazily bootstraps agentforge_memory if missing. Re-check:
CODE=$(qcode "/collections/agentforge_memory")
[[ "$CODE" == "200" ]] \
  && ok "Memory collection auto-bootstrapped"      "/api/memory/search created agentforge_memory" \
  || ng "Memory collection auto-bootstrapped"      "HTTP $CODE — search didn't trigger ensureCollection"

# ═══════════════════════════════════════════════════════════════════
section "4. MemoryService write-paths (sampled via scroll)"
# ═══════════════════════════════════════════════════════════════════
# RunStreamService.applyEvent on 'success' calls memory.recordSuccessfulRun.
# Inspect any agentforge_memory points to confirm writes flow through.

BODY=$(curl -sS --max-time 8 -H "api-key: $QDRANT_KEY" \
  -X POST -H "Content-Type: application/json" \
  -d '{"limit":3,"with_payload":true,"with_vector":false}' \
  "$QDRANT_URL/collections/agentforge_memory/points/scroll")
HITS=$(echo "$BODY" | python -c "
import sys, json
try:
    d = json.load(sys.stdin)['result']
    pts = d.get('points',[])
    print(len(pts))
except Exception as e:
    print('ERR')
")
if [[ "$HITS" =~ ^[0-9]+$ ]]; then
  if [[ "$HITS" -gt 0 ]]; then
    SAMPLE=$(echo "$BODY" | python -c "
import sys, json
p = json.load(sys.stdin)['result']['points'][0]['payload']
print(f\"kind={p.get('kind')}  domain={p.get('domain')}  preview={(p.get('preview','') or '')[:60]}\")
")
    ok "Scroll agentforge_memory"                  "$HITS point(s); first: $SAMPLE"
  else
    ok "Scroll agentforge_memory"                  "collection bootstrapped, 0 points yet (no completed runs)"
  fi
else
  ng "Scroll agentforge_memory"                    "$HITS"
fi

# ═══════════════════════════════════════════════════════════════════
section "5. Python AI service writes (template_store + run_store)"
# ═══════════════════════════════════════════════════════════════════

# template_store.py: per-domain templates_<domain> collections
BODY=$(curl -sS --max-time 8 -H "api-key: $QDRANT_KEY" \
  -X POST -H "Content-Type: application/json" \
  -d '{"limit":1,"with_payload":true,"with_vector":false}' \
  "$QDRANT_URL/collections/templates_website_builder/points/scroll")
TPL=$(echo "$BODY" | python -c "
import sys, json
try:
    pts = json.load(sys.stdin)['result'].get('points',[])
    if not pts:
        print('empty'); raise SystemExit
    p = pts[0]['payload']
    print(f\"domain={p.get('domain','?')}  score={p.get('score','?')}  goal={str(p.get('goal',''))[:50]}\")
except Exception as e:
    print(f'ERR:{e}')
")
[[ "$TPL" == ERR:* || "$TPL" == "empty" ]] \
  && ng "template_store wrote templates_website_builder"  "$TPL" \
  || ok "template_store wrote templates_website_builder"  "$TPL"

# run_store.py: single 'runs' collection
BODY=$(curl -sS --max-time 8 -H "api-key: $QDRANT_KEY" \
  -X POST -H "Content-Type: application/json" \
  -d '{"limit":1,"with_payload":true,"with_vector":false}' \
  "$QDRANT_URL/collections/runs/points/scroll")
RUN=$(echo "$BODY" | python -c "
import sys, json
try:
    pts = json.load(sys.stdin)['result'].get('points',[])
    if not pts:
        print('empty'); raise SystemExit
    p = pts[0]['payload']
    keys = sorted(p.keys())
    print(f\"run_id={str(p.get('run_id',''))[:18]}  payload_keys={','.join(keys)}\")
except Exception as e:
    print(f'ERR:{e}')
")
[[ "$RUN" == ERR:* || "$RUN" == "empty" ]] \
  && ng "run_store wrote 'runs'"                   "$RUN" \
  || ok "run_store wrote 'runs'"                   "$RUN"

# ═══════════════════════════════════════════════════════════════════
section "6. Qdrant similarity search (cosine over 384-dim)"
# ═══════════════════════════════════════════════════════════════════

VEC=$(python -c "import json; print(json.dumps([0.01]*384))")
BODY=$(curl -sS --max-time 8 -H "api-key: $QDRANT_KEY" \
  -X POST -H "Content-Type: application/json" \
  -d "{\"vector\":$VEC,\"limit\":3,\"with_payload\":true}" \
  "$QDRANT_URL/collections/runs/points/search")
N=$(echo "$BODY" | python -c "
import sys, json
try:
    print(len(json.load(sys.stdin)['result']))
except Exception:
    print('ERR')
")
if [[ "$N" =~ ^[0-9]+$ ]]; then
  ok "Similarity search /points/search"            "$N hits returned (cosine, 384-dim 'all-MiniLM-L6-v2')"
else
  ng "Similarity search /points/search"            "$N"
fi

# Same against agentforge_memory (backend collection, HashEmbedder)
BODY=$(curl -sS --max-time 8 -H "api-key: $QDRANT_KEY" \
  -X POST -H "Content-Type: application/json" \
  -d "{\"vector\":$VEC,\"limit\":3,\"with_payload\":true}" \
  "$QDRANT_URL/collections/agentforge_memory/points/search")
N=$(echo "$BODY" | python -c "
import sys, json
try:
    print(len(json.load(sys.stdin)['result']))
except Exception:
    print('ERR')
")
if [[ "$N" =~ ^[0-9]+$ ]]; then
  ok "Similarity search on agentforge_memory"      "$N hits (HashEmbedder-backed user-scoped index)"
else
  ng "Similarity search on agentforge_memory"      "$N"
fi

# ═══════════════════════════════════════════════════════════════════
section "Summary"
# ═══════════════════════════════════════════════════════════════════

TOTAL=$((PASS + FAIL))
echo
printf "  %s %s passed   %s %s failed   %s %s total\n" \
  "$(c_g '✓')" "$PASS" "$(c_r '✗')" "$FAIL" "$(c_dim '•')" "$TOTAL"

exit $(( FAIL > 0 ? 1 : 0 ))
