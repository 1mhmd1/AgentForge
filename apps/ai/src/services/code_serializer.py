"""
Code Serialization Service
Safely serializes content for injection into Python agents
Prevents syntax errors from unsafe string embedding
"""

import json
import textwrap
from typing import Any, Dict


class CodeSerializer:
    """Serializes various content types for safe Python injection"""

    @staticmethod
    def serialize_python_string(content: str) -> str:
        """
        Serialize string content safely for Python code
        Handles quotes, newlines, special characters
        """
        escaped = content.replace('"""', r'\"\"\"')
        return f'"""{escaped}"""'

    @staticmethod
    def serialize_html(html: str) -> str:
        """
        Serialize HTML safely for Python string
        Prevents quote conflicts and indentation issues
        """
        html = html.strip()
        html = html.replace('"""', r'\"\"\"')

        if "'''" not in html and '"""' not in html:
            return f'"""{html}"""'
        else:
            return json.dumps(html)

    @staticmethod
    def serialize_css(css: str) -> str:
        """
        Serialize CSS safely for Python string
        Critical: CSS has {} which conflicts with f-strings
        """
        css = css.strip()
        css = css.replace('"""', r'\"\"\"')
        return f'"""{css}"""'

    @staticmethod
    def serialize_json(data: Any) -> str:
        """
        Serialize JSON data safely
        Returns Python string containing JSON
        """
        json_str = json.dumps(data, indent=2, ensure_ascii=False)
        return CodeSerializer.serialize_python_string(json_str)

    @staticmethod
    def wrap_multiline(content: str, indent_level: int = 0) -> str:
        """
        Wrap multiline content with proper indentation
        """
        indent = "    " * indent_level
        lines = content.split('\n')
        wrapped = '\n'.join(f"{indent}{line}" if line.strip() else "" for line in lines)
        return wrapped

    @staticmethod
    def escape_for_python(text: str) -> str:
        """
        Escape string for embedding in Python code
        Handles backslashes, quotes, newlines
        """
        text = text.replace('\\', '\\\\')
        text = text.replace('"', '\\"')
        text = text.replace("'", "\\'")
        text = text.replace('\n', '\\n')
        text = text.replace('\r', '\\r')
        text = text.replace('\t', '\\t')
        return text


class DomainSerializer:
    """Domain-specific serialization wrappers"""

    @staticmethod
    def wrap_html(html: str, css: str = "", js: str = "") -> str:
        """
        Wrap HTML/CSS/JS into safe Python constants
        Returns Python code defining HTML_CONTENT, CSS_CONTENT, JS_CONTENT
        """
        serializer = CodeSerializer()

        html_safe = serializer.serialize_html(html)
        css_safe = serializer.serialize_css(css) if css else '""'
        js_safe = serializer.serialize_python_string(js) if js else '""'

        code = f'''# ── Website Content ──────────────────────────────────────
HTML_CONTENT = {html_safe}

CSS_CONTENT = {css_safe}

JS_CONTENT = {js_safe}
'''
        return code

    @staticmethod
    def wrap_markdown(markdown: str) -> str:
        """Wrap markdown content safely"""
        serializer = CodeSerializer()
        md_safe = serializer.serialize_python_string(markdown)

        code = f'''# ── Document Content ─────────────────────────────────────
DOCUMENT_CONTENT = {md_safe}
'''
        return code

    @staticmethod
    def wrap_text(text: str) -> str:
        """Wrap plain text content safely"""
        serializer = CodeSerializer()
        text_safe = serializer.serialize_python_string(text)

        code = f'''# ── Research Content ─────────────────────────────────────
RESEARCH_CONTENT = {text_safe}
'''
        return code

    @staticmethod
    def wrap_json(data: Any) -> str:
        """Wrap JSON data safely"""
        serializer = CodeSerializer()
        json_safe = serializer.serialize_json(data)

        code = f'''# ── Data Content ─────────────────────────────────────────
import json

DATA_CONTENT = {json_safe}
DATA_PARSED = json.loads(DATA_CONTENT)
'''
        return code


# Domain wrapper mapping
DOMAIN_WRAPPERS = {
    "website_builder": DomainSerializer.wrap_html,
    "document": DomainSerializer.wrap_markdown,
    "web_research": DomainSerializer.wrap_text,
    "data_transform": DomainSerializer.wrap_json,
}


def serialize_for_domain(domain: str, **content) -> str:
    """
    Serialize content for specific domain

    Args:
        domain: One of website_builder, document, web_research, data_transform
        **content: Domain-specific content kwargs

    Returns:
        Safe Python code defining content constants
    """
    if domain not in DOMAIN_WRAPPERS:
        raise ValueError(f"Unknown domain: {domain}")

    wrapper = DOMAIN_WRAPPERS[domain]

    if domain == "website_builder":
        return wrapper(
            content.get("html", ""),
            content.get("css", ""),
            content.get("js", "")
        )
    else:
        return wrapper(content.get("content", ""))
