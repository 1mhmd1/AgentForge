"""
Adversarial probes against validator_node.

Goal: find silent-success cases, contract mismatches, and missing edge-case
detection. Each test reports OK (validator behaved correctly) or FAIL (a real
gap that needs documenting in the audit report).

This suite does NOT call real LLMs. It writes canned malformed code to disk
and runs the validator against it directly. Stubbing real LLMs for adversarial
testing would defeat the purpose -- we want to break the validator, not the LLM.

Usage: python apps/ai/test_validator_adversarial.py
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from nodes.validator import validator_node
from services.validator_engine import run_validation


# ---- helpers ------------------------------------------------------------


def _good_audit() -> dict:
    return {
        "total_tokens": 1000,
        "agents_executed": 2,
        "provider_usage": {"groq": 2},
        "failed_step": None,
    }


def _builder_audit() -> dict:
    """Mimic what builder.py actually writes (post-BUG-E fix)."""
    return {
        "total_tokens": 1000,
        "prompt_tokens": 600,
        "completion_tokens": 400,
        "agents_executed": ["step_1", "step_2"],  # LIST, not int
        "provider_usage": {"groq": 2},
        "per_agent_tokens": {},
        "failed_step": None,
    }


def _state_with_code(code: str, *, audit: dict | None = None, run_id: str = "adv") -> dict:
    tmpdir = tempfile.mkdtemp(prefix="adv_validator_")
    out_path = str(Path(tmpdir) / "agent.py")
    Path(out_path).write_text(code, encoding="utf-8")
    return {
        "run_id": run_id,
        "user_prompt": "x",
        "stage": "building",
        "status": "running",
        "spec": {"goal": "x", "domain": "website_builder", "steps": ["a"], "tools": []},
        "domain": "website_builder",
        "generated_code": code,
        "output_path": out_path,
        "run_audit": audit if audit is not None else _good_audit(),
        "validation_errors": [],
        "repair_attempts": 0,
    }


# ---- result tracking ----------------------------------------------------


_findings: list[tuple[str, str, str]] = []  # (category, name, observation)


def probe(category: str, name: str, expectation: str, fn) -> None:
    print(f"  [{category}] {name}")
    print(f"    Expect: {expectation}")
    try:
        observation = fn()
    except Exception as exc:
        observation = f"CRASH: {type(exc).__name__}: {exc}"
    print(f"    Got:    {observation}")
    _findings.append((category, name, observation))
    print()


# ---- PROBES: code-content edge cases -----------------------------------


def builder_inject_marker_passes() -> str:
    code = '''import os

def main():
    print("Start")
    """BUILDER_INJECT:step_2"""
    print("End")

if __name__ == "__main__":
    main()
'''
    out = validator_node(_state_with_code(code))
    if out["validation_status"] == "failed":
        errs = " | ".join(out.get("validation_errors", []))
        return f"PASS -> failed (errors: {errs[:80]})"
    return f"FAIL -> passed validation despite BUILDER_INJECT marker (status={out['validation_status']})"


def jinja2_string_leak_passes() -> str:
    code = '''def main():
    run_id = "{{ run_id }}"
    domain = "{{ domain }}"
    print(run_id, domain)

if __name__ == "__main__":
    main()
'''
    out = validator_node(_state_with_code(code))
    return f"FAIL -> {out['validation_status']} (Jinja {{}} in string literals not detected)" \
        if out["validation_status"] == "passed" \
        else f"PASS -> failed ({' | '.join(out.get('validation_errors', []))[:80]})"


def comments_only_file_passes() -> str:
    code = "# this is a comment\n# nothing else\n"
    out = validator_node(_state_with_code(code))
    return f"FAIL -> passed (comments-only is a silent success)" \
        if out["validation_status"] == "passed" \
        else f"OK -> failed ({' | '.join(out.get('validation_errors', []))[:80]})"


def imports_only_file_passes() -> str:
    code = "import os\nimport sys\nimport json\n"
    out = validator_node(_state_with_code(code))
    return f"FAIL -> passed (imports-only is a silent success)" \
        if out["validation_status"] == "passed" \
        else f"OK -> failed ({' | '.join(out.get('validation_errors', []))[:80]})"


def placeholder_only_passes() -> str:
    code = '''def create_hero():
    # TODO: Implement hero section
    pass

def create_menu():
    # TODO: Implement menu
    pass

def main():
    create_hero()
    create_menu()

if __name__ == "__main__":
    main()
'''
    out = validator_node(_state_with_code(code))
    return f"FAIL -> passed (TODO/pass-only never flagged)" \
        if out["validation_status"] == "passed" \
        else f"OK -> failed ({' | '.join(out.get('validation_errors', []))[:80]})"


def whitespace_only_code_caught() -> str:
    code = "   \n\n  \n"
    out = validator_node(_state_with_code(code))
    err_str = " | ".join(out.get("validation_errors", []))
    if out["validation_status"] == "failed":
        return f"OK -> failed ({err_str[:80]})"
    return f"FAIL -> passed despite whitespace-only code"


def empty_string_caught() -> str:
    out = validator_node(_state_with_code(""))
    err_str = " | ".join(out.get("validation_errors", []))
    if out["validation_status"] == "failed":
        return f"OK -> failed ({err_str[:80]})"
    return "FAIL -> passed empty string"


def markdown_fence_handling() -> str:
    code = '```python\ndef main():\n    print("hi")\n\nif __name__ == "__main__":\n    main()\n```\n'
    out = validator_node(_state_with_code(code))
    if out["validation_status"] == "failed":
        errs = " | ".join(out.get("validation_errors", []))
        mentions_md = "markdown" in errs.lower() or "```" in errs
        return f"OK (no auto-clean) -> failed; error mentions markdown: {mentions_md}; first error: {errs[:80]}"
    return "FAIL -> passed despite markdown fences"


def syntax_error_caught() -> str:
    code = "def main(\n    pass\n"
    out = validator_node(_state_with_code(code))
    return f"OK -> failed ({' | '.join(out.get('validation_errors', []))[:80]})" \
        if out["validation_status"] == "failed" \
        else "FAIL -> syntax error not caught"


def infinite_loop_timeout() -> str:
    code = '''import time

def main():
    while True:
        time.sleep(0.5)

if __name__ == "__main__":
    main()
'''
    out = validator_node(_state_with_code(code))
    err_str = " | ".join(out.get("validation_errors", []))
    if out["validation_status"] == "failed" and "Timeout" in err_str:
        return f"OK -> timed out ({err_str[:80]})"
    return f"FAIL -> {out['validation_status']} (errors: {err_str[:80]})"


def import_error_caught() -> str:
    code = '''import nonexistent_module_xyz_123

def main():
    nonexistent_module_xyz_123.do_something()

if __name__ == "__main__":
    main()
'''
    out = validator_node(_state_with_code(code))
    return f"OK -> failed ({' | '.join(out.get('validation_errors', []))[:80]})" \
        if out["validation_status"] == "failed" \
        else "FAIL -> import error slipped past execution check"


# ---- PROBES: state contract --------------------------------------------


def builder_audit_format_compatibility() -> str:
    """The contract bug. Builder writes agents_executed as list; audit_checker wants int."""
    code = 'def main():\n    print("hi")\n\nif __name__ == "__main__":\n    main()\n'
    state = _state_with_code(code, audit=_builder_audit())
    out = validator_node(state)
    report = out.get("validation_report", {})
    audit_valid = report.get("audit_valid", True)
    if audit_valid:
        return "OK -> audit passed with builder's real list-based audit"
    warnings = " | ".join(report.get("warnings", []))
    return f"FAIL -> CRITICAL CONTRACT BUG. audit_valid=False with builder's actual format. warnings: {warnings[:120]}"


def missing_output_path_graceful() -> str:
    state = _state_with_code("def main(): pass\n")
    state.pop("output_path")
    try:
        out = validator_node(state)
        if out["validation_status"] == "failed" and any(
            "output_path" in str(e).lower() for e in out.get("validation_errors", [])
        ):
            return "OK -> failed gracefully with output_path message"
        return f"FAIL -> {out['validation_status']} (errors: {out.get('validation_errors')})"
    except Exception as exc:
        return f"FAIL -> CRASH: {type(exc).__name__}: {exc}"


def missing_generated_code_graceful() -> str:
    state = _state_with_code("def main(): pass\n")
    state.pop("generated_code")
    try:
        out = validator_node(state)
        return f"{'OK' if out['validation_status'] == 'failed' else 'FAIL'} -> {out['validation_status']}"
    except Exception as exc:
        return f"FAIL -> CRASH: {type(exc).__name__}: {exc}"


def corrupted_state_types_graceful() -> str:
    bad_state = {
        "run_id": "x",
        "status": "running",
        "output_path": 12345,
        "generated_code": ["not", "a", "string"],
        "spec": "not a dict",
        "run_audit": "not a dict",
    }
    try:
        out = validator_node(bad_state)
        return f"OK -> handled, status={out['validation_status']}"
    except Exception as exc:
        return f"FAIL -> CRASH: {type(exc).__name__}: {exc}"


def state_keys_preserved() -> str:
    code = 'def main():\n    print("hi")\n\nif __name__ == "__main__":\n    main()\n'
    state = _state_with_code(code)
    state["custom_key"] = {"important": "data"}
    state["planner_metadata"] = "preserve me"
    state["spec"]["goal"] = "ORIGINAL_GOAL_MARKER"

    out = validator_node(state)

    missing = [k for k in state.keys() if k not in out]
    spec_intact = out.get("spec", {}).get("goal") == "ORIGINAL_GOAL_MARKER"
    custom_intact = out.get("custom_key") == {"important": "data"}
    metadata_intact = out.get("planner_metadata") == "preserve me"

    if not missing and spec_intact and custom_intact and metadata_intact:
        return "OK -> all state keys preserved, spec intact, custom keys intact"
    return f"FAIL -> missing={missing}, spec_intact={spec_intact}, custom_intact={custom_intact}"


def determinism_same_input_same_output() -> str:
    code = 'def main():\n    print("hi")\n\nif __name__ == "__main__":\n    main()\n'
    out1 = validator_node(_state_with_code(code))
    out2 = validator_node(_state_with_code(code))
    if out1["validation_status"] == out2["validation_status"] and out1["validation_score"] == out2["validation_score"]:
        return f"OK -> consistent ({out1['validation_status']}, score={out1['validation_score']})"
    return f"FAIL -> nondeterministic. run1={out1['validation_status']}/{out1['validation_score']}, run2={out2['validation_status']}/{out2['validation_score']}"


def silent_success_invariant() -> str:
    """The most important invariant: broken syntax MUST NEVER pass."""
    cases = [
        "def main(\n    pass",
        "if True\n    pass",
        ")(",
        "def f(): return\n    x",
    ]
    leaks = []
    for code in cases:
        out = validator_node(_state_with_code(code))
        if out["validation_status"] == "passed":
            leaks.append(code[:30])
    if leaks:
        return f"FAIL -> CRITICAL: {len(leaks)} broken-syntax leaks: {leaks}"
    return f"OK -> 0 leaks across {len(cases)} broken-syntax cases"


def execution_subprocess_isolation() -> str:
    """Verify subprocess can't import host project modules (validates env isolation)."""
    code = '''try:
    import nodes.builder  # would only succeed if PYTHONPATH leaks
    print("LEAK")
except ImportError:
    print("isolated")

if __name__ == "__main__":
    pass
'''
    out = validator_node(_state_with_code(code))
    stdout = (out.get("validation_report", {}).get("execution_valid") and
              out.get("sandbox_output", "")) or ""
    if "LEAK" in stdout:
        return f"FAIL -> subprocess inherited PYTHONPATH; can import host modules"
    return "OK -> subprocess env appears isolated (no host module leak)"


# ---- driver --------------------------------------------------------------


PROBES = [
    ("CONTENT", "BUILDER_INJECT marker in docstring", "should FAIL (unresolved injection)", builder_inject_marker_passes),
    ("CONTENT", "Jinja2 {{ }} leak in string literal", "should FAIL (template not rendered)", jinja2_string_leak_passes),
    ("CONTENT", "Comments-only file", "should FAIL (no real logic)", comments_only_file_passes),
    ("CONTENT", "Imports-only file", "should FAIL (no real logic)", imports_only_file_passes),
    ("CONTENT", "Placeholder-only (TODO/pass)", "should FAIL (no implementation)", placeholder_only_passes),
    ("CONTENT", "Whitespace-only code", "should FAIL", whitespace_only_code_caught),
    ("CONTENT", "Empty string code", "should FAIL", empty_string_caught),
    ("CONTENT", "Markdown fences around code", "should FAIL or auto-clean with clear error", markdown_fence_handling),
    ("CONTENT", "Genuine SyntaxError", "should FAIL with syntax message", syntax_error_caught),
    ("CONTENT", "Infinite loop", "should FAIL with timeout", infinite_loop_timeout),
    ("CONTENT", "Import error at runtime", "should FAIL via execution check", import_error_caught),
    ("CONTRACT", "Builder's real audit format (list)", "should be ACCEPTED by audit_checker", builder_audit_format_compatibility),
    ("CONTRACT", "Missing output_path", "should FAIL gracefully (no crash)", missing_output_path_graceful),
    ("CONTRACT", "Missing generated_code", "should FAIL gracefully (no crash)", missing_generated_code_graceful),
    ("CONTRACT", "Corrupted state types", "should NOT CRASH; should FAIL", corrupted_state_types_graceful),
    ("STATE", "Validator preserves all input state keys", "all keys in -> all keys out", state_keys_preserved),
    ("STATE", "Determinism: same input -> same output", "consistent across runs", determinism_same_input_same_output),
    ("INVARIANT", "Broken syntax NEVER passes (silent-success guard)", "0 leaks", silent_success_invariant),
    ("ISOLATION", "Subprocess env isolation", "host modules NOT importable", execution_subprocess_isolation),
]


def main() -> int:
    print("=" * 70)
    print("ADVERSARIAL VALIDATOR PROBES")
    print("=" * 70)
    print()

    by_cat: dict[str, list] = {}
    for cat, name, expect, fn in PROBES:
        by_cat.setdefault(cat, []).append((name, expect, fn))

    for cat in by_cat:
        print(f"\n[{cat}]")
        for name, expect, fn in by_cat[cat]:
            probe(cat, name, expect, fn)

    # Summary
    fails = [f for f in _findings if f[2].startswith("FAIL")]
    crashes = [f for f in _findings if "CRASH" in f[2]]
    oks = [f for f in _findings if f[2].startswith("OK")]
    other = [f for f in _findings if f not in fails and f not in oks and f not in crashes]

    print("\n" + "=" * 70)
    print(f"SUMMARY: {len(oks)} OK, {len(fails)} FAIL, {len(crashes)} CRASH, {len(other)} OTHER")
    print("=" * 70)

    if fails or crashes:
        print("\nIssues found:")
        for cat, name, obs in fails + crashes:
            print(f"  - [{cat}] {name}")
            print(f"      {obs}")

    return 0  # informational suite -- always exit 0


if __name__ == "__main__":
    sys.exit(main())
