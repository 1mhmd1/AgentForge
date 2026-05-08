from typing import Any

from jinja2 import Template, StrictUndefined

from services.errors import ERROR_CODES


def render_template(template_text: str, context: dict[str, Any]) -> str:
    try:
        if not isinstance(template_text, str) or not template_text.strip():
            raise RuntimeError("Template is empty")
        template = Template(template_text, undefined=StrictUndefined)
        rendered = template.render(**context)
        return str(rendered)
    except Exception as exc:
        raise RuntimeError(f"{ERROR_CODES['RENDER_ERROR']}:{exc}") from exc
