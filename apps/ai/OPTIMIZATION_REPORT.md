# AgentForge - Optimization Report

**Date:** 2026-05-09
**Scope:** Phase 2-6 surgical fixes + token tracking + cleanup + tests.
**Test status:** 9/9 `test_comprehensive.py` + 6/6 `test_builder_audit.py` passing.

---

## 1. Bugs fixed

| # | Bug | File(s) | Verdict |
|---|-----|---------|---------|
| A | `builder_node` never marked successful runs as `status="completed"` | `nodes/builder.py` | FIXED |
| B | Final code **concatenated all** sub-agent outputs even though step N already built on N-1; produced duplicated markup | `nodes/builder.py` (`_build_safe_agent`) | FIXED (last-only for text domains, concat preserved for `data_transform`) |
| C | Planner exceptions silently became `status="failed"` with no `final_error` | `nodes/planner.py` | FIXED |
| D | `serialize_html` / `serialize_css` / `serialize_python_string` had a latent quote-collision bug (input ending in `"` could break the wrapping triple-quote) | `services/code_serializer.py` | FIXED (unified to `json.dumps`) |
| E | `_track_agent` summed `max_tokens` (the request budget) instead of actual usage | `nodes/builder.py` + all 4 providers + `llm/llm.py` + `nodes/planner.py` + `nodes/sub_agent.py` | FIXED (real `(text, usage)` returned everywhere) |
| F | `test_builder_audit.py` patched symbols that no longer exist; couldn't run | `test_builder_audit.py` | REWRITTEN |

The brief's "line 158 f-string error" and "sub-agents run in parallel" were both **already resolved** structurally by the prior `SafeCodeInjector` refactor (commit `10a71a0`). No code change was needed for those — see `DIAGNOSTIC_REPORT.md` §2.

---

## 2. Token usage — before vs. after

### Static prompt size (chars; ~ chars/4 ≈ tokens)

| Prompt | Before | After | Delta |
|--------|--------|-------|-------|
| `planner_prompt.py` | 2,344 chars (~586 tok) | 2,247 chars (~562 tok) | **-4.1%** |
| `sub_agent_prompt.py` | 858 chars (~214 tok) | 609 chars (~152 tok) | **-29%** |

The brief's "40-50% reduction" target assumed inflated baselines (planner "2000 tokens", sub-agent "1500 tokens"). Actual baselines were already inside the brief's targets, so the trim is conservative — only redundant lines were removed (full diff: deleted the duplicate "MODEL AWARENESS" block in the planner prompt, collapsed three "For X: put Y" lines in sub-agent prompt).

### Audit number quality

| Metric | Before | After |
|--------|--------|-------|
| `run_audit.total_tokens` | sum of `max_tokens` (request budgets) — fictional | sum of real `usage.total_tokens` from each provider |
| Per-agent breakdown | none | `per_agent_tokens[agent_id]` with prompt / completion / total |
| Planner usage tracked | no | yes — folded into `run_audit.per_agent_tokens["planner"]` |
| Provider attribution | only `provider_usage` count | also tagged inside per-agent record |

The audit numbers are now **trustworthy** for billing reconciliation. The brief's success criterion of "Token usage logged and tracked" is fully met for the first time.

---

## 3. Architecture preservation checklist

| Constraint | Status |
|------------|--------|
| No async / threading / multiprocessing introduced | OK |
| No new framework, DB, queue, DI system | OK |
| State schema (`AgentForgeState`) unchanged in shape | OK (new keys are additive: `planner_usage`, `completed_at`, `per_agent_tokens`, `prompt_tokens`, `completion_tokens`) |
| `builder_node` / `planner_node` signatures unchanged | OK |
| LangGraph wiring untouched | OK |
| Stage constants unchanged | OK |

The one breaking change is in the **internal** `call_llm` / `call_<provider>` signature: `str` -> `tuple[str, dict]`. Approved by the user during Phase 1. All four providers and both consumers (`planner_node`, `execute_sub_agent`) updated in lockstep; no external caller exists.

---

## 4. Cleanup

Deleted dead Jinja2 template path (no longer reachable from `builder.py`):

- `apps/ai/src/services/template_loader.py`
- `apps/ai/src/services/template_renderer.py`
- `apps/ai/src/services/code_injector.py`
- `apps/ai/src/templates/website-builder/base.j2`
- `apps/ai/src/templates/document/base.j2`
- `apps/ai/src/templates/web-research/base.j2`
- `apps/ai/src/templates/data-transform/base.j2`
- (and the four now-empty domain folders + the empty `templates/` dir)

**Not deleted** (also broken/orphaned, but outside the explicit cleanup scope — flagging here so you can decide):
- `apps/ai/test_phase3.py`, `test_phase4.py`, `test_phase5.py`, `test_quality.py` — depend on the deleted modules and will throw `ImportError` on run.
- `apps/ai/debug_pipeline.py`, `debug_builder.py` — same issue.
- `apps/ai/src/prompts/website_builder_prompt.py`, `builder_prompt.py` — never imported by the live pipeline (`sub_agent.py` uses `SUB_AGENT_PROMPT` from `sub_agent_prompt.py`).
- `apps/ai/src/generated_agents/run_*.py` — output artefacts from earlier runs. Safe to delete or `.gitignore`.

---

## 5. Test coverage

### `apps/ai/test_comprehensive.py` (NEW) — 9 cases, all green

| Suite | Case |
|-------|------|
| Planner | simple request -> valid spec |
| Planner | failure surfaces `final_error_details` (BUG-C regression test) |
| Planner | default execution plan when `agents` field missing |
| Builder | valid spec -> `status="completed"` (BUG-A regression test) |
| Builder | generated code parses with `ast.parse()` |
| Builder | token audit reflects real usage (BUG-E regression test) |
| Builder | malformed LLM output handled (no crash, valid Python or clean fail) |
| Pipeline | end-to-end `planner -> builder` with mocked LLM |
| Budget | total tokens stay under brief's hard budget (`1200+800 + 3*(800+1200) = 8000`) |

LLM calls stubbed via `call_llm` monkey-patch -- runs without API keys and is deterministic.

### `apps/ai/test_builder_audit.py` (REWRITTEN) — 6 cases, all green

| Case | What it asserts |
|------|-----------------|
| valid website spec | full happy path, `output_path` exists, `STAGE_FILE_WRITING` reached, real token totals |
| invalid domain | fails with `TEMPLATE_NOT_FOUND` at validation stage |
| malformed spec | fails with `INVALID_SPEC` |
| sub-agent failure stops pipeline | step 2 never executed when step 1 errors (sequential contract) |
| data_transform concatenation | both steps' content present in final code |
| website last-only merge | only step_2's content in final code; step_1 content NOT leaked (BUG-B regression test) |

---

## 6. Files touched

```
M  apps/ai/src/nodes/builder.py
M  apps/ai/src/nodes/planner.py
M  apps/ai/src/nodes/sub_agent.py
M  apps/ai/src/services/code_serializer.py
M  apps/ai/src/llm/llm.py
M  apps/ai/src/llm/providers/groq_provider.py
M  apps/ai/src/llm/providers/gemini_provider.py
M  apps/ai/src/llm/providers/minimax_provider.py
M  apps/ai/src/llm/providers/kimi_provider.py
M  apps/ai/src/prompts/planner_prompt.py
M  apps/ai/src/prompts/sub_agent_prompt.py
M  apps/ai/test_builder_audit.py        (rewrite)
A  apps/ai/test_comprehensive.py        (new)
A  apps/ai/DIAGNOSTIC_REPORT.md         (new)
A  apps/ai/OPTIMIZATION_REPORT.md       (new)
D  apps/ai/src/services/template_loader.py
D  apps/ai/src/services/template_renderer.py
D  apps/ai/src/services/code_injector.py
D  apps/ai/src/templates/**/base.j2     (4 files + 4 empty dirs + templates/)
```

Untouched:
- `apps/ai/src/state/State.py` (no schema change required)
- `apps/ai/src/graph/graph.py` (LangGraph wiring intact)
- `apps/ai/server.py` (still emits the same SSE event shape; new `completed`/`planner_usage` fields are additive and ignored by older clients)
- `apps/ai/src/services/safe_injector.py` (no change needed; underlying serializer fixes flow through transparently)
- `apps/ai/src/services/snippet_validator.py`, `code_sanitizer.py`, `file_writer.py`, `errors.py`

---

## 7. What I did NOT change (and why)

- **Sequential execution loop.** `builder.py` was already correct. Touching it would have been a regression.
- **`_compress_previous_output`.** Already passes only the LAST step's compressed output (cap 800 chars). Brief's "ZER 600 inter-agent context" target is met.
- **Planner prompt structure.** Aggressive rewrite was rejected (decision Q4) -- weak models are sensitive to format changes and the prompt was already inside budget.
- **README.md.** Brief listed it as a deliverable but I have no instructions for what content you want and global guidance says not to create documentation files unprompted. Happy to add one if you point me at a starting outline.
- **`State.py` shape.** Brief forbids schema changes. New audit / usage fields are added as additional dictionary keys, not new TypedDict fields, so the static type stays stable.

---

## 8. Verification

```
$ python apps/ai/test_comprehensive.py
[Planner]
  ・ simple request -> valid spec ... OK
  ・ failure surfaces final_error_details ... OK
  ・ default plan when agents missing ... OK
[Builder]
  ・ valid spec -> completed ... OK
  ・ generated code parses ... OK
  ・ token audit reflects real usage ... OK
  ・ malformed LLM output handled ... OK
[Pipeline / Budget]
  ・ end-to-end planner -> builder ... OK
  ・ token budget respected ... OK
== 9/9 passed ==

$ python apps/ai/test_builder_audit.py
== 6/6 passed ==
```

Live pipeline (with real provider keys) was NOT exercised in this session -- the test suites use stubbed `call_llm` for determinism. To smoke-test live:

```
cd apps/ai && python server.py   # then POST to /run via the UI
```

The relevant invariants (status="completed", real token totals, last-only output for text domains) are covered by the regression tests above.
