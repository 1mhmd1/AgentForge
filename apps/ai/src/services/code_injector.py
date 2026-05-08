from typing import Any

from services.errors import ERROR_CODES


def inject_code(rendered_template: str, sub_agent_results: dict[str, Any]) -> str:
    if not isinstance(rendered_template, str):
        raise RuntimeError("rendered_template is not a string")

    required_markers = []
    for step_id in sub_agent_results.keys():
        required_markers.append(f"\"\"\"BUILDER_INJECT:{step_id}\"\"\"")

    missing = [marker for marker in required_markers if marker not in rendered_template]
    if missing:
        missing_ids = [marker.replace('"""BUILDER_INJECT:', '').replace('"""', '') for marker in missing]
        raise RuntimeError(f"{ERROR_CODES['MARKER_MISSING']}:{','.join(missing_ids)}")

    final_code = rendered_template
    for step_id, result in sub_agent_results.items():
        generated_code = str(result.get("generated_code", ""))
        marker = f"\"\"\"BUILDER_INJECT:{step_id}\"\"\""
        final_code = final_code.replace(marker, generated_code)

    cleaned_lines: list[str] = []
    for line in final_code.splitlines():
        if "BUILDER_INJECT:" in line:
            cleaned_lines.append(line.replace(line.strip(), ""))
        else:
            cleaned_lines.append(line)

    return "\n".join(cleaned_lines)
