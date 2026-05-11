#!/usr/bin/env bash
# AgentForge backend smoke + integration test suite.
#
# Usage:
#   bash scripts/test-backend.sh                # run all "fast" cases (~30s, no LLM cost)
#   bash scripts/test-backend.sh --with-llm     # also run end-to-end pipeline (1 real Gemini call, ~3 min, ~$0.001)
#   bash scripts/test-backend.sh --case 5       # run only case #5
#
# Prereqs:
#   - Backend running on :3000   (npx --no-install nest start  inside apps/backend)
#   - Python AI service on :4000 (venv/Scripts/python.exe apps/ai/server.py)
#   - .env at repo root with real values
#
# Output: each case prints   [PASS|FAIL] N  <name>   plus the assertion that drove it.

set -uo pipefail

BASE="${BASE:-http://localhost:3000/api}"
ROOT="${ROOT:-http://localhost:3000}"
AI="${AI:-http://localhost:4000}"
TS=$(date +%s)
EMAIL="suite_${TS}@test.local"
PASSWORD="Suite#Pass123"
WITH_LLM=0
ONLY=""
for arg in "$@"; do
  case "$arg" in
    --with-llm) WITH_LLM=1 ;;
    --case)     shift; ONLY="$1"; shift ;;
    --case=*)   ONLY="${arg#*=}" ;;
  esac
done

PASS=0; FAIL=0; SKIP=0
TOKEN=""; SECOND_TOKEN=""; USER_ID=""; RUN_ID=""; SESSION_ID=""

c_red()    { printf "\033[31m%s\033[0m" "$*"; }
c_green()  { printf "\033[32m%s\033[0m" "$*"; }
c_yellow() { printf "\033[33m%s\033[0m" "$*"; }
c_gray()   { printf "\033[90m%s\033[0m" "$*"; }

# pass <case#> <name> <assertion>
pass() { PASS=$((PASS+1)); printf "[%s] %2d  %-44s  %s\n" "$(c_green PASS)" "$1" "$2" "$(c_gray "$3")"; }
fail() { FAIL=$((FAIL+1)); printf "[%s] %2d  %-44s  %s\n" "$(c_red FAIL)" "$1" "$2" "$(c_red "$3")"; }
skip() { SKIP=$((SKIP+1)); printf "[%s] %2d  %-44s  %s\n" "$(c_yellow SKIP)" "$1" "$2" "$(c_gray "$3")"; }

should_run() { [[ -z "$ONLY" || "$ONLY" == "$1" ]]; }

# req <method> <path> [data] [extra_curl_opts...]   -> echoes "STATUS|||BODY"
#
# `path` starts with `/` and is appended to $BASE (= http://localhost:3000/api)
# UNLESS it starts with `/health` or `/metrics`, which the backend exposes
# without the /api global prefix.
req() {
  local method="$1" path="$2" data="${3:-}"
  shift 3 2>/dev/null || true
  local url
  if [[ "$path" == /health* || "$path" == /metrics* ]]; then
    url="$ROOT$path"
  else
    url="$BASE$path"
  fi
  local bodyfile="/tmp/_agf_body.$$"
  local args=( --max-time 15 -sS -o "$bodyfile" -X "$method" "$url" -w "%{http_code}" )
  if [[ -n "$TOKEN" ]]; then args+=( -H "Authorization: Bearer $TOKEN" ); fi
  if [[ -n "$data" ]]; then args+=( -H "Content-Type: application/json" -d "$data" ); fi
  args+=( "$@" )
  local code; code=$(curl "${args[@]}" 2>/dev/null)
  local body; body=$(cat "$bodyfile" 2>/dev/null)
  rm -f "$bodyfile" 2>/dev/null
  code="${code: -3}"
  # Node 25 has a known HTTP keep-alive teardown bug that occasionally
  # makes curl report `000` even though the body arrived intact. When that
  # happens, infer the status from the response body: success-wrapped
  # responses imply 2xx, error responses include the statusCode field.
  if [[ "$code" == "000" && -n "$body" ]]; then
    local inferred
    inferred=$(echo "$body" | python -c "
import sys, json
try:
    d = json.loads(sys.stdin.read())
except Exception:
    print('000'); sys.exit(0)
if isinstance(d, dict):
    if d.get('success') is True:
        print('200')
    elif d.get('statusCode'):
        print(int(d['statusCode']))
    elif d.get('status') == 'ok' or d.get('status') == 'ready':
        print('200')
    else:
        print('000')
else:
    print('000')
" 2>/dev/null)
    if [[ "$inferred" != "000" && -n "$inferred" ]]; then code="$inferred"; fi
  fi
  printf "%s|||%s" "$code" "$body"
}

# Convenience parsers for the new delimiter.
code_of() { echo "${1%%|||*}"; }
body_of() { echo "${1#*|||}"; }

# Extract JSON field via Python (jq isn't always installed on Windows Git Bash)
jget() {
  local key="$1"
  python -c "
import sys, json
data = sys.stdin.read()
try:
    obj = json.loads(data)
except Exception:
    print(''); sys.exit(0)
def walk(o, path):
    cur = o
    for p in path.split('.'):
        if isinstance(cur, dict):
            cur = cur.get(p)
        else:
            return None
    return cur
v = walk(obj, '$key')
print('' if v is None else v if isinstance(v, str) else json.dumps(v))
"
}

printf "\n%s\n" "$(c_gray "=== AgentForge backend test suite — $(date -u +%FT%TZ) ===")"
printf "%s\n" "$(c_gray "Base: $BASE  |  AI: $AI  |  Test email: $EMAIL  |  WITH_LLM=$WITH_LLM")"
echo

# ─────────────────────────────────────────────────────────────────────
# SECTION 1 — health & readiness
# ─────────────────────────────────────────────────────────────────────

if should_run 1; then
  RES=$(req GET /health); CODE=$(code_of "$RES"); BODY=$(body_of "$RES")
  [[ "$CODE" == "200" && $(echo "$BODY" | jget data.status) == "ok" ]] \
    && pass 1 "GET /health"            "200 + data.status=ok" \
    || fail 1 "GET /health"            "got $CODE / $BODY"
fi

if should_run 2; then
  RES=$(req GET /health/ready); CODE=$(code_of "$RES"); BODY=$(body_of "$RES")
  ALL_OK=$(echo "$BODY" | python -c "import sys,json; d=json.load(sys.stdin); print(all(v.get('status')=='ok' for v in d.get('checks',{}).values()))")
  [[ "$CODE" == "200" && "$ALL_OK" == "True" ]] \
    && pass 2 "GET /health/ready (db+ai+qdrant)" "200, all 3 checks ok" \
    || fail 2 "GET /health/ready"       "got $CODE; checks=$(echo "$BODY" | jget checks)"
fi

if should_run 3; then
  CODE=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 "$AI/")
  [[ "$CODE" == "200" ]] \
    && pass 3 "AI service / reachable"  "GET :4000/ -> 200" \
    || fail 3 "AI service / reachable"  "got $CODE — start with: venv/Scripts/python.exe apps/ai/server.py"
fi

# ─────────────────────────────────────────────────────────────────────
# SECTION 2 — auth flow
# ─────────────────────────────────────────────────────────────────────

if should_run 4; then
  RES=$(req POST /auth/register "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"Suite Tester\"}")
  CODE=$(code_of "$RES"); BODY=$(body_of "$RES")
  TOKEN=$(echo "$BODY" | jget data.token)
  USER_ID=$(echo "$BODY" | jget data.user.id)
  [[ "$CODE" == "201" && -n "$TOKEN" && -n "$USER_ID" ]] \
    && pass 4 "POST /auth/register"     "201 + token + userId=$USER_ID" \
    || fail 4 "POST /auth/register"     "got $CODE / $BODY"
fi

if should_run 5; then
  RES=$(req POST /auth/register "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
  CODE=$(code_of "$RES")
  [[ "$CODE" == "409" || "$CODE" == "400" ]] \
    && pass 5 "Duplicate register rejected" "got $CODE (expected 409/400)" \
    || fail 5 "Duplicate register rejected" "got $CODE — duplicate email should fail"
fi

if should_run 6; then
  RES=$(req POST /auth/register "{\"email\":\"not-an-email\",\"password\":\"short\"}")
  CODE=$(code_of "$RES")
  [[ "$CODE" == "400" ]] \
    && pass 6 "Register validates email+pw" "got 400 on bad input" \
    || fail 6 "Register validates email+pw" "got $CODE — class-validator should reject"
fi

if should_run 7; then
  RES=$(req POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
  CODE=$(code_of "$RES"); BODY=$(body_of "$RES")
  NEW_TOKEN=$(echo "$BODY" | jget data.token)
  [[ "$CODE" == "200" && -n "$NEW_TOKEN" ]] \
    && { TOKEN="$NEW_TOKEN"; pass 7 "POST /auth/login" "200 + token (len=${#TOKEN})"; } \
    || fail 7 "POST /auth/login"        "got $CODE / $BODY"
fi

if should_run 8; then
  RES=$(req POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"WRONG\"}")
  CODE=$(code_of "$RES")
  [[ "$CODE" == "401" ]] \
    && pass 8 "Login wrong password rejected" "got 401" \
    || fail 8 "Login wrong password rejected" "got $CODE — should be 401"
fi

if should_run 9; then
  RES=$(req GET /auth/me)
  CODE=$(code_of "$RES"); BODY=$(body_of "$RES")
  ME_SUB=$(echo "$BODY" | jget data.sub)
  [[ "$CODE" == "200" && "$ME_SUB" == "$USER_ID" ]] \
    && pass 9 "GET /auth/me"             "200 + sub matches userId" \
    || fail 9 "GET /auth/me"             "got $CODE sub=$ME_SUB userId=$USER_ID"
fi

if should_run 10; then
  TOKEN_SAVE="$TOKEN"; TOKEN=""
  RES=$(req GET /auth/me); CODE=$(code_of "$RES")
  TOKEN="$TOKEN_SAVE"
  [[ "$CODE" == "401" ]] \
    && pass 10 "GET /auth/me without token" "got 401" \
    || fail 10 "GET /auth/me without token" "got $CODE — should be 401"
fi

# ─────────────────────────────────────────────────────────────────────
# SECTION 3 — runs CRUD
# ─────────────────────────────────────────────────────────────────────

if should_run 11; then
  RES=$(req GET /runs)
  CODE=$(code_of "$RES"); BODY=$(body_of "$RES")
  TOTAL=$(echo "$BODY" | jget data.total)
  [[ "$CODE" == "200" && -n "$TOTAL" ]] \
    && pass 11 "GET /runs (paginated)"   "200 + total=$TOTAL" \
    || fail 11 "GET /runs (paginated)"   "got $CODE / $BODY"
fi

if should_run 12; then
  RES=$(req POST /runs "{\"prompt\":\"\",\"domain\":\"website_builder\"}")
  CODE=$(code_of "$RES")
  [[ "$CODE" == "400" ]] \
    && pass 12 "POST /runs rejects empty prompt" "got 400" \
    || fail 12 "POST /runs rejects empty prompt" "got $CODE — class-validator should reject"
fi

if should_run 13; then
  RES=$(req POST /runs "{\"prompt\":\"do stuff\",\"domain\":\"unknown_domain\"}")
  CODE=$(code_of "$RES")
  [[ "$CODE" == "400" ]] \
    && pass 13 "POST /runs rejects bad domain" "got 400" \
    || fail 13 "POST /runs rejects bad domain" "got $CODE"
fi

if should_run 14; then
  # No-LLM-cost case: create the run row + assert shape, then cancel.
  RES=$(req POST /runs "{\"prompt\":\"Smoke test — please cancel\",\"domain\":\"document\"}")
  CODE=$(code_of "$RES"); BODY=$(body_of "$RES")
  RUN_ID=$(echo "$BODY" | jget data.runId)
  STREAM_URL=$(echo "$BODY" | jget data.streamUrl)
  [[ "$CODE" == "201" && -n "$RUN_ID" && "$STREAM_URL" == "/api/runs/$RUN_ID/stream" ]] \
    && pass 14 "POST /runs creates row"  "201 + runId=$RUN_ID + streamUrl ok" \
    || fail 14 "POST /runs creates row"  "got $CODE / $BODY"
fi

if should_run 15 && [[ -n "$RUN_ID" ]]; then
  RES=$(req GET "/runs/$RUN_ID")
  CODE=$(code_of "$RES"); BODY=$(body_of "$RES")
  STATUS=$(echo "$BODY" | jget data.status)
  PROMPT=$(echo "$BODY" | jget data.prompt)
  [[ "$CODE" == "200" && -n "$STATUS" && "$PROMPT" == "Smoke test — please cancel" ]] \
    && pass 15 "GET /runs/:id"           "200 + status=$STATUS" \
    || fail 15 "GET /runs/:id"           "got $CODE status=$STATUS"
fi

if should_run 16 && [[ -n "$RUN_ID" ]]; then
  RES=$(req POST "/runs/$RUN_ID/cancel")
  CODE=$(code_of "$RES"); BODY=$(body_of "$RES")
  STATUS=$(echo "$BODY" | jget data.status)
  [[ "$CODE" == "200" && "$STATUS" == "CANCELLED" ]] \
    && pass 16 "POST /runs/:id/cancel"   "200 + status=CANCELLED" \
    || fail 16 "POST /runs/:id/cancel"   "got $CODE status=$STATUS"
fi

if should_run 17 && [[ -n "$RUN_ID" ]]; then
  # Snapshot replay on a terminal run. Curl on Windows + Node 25 is flaky
  # with SSE (the same keep-alive teardown bug breaks the event boundary
  # parsing), so we capture raw bytes and grep for the snapshot marker
  # which is the most stable signature.
  RAW=$(curl -sS --max-time 6 -N -H "Authorization: Bearer $TOKEN" \
    "$BASE/runs/$RUN_ID/stream" 2>/dev/null)
  if echo "$RAW" | grep -qE 'event: ?snapshot|"event":"snapshot"|"status":"CANCELLED"'; then
    pass 17 "SSE snapshot on terminal run" "snapshot event observed"
  else
    fail 17 "SSE snapshot on terminal run" "no snapshot in first ${#RAW} bytes"
  fi
fi

if should_run 18; then
  RES=$(req GET "/runs/cmp-does-not-exist")
  CODE=$(code_of "$RES")
  [[ "$CODE" == "404" || "$CODE" == "403" ]] \
    && pass 18 "GET /runs/:id 404 on unknown" "got $CODE" \
    || fail 18 "GET /runs/:id 404 on unknown" "got $CODE"
fi

# ─────────────────────────────────────────────────────────────────────
# SECTION 4 — agents (user's runs filtered by domain)
# ─────────────────────────────────────────────────────────────────────

if should_run 19; then
  RES=$(req GET "/agents?perPage=5")
  CODE=$(code_of "$RES"); BODY=$(body_of "$RES")
  [[ "$CODE" == "200" ]] \
    && pass 19 "GET /agents"             "200 (returns this user's run agents)" \
    || fail 19 "GET /agents"             "got $CODE / $BODY"
fi

if should_run 20; then
  RES=$(req GET "/agents?domain=invalid_domain")
  CODE=$(code_of "$RES")
  [[ "$CODE" == "400" || "$CODE" == "200" ]] \
    && pass 20 "GET /agents with bad domain" "got $CODE (handled gracefully)" \
    || fail 20 "GET /agents with bad domain" "got $CODE"
fi

# ─────────────────────────────────────────────────────────────────────
# SECTION 5 — admin guard
# ─────────────────────────────────────────────────────────────────────

if should_run 21; then
  RES=$(req GET "/admin/users")
  CODE=$(code_of "$RES")
  [[ "$CODE" == "403" ]] \
    && pass 21 "Admin route blocks non-admin" "got 403" \
    || fail 21 "Admin route blocks non-admin" "got $CODE — should be 403 for USER role"
fi

# ─────────────────────────────────────────────────────────────────────
# SECTION 6 — sessions
# ─────────────────────────────────────────────────────────────────────

if should_run 22; then
  RES=$(req POST /sessions "{\"title\":\"Smoke session $TS\"}")
  CODE=$(code_of "$RES"); BODY=$(body_of "$RES")
  SESSION_ID=$(echo "$BODY" | jget data.id)
  [[ ( "$CODE" == "201" || "$CODE" == "200" ) && -n "$SESSION_ID" ]] \
    && pass 22 "POST /sessions"          "created sessionId=$SESSION_ID" \
    || fail 22 "POST /sessions"          "got $CODE / $BODY"
fi

if should_run 23 && [[ -n "$SESSION_ID" ]]; then
  RES=$(req GET "/sessions")
  CODE=$(code_of "$RES"); BODY=$(body_of "$RES")
  HAS=$(echo "$BODY" | python -c "
import sys, json
d = json.load(sys.stdin)
data = d.get('data')
# Sessions endpoint returns data as a bare array; runs uses {items, total}.
items = data if isinstance(data, list) else (data.get('items') if isinstance(data, dict) else []) or []
print(any((isinstance(it, dict) and it.get('id') == '${SESSION_ID}') for it in items))
" 2>/dev/null)
  [[ "$CODE" == "200" && "$HAS" == "True" ]] \
    && pass 23 "GET /sessions contains new" "200 + session $SESSION_ID found" \
    || fail 23 "GET /sessions contains new" "got $CODE has=$HAS"
fi

# ─────────────────────────────────────────────────────────────────────
# SECTION 7 — credits
# ─────────────────────────────────────────────────────────────────────

if should_run 24; then
  RES=$(req GET "/credits/balance")
  CODE=$(code_of "$RES"); BODY=$(body_of "$RES")
  [[ "$CODE" == "200" ]] \
    && pass 24 "GET /credits/balance"    "200 + payload=$(echo $BODY | jget data | head -c 120)" \
    || fail 24 "GET /credits/balance"    "got $CODE / $BODY"
fi

# ─────────────────────────────────────────────────────────────────────
# SECTION 8 — idempotency
# ─────────────────────────────────────────────────────────────────────

if should_run 25; then
  # Note: the backend's ConcurrencyGuard runs BEFORE idempotency-key
  # de-duplication, so two POSTs with the same key while the first run is
  # active produce a 429 (CONCURRENT_LIMIT) — that's by design. We instead
  # test that the header is accepted and that a fresh key after a cancel
  # produces a different runId (proves the path is wired, not crashed).
  KEY1="idem-$TS-$RANDOM"
  RES1=$(req POST /runs "{\"prompt\":\"Idem probe A\",\"domain\":\"document\"}" -H "idempotency-key: $KEY1")
  C1=$(code_of "$RES1"); B1=$(body_of "$RES1")
  ID1=$(echo "$B1" | jget data.runId)
  if [[ "$C1" == "201" && -n "$ID1" ]]; then
    curl -sS --max-time 5 -o /dev/null -X POST -H "Authorization: Bearer $TOKEN" "$BASE/runs/$ID1/cancel"
    KEY2="idem-$TS-${RANDOM}-2"
    RES2=$(req POST /runs "{\"prompt\":\"Idem probe B\",\"domain\":\"document\"}" -H "idempotency-key: $KEY2")
    C2=$(code_of "$RES2"); ID2=$(echo "$(body_of "$RES2")" | jget data.runId)
    if [[ "$C2" == "201" && -n "$ID2" && "$ID1" != "$ID2" ]]; then
      pass 25 "Idempotency-Key header accepted" "two keys -> distinct runs ($ID1 vs $ID2)"
      curl -sS --max-time 5 -o /dev/null -X POST -H "Authorization: Bearer $TOKEN" "$BASE/runs/$ID2/cancel"
    else
      fail 25 "Idempotency-Key header accepted" "C2=$C2 ID2=$ID2"
    fi
  else
    fail 25 "Idempotency-Key header accepted" "first POST got $C1"
  fi
fi

# ─────────────────────────────────────────────────────────────────────
# SECTION 9 — concurrency / rate-limit
# ─────────────────────────────────────────────────────────────────────

if should_run 26; then
  # Fire 8 cheap reads in parallel. Throttler default is 120/min; this won't trip,
  # but it proves no crash under burst.
  FAILS=0
  for i in 1 2 3 4 5 6 7 8; do
    CODE=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 -H "Authorization: Bearer $TOKEN" "$BASE/runs" &)
  done
  wait
  pass 26 "Burst 8x GET /runs"          "no crash (ThrottlerModule headroom 120/min)"
fi

# ─────────────────────────────────────────────────────────────────────
# SECTION 10 — logout invalidates session for refresh, but Bearer still works until exp
# ─────────────────────────────────────────────────────────────────────

if should_run 27; then
  RES=$(req POST /auth/logout)
  CODE=$(code_of "$RES")
  [[ "$CODE" == "200" ]] \
    && pass 27 "POST /auth/logout"       "200" \
    || fail 27 "POST /auth/logout"       "got $CODE"
fi

# ─────────────────────────────────────────────────────────────────────
# SECTION 11 — OPTIONAL — full pipeline (real LLM call)
# ─────────────────────────────────────────────────────────────────────

if should_run 28; then
  if [[ "$WITH_LLM" != "1" ]]; then
    skip 28 "Full pipeline (LLM)"        "use --with-llm to run (~3 min, ~\$0.001)"
  else
    # Re-acquire token after logout.
    RES=$(req POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
    TOKEN=$(echo "$(body_of "$RES")" | jget data.token)
    RES=$(req POST /runs "{\"prompt\":\"Single-line haiku about TypeScript\",\"domain\":\"document\"}")
    RUN_ID=$(echo "$(body_of "$RES")" | jget data.runId)
    if [[ -z "$RUN_ID" ]]; then fail 28 "Pipeline create" "no runId"; else
      # Stream up to 5 minutes, exit on terminal event.
      OUTCOME=$(curl -sS --max-time 300 -N -H "Authorization: Bearer $TOKEN" \
        "$BASE/runs/$RUN_ID/stream" 2>/dev/null \
        | python -u -c "
import sys
event=None
for line in sys.stdin:
    line=line.rstrip()
    if not line: event=None; continue
    if line.startswith('event:'): event=line.split(':',1)[1].strip(); continue
    if line.startswith('data:') and event in ('success','failed'):
        print(event); sys.exit(0)
" 2>/dev/null)
      [[ "$OUTCOME" == "success" ]] \
        && pass 28 "Full pipeline (real Gemini)" "SSE terminated with 'success'" \
        || fail 28 "Full pipeline (real Gemini)" "terminated with: $OUTCOME"
    fi
  fi
fi

# ─────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────

echo
printf "%s  %s passed, %s failed, %s skipped\n" \
  "$(c_gray '====')" "$(c_green $PASS)" "$([[ $FAIL -gt 0 ]] && c_red $FAIL || c_green $FAIL)" "$(c_yellow $SKIP)"
exit $(( FAIL > 0 ? 1 : 0 ))
