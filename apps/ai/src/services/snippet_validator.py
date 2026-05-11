import re
from typing import Any


PLACEHOLDER_PATTERNS = [
    r'\bcreate_\w+\s*\(',
    r'\bbuild_\w+\s*\(',
    r'\bimplement_\w+\s*\(',
    r'\bsetup_\w+\s*\(',
    r'\bhandle_\w+\s*\(',
    r'\bprocess_\w+\s*\(',
    r'\bgenerate_\w+_section\s*\(',
    r'\bapply_\w+_css\s*\(',
    r'#\s*TODO\b',
    r'#\s*FIXME\b',
    r'\bplaceholder\b',
    r'\bdummy\b',
    r'\bimplement\s+later\b',
]

KNOWN_THIRD_PARTY = {
    "requests": r'\brequests\.',
    "pandas": r'\bpd\.|import pandas',
    "numpy": r'\bnp\.|import numpy',
    "bs4": r'\bBeautifulSoup\b',
    "flask": r'\bFlask\b',
    "fastapi": r'\bFastAPI\b',
}


def detect_placeholders(code: str) -> list[str]:
    violations: list[str] = []
    lines = code.splitlines()

    for pattern in PLACEHOLDER_PATTERNS:
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith('#') and 'TODO' not in pattern and 'FIXME' not in pattern:
                continue
            if stripped.startswith('"""') or stripped.startswith("'''"):
                continue
            matches = re.findall(pattern, line, re.IGNORECASE)
            for match in matches:
                func_name = match.strip().rstrip('(').strip()
                if not _is_function_defined(code, func_name):
                    violations.append(f"line {i}: {match.strip()}")

    body_lines = [l.strip() for l in lines if l.strip() and not l.strip().startswith('#') and not l.strip().startswith('"""') and not l.strip().startswith("'''")]
    if len(body_lines) == 1 and body_lines[0] == 'pass':
        violations.append("only statement is 'pass'")
    if len(body_lines) == 1 and body_lines[0] == '...':
        violations.append("only statement is '...'")

    return violations


def _is_function_defined(code: str, func_name: str) -> bool:
    if not func_name:
        return True
    pattern = rf'def\s+{re.escape(func_name)}\s*\('
    return bool(re.search(pattern, code))


def detect_missing_imports(code: str) -> list[str]:
    missing: list[str] = []
    for module, usage_pattern in KNOWN_THIRD_PARTY.items():
        if re.search(usage_pattern, code):
            import_patterns = [
                rf'^\s*import\s+{re.escape(module)}\b',
                rf'^\s*from\s+{re.escape(module)}\b',
            ]
            if module == "bs4":
                import_patterns.append(r'^\s*from\s+bs4\s+import')
            if module == "pandas":
                import_patterns.append(r'^\s*import\s+pandas\b')
            if module == "numpy":
                import_patterns.append(r'^\s*import\s+numpy\b')

            has_import = any(
                re.search(pat, code, re.MULTILINE)
                for pat in import_patterns
            )
            if not has_import:
                missing.append(module)
    return missing


def score_quality(code: str, domain: str | None = None) -> dict[str, Any]:
    placeholders = detect_placeholders(code)
    missing_imports = detect_missing_imports(code)

    lines = code.splitlines()
    code_lines = [l for l in lines if l.strip() and not l.strip().startswith('#')]
    code_length = len(code)

    length_score = min(1.0, code_length / 2000)

    logic_indicators = ['if ', 'for ', 'while ', 'return ', '= ', 'def ', 'class ']
    logic_lines = sum(1 for l in code_lines if any(ind in l for ind in logic_indicators))
    logic_ratio = logic_lines / max(len(code_lines), 1)

    implementation_quality = round(
        (0.3 * length_score + 0.4 * logic_ratio + 0.3 * (1.0 if not placeholders else 0.0)),
        2,
    )

    semantic_completeness = 1.0
    if domain == "website_builder":
        checks = {
            "has_html": bool(re.search(r'<\w+[>\s]', code)),
            "has_css": bool(re.search(r'[{};].*:', code) or 'style' in code.lower()),
            "has_heading": bool(re.search(r'<h[1-3]', code)),
            "has_section": bool(re.search(r'<(section|div|main|header)', code)),
        }
        passed = sum(1 for v in checks.values() if v)
        semantic_completeness = round(passed / len(checks), 2)
    elif domain == "web_research":
        checks = {
            "has_url": bool(re.search(r'https?://', code)),
            "has_request": bool(re.search(r'requests?\.(get|post)', code) or 'fetch' in code.lower()),
        }
        passed = sum(1 for v in checks.values() if v)
        semantic_completeness = round(passed / max(len(checks), 1), 2)

    return {
        "implementation_quality": implementation_quality,
        "semantic_completeness": semantic_completeness,
        "has_placeholders": len(placeholders) > 0,
        "has_missing_imports": len(missing_imports) > 0,
        "placeholder_violations": placeholders,
        "missing_imports": missing_imports,
        "code_lines": len(code_lines),
        "code_length": code_length,
    }
