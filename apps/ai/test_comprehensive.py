"""
Comprehensive tests for AgentForge -- planner, builder, full pipeline, token budget.

LLM calls are stubbed via call_llm monkey-patch so the suite runs deterministically
without API keys. Run with:  python apps/ai/test_comprehensive.py
"""
import ast
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from state.State import initial_state
from nodes import planner as planner_module
from nodes import sub_agent as sub_agent_module
from nodes import builder as builder_module
from nodes.planner import planner_node
from nodes.builder import builder_node


# ── Stub helpers ─────────────────────────────────────────────────────────


def _make_usage(prompt_tokens: int = 200, completion_tokens: int = 100, provider: str = "groq") -> dict:
    return {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": prompt_tokens + completion_tokens,
        "provider": provider,
    }


def _stub_planner_call(spec: dict, usage: dict | None = None):
    """Patch planner's call_llm to return a canned spec."""
    if usage is None:
        usage = _make_usage(420, 180, "groq")
    payload = json.dumps(spec)

    def fake(prompt, max_tokens=500):
        return payload, usage

    planner_module.call_llm = fake


def _stub_subagent_calls(payloads_by_step: dict[str, dict], usage_per_call: dict | None = None):
    """Patch sub_agent's call_llm to return a canned JSON per step.

    payloads_by_step: {"step_1": {"generated_code": "...", "summary": "..."}, ...}
    """
    if usage_per_call is None:
        usage_per_call = _make_usage(150, 80, "groq")

    call_counter = {"i": 0}
    step_order = sorted(payloads_by_step.keys())

    def fake(prompt, provider="groq", max_tokens=1024):
        idx = call_counter["i"]
        call_counter["i"] += 1
        if idx >= len(step_order):
            # Fallback: empty success
            return json.dumps({"step_id": f"step_{idx + 1}", "status": "success",
                               "generated_code": "<p>extra</p>", "summary": "", "error": None}), usage_per_call
        sid = step_order[idx]
        body = payloads_by_step[sid]
        return json.dumps({
            "step_id": sid,
            "status": body.get("status", "success"),
            "generated_code": body.get("generated_code", ""),
            "summary": body.get("summary", ""),
            "error": body.get("error"),
        }), usage_per_call

    sub_agent_module.call_llm = fake


def _restore_stubs(orig_planner, orig_sub_agent):
    planner_module.call_llm = orig_planner
    sub_agent_module.call_llm = orig_sub_agent


# ── TEST RUNNER ──────────────────────────────────────────────────────────


_results = {"pass": 0, "fail": 0, "errors": []}


def run_case(name: str, fn) -> None:
    print(f"  • {name} ...", end=" ")
    orig_planner = planner_module.call_llm
    orig_sub_agent = sub_agent_module.call_llm
    try:
        fn()
        print("OK")
        _results["pass"] += 1
    except AssertionError as exc:
        print(f"FAIL -- {exc}")
        _results["fail"] += 1
        _results["errors"].append((name, "FAIL", str(exc)))
    except Exception as exc:
        print(f"ERROR -- {type(exc).__name__}: {exc}")
        _results["fail"] += 1
        _results["errors"].append((name, "ERROR", f"{type(exc).__name__}: {exc}"))
    finally:
        _restore_stubs(orig_planner, orig_sub_agent)


# ── PLANNER TESTS ────────────────────────────────────────────────────────


def planner_simple_request() -> None:
    _stub_planner_call({
        "goal": "Build a simple website",
        "domain": "website_builder",
        "execution_type": "sequential",
        "estimated_total_tokens": 1500,
        "steps": ["Create HTML", "Add CSS", "Add JS"],
        "tools": ["generate", "code"],
        "success_criteria": "page loads",
        "complexity": "simple",
        "agents": [
            {"id": "agent_1", "role": "html", "input": "user_input", "output": "html",
             "provider": "groq", "max_tokens": 400},
            {"id": "agent_2", "role": "css", "input": "agent_1.output", "output": "styled",
             "provider": "groq", "max_tokens": 400},
            {"id": "agent_3", "role": "js", "input": "agent_2.output", "output": "final",
             "provider": "groq", "max_tokens": 400},
        ],
    })
    state = initial_state("t_planner_1", "Build a simple website")
    result = planner_node(state)

    assert result.get("spec") is not None, "spec missing"
    assert result["spec"]["domain"] == "website_builder"
    assert len(result["spec"]["steps"]) == 3
    assert "success_criteria" in result["spec"]
    assert result.get("execution_plan") is not None
    assert len(result["execution_plan"]["agents"]) == 3
    assert result.get("planner_usage", {}).get("total_tokens", 0) > 0


def planner_records_failure_with_context() -> None:
    """A bad LLM response must surface as final_error + final_error_details."""
    def boom(prompt, max_tokens=500):
        return "this is not json at all", _make_usage()
    planner_module.call_llm = boom

    state = initial_state("t_planner_fail", "Anything")
    result = planner_node(state)
    assert result["status"] == "failed", "should be failed on JSON parse error"
    assert result.get("final_error") == "planner_failed"
    details = result.get("final_error_details") or {}
    assert "exception_type" in details
    assert "message" in details


def planner_default_execution_plan_when_agents_missing() -> None:
    _stub_planner_call({
        "goal": "Do a thing",
        "domain": "document",
        "steps": ["one", "two"],
        "tools": ["generate"],
        "success_criteria": "ok",
        "complexity": "simple",
        # NOTE: no "agents" key -- planner must build a default plan
    })
    state = initial_state("t_planner_default", "Do a thing")
    result = planner_node(state)
    assert result.get("spec") is not None
    plan = result.get("execution_plan")
    assert plan is not None
    assert len(plan["agents"]) == 2  # one per step


# ── BUILDER TESTS ────────────────────────────────────────────────────────


def _ready_state(domain: str, steps: list[str]) -> dict:
    state = initial_state("t_builder", "Test goal")
    state["spec"] = {
        "goal": "Test goal",
        "domain": domain,
        "steps": steps,
        "tools": ["generate"],
        "success_criteria": "ok",
        "complexity": "simple",
    }
    state["domain"] = domain
    return state


def builder_with_valid_spec() -> None:
    _stub_subagent_calls({
        "step_1": {"generated_code": "<h1>Hi</h1>"},
        "step_2": {"generated_code": "<h1>Hi</h1><p>p</p>"},
    })
    state = _ready_state("website_builder", ["a", "b"])
    result = builder_node(state)
    assert result["status"] == "completed", f"status was {result['status']} ({result.get('final_error')})"
    assert result.get("output_path"), "no output_path"
    assert os.path.exists(result["output_path"])
    assert result.get("final_error") is None


def builder_generated_code_parses() -> None:
    _stub_subagent_calls({
        "step_1": {"generated_code": "<h1>Hello</h1>"},
    })
    state = _ready_state("website_builder", ["only"])
    result = builder_node(state)
    assert result["status"] == "completed"
    code = result["generated_code"]
    ast.parse(code)  # raises SyntaxError if invalid


def builder_token_audit_has_real_numbers() -> None:
    _stub_subagent_calls(
        {"step_1": {"generated_code": "<p>x</p>"}},
        usage_per_call=_make_usage(500, 250, "groq"),
    )
    state = _ready_state("website_builder", ["only"])
    result = builder_node(state)
    audit = result["run_audit"]
    assert audit["total_tokens"] == 750, f"expected 750 (real per-step usage), got {audit['total_tokens']}"
    assert audit["prompt_tokens"] == 500
    assert audit["completion_tokens"] == 250
    assert "step_1" in audit["per_agent_tokens"]


def builder_handles_malformed_llm_output() -> None:
    """Sub-agent returns garbage -- pipeline should still produce safe Python."""
    def garbage(prompt, provider="groq", max_tokens=1024):
        return "this isn't json{{{ broken", _make_usage()
    sub_agent_module.call_llm = garbage

    state = _ready_state("website_builder", ["only"])
    result = builder_node(state)
    # Either succeeds with the raw garbage as content (safely serialized) or
    # fails cleanly with status=failed -- both are acceptable. What is NOT
    # acceptable is producing invalid Python or crashing.
    assert result["status"] in {"completed", "failed"}
    if result["status"] == "completed":
        ast.parse(result["generated_code"])


# ── PIPELINE / TOKEN BUDGET ──────────────────────────────────────────────


def full_pipeline_e2e() -> None:
    _stub_planner_call({
        "goal": "Build a simple website",
        "domain": "website_builder",
        "steps": ["Create HTML", "Add CSS"],
        "tools": ["generate", "code"],
        "success_criteria": "renders",
        "complexity": "simple",
        "agents": [
            {"id": "a1", "role": "html", "input": "user_input", "output": "html",
             "provider": "groq", "max_tokens": 400},
            {"id": "a2", "role": "css", "input": "a1.output", "output": "final",
             "provider": "groq", "max_tokens": 400},
        ],
    })
    _stub_subagent_calls({
        "step_1": {"generated_code": "<h1>Site</h1>"},
        "step_2": {"generated_code": "<h1>Site</h1><style>h1{color:#000}</style>"},
    })

    state = initial_state("t_e2e", "Build a simple website")
    planned = planner_node(state)
    built = builder_node(planned)

    assert built["status"] == "completed", f"final status {built['status']} err={built.get('final_error')}"
    assert os.path.exists(built["output_path"])
    with open(built["output_path"], encoding="utf-8") as f:
        code = f.read()
    ast.parse(code)


def token_budget_respected() -> None:
    """Whole pipeline tokens stay within the brief's hard limit."""
    _stub_planner_call(
        {
            "goal": "Tiny site",
            "domain": "website_builder",
            "steps": ["one", "two", "three"],
            "tools": ["generate"],
            "success_criteria": "ok",
            "complexity": "simple",
            "agents": [
                {"id": f"a{i}", "role": f"r{i}", "input": "user_input",
                 "output": "x", "provider": "groq", "max_tokens": 800}
                for i in range(1, 4)
            ],
        },
        usage=_make_usage(800, 400, "groq"),  # planner under 1200/800 budget
    )
    _stub_subagent_calls(
        {f"step_{i}": {"generated_code": f"<p>{i}</p>"} for i in range(1, 4)},
        usage_per_call=_make_usage(700, 600, "groq"),  # under 800/1200 sub-agent budget
    )

    state = initial_state("t_budget", "Tiny site")
    planned = planner_node(state)
    built = builder_node(planned)
    assert built["status"] == "completed"

    audit = built["run_audit"]
    # Budget: planner (1200+800) + 3 sub-agents (800+1200 each) = 8000
    BUDGET = 1200 + 800 + 3 * (800 + 1200)
    assert audit["total_tokens"] <= BUDGET, f"used {audit['total_tokens']} tokens, budget {BUDGET}"
    # Per-agent breakdown should include planner + each step
    assert "planner" in audit["per_agent_tokens"]
    assert all(f"step_{i}" in audit["per_agent_tokens"] for i in range(1, 4))


# ── DRIVER ───────────────────────────────────────────────────────────────


SUITES = [
    ("Planner", [
        ("simple request → valid spec", planner_simple_request),
        ("failure surfaces final_error_details", planner_records_failure_with_context),
        ("default plan when agents missing", planner_default_execution_plan_when_agents_missing),
    ]),
    ("Builder", [
        ("valid spec → completed", builder_with_valid_spec),
        ("generated code parses", builder_generated_code_parses),
        ("token audit reflects real usage", builder_token_audit_has_real_numbers),
        ("malformed LLM output handled", builder_handles_malformed_llm_output),
    ]),
    ("Pipeline / Budget", [
        ("end-to-end planner → builder", full_pipeline_e2e),
        ("token budget respected", token_budget_respected),
    ]),
]


def main() -> int:
    for suite_name, cases in SUITES:
        print(f"\n[{suite_name}]")
        for name, fn in cases:
            run_case(name, fn)

    total = _results["pass"] + _results["fail"]
    print(f"\n── {_results['pass']}/{total} passed ──")
    if _results["errors"]:
        print("\nFailures:")
        for name, kind, msg in _results["errors"]:
            print(f"  [{kind}] {name}: {msg}")
    return 0 if _results["fail"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
