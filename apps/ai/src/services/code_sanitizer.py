"""
Code Sanitization Service
Pre-syntax validation cleanup
Catches common injection issues before Python parser sees them
"""

import re
from typing import Tuple, List, Dict


class CodeSanitizer:
    """Sanitizes generated Python code before syntax validation"""

    @staticmethod
    def sanitize_generated_code(code: str) -> Tuple[str, List[str]]:
        """
        Sanitize generated Python code

        Returns:
            (sanitized_code, warnings)
        """
        warnings = []

        code, quote_warnings = CodeSanitizer._check_triple_quotes(code)
        warnings.extend(quote_warnings)

        code, indent_warnings = CodeSanitizer._fix_indentation(code)
        warnings.extend(indent_warnings)

        code, html_warnings = CodeSanitizer._check_raw_html(code)
        warnings.extend(html_warnings)

        code, css_warnings = CodeSanitizer._check_raw_css(code)
        warnings.extend(css_warnings)

        code, print_warnings = CodeSanitizer._check_module_prints(code)
        warnings.extend(print_warnings)

        return code, warnings

    @staticmethod
    def _check_triple_quotes(code: str) -> Tuple[str, List[str]]:
        """Check for unmatched triple quotes"""
        warnings = []

        double_quotes = code.count('"""')
        single_quotes = code.count("'''")

        if double_quotes % 2 != 0:
            warnings.append(f"Unmatched triple double quotes: {double_quotes} found")

        if single_quotes % 2 != 0:
            warnings.append(f"Unmatched triple single quotes: {single_quotes} found")

        return code, warnings

    @staticmethod
    def _fix_indentation(code: str) -> Tuple[str, List[str]]:
        """Fix broken indentation"""
        warnings = []
        lines = code.split('\n')
        fixed_lines = []

        for i, line in enumerate(lines):
            if '\t' in line and ' ' in line[:len(line) - len(line.lstrip())]:
                warnings.append(f"Line {i+1}: Mixed tabs and spaces")
                line = line.replace('\t', '    ')

            leading_spaces = len(line) - len(line.lstrip())
            if leading_spaces > 0 and leading_spaces % 4 != 0:
                correct_indent = (leading_spaces // 4) * 4
                warnings.append(f"Line {i+1}: Indentation {leading_spaces} -> {correct_indent}")
                line = ' ' * correct_indent + line.lstrip()

            fixed_lines.append(line)

        return '\n'.join(fixed_lines), warnings

    @staticmethod
    def _check_raw_html(code: str) -> Tuple[str, List[str]]:
        """Check for raw HTML outside strings"""
        warnings = []
        lines = code.split('\n')

        html_pattern = re.compile(r'^[\s]*<[a-zA-Z\/][^>]*>[\s]*$')

        in_string = False
        for i, line in enumerate(lines):
            stripped = line.strip()
            triple_count = stripped.count('"""') + stripped.count("'''")
            if triple_count % 2 != 0:
                in_string = not in_string

            if in_string:
                continue

            if html_pattern.match(line):
                warnings.append(f"Line {i+1}: Raw HTML outside string: {stripped[:50]}")

        return code, warnings

    @staticmethod
    def _check_raw_css(code: str) -> Tuple[str, List[str]]:
        """Check for raw CSS outside strings"""
        warnings = []
        lines = code.split('\n')

        css_pattern = re.compile(r'^[\s]*[a-z-]+[\s]*:[\s]*[^;]+;[\s]*$')

        in_string = False
        for i, line in enumerate(lines):
            stripped = line.strip()
            triple_count = stripped.count('"""') + stripped.count("'''")
            if triple_count % 2 != 0:
                in_string = not in_string

            if in_string:
                continue

            if css_pattern.match(line) and '{' not in line:
                warnings.append(f"Line {i+1}: Raw CSS outside string: {stripped[:50]}")

        return code, warnings

    @staticmethod
    def _check_module_prints(code: str) -> Tuple[str, List[str]]:
        """Check for print statements at module level"""
        warnings = []
        lines = code.split('\n')

        in_function = False
        in_class = False
        indent_stack = [0]

        for i, line in enumerate(lines):
            stripped = line.lstrip()
            indent = len(line) - len(stripped)

            if stripped.startswith('def '):
                in_function = True
                indent_stack.append(indent)
            elif stripped.startswith('class '):
                in_class = True
                indent_stack.append(indent)
            elif indent <= indent_stack[-1] and len(indent_stack) > 1:
                indent_stack.pop()
                if len(indent_stack) == 1:
                    in_function = False
                    in_class = False

            if stripped.startswith('print(') and not in_function and not in_class:
                warnings.append(f"Line {i+1}: Module-level print statement")

        return code, warnings

    @staticmethod
    def validate_python_syntax(code: str) -> Dict:
        """
        Validate Python syntax without executing

        Returns:
            {"valid": bool, "error": str|None, "line": int|None, "offset": int|None}
        """
        try:
            compile(code, '<string>', 'exec')
            return {"valid": True, "error": None, "line": None, "offset": None}
        except SyntaxError as e:
            return {
                "valid": False,
                "error": str(e.msg),
                "line": e.lineno,
                "offset": e.offset,
                "text": e.text
            }
        except Exception as e:
            return {
                "valid": False,
                "error": str(e),
                "line": None,
                "offset": None
            }


def pre_syntax_check(code: str) -> Tuple[str, List[str], bool]:
    """
    Complete pre-syntax validation pipeline

    Returns:
        (sanitized_code, warnings, is_safe)
    """
    sanitized, warnings = CodeSanitizer.sanitize_generated_code(code)

    validation = CodeSanitizer.validate_python_syntax(sanitized)

    if not validation["valid"]:
        warnings.append(
            f"Syntax Error at line {validation['line']}: {validation['error']}"
        )
        return sanitized, warnings, False

    return sanitized, warnings, True
