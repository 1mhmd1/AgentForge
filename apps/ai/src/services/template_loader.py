from pathlib import Path

from services.errors import ERROR_CODES, SUPPORTED_DOMAINS


def load_template(domain: str) -> tuple[str, str]:
    domain_map = {
        "web_research": "web-research",
        "document": "document",
        "data_transform": "data-transform",
        "website_builder": "website-builder",
    }

    if not isinstance(domain, str) or not domain.strip():
        raise RuntimeError(f"{ERROR_CODES['TEMPLATE_NOT_FOUND']}:missing_domain")

    normalized = domain.strip().lower()
    if normalized not in SUPPORTED_DOMAINS:
        raise RuntimeError(f"{ERROR_CODES['TEMPLATE_NOT_FOUND']}:{normalized}")
    folder = domain_map.get(normalized)
    if not folder:
        raise RuntimeError(f"{ERROR_CODES['TEMPLATE_NOT_FOUND']}:{normalized}")

    base_dir = Path(__file__).resolve().parents[1]
    template_path = base_dir / "templates" / folder / "base.j2"

    if not template_path.exists():
        raise RuntimeError(f"{ERROR_CODES['TEMPLATE_NOT_FOUND']}:{normalized}")

    template_text = template_path.read_text(encoding="utf-8")
    if not isinstance(template_text, str) or not template_text.strip():
        raise RuntimeError(ERROR_CODES["TEMPLATE_EMPTY"])

    return str(template_path), template_text
