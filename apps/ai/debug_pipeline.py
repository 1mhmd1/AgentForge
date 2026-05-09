import ast
import json
import re
import sys
from pathlib import Path

sys.path.append("c:/Users/1mhmd/OneDrive/Desktop/Ai Projects/AgentForge/apps/ai/src")

from state.State import initial_state
from nodes.planner import planner_node
from nodes.sub_agent import execute_sub_agent
from services.template_loader import load_template
from services.template_renderer import render_template
from services.code_injector import inject_code


def print_header(title: str) -> None:
    print(f"\n=== {title} ===")


def preview(text: str, lines: int = 20) -> str:
    snippet = "\n".join(text.splitlines()[:lines])
    return snippet if snippet else "<empty>"


def diagnose_fstring_error(code_text: str, error_line: int) -> None:
    lines = code_text.split("\n")
    print("\n=== LINE CONTEXT ===")
    start = max(0, error_line - 6)
    end = min(len(lines), error_line + 5)
    for i in range(start, end):
        marker = ">>>" if i == error_line - 1 else "   "
        print(f"{marker} Line {i + 1}: {lines[i]}")


def validate_all_fstrings(code_text: str) -> None:
    print("\n=== F-STRING SCAN ===")
    lines = code_text.split("\n")
    issues_found = False
    for idx, line in enumerate(lines, start=1):
        if "f\"" in line or "f'" in line or "f\"\"\"" in line or "f'''" in line:
            normalized = line.replace("{{", "").replace("}}", "")
            if re.search(r"{\s*}", normalized):
                issues_found = True
                print(f"Line {idx}: empty expression in f-string")
                print(f"  {line}")
            brace_balance = normalized.count("{") - normalized.count("}")
            if brace_balance != 0:
                issues_found = True
                print(f"Line {idx}: unbalanced braces in f-string")
                print(f"  {line}")
    if not issues_found:
        print("No obvious f-string issues detected.")


def main() -> None:
    state = initial_state("debug_run", "Build a simple website")
    state["domain"] = "website_builder"

    print_header("planner")
    planned = planner_node(state)
    spec = planned.get("spec", {})
    print(json.dumps(spec, indent=2))

    print_header("template loading")
    domain = spec.get("domain")
    try:
        template_path, template_text = load_template(domain)
        print("template_path:", template_path)
        print("template_len:", len(template_text))
    except Exception as exc:
        print("template_error:", exc)
        return

    print_header("template rendering")
    context = {
        "run_id": planned.get("run_id"),
        "goal": spec.get("goal"),
        "domain": spec.get("domain"),
        "steps": spec.get("steps", []),
        "tools": spec.get("tools", []),
        "inputs": spec.get("inputs", []),
        "outputs": spec.get("outputs", []),
        "complexity": spec.get("complexity"),
        "success_criteria": spec.get("success_criteria"),
        "sub_agent_results": {},
    }

    try:
        rendered = render_template(template_text, context)
        print("render_len:", len(rendered))
        print("render_preview:\n", preview(rendered))
    except Exception as exc:
        print("render_error:", exc)
        return

    print_header("sub-agent execution")
    steps = spec.get("steps", [])
    step_map = {f"step_{i + 1}": {"order": i + 1, "text": step, "tools": spec.get("tools", [])} for i, step in enumerate(steps)}
    sub_agent_results = {}
    for step_id, step_data in step_map.items():
        result = execute_sub_agent(
            step_id=step_id,
            step_data=step_data,
            total_steps=len(step_map),
            previous_results=sub_agent_results,
        )
        sub_agent_results[step_id] = result
        print(step_id, "status:", result.get("status"))

    print_header("marker validation")
    missing_markers = []
    for step_id in step_map:
        marker = f"\"\"\"BUILDER_INJECT:{step_id}\"\"\""
        if marker not in rendered:
            missing_markers.append(step_id)
    print("missing_markers:", missing_markers)

    print_header("code injection")
    final_code = inject_code(rendered, sub_agent_results)
    print("final_code_len:", len(final_code))
    print("final_preview:\n", preview(final_code))

    print_header("post checks")
    unresolved = False
    unresolved_line = ""
    for line in final_code.splitlines():
        if "{%%" in line or "%%}" in line:
            unresolved = True
            unresolved_line = line
            break
        if ("f\"" in line or "f'" in line or "f\"\"\"" in line or "f'''" in line):
            continue
        if "{{" in line or "}}" in line:
            unresolved = True
            unresolved_line = line
            break

    checks = {
        "empty": not final_code.strip(),
        "unresolved_jinja": unresolved,
        "unresolved_line": unresolved_line.strip(),
        "unresolved_marker": "BUILDER_INJECT:step_" in final_code,
        "todo": "TODO" in final_code,
        "missing_markers": missing_markers,
    }
    print(json.dumps(checks, indent=2))

    print_header("syntax validation")
    try:
        ast.parse(final_code)
        print("syntax_ok: True")
    except Exception as exc:
        print("syntax_ok: False")
        print("syntax_error:", exc)
        if isinstance(exc, SyntaxError) and exc.lineno:
            diagnose_fstring_error(final_code, exc.lineno)
        validate_all_fstrings(final_code)

    print_header("output location")
    output_dir = Path(__file__).resolve().parents[1] / "src" / "generated_agents"
    print("generated_agents_dir:", output_dir)


if __name__ == "__main__":
    main()
