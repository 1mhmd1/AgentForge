# AgentForge — Render API test suite (PowerShell)
# Usage:  .\scripts\test-render.ps1
# Prereqs: none — hits the live Render deployment directly

$BASE  = "https://agentforge-1.onrender.com/api"
$ROOT  = "https://agentforge-1.onrender.com"
$TS    = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$EMAIL = "suite_$TS@test.local"
$PASS  = "Suite#Pass123"

$PASS_COUNT = 0; $FAIL_COUNT = 0
$TOKEN = ""; $USER_ID = ""; $RUN_ID = ""

function pass($n, $name, $detail) {
    $PASS_COUNT++
    Write-Host ("[PASS] {0,2}  {1,-44}  {2}" -f $n, $name, $detail) -ForegroundColor Green
    Set-Variable -Name PASS_COUNT -Value $PASS_COUNT -Scope Script
}
function fail($n, $name, $detail) {
    $FAIL_COUNT++
    Write-Host ("[FAIL] {0,2}  {1,-44}  {2}" -f $n, $name, $detail) -ForegroundColor Red
    Set-Variable -Name FAIL_COUNT -Value $FAIL_COUNT -Scope Script
}

function req($method, $path, $body = $null, $token = $null) {
    $url = if ($path -match "^/health") { "$ROOT$path" } else { "$BASE$path" }
    $headers = @{ "Content-Type" = "application/json" }
    if ($token) { $headers["Authorization"] = "Bearer $token" }
    try {
        $params = @{ Uri = $url; Method = $method; Headers = $headers; ErrorAction = "Stop" }
        if ($body) { $params["Body"] = ($body | ConvertTo-Json -Depth 10) }
        $res = Invoke-RestMethod @params
        return @{ ok = $true; status = 200; body = $res }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        $raw  = ""
        try {
            $s = $_.Exception.Response.GetResponseStream()
            $raw = (New-Object System.IO.StreamReader($s)).ReadToEnd()
        } catch {}
        return @{ ok = $false; status = $code; body = $raw }
    }
}

Write-Host "`n=== AgentForge Render API Tests ===" -ForegroundColor Cyan
Write-Host "Target : $BASE"
Write-Host "Time   : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n"

# ── 1. Liveness ──────────────────────────────────────────────────────────────
$r = req GET /health
if ($r.ok -and $r.body.data.status -eq "ok") { pass 1 "GET /health — liveness" "status=ok" }
else { fail 1 "GET /health — liveness" "got: $($r.body)" }

# ── 2. Readiness ─────────────────────────────────────────────────────────────
$r = req GET /health/ready
if ($r.ok -and $r.body.checks.database.status -eq "ok") {
    pass 2 "GET /health/ready — all deps" "db=$($r.body.checks.database.status) ai=$($r.body.checks.aiService.status) qdrant=$($r.body.checks.qdrant.status)"
} else { fail 2 "GET /health/ready — all deps" "status=$($r.status) body=$($r.body)" }

# ── 3. Register ───────────────────────────────────────────────────────────────
$r = req POST /auth/register @{ email = $EMAIL; password = $PASS }
if ($r.ok -and $r.body.data.user.email -eq $EMAIL) {
    $script:TOKEN   = $r.body.data.token
    $script:USER_ID = $r.body.data.user.id
    pass 3 "POST /auth/register" "id=$($USER_ID.Substring(0,[Math]::Min(8,$USER_ID.Length)))…"
} else { fail 3 "POST /auth/register" "status=$($r.status) body=$($r.body)" }

# ── 4. Duplicate register → 409 ──────────────────────────────────────────────
$r = req POST /auth/register @{ email = $EMAIL; password = $PASS }
if ($r.status -eq 409 -or $r.status -eq 400) { pass 4 "POST /auth/register (duplicate) → 4xx" "status=$($r.status)" }
else { fail 4 "POST /auth/register (duplicate) → 4xx" "status=$($r.status)" }

# ── 5. Login ──────────────────────────────────────────────────────────────────
$r = req POST /auth/login @{ email = $EMAIL; password = $PASS }
if ($r.ok -and $r.body.data.token) {
    $script:TOKEN = $r.body.data.token
    pass 5 "POST /auth/login" "token=…$($TOKEN.Substring([Math]::Max(0,$TOKEN.Length-8)))"
} else { fail 5 "POST /auth/login" "status=$($r.status)" }

# ── 6. Wrong password → 401 ──────────────────────────────────────────────────
$r = req POST /auth/login @{ email = $EMAIL; password = "Wrong#Pass999" }
if ($r.status -eq 401) { pass 6 "POST /auth/login (bad password) → 401" "status=401" }
else { fail 6 "POST /auth/login (bad password) → 401" "status=$($r.status)" }

# ── 7. GET /auth/me ───────────────────────────────────────────────────────────
$r = req GET /auth/me $null $TOKEN
if ($r.ok -and $r.body.data.email -eq $EMAIL) { pass 7 "GET /auth/me" "email=$($r.body.data.email)" }
else { fail 7 "GET /auth/me" "status=$($r.status)" }

# ── 8. GET /auth/me — no token → 401 ─────────────────────────────────────────
$r = req GET /auth/me
if ($r.status -eq 401) { pass 8 "GET /auth/me (no token) → 401" "status=401" }
else { fail 8 "GET /auth/me (no token) → 401" "status=$($r.status)" }

# ── 9. List runs (empty) ──────────────────────────────────────────────────────
$r = req GET /runs $null $TOKEN
if ($r.ok) { pass 9 "GET /runs (empty list)" "total=$($r.body.data.total)" }
else { fail 9 "GET /runs (empty list)" "status=$($r.status)" }

# ── 10. Create run ────────────────────────────────────────────────────────────
$r = req POST /runs @{ prompt = "Build a simple hello world webpage"; domain = "website_builder" } $TOKEN
if ($r.ok -and $r.body.data.runId) {
    $script:RUN_ID = $r.body.data.runId
    pass 10 "POST /runs (create)" "runId=$RUN_ID"
} else { fail 10 "POST /runs (create)" "status=$($r.status) body=$($r.body)" }

# ── 11. Get run by ID ─────────────────────────────────────────────────────────
if ($RUN_ID) {
    $r = req GET /runs/$RUN_ID $null $TOKEN
    if ($r.ok) { pass 11 "GET /runs/:id" "status=$($r.body.data.status)" }
    else { fail 11 "GET /runs/:id" "status=$($r.status)" }
} else { Write-Host ("[SKIP] 11  GET /runs/:id — no runId from case 10") -ForegroundColor Yellow }

# ── 12. List runs — should now have 1 ────────────────────────────────────────
$r = req GET /runs $null $TOKEN
if ($r.ok -and $r.body.data.total -ge 1) { pass 12 "GET /runs (has items)" "total=$($r.body.data.total)" }
else { fail 12 "GET /runs (has items)" "total=$($r.body.data.total)" }

# ── 13. Admin guard — USER role → 403 ────────────────────────────────────────
$r = req GET /admin/users $null $TOKEN
if ($r.status -eq 403) { pass 13 "GET /admin/users (USER role) → 403" "status=403" }
else { fail 13 "GET /admin/users (USER role) → 403" "status=$($r.status)" }

# ── 14. Admin analytics guard ────────────────────────────────────────────────
$r = req GET /admin/analytics/overview $null $TOKEN
if ($r.status -eq 403) { pass 14 "GET /admin/analytics (USER role) → 403" "status=403" }
else { fail 14 "GET /admin/analytics (USER role) → 403" "status=$($r.status)" }

# ── 15. Memory search ─────────────────────────────────────────────────────────
$r = req POST /memory/search @{ query = "hello world webpage"; limit = 3 } $TOKEN
if ($r.ok) { pass 15 "POST /memory/search" "backend=$($r.body.data.backend) items=$($r.body.data.items.Count)" }
else { fail 15 "POST /memory/search" "status=$($r.status) $($r.body)" }

# ── 16. Sessions list ─────────────────────────────────────────────────────────
$r = req GET /sessions $null $TOKEN
if ($r.ok) { pass 16 "GET /sessions" "count=$($r.body.data.Count)" }
else { fail 16 "GET /sessions" "status=$($r.status)" }

# ── 17. Logout ────────────────────────────────────────────────────────────────
$r = req POST /auth/logout $null $TOKEN
if ($r.ok) { pass 17 "POST /auth/logout" "ok" }
else { fail 17 "POST /auth/logout" "status=$($r.status)" }

# ── 18. Access after logout → 401 ─────────────────────────────────────────────
$r = req GET /auth/me $null $TOKEN
if ($r.status -eq 401) { pass 18 "GET /auth/me after logout → 401" "status=401" }
else { fail 18 "GET /auth/me after logout → 401" "status=$($r.status) (token may still be valid until expiry)" }

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host "`n════════════════════════════════════" -ForegroundColor Cyan
$total = $PASS_COUNT + $FAIL_COUNT
Write-Host ("  PASSED : {0}/{1}" -f $PASS_COUNT, $total) -ForegroundColor Green
if ($FAIL_COUNT -gt 0) {
    Write-Host ("  FAILED : {0}/{1}" -f $FAIL_COUNT, $total) -ForegroundColor Red
}
Write-Host "════════════════════════════════════`n" -ForegroundColor Cyan
