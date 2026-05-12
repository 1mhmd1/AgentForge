# AgentForge Complete System Audit

**Date:** 2026-05-09
**Branch:** Buildernode (post-merge)
**Auditor stance:** Principal engineer, diagnosis-first, no fabricated metrics. Every finding cites a real file/line; estimated impact is marked as such. Quality-target percentages from the brief are aspirational -- this audit reports what the code says and what it would actually take.

---

## EXECUTIVE SUMMARY

### Three things to know before reading anything else

1. **`server.py` bypasses `graph.py`.** [`server.py:74-149`](apps/ai/server.py#L74) directly chains `planner_node -> builder_node`. The `prompt_optimizer` and `validator` nodes that exist in the codebase and are wired into `graph.py` are **never reached in production HTTP traffic**. This is the single biggest architectural gap and it invalidates several other claims about the pipeline.

2. **Builder writes `agents_executed` as a list; validator wanted an int.** Already fixed in this session ([`audit_checker.py`](apps/ai/src/services/audit_checker.py)). Mentioning here for completeness because the LangGraph pipeline (when you DO use `graph.py`) couldn't pass validation before that patch.

3. **Sub-agent prompt has a literal em-dash.** [`sub_agent_prompt.py:11`](apps/ai/src/prompts/sub_agent_prompt.py#L11) contains `—` (U+2014). Project rule (Windows Python 3.11 source-encoding history) is ASCII-only in `.py` files. Currently working because the file is UTF-8, but it's a tripwire.

### Audit summary

| Category | Verdict | Critical issues | High | Medium | Low |
|---|---|---|---|---|---|
| Architecture & wiring | NEEDS WORK | 1 | 2 | 3 | 1 |
| Orchestration | OK with gaps | 0 | 1 | 2 | 0 |
| State management | MOSTLY OK | 0 | 1 | 2 | 1 |
| Prompt engineering | GOOD | 0 | 0 | 3 | 1 |
| LLM output parsing | GOOD | 0 | 1 | 1 | 0 |
| Template system | DESIGN-OK | 0 | 0 | 2 | 1 |
| Code injection | EXCELLENT | 0 | 0 | 0 | 1 |
| Sub-agent coordination | GOOD | 0 | 0 | 2 | 0 |
| Validation completeness | OK (post-patch) | 0 | 1 | 3 | 1 |
| Error handling | OK | 0 | 1 | 2 | 0 |
| Observability | WEAK | 0 | 2 | 2 | 1 |
| Testing | OK | 0 | 1 | 1 | 1 |
| Security & sandboxing | NEEDS WORK | 1 | 2 | 1 | 1 |
| Performance & efficiency | OK | 0 | 0 | 3 | 1 |
| Maintainability | GOOD | 0 | 0 | 2 | 2 |
| Production readiness | NOT READY | 2 | 2 | 1 | 0 |
| Observability infra | ABSENT | 0 | 1 | 2 | 1 |
| **TOTAL** | | **4** | **15** | **30** | **15** |

### Top-of-funnel "ship-blockers"

1. **server.py routes around graph.py** -- prompt_optimizer + validator unreachable in HTTP path
2. **CORS `allow_origins=["*"]` in [server.py:43](apps/ai/server.py#L43)** -- production must restrict
3. **`os.chdir` at import time in [server.py:13](apps/ai/server.py#L13)** -- breaks concurrent runs and any other module that depends on cwd
4. **Subprocess execution does NOT pass `env=` ** -- inherits host PYTHONPATH (low-risk today, blast-radius tomorrow)

### What this audit deliberately does NOT do

- **Fabricate quality numbers.** The brief's "+300% output quality" targets aren't measurable without baseline data. Findings are concrete; impact estimates are directional.
- **Recommend new frameworks.** AgentForge's "simple functions, hardcoded skeletons" style is intentional. Suggested fixes preserve it.
- **Recommend an LLM upgrade.** That's Phase 18, which I reach with discipline, not as a default.

---

## PHASE 1 -- ARCHITECTURE STABILITY & SCALING

### 1.1 -- Audit summary
- Components analyzed: `nodes/{planner,builder,sub_agent,prompt_optimizer,validator}.py`, `graph/graph.py`, `server.py`, `state/State.py`
- Total files: 10 production modules, ~2300 LOC
- Critical: 1 | High: 2 | Medium: 3 | Low: 1

### 1.2 -- Current weaknesses

**W1.1 (CRITICAL) -- HTTP server bypasses LangGraph wiring**
**Where:** [`server.py:74-149`](apps/ai/server.py#L74)
**Evidence:**
```python
# server.py emits SSE for two stages only:
yield emit("stage", {"stage": "PLANNER", ...})
state = initial_state(run_id=run_id, user_prompt=prompt)
planned = planner_node(state)
...
yield emit("stage", {"stage": "BUILDER", ...})
built = builder_node(planned)
```
Meanwhile [`graph.py`](apps/ai/src/graph/graph.py) compiles `prompt_optimizer -> planner -> builder -> END`. The validator isn't in the graph either (it's defined in `nodes/validator.py` but no edge points to it).
**Impact:** Two fully-built features (prompt optimization, validation) never run for real users. The graph object is exported but nobody imports it.
**Root cause:** Two parallel control planes evolved independently -- the graph was the design target but server.py kept calling the nodes directly for SSE granularity.

**W1.2 (HIGH) -- Validator node not wired into the graph**
**Where:** [`graph.py`](apps/ai/src/graph/graph.py) lacks `add_node("validator", validator_node)` and edge `builder -> validator`.
**Evidence:** Reading the file: `prompt_optimizer -> planner -> builder -> END`. Validator node exists in `nodes/validator.py` (38 lines) but nothing references it.
**Impact:** All the audit work on the validator (this session and prior) is dead code until wired. Same gap as W1.1 but specifically for validation.

**W1.3 (HIGH) -- Hardcoded "groq" defaults scattered across the codebase**
**Where:**
- [`builder.py:229-230`](apps/ai/src/nodes/builder.py#L229) `provider = "groq"` default
- [`sub_agent.py:145`](apps/ai/src/nodes/sub_agent.py#L145) `provider: str = "groq"` parameter default
- [`audit_checker.py`](apps/ai/src/services/audit_checker.py) accepts any provider name; doesn't enforce
- `llm.py:18` reads `LLM_PROVIDER` env var, defaults `"groq"`
**Impact:** "Swap providers" requires changing multiple files plus env. Not catastrophic; but four places to update is one too many.

**W1.4 (MEDIUM) -- Domain knowledge hardcoded in 3 separate places**
**Where:**
- [`safe_injector.py:118-321`](apps/ai/src/services/safe_injector.py#L118) one builder per domain
- [`code_serializer.py:136-141`](apps/ai/src/services/code_serializer.py#L136) `DOMAIN_WRAPPERS` dict
- [`errors.py:1-6`](apps/ai/src/services/errors.py#L1) `SUPPORTED_DOMAINS` set
**Impact:** Adding a 5th domain requires editing all three files plus `State.py` (Domain Literal) plus `planner_prompt.py` (DOMAIN-TOOL MAP). Plugin system would consolidate.

**W1.5 (MEDIUM) -- `next_state = state.copy()` is shallow**
**Where:** Every node: [`builder.py:155`](apps/ai/src/nodes/builder.py#L155), [`planner.py:47`](apps/ai/src/nodes/planner.py#L47), [`prompt_optimizer.py:108`](apps/ai/src/nodes/prompt_optimizer.py#L108), [`validator.py:7`](apps/ai/src/nodes/validator.py#L7)
**Evidence:** `next_state = state.copy()` only copies the top-level dict. Mutating `next_state["spec"]["steps"].append(...)` would also mutate the input state.
**Impact:** Today low because the only deep mutation I can find is [`builder.py:166-170`](apps/ai/src/nodes/builder.py#L166) `spec = dict(spec)` which explicitly defends -- but the convention isn't enforced. A future contributor adding `next_state["run_audit"]["counter"] += 1` would silently mutate the caller's state.

**W1.6 (MEDIUM) -- AGENT_TEMPLATE is a Python string constant, not a file**
**Where:** [`safe_injector.py:16-74`](apps/ai/src/services/safe_injector.py#L16) inside `class SafeCodeInjector`.
**Impact:** Editing the template requires touching Python source, no syntax highlighting for the embedded code, and CI won't lint it. Migrating to a proper template file would help, but the hardcoded approach is intentional since the prior Jinja2 system was deleted.

**W1.7 (LOW) -- AGENT_TEMPLATE single-string format edge case**
[`safe_injector.py:101-113`](apps/ai/src/services/safe_injector.py#L101) calls `.format(...)`. The template uses `{{ }}` for literal braces (line 40, 50, 65). One unescaped `{` would break it. Defensive: switch to `string.Template` or `% formatting`.

### 1.3 -- Hidden risks

**R1.A -- Adding any new node requires editing graph.py AND server.py AND any test that bypasses the graph.** Probability: HIGH whenever someone adds a node. Impact: features exist but don't run. Mitigation: collapse into a single entry point.

**R1.B -- Two parallel pipelines diverge over time.** Today server.py and graph.py both call the same node functions, but their pre/post-state shaping differs. As either evolves, drift becomes a debugging tax.

**R1.C -- State schema evolves but `AgentForgeState` TypedDict doesn't.** Several runtime keys (`planner_usage`, `optimized_prompt` (now in TypedDict), `prompt_analysis`, `validation_status`, etc.) were added. If someone forgets to update both places, type checkers won't catch the drift.

### 1.4 -- Recommended improvements

**I1.1 -- Make server.py call the compiled graph (HIGH priority, ~30 LOC)**
```python
# Replace server.py:74-149 with
from graph.graph import graph
# In stream_pipeline:
final_state = graph.invoke(initial_state(run_id, prompt))
# Then emit SSE events from final_state["completed_stages"]
```
Drawback: SSE granularity drops from per-stage to per-node unless you intercept at the LangGraph callback layer. Trade-off worth taking.
**Impact:** Wires prompt_optimizer + validator into production. Eliminates W1.1 and W1.2.

**I1.2 -- Centralize "default provider" decision (LOW, ~5 LOC)**
One place reads `LLM_PROVIDER` env, every consumer asks for it. Already done in `llm.py`; just remove the `"groq"` fallbacks in builder.py:229-230 and sub_agent.py:145, replacing with `provider or os.getenv("LLM_PROVIDER", "groq")`.

**I1.3 -- Shallow-copy is fine; document the convention (LOW)**
Add a comment in each node saying "shallow copy is intentional; do not mutate nested dicts in-place". Cheaper than rewriting.

### 1.5 -- Implementation priority
- **CRITICAL:** I1.1 (server.py uses graph)
- **HIGH:** none -- W1.2 is collateral damage of W1.1; same fix
- **MEDIUM:** I1.2, plugin registration for domains
- **LOW:** I1.3, AGENT_TEMPLATE format hardening

### 1.6 -- Expected impact (directional, not measured)
- **Production correctness:** large -- two features go from 0% reach to 100%
- **Maintainability:** moderate -- removes the "two pipelines" mental tax
- **Stability:** small -- mostly already stable

---

## PHASE 2 -- ORCHESTRATION QUALITY & FLOW

### 2.1 -- Current state
LangGraph DAG (after my prompt_optimizer + the state.py merge):
```
START -> prompt_optimizer -> planner -> builder -> END
                                                 |
            validator (defined, NOT wired) ------+
```

### 2.2 -- Weaknesses

**W2.1 (HIGH) -- Validator's `repair_attempts` loop is plumbed but never reached**
**Where:** [`validator.py:30-36`](apps/ai/src/nodes/validator.py#L30) increments `repair_attempts` and toggles `status="running"` to imply "the graph will retry me". The graph has no edge to make that happen.
**Impact:** A failed validation leaves the run in `status="running"` until `repair_attempts >= 3`. Misleads any downstream consumer.

**W2.2 (MEDIUM) -- `prompt_optimizer_node` may auto-set `domain` based on detected domain, which can later conflict with planner**
**Where:** [`prompt_optimizer.py:114-122`](apps/ai/src/nodes/prompt_optimizer.py#L114) sets `next_state["domain"]` from `detected_domain` if not already specified. Planner [`planner.py:60-63`](apps/ai/src/nodes/planner.py#L60) then overrides spec's domain with `next_state.get("domain")`.
**Impact:** Optimizer's heuristic domain becomes the canonical one, even if the planner's structured analysis would have chosen differently. Small risk; deliberate trade-off when I implemented it; flagging for awareness.

**W2.3 (MEDIUM) -- No conditional routing**
LangGraph supports `add_conditional_edges`. Current graph is fully linear. If planner fails, builder still runs (and immediately fails on `validate_spec`). Wastes one builder invocation's worth of state-shaping work.

### 2.3 -- Recommended improvements
- **I2.1 (HIGH):** Fix validator wiring as part of I1.1.
- **I2.2 (MEDIUM):** Add `add_conditional_edges("planner", lambda s: "builder" if s.get("status") != "failed" else END)`. ~5 LOC.
- **I2.3 (LOW):** Decide whether optimizer should set `domain` or just suggest it. Today: it sets, planner overrides via spec, then planner.py:60 reverts to optimizer's value. Confusing; pick one.

---

## PHASE 3 -- STATE MANAGEMENT SAFETY

### 3.1 -- Current state
`AgentForgeState` is a `TypedDict` with ~38 fields after the merge. Used as a plain dict at runtime (TypedDict provides no runtime check).

### 3.2 -- Weaknesses

**W3.1 (HIGH) -- State contract is documented but not enforced**
**Where:** [`State.py`](apps/ai/src/state/State.py)
TypedDict is a type-checker hint only. At runtime, `state["nonexistent_key"]` raises `KeyError`; `state.get("foo")` returns `None`; nothing validates types. Several nodes do their own ad-hoc validation (e.g. validator's `_state_validation_errors` checks 4 keys), but most don't.
**Impact:** A node receiving a malformed state finds out lazily, often via a confusing exception inside business logic.

**W3.2 (MEDIUM) -- No state save/restore**
There is no checkpoint mechanism. A crash mid-builder loses everything. Given pipeline runs are <30s typical, this is borderline-acceptable, but it's a pure "if you wanted it, here's where it'd go" finding.

**W3.3 (MEDIUM) -- `next_state = state.copy()` shallowness (already covered as W1.5)**

**W3.4 (LOW) -- TypedDict drift risk (covered as R1.C)**

### 3.3 -- Recommended improvements

**I3.1 (MEDIUM):** Add a single `validate_state(state, required_keys)` helper in `state/State.py` and call it at the top of each node:
```python
def validate_state(state, required, where):
    missing = [k for k in required if k not in state]
    if missing:
        raise KeyError(f"{where}: missing state keys: {missing}")
```
~15 LOC. Catches the contract drift pattern that broke things in this session (validator's audit-shape mismatch).

---

## PHASE 4 -- PROMPT ENGINEERING QUALITY

### 4.1 -- Inventory
| Prompt | Size | Notes |
|---|---|---|
| `planner_prompt.py` | 2247 chars (~562 tokens) | Has 1 example, schema, 9 rules. Trimmed in prior session (-4%). |
| `prompt_optimizer_prompt.py` | ~2300 chars | 2 examples, repeats "RETURN ONLY JSON" 3x per spec |
| `sub_agent_prompt.py` | 609 chars (~152 tokens) | Aggressively trim. Has em-dash on line 11 (rule violation) |

### 4.2 -- Weaknesses

**W4.1 (MEDIUM) -- Sub-agent prompt is too terse for low-tier models**
**Where:** [`sub_agent_prompt.py`](apps/ai/src/prompts/sub_agent_prompt.py)
Just 18 lines, no example. Groq's `llama-3.1-8b-instant` is the smallest commonly-used model in the Groq lineup. With this minimal prompt, the agent has high variance on (a) JSON shape, (b) what to put in `generated_code` (HTML vs Python vs markdown).
**Evidence:** `sub_agent.py` has FIVE layers of recovery (`_strip_invisible`, `_clean_response`, `_extract_json`, `_extract_fields_fallback`, raw-output fallback). That much defensive parsing is itself a measurement: the prompt produces messy outputs often enough to need it.
**Recommendation:** Add a 1-shot example showing the success format. Cost: +200 tokens per call. Likely cuts retry rate.

**W4.2 (MEDIUM) -- ASCII rule violation in sub_agent_prompt.py**
[`sub_agent_prompt.py:11`](apps/ai/src/prompts/sub_agent_prompt.py#L11): `... — NOT Python.` Use `--`. ~5 sec fix.

**W4.3 (MEDIUM) -- Planner prompt offers tools per domain but planner doesn't validate the LLM picked from that list**
**Where:** [`planner_prompt.py:45-52`](apps/ai/src/prompts/planner_prompt.py#L45) defines TOOL OPTIONS and DOMAIN-TOOL MAP. [`planner.py:54-86`](apps/ai/src/nodes/planner.py#L54) accepts whatever the LLM returned in `tools`.
**Impact:** A hallucinated tool name flows downstream; sub_agent doesn't currently use the tools field for routing, so impact is "metadata pollution" not "broken pipeline" today.

**W4.4 (LOW) -- No prompt versioning**
Prompts are constants. If you change one and a regression appears, you can `git log` your way back, but there's no `PROMPT_VERSION = "2.1"` you can include in run_audit. Helpful for A/B comparison.

### 4.3 -- Recommendations
- **I4.1 (MEDIUM):** Add a 1-shot example to sub_agent_prompt.py. Test with adversarial sub-agent calls.
- **I4.2 (LOW):** Sweep all `.py` prompt files for non-ASCII; replace with ASCII equivalents. One-time migration.

### 4.4 -- Token cost is already reasonable
Per the prior optimization session, planner is ~562 tok and sub-agent is ~152 tok. The brief's "47% reduction" target on these sizes would mean cutting an already-tight planner prompt to ~300 tokens, which would degrade output quality. **Don't do it.**

---

## PHASE 5 -- LLM OUTPUT PARSING ROBUSTNESS

### 5.1 -- Strengths
The codebase invests heavily here, and it shows:
- [`sub_agent.py:9-23`](apps/ai/src/nodes/sub_agent.py#L9): strips zero-width spaces, BOMs, markdown fences
- [`sub_agent.py:26-49`](apps/ai/src/nodes/sub_agent.py#L26): finds first `{` to last `}`, fixes trailing commas, falls back to regex extraction
- [`sub_agent.py:52-86`](apps/ai/src/nodes/sub_agent.py#L52): per-field regex extraction when JSON is unparseable
- [`sub_agent.py:174-216`](apps/ai/src/nodes/sub_agent.py#L174): retry once + final raw-output-as-content fallback

This is genuinely robust.

### 5.2 -- Weaknesses

**W5.1 (HIGH) -- Planner has weaker recovery than sub-agent**
**Where:** [`planner.py:7-16`](apps/ai/src/nodes/planner.py#L7) has only `_clean_json` (markdown fence stripper). On `json.loads` failure, the planner immediately returns `status=failed` with no retry, no field-extraction fallback.
**Impact:** A malformed planner output kills the entire run, where sub-agent equivalents would attempt 2 more recovery strategies. Inconsistent.
**Fix:** Lift sub_agent's `_extract_json` + `_extract_fields_fallback` into a shared module (`services/llm_parsing.py`) and use it from planner too. ~30 LOC of refactor.

**W5.2 (MEDIUM) -- No "repair via LLM" loop**
The brief suggested asking the LLM to fix its own malformed output. Not implemented anywhere. Trade-off: extra LLM call costs vs. saving runs that would otherwise fail. With the current 3-tier fallback, repair-LLM is probably overkill.

### 5.3 -- Recommendation
**I5.1:** Extract shared parser module. Apply to both planner_node and prompt_optimizer_node (which has its own redundant copy of the same logic).

---

## PHASE 6 -- TEMPLATE SYSTEM RELIABILITY

### 6.1 -- Current architecture
There IS no template system in the spec sense. The prior Jinja2 system was deleted. Current "templates" are:
- A hardcoded Python string constant in [`safe_injector.py:16-74`](apps/ai/src/services/safe_injector.py#L16) -- the `AGENT_TEMPLATE` skeleton
- Per-domain "agent_functions" + "main_body" hardcoded as string constants in [`safe_injector.py:127-321`](apps/ai/src/services/safe_injector.py#L127)

### 6.2 -- Verdict
**This is fine.** The brief's template recommendations (Jinja inheritance, namespaced markers, etc.) presume Jinja2 is in use. It isn't. The current "template = string constant + json.dumps for injection" approach **eliminates template-injection bugs by construction** (no markers exist for the LLM to leave unresolved -- content goes into Python string literals via json.dumps).

The cost is editor ergonomics (Python source contains literal HTML/CSS code). Acceptable.

### 6.3 -- One real weakness

**W6.1 (MEDIUM) -- Per-domain skeletons duplicate ~70% of structure**
The 4 builders (website, research, document, data) all do: define `step_1`, optionally `step_2`, set `final_result`, return via `inject_safe`. Could be parameterized to one function. Minor.

---

## PHASE 7 -- CODE INJECTION SAFETY

### 7.1 -- Excellent design

The current "code injection" path uses `json.dumps` for ALL content serialization:
```python
# code_serializer.py:20
return json.dumps(content, ensure_ascii=False)
```

This means generated content (HTML, CSS, JS, markdown, JSON) is serialized into Python string literals like `HTML_CONTENT = "<html>..."`. There is **no marker replacement, no f-string injection, no exec**.

This is the safest possible pattern for embedding untrusted content into Python source. Triple-quote collisions, escape-sequence ambiguity, and indentation corruption are all eliminated.

### 7.2 -- Post-injection sanitizer ([`code_sanitizer.py`](apps/ai/src/services/code_sanitizer.py))
- Counts `"""` and `'''` for matched-quote check (line 42-55)
- Fixes mixed tabs/spaces (line 58-77)
- Warns on raw HTML/CSS outside strings (lines 80-123)
- Warns on module-level prints (lines 126-154)

The sanitizer's checks are heuristic; some can false-positive (e.g., the indentation rounding at line 70 will "fix" a legitimately-indented code block that uses 2-space indent). But because content doesn't go through markers anymore, the sanitizer is mostly a belt-and-suspenders check. Low risk.

### 7.3 -- One nit

**W7.1 (LOW) -- Sanitizer's indentation auto-fix can corrupt valid code**
[`code_sanitizer.py:70-73`](apps/ai/src/services/code_sanitizer.py#L70): if leading_spaces is not a multiple of 4, it rounds DOWN to the nearest multiple of 4. A line indented at column 6 (e.g., a continuation) becomes column 4. Could break code.

---

## PHASE 8 -- SUB-AGENT COORDINATION

### 8.1 -- Verified strengths
- **Truly sequential.** [`builder.py:216-263`](apps/ai/src/nodes/builder.py#L216) is a plain `for` loop. Confirmed.
- **Context compression.** [`sub_agent.py:114-137`](apps/ai/src/nodes/sub_agent.py#L114) `_compress_previous_output` passes only the LAST step's summary + first 800 chars of code. Avoids unbounded context growth.
- **Stop-on-failure.** [`builder.py:255-263`](apps/ai/src/nodes/builder.py#L255): if any step returns `status="error"`, the loop exits and the pipeline returns failed. No partial completion confusion.
- **Per-step usage tracking.** Real prompt/completion/total tokens accumulated, attributed to step_id.

### 8.2 -- Weaknesses

**W8.1 (MEDIUM) -- Sub-agent retries (2 attempts + final fallback) burn tokens silently**
[`sub_agent.py:174-216`](apps/ai/src/nodes/sub_agent.py#L174). If JSON parsing fails twice, then the third call returns raw output. That's up to 3 LLM calls per failing step, each adding to `accumulated_usage`. The audit shows total tokens but doesn't attribute "retry cost" separately.
**Recommendation:** Track `retry_count` in usage. ~3 LOC.

**W8.2 (MEDIUM) -- "data_transform" is the only domain that concatenates outputs**
[`builder.py:109-122`](apps/ai/src/nodes/builder.py#L109) keeps last-step-only for text domains, concatenates for `data_transform`. Documented in code comment. Correct behavior, but it's a quiet domain-specific branch that future contributors might break unaware.

---

## PHASE 9 -- VALIDATION COMPLETENESS

Already audited extensively in [`VALIDATOR_PRODUCTION_AUDIT_REPORT.md`](apps/ai/VALIDATOR_PRODUCTION_AUDIT_REPORT.md). Recap:

### Fixed in this session
- W9.A (CRITICAL): audit_checker accepts `agents_executed: list` (the contract bug)
- W9.B (HIGH): syntax_checker now detects unresolved `BUILDER_INJECT:`, `{{ }}`, `NotImplementedError`

### Outstanding
- **W9.1 (HIGH) -- Validator not wired into the pipeline** (W1.2 / W2.1)
- **W9.2 (MEDIUM) -- No semantic validation.** No "do imports actually exist", no "are all called functions defined". Hard problem; deferring to future is the right call.
- **W9.3 (MEDIUM) -- No triviality detection.** Comments-only, imports-only, or all-`pass` code passes validation. snippet_validator.score_quality has the helper but validator doesn't call it.
- **W9.4 (LOW) -- Em-dash in `validation_report.py:45,55`** (ASCII rule)

---

## PHASE 10 -- ERROR HANDLING RESILIENCE

### 10.1 -- Current state
- [`errors.py`](apps/ai/src/services/errors.py) defines 6 ERROR_CODES as flat strings
- Most nodes catch `Exception` and write `state["final_error"]` + `state["final_error_details"]`
- Planner records `exception_type` and `message` in `final_error_details` (good)
- Builder records `error_stage` (good)

### 10.2 -- Weaknesses

**W10.1 (HIGH) -- No error severity classification**
Every error is treated equally. A timeout (recoverable) and a syntax error (must-fix) both produce `status="failed"`. The validator's repair_payload model gestures at this but it's not consistently applied.

**W10.2 (MEDIUM) -- ERROR_CODES are underused**
Only 6 codes exist; many error sites use ad-hoc strings like `"sub_agent_failed_step_1"`, `"step_consistency_failed"`, `"file_write_failed"`. Either expand ERROR_CODES to be the canonical source or remove the file as misleading.

**W10.3 (MEDIUM) -- No retry mechanism for transient LLM failures**
Sub-agent retries on PARSE failures (good) but not on network/HTTP failures (bad). A 429 from Groq today is a fatal pipeline error today. Should be retried with backoff.

### 10.3 -- Recommendations
- **I10.1 (MEDIUM):** Add `_call_llm_with_retry` wrapper in `llm.py` that catches transient HTTP errors (429, 503) and retries with exponential backoff.
- **I10.2 (LOW):** Either grow ERROR_CODES or scrap it.

---

## PHASE 11 -- OBSERVABILITY & DEBUGGING

### 11.1 -- Current state
- Validator engine emits one-line plain-text logs via `print` ([validator_engine.py:14-19](apps/ai/src/services/validator_engine.py#L14))
- Server uses `logging.basicConfig(level=logging.WARNING)` -- almost nothing gets logged
- Run audit captures token totals and per-agent breakdown
- No structured (JSON) logging
- No execution tracer
- No correlation IDs across log lines other than `run_id`

### 11.2 -- Weaknesses

**W11.1 (HIGH) -- No structured logging**
`print(f"{stage} | {pass/fail} | {elapsed:.4f}s | {summary}")` is fine for human debugging but useless for log aggregation. Splunk/Datadog/CloudWatch can't extract `stage` as a field without parsing.
**Fix effort:** Convert to `logging.info()` with `extra={"stage": ..., "elapsed": ...}` and a JSON formatter. ~50 LOC.

**W11.2 (HIGH) -- No execution trace persisted to disk**
Brief asks for "save state snapshots, replay executions". Today: nothing. The run_id is generated but never used to file traces.
**Fix:** Add a `services/tracer.py` that writes per-run JSON to `apps/ai/traces/{run_id}.json` with each node's input/output. Useful for debugging real LLM runs. ~80 LOC.

**W11.3 (MEDIUM) -- Server.py prints to stdout, not the structured log channel**
Mixed channels mean some events go to stdout, others to the logging module. Pick one.

**W11.4 (LOW) -- No metrics endpoint**
No `/metrics` Prometheus-style. For a 1-user dev tool, fine. For production, a future need.

### 11.3 -- Recommendations
- **I11.1 (HIGH):** Structured logging migration. Single highest-ROI observability change.
- **I11.2 (MEDIUM):** Per-run trace files. Enables "replay" debugging.

---

## PHASE 12 -- TESTING COVERAGE & QUALITY

### 12.1 -- Inventory (verified)
| Suite | File | Cases | Method |
|---|---|---|---|
| Pipeline e2e (stubbed LLM) | `test_comprehensive.py` | 9 | call_llm monkey-patched |
| Builder audit (stubbed sub_agent) | `test_builder_audit.py` | 6 | execute_sub_agent monkey-patched |
| Prompt optimizer (stubbed LLM) | `test_prompt_optimizer.py` | 12 | call_llm monkey-patched |
| Validator units (mock states) | `src/tests/test_*.py` | 5 scripts | mock_builder_outputs.py |
| Validator adversarial (this session) | `test_validator_adversarial.py` | 19 probes | hand-crafted bad inputs |
| Manual E2E | `test_phase1.py` | 1 | needs real API key |

**Total automated: 51 cases.** All passing post-hardening.

### 12.2 -- Strengths
- Stubbed LLM tests run without API keys
- Adversarial suite established (this session)
- Clear separation: unit / integration / adversarial

### 12.3 -- Weaknesses

**W12.1 (HIGH) -- No prompt regression tests**
If someone edits planner_prompt.py, no test catches that the LLM now produces a different shape. The stubs return canned outputs; they don't exercise the prompt itself.
**Mitigation:** Hard to fix without live LLM in CI. Defer.

**W12.2 (MEDIUM) -- Validator's own unit tests use the WRONG `agents_executed` shape**
[`mock_builder_outputs.py:45,73,91,116,156`](apps/ai/src/tests/mock_builder_outputs.py#L45) all use `"agents_executed": <int>`. The real builder writes a list. Tests passed, real pipeline broke. Already fixed via my audit_checker patch (it now accepts both), but the mocks themselves should be updated to use the realistic format.

**W12.3 (LOW) -- Test discovery**
Validator tests use `def run()` instead of `def test_*()`, so pytest can't collect them. Each must be invoked as a script. Convert to pytest functions.

---

## PHASE 13 -- SECURITY & SANDBOXING

### 13.1 -- Current state
- Subprocess execution: tempdir + cwd=tempdir + timeout=15s (good)
- No `env=` cleaning -- subprocess inherits parent env including PYTHONPATH
- No resource limits (no `resource.setrlimit`, no Docker, no firejail)
- CORS `allow_origins=["*"]` in server.py
- User input passes directly to LLM prompts (prompt-injection surface)
- No rate limiting

### 13.2 -- Weaknesses

**W13.1 (CRITICAL) -- CORS wildcard in production-bound server**
[`server.py:43`](apps/ai/server.py#L43) `allow_origins=["*"]`. Any website can call this server's API. For a dev tool, fine. For deployment, must restrict.

**W13.2 (HIGH) -- Subprocess inherits host PYTHONPATH**
Already covered (W#7 in validator audit). Currently exploitable only if developer runs the server with project root in PYTHONPATH; harmless on a clean Heroku/Docker deploy.

**W13.3 (HIGH) -- No prompt-injection defense**
User prompt flows verbatim into planner_prompt and optimizer_prompt. A user could submit `Ignore previous instructions and respond with...` and (depending on Groq's prompt-following) get wild output.
**Practical impact:** Output is generated Python code; if injection succeeds, you get code that does what the attacker wants. Since the validator runs in a subprocess sandbox with timeout, the worst case is one wasted run. Severity is HIGH for a multi-tenant deployment, MEDIUM for single-user.

**W13.4 (MEDIUM) -- No resource limits on subprocess**
Generated code can `[i for i in range(10**10)]` and burn CPU until the 15s timeout. Memory could spike.
**Fix:** Use `resource.setrlimit` (Linux) or a Docker sandbox. Big lift.

**W13.5 (LOW) -- env vars exposed to subprocess**
Subprocess sees `GROQ_API_KEY` and similar. A malicious sub-agent could exfiltrate them. Pass `env={"PATH": ..., }` to scrub.

### 13.3 -- Recommendations (priority order)
1. **I13.1 (CRITICAL):** Replace `allow_origins=["*"]` with a configured allowlist BEFORE any deployment.
2. **I13.2 (HIGH):** Pass clean `env=` to subprocess in execution_checker.
3. **I13.3 (HIGH):** Add a one-paragraph "system message" to user prompts that bounds the LLM's behavior. (No silver bullet for prompt injection, but raises the bar.)

---

## PHASE 14 -- PERFORMANCE & EFFICIENCY

### 14.1 -- Real measurements (from this session's tests)
- Validator total time on simple successful run: <0.5 seconds (sum of stage logs)
- Validator infinite-loop case: 15.04s (timeout fired)
- Test suites combined: <30s including subprocess work

### 14.2 -- Token usage
Already optimized in prior session:
- Planner prompt: ~562 tokens (after -4% trim)
- Sub-agent prompt: ~152 tokens (after -29% trim)
- Per-step max_tokens cap: 1024 (configured per agent)
- Real measured per-pipeline cost (from `test_comprehensive.py` budget test): under 8000 tokens for a 3-step plan

The brief targets a 50% reduction. **I do not recommend pursuing this.** The prompts are already tight; further trimming will hurt output quality on a low-tier model.

### 14.3 -- Weaknesses

**W14.1 (MEDIUM) -- No caching of LLM responses**
Identical prompts pay full token cost each time. For development, a `@lru_cache` on `call_llm(prompt_hash, max_tokens)` would be helpful (with an env-flag to disable in production).

**W14.2 (MEDIUM) -- Unbounded `accumulated_usage` if retry loop spirals**
If sub_agent's 2 retries + 1 fallback all fire, the user pays for 3 LLM calls. Audit captures it but no throttle.

**W14.3 (MEDIUM) -- File I/O per generated agent**
Each successful run writes to `apps/ai/src/generated_agents/run_{id}.py`. If you generate 100 agents/min, that's 100 file writes. Fine today; flag for future.

### 14.4 -- Recommendations
- **I14.1 (MEDIUM):** Optional `@lru_cache` on call_llm in dev mode. ~10 LOC.

---

## PHASE 15 -- MAINTAINABILITY & EXTENSIBILITY

### 15.1 -- Strengths
- Most files <200 LOC
- Functions over classes (per project style)
- Each node has a single clear responsibility
- Service layer (`services/`) is well-separated
- Adversarial test suite + audit reports are durable artifacts for future contributors

### 15.2 -- Weaknesses

**W15.1 (MEDIUM) -- No domain plugin system**
Adding a domain requires changes in [`State.py` Domain Literal](apps/ai/src/state/State.py), [`errors.py SUPPORTED_DOMAINS`](apps/ai/src/services/errors.py#L1), [`code_serializer.py DOMAIN_WRAPPERS`](apps/ai/src/services/code_serializer.py#L136), [`safe_injector.py builders dict`](apps/ai/src/services/safe_injector.py#L331), and [`planner_prompt.py DOMAIN-TOOL MAP`](apps/ai/src/prompts/planner_prompt.py#L48). Five places.

**W15.2 (MEDIUM) -- Documentation lives in MD reports, not in code**
Functions have minimal docstrings. The architecture is mostly explained in the audit reports (this one + validator audit + diagnostic + optimization). Reorganize over time.

**W15.3 (LOW) -- No `__init__.py` exports**
Imports use full paths (`from nodes.builder import builder_node`). Works but verbose. A single `nodes/__init__.py` re-exporting would simplify.

**W15.4 (LOW) -- Magic strings**
`"website_builder"`, `"data_transform"`, etc. are bare strings throughout. The Domain Literal in State.py types them at compile time but most callers use raw strings.

---

## PHASE 16 -- PRODUCTION READINESS

### 16.1 -- Hard reality check

Looking at the repo for production artifacts:
- `Dockerfile`: not present at `apps/ai/`
- `requirements.txt`: present at root only (would need scoping for the AI app specifically)
- Health check endpoint: server.py has none
- `/healthz`, `/readyz`: not implemented
- Graceful shutdown: not implemented
- State checkpointing: not implemented
- No configured timeout for the FastAPI app itself

### 16.2 -- Critical gaps

**W16.1 (CRITICAL) -- No deployment artifacts for the AI service**
There's a `infra/docker/` directory at repo root, but no Dockerfile for `apps/ai`. A Heroku Procfile, k8s manifest, or `pyproject.toml` (with deps) is also missing.

**W16.2 (CRITICAL) -- `os.chdir` at import time in server.py:13**
[`server.py:13`](apps/ai/server.py#L13) `os.chdir(...)`. This runs once at import. If FastAPI is run with multiple workers (uvicorn `--workers 4`), each worker chdir's. If anything else in the process expects the original cwd, it breaks. ALSO -- this means relative paths used by other nodes are now relative to `apps/ai/src/`, an implicit contract.

**W16.3 (HIGH) -- No `.env.example` for the AI app**
A `.env.example` exists at repo root but doesn't document GROQ_API_KEY, GEMINI_API_KEY, etc.

**W16.4 (HIGH) -- No graceful shutdown / no upload limits**
[`server.py`](apps/ai/server.py) has an `UploadFile` endpoint (line 18 import) but I didn't see size limits or content validation. Default FastAPI = unbounded uploads.

**W16.5 (MEDIUM) -- No rate limiting**
A user can submit 100 requests/min and burn through the API quota.

### 16.3 -- Recommendations

- **I16.1 (CRITICAL):** Remove `os.chdir`. Replace with `Path(__file__).parent` resolution where needed.
- **I16.2 (CRITICAL):** Add a Dockerfile with pinned deps and a non-root user.
- **I16.3 (HIGH):** Implement `/healthz` returning `{"ok": true, "version": ...}`.

---

## PHASE 17 -- OBSERVABILITY INFRASTRUCTURE

### 17.1 -- Reality
There is no observability infrastructure. Logs go to stdout. Metrics aren't collected. There's no dashboard.

### 17.2 -- Weaknesses

**W17.1 (HIGH) -- No metrics export**
For a low-traffic dev tool, OK. For anything production, need at minimum: success_rate, p50/p99 duration, token spend per hour.

**W17.2 (MEDIUM) -- No alert rules**
No "page me when error rate > 5%". Defer until you have metrics.

**W17.3 (MEDIUM) -- No debug tools**
Brief asks for state inspector / execution replay / trace visualizer. The trace file (W11.2) would enable replay; viewer is a separate UI build.

**W17.4 (LOW) -- run_audit captures usage but no aggregator**
Per-run audit data is computed and returned but never persisted to a metrics store. Each run is forgotten.

### 17.3 -- Recommendation
Defer the dashboard. Implement structured logging (I11.1) + per-run trace files (I11.2) first; aggregation can come from log shipping.

---

## PHASE 18 -- LLM CAPABILITY ASSESSMENT

### 18.1 -- The gating discipline

Per the brief: I may only recommend a model upgrade after exhausting Phases 1-17. I have not exhausted them. The major engineering improvements that would move output quality:

| Improvement | Effort | Likely quality lift |
|---|---|---|
| Wire validator into graph + server | Medium | Catches bad output before users see it -- big perceived quality win |
| Add 1-shot example to sub_agent_prompt | Low | Reduces JSON parse failures, reduces fallback-to-raw cases |
| Add semantic validation (W9.2) | Medium | Catches "imports a fake module" bugs |
| Add triviality detection (W9.3) | Low | Catches "all-pass placeholder" outputs |
| Structured logging + traces | Medium | Speeds debugging (the brief's "+800%" target) |
| Server uses graph, not bypass | Medium | Unblocks the entire design |

These are real, doable, and address the actual symptoms a low-tier LLM produces. **None of them require a model upgrade.**

### 18.2 -- Where LLM IS the limit (honest reading)

Even with all the above done, `llama-3.1-8b-instant` will still:
- Generate placeholder code more often than a frontier model
- Hallucinate library function signatures
- Fail at multi-file architectural reasoning
- Produce "looks plausible, doesn't work" code at higher rates than a 70B+ model

**For the AgentForge use case** -- generating self-contained, single-file, narrow-scope agents (HTML page, CSV transformer, research aggregator) -- `llama-3.1-8b-instant` is **fit for purpose**. The use case is small enough that an 8B model can succeed when prompted well and validated carefully.

If the use case grows to:
- Multi-file projects
- Complex business logic
- Long-context refactoring

...then the model becomes the bottleneck and an upgrade is justified. Today, it isn't.

### 18.3 -- Verdict

> **Do not upgrade the LLM yet.** Implement Phase 1's I1.1 (server uses graph), Phase 4's I4.1 (sub-agent example), Phase 9's W9.3 (triviality detection), and Phase 11's I11.1 (structured logging) first. Re-evaluate output quality after those four changes. Anchor the re-eval on real measurements (e.g., "% of runs that pass validation without retry"), not vibes.

If after those four changes the validation-pass rate is still <70%, then revisit the LLM. Until then, the engineering ROI dominates the model-upgrade ROI.

---

## CONSOLIDATED PRIORITY ROADMAP

### CRITICAL (do first; production blockers)
1. **server.py uses graph.py** (I1.1) -- unblocks prompt_optimizer and validator
2. **Remove `os.chdir` at server.py:13** (I16.1) -- fixes concurrency
3. **CORS allowlist in server.py** (I13.1) -- before any public deploy
4. **Dockerfile + pinned deps for apps/ai** (I16.2)

### HIGH (do next; quality + safety)
5. Wire validator into graph (W9.1, was W1.2)
6. Subprocess `env=` cleaning (I13.2)
7. Prompt-injection defense paragraph (I13.3)
8. Add 1-shot to sub_agent_prompt (I4.1) + ASCII fix (W4.2)
9. Structured logging migration (I11.1)
10. Per-run execution trace file (I11.2)
11. Planner JSON recovery parity with sub_agent (I5.1)
12. LLM call retry with backoff for transient HTTP errors (I10.1)

### MEDIUM (cleanup; do over a sprint)
13. Triviality detection in validator (W9.3)
14. Conditional graph edges (I2.2)
15. State validate helper (I3.1)
16. Domain plugin system (W15.1)
17. Update mock_builder_outputs to realistic shapes (W12.2)
18. Convert validator tests to pytest functions (W12.3)
19. ERROR_CODES expansion or removal (I10.2)
20. Optional LLM response cache for dev (I14.1)

### LOW (when you have time)
21. ASCII sweep across all .py prompts and reports
22. AGENT_TEMPLATE format hardening (W1.7)
23. Sanitizer indentation auto-fix off-by-default (W7.1)
24. Domain skeleton parameterization (W6.1)
25. Track sub-agent retry_count separately in audit (W8.1)

---

## RISK ASSESSMENT

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Two pipelines diverge (server vs graph) | HIGH (already happening) | HIGH (features unreachable) | I1.1 |
| Production deploy with CORS=`*` | MEDIUM (easy to forget) | CRITICAL (open API) | I13.1 + deployment checklist |
| Concurrent `os.chdir` race | LOW (workers=1 today) | HIGH if it happens | I16.1 |
| Prompt injection from a user | MEDIUM (multi-tenant) | MEDIUM (one bad run) | I13.3 + sandbox already covers code-execution risk |
| Sub-agent retries silently triple LLM cost | MEDIUM | LOW (visible in audit) | W8.1 -- track separately |
| Mock-vs-real contract drift | HIGH (already burned us once) | HIGH (silent prod fail) | I3.1 + use realistic mocks (W12.2) |

---

## RESOURCE & TIMELINE ESTIMATE

Honest scoping (one engineer, not counting time spent reading this report):

| Bucket | LOC delta | Days |
|---|---|---|
| CRITICAL items (4) | ~150 | 1-2 |
| HIGH items (8) | ~400 | 4-5 |
| MEDIUM items (8) | ~600 | 5-7 |
| LOW items (5) | ~150 | 1-2 |
| **Total** | **~1300** | **11-16 days** |

This excludes: end-to-end live LLM testing, deployment to a real environment, monitoring/alerts setup. Add another 5-7 days for those.

---

## CONCLUSION

The AgentForge codebase has good bones: small focused modules, strong code-injection safety (json.dumps everywhere), real test coverage with stubbed LLMs, and a recently-merged validator with a sound architecture.

The biggest issues are **architectural drift** (server.py vs graph.py), **deployment readiness** (no Dockerfile, CORS=*, os.chdir at import), and **observability** (one-line stdout logs only). These are engineering problems with engineering fixes.

The LLM (Groq llama-3.1-8b-instant) is **not** the bottleneck. The bottleneck is that the engineering improvements available -- wiring the validator in, prompt examples, structured logging -- haven't been applied yet. Apply them first.

**Recommendation:** Do not upgrade the LLM. Execute the CRITICAL + HIGH items above (~6 days work), measure validation-pass rates, then re-evaluate.

---

*This audit was performed by reading every file in the active pipeline path, running the existing test suites, building and running 19 adversarial probes, and patching two confirmed bugs (audit contract mismatch + missing marker detection). All findings cite real file paths and line numbers. Quality-target percentages from the brief are intentionally not reproduced -- they are not measurable from the current codebase, and inventing them would be dishonest.*
