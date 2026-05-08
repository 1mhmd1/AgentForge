import sys

sys.path.append("c:/Users/1mhmd/OneDrive/Desktop/Ai Projects/AgentForge/apps/ai/src")

from state.State import initial_state
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


def run_case(title: str, fn) -> None:
    print(f"\n=== {title} ===")
    try:
        fn()
    except Exception as exc:
        print("ERROR:", exc)


def _build_state(run_id: str, spec: dict) -> dict:
    state = initial_state(run_id, spec.get("goal", ""))
    state["spec"] = spec
    state["domain"] = spec.get("domain")
    return state


def _run_builder_with_template(spec: dict, template_text: str, generated_map: dict) -> dict:
    import nodes.builder as builder

    original_execute = builder.execute_sub_agent
    original_load = builder.load_template

    def fake_execute(step_id, step_data, total_steps, previous_results):
        return {
            "status": "ok",
            "generated_code": generated_map.get(step_id, ""),
        }

    builder.execute_sub_agent = fake_execute
    builder.load_template = lambda domain: ("<memory>", template_text)

    try:
        return builder.builder_node(_build_state("audit", spec))
    finally:
        builder.execute_sub_agent = original_execute
        builder.load_template = original_load


def _run_builder_with_loader_error(spec: dict, error_message: str) -> dict:
    import nodes.builder as builder

    original_execute = builder.execute_sub_agent
    original_load = builder.load_template

    builder.execute_sub_agent = lambda *args, **kwargs: {"status": "ok", "generated_code": "pass"}
    builder.load_template = lambda domain: (_ for _ in ()).throw(RuntimeError(error_message))

    try:
        return builder.builder_node(_build_state("audit", spec))
    finally:
        builder.execute_sub_agent = original_execute
        builder.load_template = original_load


def valid_website_spec() -> None:
    spec = {
        "goal": "Build a simple website",
        "domain": "website_builder",
        "steps": ["Step one", "Step two"],
        "tools": [],
        "inputs": [],
        "outputs": [],
        "success_criteria": "done",
        "complexity": "simple",
    }
    template_text = """def run():\n    \"\"\"BUILDER_INJECT:step_1\"\"\"\n    \"\"\"BUILDER_INJECT:step_2\"\"\"\n"""
    built = _run_builder_with_template(
        spec,
        template_text,
        {"step_1": "print('ok')", "step_2": "print('done')"},
    )
    assert built.get("status") == "running"
    assert built.get("generated_code")
    assert built.get("current_stage") == STAGE_FILE_WRITING
    assert built.get("completed_stages") == [
        STAGE_VALIDATION,
        STAGE_EXECUTION_PLANNING,
        STAGE_TEMPLATE_LOADING,
        STAGE_TEMPLATE_RENDERING,
        STAGE_CODE_INJECTION,
        STAGE_QUALITY_VALIDATION,
        STAGE_SYNTAX_VALIDATION,
        STAGE_FILE_WRITING,
    ]
    assert built.get("error_stage") is None
    assert built.get("started_at") is not None
    assert built.get("completed_at") is not None
    assert built.get("build_duration_seconds") is not None
    print("status:", built.get("status"))
    print("generated_code_len:", len(built.get("generated_code") or ""))


def invalid_domain() -> None:
    spec = {
        "goal": "Build a simple website",
        "domain": "bad_domain",
        "steps": ["Step one", "Step two"],
        "tools": [],
    }
    built = builder_node(_build_state("audit_bad_domain", spec))
    assert built.get("status") == "failed"
    assert str(built.get("final_error", "")).startswith(ERROR_CODES["TEMPLATE_NOT_FOUND"])
    assert built.get("current_stage") == STAGE_VALIDATION
    assert built.get("completed_stages") == []
    assert built.get("error_stage") == STAGE_VALIDATION
    print("status:", built.get("status"))
    print("final_error:", built.get("final_error"))


def broken_template() -> None:
    spec = {
        "goal": "Build a simple website",
        "domain": "website_builder",
        "steps": ["Step one", "Step two"],
        "tools": [],
    }
    built = _run_builder_with_template(
        spec,
        "{{ bad:",
        {"step_1": "print('ok')", "step_2": "print('done')"},
    )
    assert built.get("status") == "failed"
    assert str(built.get("final_error", "")).startswith(ERROR_CODES["RENDER_ERROR"])
    assert built.get("current_stage") == STAGE_TEMPLATE_RENDERING
    assert built.get("completed_stages") == [
        STAGE_VALIDATION,
        STAGE_EXECUTION_PLANNING,
        STAGE_TEMPLATE_LOADING,
    ]
    assert built.get("error_stage") == STAGE_TEMPLATE_RENDERING
    print("status:", built.get("status"))
    print("final_error:", built.get("final_error"))


def empty_template() -> None:
    spec = {
        "goal": "Build a simple website",
        "domain": "website_builder",
        "steps": ["Step one", "Step two"],
        "tools": [],
    }
    built = _run_builder_with_loader_error(spec, ERROR_CODES["TEMPLATE_EMPTY"])
    assert built.get("status") == "failed"
    assert built.get("final_error") == ERROR_CODES["TEMPLATE_EMPTY"]
    assert built.get("current_stage") == STAGE_TEMPLATE_LOADING
    assert built.get("completed_stages") == [
        STAGE_VALIDATION,
        STAGE_EXECUTION_PLANNING,
    ]
    assert built.get("error_stage") == STAGE_TEMPLATE_LOADING
    print("status:", built.get("status"))
    print("final_error:", built.get("final_error"))


def missing_injection_marker() -> None:
    spec = {
        "goal": "Build a simple website",
        "domain": "website_builder",
        "steps": ["Step one", "Step two"],
        "tools": [],
    }
    built = _run_builder_with_template(
        spec,
        "print('no markers')",
        {"step_1": "print('ok')", "step_2": "print('done')"},
    )
    assert built.get("status") == "failed"
    assert str(built.get("final_error", "")).startswith(ERROR_CODES["MARKER_MISSING"])
    assert built.get("current_stage") == STAGE_CODE_INJECTION
    assert built.get("completed_stages") == [
        STAGE_VALIDATION,
        STAGE_EXECUTION_PLANNING,
        STAGE_TEMPLATE_LOADING,
        STAGE_TEMPLATE_RENDERING,
    ]
    assert built.get("error_stage") == STAGE_CODE_INJECTION
    print("status:", built.get("status"))
    print("final_error:", built.get("final_error"))


def invalid_python_after_injection() -> None:
    spec = {
        "goal": "Build a simple website",
        "domain": "website_builder",
        "steps": ["Step one", "Step two"],
        "tools": [],
    }
    template_text = """def run():\n    \"\"\"BUILDER_INJECT:step_1\"\"\"\n    \"\"\"BUILDER_INJECT:step_2\"\"\"\n"""
    built = _run_builder_with_template(
        spec,
        template_text,
        {"step_1": "def bad(:", "step_2": "print('ok')"},
    )
    assert built.get("status") == "failed"
    assert str(built.get("final_error", "")).startswith(ERROR_CODES["SYNTAX_ERROR"])
    assert built.get("final_error_details")
    assert built.get("current_stage") == STAGE_SYNTAX_VALIDATION
    assert built.get("completed_stages") == [
        STAGE_VALIDATION,
        STAGE_EXECUTION_PLANNING,
        STAGE_TEMPLATE_LOADING,
        STAGE_TEMPLATE_RENDERING,
        STAGE_CODE_INJECTION,
        STAGE_QUALITY_VALIDATION,
    ]
    assert built.get("error_stage") == STAGE_SYNTAX_VALIDATION
    print("status:", built.get("status"))
    print("final_error:", built.get("final_error"))
    print("syntax_details:", built.get("final_error_details"))


def malformed_prompt_input() -> None:
    spec = {
        "goal": "",
        "domain": "website_builder",
        "steps": [],
        "tools": [],
    }
    built = builder_node(_build_state("audit_bad_spec", spec))
    assert built.get("status") == "failed"
    assert str(built.get("final_error", "")).startswith(ERROR_CODES["INVALID_SPEC"])
    assert built.get("current_stage") == STAGE_VALIDATION
    assert built.get("completed_stages") == []
    assert built.get("error_stage") == STAGE_VALIDATION
    print("status:", built.get("status"))
    print("final_error:", built.get("final_error"))


def missing_template_file() -> None:
    spec = {
        "goal": "Build a simple website",
        "domain": "website_builder",
        "steps": ["Step one", "Step two"],
        "tools": [],
    }
    built = _run_builder_with_loader_error(
        spec,
        f"{ERROR_CODES['TEMPLATE_NOT_FOUND']}:website_builder",
    )
    assert built.get("status") == "failed"
    assert str(built.get("final_error", "")).startswith(ERROR_CODES["TEMPLATE_NOT_FOUND"])
    assert built.get("current_stage") == STAGE_TEMPLATE_LOADING
    assert built.get("completed_stages") == [
        STAGE_VALIDATION,
        STAGE_EXECUTION_PLANNING,
    ]
    assert built.get("error_stage") == STAGE_TEMPLATE_LOADING
    print("status:", built.get("status"))
    print("final_error:", built.get("final_error"))


if __name__ == "__main__":
    run_case("valid website spec", valid_website_spec)
    run_case("invalid domain", invalid_domain)
    run_case("broken template", broken_template)
    run_case("empty template", empty_template)
    run_case("missing injection marker", missing_injection_marker)
    run_case("invalid python after injection", invalid_python_after_injection)
    run_case("malformed planner output", malformed_prompt_input)
    run_case("template loading", missing_template_file)
