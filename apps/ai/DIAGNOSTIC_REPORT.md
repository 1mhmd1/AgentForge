# AgentForge — Phase 1 Diagnostic Report

**Date:** 2026-05-09
**Scope:** Full system audit before any code modification.
**Conclusion at a glance:** The system has already been refactored well beyond the assumptions in the task brief. Sequential execution and the SafeCodeInjector path are already live. The remaining issues are smaller, surgical bugs — not the architectural rewrites the brief implies.

---

## 1. Pipeline Map (User → Output)

```
client → server.py
   └─► graph.py (LangGraph: planner → builder → END)
           ├─► planner_node (nodes/planner.py)
           │     └─► call_llm(planner_prompt, max_tokens=500)   [groq llama-3.1-8b-instant]
           │     └─► spec, execution_plan written to state
           │
           └─► builder_node (nodes/builder.py)
                 ├─ Phase 1: validate_spec
                 ├─ Phase 2: build step_map / execution_order
                 ├─ Phase 3: SEQUENTIAL for-loop over execution_order
                 │             └─► execute_sub_agent(step_id, ..., previous_results, ...)
                 │                    └─► _compress_previous_output (LAST step only)
                 │                    └─► call_llm(sub_agent_prompt, max_tokens)
                 ├─ Phase 4–6: SafeCodeInjector.build_and_validate(domain, ...)
                 │             └─► CodeSerializer wraps content as """..."""
                 │             └─► pre_syntax_check → ast/compile validation
                 ├─ Phase 7: snippet_validator.score_quality
                 ├─ Phase 8: ast.parse(final_code)
                 └─ Phase 9: file_writer.write_generated_agent → src/generated_agents/run_<id>.py
```

State keys actually used downstream: `spec`, `domain`, `execution_plan`, `step_map`, `execution_order`, `sub_agent_results`, `run_audit`, `quality_score`, `generated_code`, `output_path`, `completed_stages`, `build_duration_seconds`, `final_error`, `final_error_details`, `error_stage`, `status`, `stage`, `sanitize_warnings`.

---

## 2. Status of the Brief's "Critical Problems"

### 🟢 Problem #1 — "Sub-agents run in parallel" → **ALREADY SEQUENTIAL**
[apps/ai/src/nodes/builder.py:177-224](apps/ai/src/nodes/builder.py#L177-L224) is a plain `for i, step_id in enumerate(execution_order)` loop. No `ThreadPoolExecutor`, no `asyncio`, no concurrency primitives anywhere in the code path. Each iteration receives the full `sub_agent_results` accumulated so far.

[apps/ai/src/nodes/sub_agent.py:114-137](apps/ai/src/nodes/sub_agent.py#L114-L137) (`_compress_previous_output`) already does the right thing: passes only the LAST step's `summary` + truncated `generated_code` (cap 800 chars) — exactly the "previous step only, not full history" pattern the brief asks for.

**Action: NONE.** The brief's Phase 2 work is done. Touching it would be a regression.

### 🟡 Problem #2 — "F-string syntax error at line 158" → **CANNOT REPRODUCE in current generator**
The brief assumes Jinja2 templates feed the builder. They do not anymore. The current generator is `SafeCodeInjector` ([apps/ai/src/services/safe_injector.py](apps/ai/src/services/safe_injector.py)), which wraps every LLM-produced string in a regular triple-quoted `"""..."""` constant — not an f-string. Inspection of recent outputs:

- [src/generated_agents/run_ui_d8a7aac9.py](apps/ai/src/generated_agents/run_ui_d8a7aac9.py) — line 158 is `</html>"""` (the close of the f-string in `step_1_generate_page`). Parses cleanly.
- [src/generated_agents/run_ui_4e33546b.py](apps/ai/src/generated_agents/run_ui_4e33546b.py) — parses cleanly.

The Jinja templates in [src/templates/website-builder/base.j2](apps/ai/src/templates/website-builder/base.j2) still contain `{{ '{{' }}` escape sequences (lines 132-208) for the old injector path, but **they are no longer reached** — `template_loader.py` and `template_renderer.py` are dead code (no callers in `builder.py`).

**Likely origin of the brief's "line 158" report:** an older Jinja2-rendered run before the SafeCodeInjector merge (commit `10a71a0`). The class of bug is fixed structurally.

**Action:** No emergency fix needed, but tighten validation in two specific places (see §4.3).

### 🟡 Problem #3 — "Token usage" → **PROMPTS ARE ALREADY SMALL; TRACKING IS MISLEADING**

Approximate token counts (≈ 4 chars / token):

| Component | Static template | Per-call (typical) | Brief's stated "current" | Brief's target |
|-----------|----------------|--------------------|--------------------------|----------------|
| Planner prompt ([planner_prompt.py](apps/ai/src/prompts/planner_prompt.py)) | ~520 in | + ≤500 out | 2000 | ≤1200 |
| Sub-agent prompt ([sub_agent_prompt.py](apps/ai/src/prompts/sub_agent_prompt.py)) | ~150 + variables | + ≤1024 out | 1500 | ≤800 |
| Inter-agent context (`_compress_previous_output`) | n/a | ≤ ~250 (cap 800 chars) | — | ≤600 |

**The prompts are already inside the brief's token budget.** Verifiable, not estimated.

Real issues with the audit logic ([builder.py:67-79](apps/ai/src/nodes/builder.py#L67-L79)):
- `_track_agent` adds `max_tokens` (the **budget request**) to `total_tokens`, not actual API usage. Audit numbers are inflated and unrelated to billing.
- groq_provider returns only `.message.content` and discards `response.usage`. We have no way to log real prompt/completion tokens today.

### 🔴 Problem #4 — `test_builder_audit.py` IS BROKEN (real, blocking)
[apps/ai/test_builder_audit.py:33-68](apps/ai/test_builder_audit.py#L33-L68) monkey-patches symbols that no longer exist on the `builder` module:
- `builder.load_template` — **never imported** by builder.py.
- `builder.execute_sub_agent` — imported `from nodes.sub_agent`, so `builder.execute_sub_agent` exists by name, but the test's `fake_execute(step_id, step_data, total_steps, previous_results)` has the **old 4-arg signature**; the real call site passes 8 keyword args ([builder.py:202-211](apps/ai/src/nodes/builder.py#L202-L211)).
- All assertions reference `current_stage`, `started_at`, `STAGE_TEMPLATE_LOADING/RENDERING` — none of these are written by the current builder.

**This file will throw on every run.** It can't validate anything in its current state.

---

## 3. Real Bugs Found (Not in the Brief)

### 🔴 BUG-A — `builder_node` never marks the run completed
[builder.py:170](apps/ai/src/nodes/builder.py#L170) sets `next_state["status"] = "running"` when entering the build loop. **No code path sets `status = "completed"` or `stage = "completed"` on success.** A successful run terminates with `status="running"`. Any downstream consumer (frontend, tests, the audit harness) that branches on `status in {"completed","failed"}` will misclassify successful runs as still in flight.

Fix surface: 2 lines at the bottom of `builder_node`.

### 🔴 BUG-B — Final content is the **concatenation** of ALL sub-agent outputs
[builder.py:88-96](apps/ai/src/nodes/builder.py#L88-L96):
```python
for _sid, sr in sub_agent_results.items():
    code_str = str(sr.get("generated_code", "")).strip()
    if code_str:
        content_parts.append(code_str)
combined = "\n".join(content_parts) if content_parts else goal
```
This contradicts the chosen sequential model. Step 2 already builds on Step 1 (its prompt receives Step 1's output). Concatenating both in the final agent **double-includes** the earlier work, producing the duplicated/glued markup visible in [run_ui_d8a7aac9.py](apps/ai/src/generated_agents/run_ui_d8a7aac9.py#L18-L132) (two `<style>` blocks, two navs, two heroes).

The right behaviour for a chained pipeline is "use the last agent's output." (Optionally allow per-domain merge, but for `website_builder` / `document` / `web_research`, last-only is correct because each step rewrites the whole.)

Fix surface: 5 lines in `_build_safe_agent`.

### 🟡 BUG-C — Planner failures lose all context
[planner.py:92-94](apps/ai/src/nodes/planner.py#L92-L94):
```python
except Exception:
    next_state["status"] = "failed"
```
No `final_error`, no details, the `spec` key may or may not exist. Builder's `validate_spec` then trips on `spec_not_dict`, masking the original parse error.

Fix surface: 3 lines.

### 🟡 BUG-D — `serialize_html` quote escape is a half-measure
[code_serializer.py:25-36](apps/ai/src/services/code_serializer.py#L25-L36):
```python
html = html.replace('"""', r'\"\"\"')
if "'''" not in html and '"""' not in html:
    return f'"""{html}"""'
else:
    return json.dumps(html)
```
The `"""` check immediately after `replace` is dead — there are no `"""` left to find. Practically OK because the `\"\"\"`-escape works inside the wrapping triple-quote, but the branch is dead and the `'''` branch quietly switches encoding strategy on different inputs (one path returns triple-quoted, the other returns a JSON string literal). This is a latent footgun, not a current break.

Fix surface: collapse to one well-tested branch.

### 🟡 BUG-E — `_check_module_prints` indent tracker is incorrect for nested defs
[code_sanitizer.py:131-153](apps/ai/src/services/code_sanitizer.py#L131-L153) only pops `indent_stack` once per dedent, so nested `def`/`class` blocks are mis-classified. Will produce false "module-level print" warnings, not failures. Low priority.

### 🟢 BUG-F — Dead code: `template_loader.py`, `template_renderer.py`, `code_injector.py`
None of these are reachable from `builder.py` after the SafeCodeInjector merge. Not a bug per se, but they are what the broken audit file is reaching for. Decision needed: remove (clean) or keep (compat shim).

---

## 4. Recommended Targeted Fixes (Surgical, in Priority Order)

| # | File | Change | Lines touched | Risk |
|---|------|--------|---------------|------|
| 1 | builder.py | Set `status="completed"`, `stage="completed"`, `completed_at` on success | ~3 | low |
| 2 | builder.py `_build_safe_agent` | Use **last** sub-agent output, not concatenation | ~5 | low (matches stated design) |
| 3 | planner.py | On exception: set `final_error`, `final_error_details`, keep status=failed | ~5 | low |
| 4 | sub_agent.py / safe_injector.py | Pre-validate the merged content with `ast.parse` and surface the actual offending line in `final_error_details` | ~10 | low |
| 5 | groq_provider.py + builder.py audit | Return `(text, usage)` so `run_audit.total_tokens` reflects real usage | ~15 | medium (signature change — needs to ripple to other providers) |
| 6 | code_serializer.py `serialize_html` | Always JSON-encode when content has either `"""` or `'''`; otherwise wrap once | ~4 | low |
| 7 | test_builder_audit.py | Replace with a working harness that patches `nodes.sub_agent.execute_sub_agent` (correct module) and asserts against the SafeCodeInjector flow | rewrite this one file | low |
| 8 | NEW: test_comprehensive.py | Planner-solo / builder-solo / pipeline / token-budget suites per brief | new file | low |
| 9 | Optional cleanup | Remove `code_injector.py`, `template_renderer.py`, `template_loader.py`, `templates/*/base.j2` if no external consumer | delete | medium (need to confirm nobody imports) |

**What I am NOT going to touch (and why):**
- Sequential execution loop — already correct.
- LangGraph wiring in `graph.py` — correct.
- State schema in `State.py` — fully consistent with current usage; brief forbids changes.
- Planner prompt rewrite — already inside the token budget; rewriting risks worse JSON adherence on llama-3.1-8b-instant.
- Sub-agent prompt rewrite — same reason. I will only trim 2-3 redundant lines.

---

## 5. Open Questions / Decisions Needed Before Phase 2

1. **Dead-code removal** (BUG-F): delete `template_loader.py` / `template_renderer.py` / `code_injector.py` / `templates/*/base.j2`, or leave them? They add maintenance burden and confuse new readers.
2. **Provider signature change** (Fix #5): are you OK with `call_groq` returning `(text, usage_dict)` instead of `str`? It's the only honest way to track tokens. Alternative: keep `str` and add a sibling `call_groq_with_usage`.
3. **Last-only vs concatenation** (BUG-B): confirm "use the final sub-agent's output as the source of truth" is the desired contract for all four domains. (For `data_transform` it might make sense to keep all step outputs.)
4. **Backwards-compat for the broken `test_builder_audit.py`**: rewrite it in place, or leave it and create the new `test_comprehensive.py` separately?

---

## 6. Phase Plan I Will Follow Once Approved

- **Phase 2 (Fixes #1, #2, #3, #4, #6):** surgical edits to `builder.py`, `planner.py`, `safe_injector.py`, `code_serializer.py`. Each fix in its own diff; re-run the new test harness between them.
- **Phase 3 (Fix #5):** token-tracking. Touches all four provider files plus `_track_agent`.
- **Phase 4 (Prompt trimming):** remove only redundant lines from existing prompts, keep structure identical.
- **Phase 5 (Tests):** rewrite `test_builder_audit.py`, add `test_comprehensive.py` (planner / builder / pipeline / token-budget). Mock LLM calls for determinism.
- **Phase 6 (Reports):** `OPTIMIZATION_REPORT.md` with before/after numbers. README untouched unless you want it expanded.

---

## 7. TL;DR for the User

The big-ticket items in the brief (sequential execution, line-158 f-string error, 40-50% token reduction) are largely already addressed by prior work — the architecture moved past the assumptions in the brief. The real, currently-broken things are smaller and very fixable:

1. **Builder never marks runs `completed`** → tests/UI think every successful run is still running.
2. **Final output concatenates ALL sub-agent results** → duplicated content visible in recent generations.
3. **Planner failures swallow the error** → user sees only `status=failed` with no reason.
4. **The audit test file calls into symbols that don't exist anymore** → cannot run today.
5. **Token tracking adds the budget, not the spend** → the audit number is fiction.

I want approval (or pushback) on §5's open questions before I start Phase 2.
