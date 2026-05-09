"""
Prompt Optimizer tests -- verifies the optimizer node refines vague prompts
into structured briefs and that the planner consumes the optimized version.

LLM calls are stubbed via call_llm monkey-patch so the suite runs deterministically
without API keys.

Usage: python apps/ai/test_prompt_optimizer.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from state.State import initial_state
from nodes import prompt_optimizer as optimizer_module
from nodes import planner as planner_module
from nodes.prompt_optimizer import (
    prompt_optimizer_node,
    optimize_prompt,
    _clean_response,
    _extract_json,
    _validate_response,
)
from nodes.planner import planner_node


def _usage(prompt_t: int = 120, comp_t: int = 80, provider: str = "groq") -> dict:
    return {
        "prompt_tokens": prompt_t,
        "completion_tokens": comp_t,
        "total_tokens": prompt_t + comp_t,
        "provider": provider,
    }


def _stub_optimizer(payload: dict, usage: dict | None = None):
    if usage is None:
        usage = _usage()
    body = json.dumps(payload)

    def fake(prompt, provider=None, max_tokens=400):
        return body, usage

    optimizer_module.call_llm = fake


def _stub_planner(spec: dict, usage: dict | None = None):
    if usage is None:
        usage = _usage(420, 180)
    body = json.dumps(spec)

    def fake(prompt, max_tokens=500):
        return body, usage

    planner_module.call_llm = fake


_results = {"pass": 0, "fail": 0, "errors": []}


def run_case(name: str, fn) -> None:
    print(f"  - {name} ...", end=" ")
    orig_opt = optimizer_module.call_llm
    orig_plan = planner_module.call_llm
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
        optimizer_module.call_llm = orig_opt
        planner_module.call_llm = orig_plan


# ---- Helper-function unit tests ------------------------------------------


def clean_response_strips_fences() -> None:
    raw = '```json\n{"a": 1}\n```'
    out = _clean_response(raw)
    assert out == '{"a": 1}', f"got {out!r}"


def extract_json_finds_object_in_noise() -> None:
    raw = "Here you go: {\"x\": 2, \"y\": [1,2]} -- thanks"
    parsed = _extract_json(raw)
    assert parsed == {"x": 2, "y": [1, 2]}


def validate_fills_missing_fields() -> None:
    out = _validate_response({}, "make a thing")
    assert out["original_prompt"] == "make a thing"
    assert out["optimized_prompt"] == "make a thing"
    assert out["detected_domain"] == "general"
    assert out["complexity"] == "unknown"
    assert out["detected_requirements"] == []


# ---- optimize_prompt() ---------------------------------------------------


def optimize_returns_structured_dict() -> None:
    _stub_optimizer({
        "original_prompt": "make me a coffee website",
        "optimized_prompt": "Build a responsive coffee shop landing page with hero, menu, about, contact sections.",
        "detected_domain": "website_builder",
        "complexity": "simple",
        "detected_requirements": ["responsive design", "landing page"],
    })
    out = optimize_prompt("make me a coffee website")
    assert out["detected_domain"] == "website_builder"
    assert out["complexity"] == "simple"
    assert "landing page" in out["optimized_prompt"].lower()
    assert isinstance(out["detected_requirements"], list)
    assert out.get("usage", {}).get("total_tokens", 0) > 0


def optimize_falls_back_on_garbage() -> None:
    def garbage(prompt, provider=None, max_tokens=400):
        return "this is not json {{{ broken", _usage()
    optimizer_module.call_llm = garbage

    out = optimize_prompt("make a thing")
    assert out["optimized_prompt"] == "make a thing", "fallback must preserve original"
    assert out["detected_domain"] == "general"
    assert "error" in out


def optimize_falls_back_on_llm_exception() -> None:
    def boom(prompt, provider=None, max_tokens=400):
        raise RuntimeError("network down")
    optimizer_module.call_llm = boom

    out = optimize_prompt("anything")
    assert out["optimized_prompt"] == "anything"
    assert out["error"].startswith("llm_call_failed")


def optimize_handles_empty_input() -> None:
    out = optimize_prompt("")
    assert out["optimized_prompt"] == ""
    assert out["error"] == "empty user prompt"


# ---- Node + pipeline -----------------------------------------------------


def node_writes_optimized_prompt_to_state() -> None:
    _stub_optimizer({
        "original_prompt": "make me a coffee website",
        "optimized_prompt": "Build a responsive coffee shop landing page with hero, menu, about, contact sections.",
        "detected_domain": "website_builder",
        "complexity": "simple",
        "detected_requirements": ["responsive design"],
    })
    state = initial_state("t_node", "make me a coffee website")
    next_state = prompt_optimizer_node(state)

    assert next_state["optimized_prompt"]
    assert next_state["optimized_prompt"] != state["user_prompt"]
    assert next_state["prompt_analysis"]["detected_domain"] == "website_builder"
    # Domain should be auto-set from optimizer when not pre-specified
    assert next_state["domain"] == "website_builder"


def node_does_not_overwrite_user_set_domain() -> None:
    _stub_optimizer({
        "original_prompt": "x",
        "optimized_prompt": "Build a doc",
        "detected_domain": "website_builder",
        "complexity": "simple",
        "detected_requirements": [],
    })
    state = initial_state("t_node_dom", "x")
    state["domain"] = "document"
    next_state = prompt_optimizer_node(state)
    assert next_state["domain"] == "document", "user-specified domain must win"


def planner_uses_optimized_prompt() -> None:
    _stub_optimizer({
        "original_prompt": "make me a coffee website",
        "optimized_prompt": "Build a responsive coffee shop landing page.",
        "detected_domain": "website_builder",
        "complexity": "simple",
        "detected_requirements": [],
    })

    captured = {"prompt_seen": None}

    def fake_planner_llm(prompt, max_tokens=500):
        captured["prompt_seen"] = prompt
        return json.dumps({
            "goal": "Coffee landing page",
            "domain": "website_builder",
            "execution_type": "sequential",
            "estimated_total_tokens": 800,
            "steps": ["html"],
            "tools": ["generate"],
            "success_criteria": "renders",
            "complexity": "simple",
            "agents": [{"id": "a1", "role": "html", "input": "user_input",
                        "output": "html", "provider": "groq", "max_tokens": 400}],
        }), _usage(420, 180)
    planner_module.call_llm = fake_planner_llm

    state = initial_state("t_pipe", "make me a coffee website")
    after_opt = prompt_optimizer_node(state)
    after_plan = planner_node(after_opt)

    assert "responsive coffee shop landing page" in captured["prompt_seen"], \
        "planner should have received the optimized prompt"
    assert after_plan.get("spec", {}).get("domain") == "website_builder"


def planner_falls_back_when_optimizer_skipped() -> None:
    """If optimized_prompt is None, planner must still work using user_prompt."""
    captured = {"prompt_seen": None}

    def fake_planner_llm(prompt, max_tokens=500):
        captured["prompt_seen"] = prompt
        return json.dumps({
            "goal": "x",
            "domain": "document",
            "steps": ["one"],
            "tools": ["generate"],
            "success_criteria": "ok",
            "complexity": "simple",
            "agents": [],
        }), _usage()
    planner_module.call_llm = fake_planner_llm

    state = initial_state("t_skip", "raw user request only")
    # No optimizer pass -- straight into planner
    after = planner_node(state)
    assert "raw user request only" in captured["prompt_seen"]
    assert after.get("spec") is not None


# ---- Demo flow (per spec) ------------------------------------------------


def demo_flow_prints_pipeline_output() -> None:
    """Spec-required demo: initial_state -> optimizer -> planner; print outputs."""
    _stub_optimizer({
        "original_prompt": "make me a coffee website",
        "optimized_prompt": "Build a responsive coffee shop landing page with hero, menu, about, contact sections. Use lightweight static frontend (HTML/CSS, minimal JS).",
        "detected_domain": "website_builder",
        "complexity": "simple",
        "detected_requirements": ["responsive design", "frontend UI", "landing page"],
    })
    _stub_planner({
        "goal": "Build a coffee shop landing page",
        "domain": "website_builder",
        "execution_type": "sequential",
        "estimated_total_tokens": 1200,
        "steps": ["html structure", "css styling"],
        "tools": ["generate", "code"],
        "success_criteria": "page renders",
        "complexity": "simple",
        "agents": [
            {"id": "a1", "role": "html", "input": "user_input", "output": "html",
             "provider": "groq", "max_tokens": 500},
            {"id": "a2", "role": "css", "input": "a1.output", "output": "styled",
             "provider": "groq", "max_tokens": 400},
        ],
    })

    state = initial_state("t_demo", "make me a coffee website")
    after_opt = prompt_optimizer_node(state)
    after_plan = planner_node(after_opt)

    print()
    print("--- DEMO FLOW OUTPUT ---")
    print("Optimized prompt:")
    print(json.dumps(after_opt["optimized_prompt"], indent=2))
    print()
    print("Detected domain:", after_opt["prompt_analysis"]["detected_domain"])
    print()
    print("Planner spec:")
    print(json.dumps(after_plan.get("spec"), indent=2))
    print("--- END DEMO ---")

    assert after_opt["optimized_prompt"]
    assert after_plan.get("spec") is not None


SUITES = [
    ("Helpers", [
        ("clean_response strips fences", clean_response_strips_fences),
        ("extract_json finds object in noise", extract_json_finds_object_in_noise),
        ("validate fills missing fields", validate_fills_missing_fields),
    ]),
    ("optimize_prompt", [
        ("returns structured dict", optimize_returns_structured_dict),
        ("falls back on garbage", optimize_falls_back_on_garbage),
        ("falls back on llm exception", optimize_falls_back_on_llm_exception),
        ("handles empty input", optimize_handles_empty_input),
    ]),
    ("Node + Pipeline", [
        ("node writes optimized_prompt to state", node_writes_optimized_prompt_to_state),
        ("node respects user-set domain", node_does_not_overwrite_user_set_domain),
        ("planner uses optimized prompt", planner_uses_optimized_prompt),
        ("planner falls back when optimizer skipped", planner_falls_back_when_optimizer_skipped),
    ]),
    ("Demo", [
        ("demo flow prints pipeline output", demo_flow_prints_pipeline_output),
    ]),
]


def main() -> int:
    for suite_name, cases in SUITES:
        print(f"\n[{suite_name}]")
        for name, fn in cases:
            run_case(name, fn)

    total = _results["pass"] + _results["fail"]
    print(f"\n== {_results['pass']}/{total} passed ==")
    if _results["errors"]:
        print("\nFailures:")
        for name, kind, msg in _results["errors"]:
            print(f"  [{kind}] {name}: {msg}")
    return 0 if _results["fail"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
