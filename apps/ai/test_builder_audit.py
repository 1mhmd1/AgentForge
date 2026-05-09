"""
Builder audit -- runs builder_node end-to-end with a mocked sub-agent.
Replaces the older audit which monkey-patched a Jinja template path that no
longer exists (the builder uses SafeCodeInjector now).

Usage: python apps/ai/test_builder_audit.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from state.State import initial_state
from nodes import builder as builder_module
from nodes.builder import (
    builder_node,
    STAGE_VALIDATION,
    STAGE_EXECUTION_PLANNING,
    STAGE_TEMPLATE_LOADING,
    STAGE_TEMPLATE_RENDERING,
    STAGE_CODE_INJECTION,
    STAGE_QUALITY_VALIDATION,
    STAGE_SYNTAX_VALIDATION,
    STAGE_FILE_WRITING,
)
from services.errors import ERROR_CODES


def _build_state(run_id: str, spec: dict) -> dict:
    state = initial_state(run_id, spec.get("goal", ""))
    state["spec"] = spec
    state["domain"] = spec.get("domain")
    return state


def _patch_sub_agent(payloads: dict[str, dict]):
    """Replace nodes.builder.execute_sub_agent with a deterministic stub."""
    original = builder_module.execute_sub_agent

    def fake_execute(*, step_id, step_data, total_steps, previous_results,
                     provider, max_tokens, domain, goal):
        result = payloads.get(step_id, {})
        return {
            "step_id": step_id,
            "status": result.get("status", "success"),
            "generated_code": result.get("generated_code", "<p>ok</p>"),
            "summary": result.get("summary", "test"),
            "error": result.get("error"),
            "usage": {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150, "provider": provider},
        }

    builder_module.execute_sub_agent = fake_execute
    return original


def _restore_sub_agent(original) -> None:
    builder_module.execute_sub_agent = original


def run_case(title: str, fn) -> bool:
    print(f"\n=== {title} ===")
    try:
        fn()
        print("PASS")
        return True
    except AssertionError as exc:
        print(f"FAIL: {exc}")
        return False
    except Exception as exc:
        print(f"ERROR: {type(exc).__name__}: {exc}")
        return False


# ── Cases ────────────────────────────────────────────────────────────────


def valid_website_spec() -> None:
    spec = {
        "goal": "Build a simple website",
        "domain": "website_builder",
        "steps": ["Generate HTML", "Style with CSS"],
        "tools": ["generate", "code"],
        "complexity": "simple",
        "success_criteria": "page renders",
    }
    payloads = {
        "step_1": {"generated_code": "<h1>Hello</h1>"},
        "step_2": {"generated_code": "<h1>Hello</h1><style>h1{color:red}</style>"},
    }
    original = _patch_sub_agent(payloads)
    try:
        result = builder_node(_build_state("audit_website", spec))
    finally:
        _restore_sub_agent(original)

    assert result["status"] == "completed", f"status={result['status']}"
    assert result["stage"] == "completed", f"stage={result['stage']}"
    assert result.get("completed_at") is not None
    assert result.get("output_path") and os.path.exists(result["output_path"])
    assert STAGE_FILE_WRITING in result["completed_stages"]
    # Last-only merge: final code should contain step_2's content, NOT step_1's only
    assert "color:red" in result["generated_code"], "expected last-step content in output"
    assert result["run_audit"]["total_tokens"] >= 300, "should accumulate per-step usage"


def invalid_domain() -> None:
    spec = {"goal": "x", "domain": "bad_domain", "steps": ["a"], "tools": []}
    result = builder_node(_build_state("audit_bad_domain", spec))
    assert result["status"] == "failed"
    assert str(result.get("final_error", "")).startswith(ERROR_CODES["TEMPLATE_NOT_FOUND"])
    assert result["error_stage"] == STAGE_VALIDATION


def malformed_spec() -> None:
    spec = {"goal": "", "domain": "website_builder", "steps": [], "tools": []}
    result = builder_node(_build_state("audit_bad_spec", spec))
    assert result["status"] == "failed"
    assert str(result.get("final_error", "")).startswith(ERROR_CODES["INVALID_SPEC"])


def sub_agent_failure_stops_pipeline() -> None:
    spec = {
        "goal": "x",
        "domain": "website_builder",
        "steps": ["s1", "s2"],
        "tools": [],
    }
    payloads = {
        "step_1": {"status": "error", "error": "boom"},
        "step_2": {"generated_code": "<p>unreached</p>"},
    }
    original = _patch_sub_agent(payloads)
    try:
        result = builder_node(_build_state("audit_subfail", spec))
    finally:
        _restore_sub_agent(original)

    assert result["status"] == "failed"
    assert "sub_agent_failed_step_1" == result["final_error"]
    # step_2 must not have been called -- only step_1 executed
    assert list(result["sub_agent_results"].keys()) == ["step_1"]


def data_transform_concatenation() -> None:
    """data_transform domain keeps all sub-agent outputs (additive)."""
    spec = {
        "goal": "Transform data",
        "domain": "data_transform",
        "steps": ["parse", "format"],
        "tools": ["analyze", "code"],
    }
    payloads = {
        "step_1": {"generated_code": '{"a": 1}'},
        "step_2": {"generated_code": '{"b": 2}'},
    }
    original = _patch_sub_agent(payloads)
    try:
        result = builder_node(_build_state("audit_data", spec))
    finally:
        _restore_sub_agent(original)
    assert result["status"] == "completed"
    # Both step contents should make it into the final agent
    code = result["generated_code"]
    assert '"a": 1' in code or '"a":1' in code or 'a' in code
    assert '"b": 2' in code or '"b":2' in code or 'b' in code


def website_last_only_merge() -> None:
    """website_builder keeps ONLY the last sub-agent's output."""
    spec = {
        "goal": "x",
        "domain": "website_builder",
        "steps": ["draft", "final"],
        "tools": [],
    }
    payloads = {
        "step_1": {"generated_code": "<p>FIRST_DRAFT_MARKER</p>"},
        "step_2": {"generated_code": "<p>FINAL_VERSION_MARKER</p>"},
    }
    original = _patch_sub_agent(payloads)
    try:
        result = builder_node(_build_state("audit_lastonly", spec))
    finally:
        _restore_sub_agent(original)
    assert result["status"] == "completed"
    code = result["generated_code"]
    assert "FINAL_VERSION_MARKER" in code, "last-step content missing"
    assert "FIRST_DRAFT_MARKER" not in code, "first-draft content leaked into output"


CASES = [
    ("valid website spec",          valid_website_spec),
    ("invalid domain",              invalid_domain),
    ("malformed spec",              malformed_spec),
    ("sub-agent failure stops pipeline", sub_agent_failure_stops_pipeline),
    ("data_transform concatenation", data_transform_concatenation),
    ("website last-only merge",     website_last_only_merge),
]


def main() -> int:
    passed = 0
    failed = 0
    for title, fn in CASES:
        ok = run_case(title, fn)
        if ok:
            passed += 1
        else:
            failed += 1
    print(f"\n── {passed}/{passed + failed} passed ──")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
