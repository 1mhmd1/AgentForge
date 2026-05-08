"""
Quality tests: indentation normalization, placeholder detection,
import detection, quality scoring, and code injector integration.
"""
import sys
import ast

sys.path.append("c:/Users/1mhmd/OneDrive/Desktop/Ai Projects/AgentForge/apps/ai/src")

from services.code_injector import inject_code, _reindent, _detect_indent
from services.snippet_validator import detect_placeholders, detect_missing_imports, score_quality


def test_indent_detection():
    print("\n=== indent detection ===")
    assert _detect_indent("    hello") == "    "
    assert _detect_indent("hello") == ""
    assert _detect_indent("        x") == "        "
    assert _detect_indent("") == ""
    print("  [PASS]")


def test_reindent_basic():
    print("\n=== reindent basic ===")
    snippet = "x = 1\ny = 2\nz = x + y"
    result = _reindent(snippet, "    ")
    lines = result.splitlines()
    assert lines[0] == "    x = 1", f"got: {lines[0]}"
    assert lines[1] == "    y = 2", f"got: {lines[1]}"
    assert lines[2] == "    z = x + y", f"got: {lines[2]}"
    print("  [PASS]")


def test_reindent_with_existing_indent():
    print("\n=== reindent with existing indent ===")
    snippet = "    x = 1\n    y = 2"
    result = _reindent(snippet, "        ")
    lines = result.splitlines()
    assert lines[0] == "        x = 1", f"got: {lines[0]}"
    assert lines[1] == "        y = 2", f"got: {lines[1]}"
    print("  [PASS]")


def test_reindent_blank_lines():
    print("\n=== reindent blank lines ===")
    snippet = "x = 1\n\ny = 2"
    result = _reindent(snippet, "    ")
    lines = result.splitlines()
    assert lines[0] == "    x = 1"
    assert lines[1] == ""
    assert lines[2] == "    y = 2"
    print("  [PASS]")


def test_injection_indentation():
    print("\n=== injection indentation ===")
    template = 'def execute_step_1():\n    """Step 1"""\n\n    """BUILDER_INJECT:step_1"""\n'
    sub_results = {
        "step_1": {
            "generated_code": "result = 42\nprint(result)",
            "status": "success",
        }
    }
    injected = inject_code(template, sub_results)
    print(f"  injected:\n{injected}")

    try:
        ast.parse(injected)
        print("  [PASS] AST parse successful")
    except SyntaxError as e:
        print(f"  [FAIL] SyntaxError: {e}")
        raise

    assert "    result = 42" in injected, "indentation not applied"
    assert "    print(result)" in injected, "indentation not applied"
    print("  [PASS] indentation correct")


def test_injection_multiline_indent():
    print("\n=== injection multiline with nested indent ===")
    template = 'def run():\n    """BUILDER_INJECT:step_1"""\n'
    sub_results = {
        "step_1": {
            "generated_code": "for i in range(10):\n    print(i)\nprint('done')",
            "status": "success",
        }
    }
    injected = inject_code(template, sub_results)
    print(f"  injected:\n{injected}")

    try:
        ast.parse(injected)
        print("  [PASS] AST parse successful")
    except SyntaxError as e:
        print(f"  [FAIL] SyntaxError: {e}")
        raise


def test_injection_empty_code():
    print("\n=== injection empty code ===")
    template = 'def run():\n    """BUILDER_INJECT:step_1"""\n'
    sub_results = {
        "step_1": {
            "generated_code": "",
            "status": "success",
        }
    }
    injected = inject_code(template, sub_results)
    print(f"  injected:\n{injected}")

    try:
        ast.parse(injected)
        print("  [PASS] AST parse successful (empty -> pass)")
    except SyntaxError as e:
        print(f"  [FAIL] SyntaxError: {e}")
        raise

    assert "    pass" in injected, "empty code should become 'pass'"
    print("  [PASS]")


def test_placeholder_detection():
    print("\n=== placeholder detection ===")
    bad_code = "hero = create_hero_section()\nmenu = build_menu()"
    violations = detect_placeholders(bad_code)
    print(f"  violations: {violations}")
    assert len(violations) >= 2, f"expected >=2 violations, got {len(violations)}"
    print("  [PASS] placeholder calls detected")

    good_code = "x = 42\nprint(x)\nfor i in range(5):\n    print(i)"
    violations2 = detect_placeholders(good_code)
    print(f"  good code violations: {violations2}")
    assert len(violations2) == 0, f"false positives: {violations2}"
    print("  [PASS] clean code has no violations")


def test_placeholder_with_definition():
    print("\n=== placeholder with definition (should pass) ===")
    code = "def create_hero_section():\n    return '<section>Hero</section>'\n\nhero = create_hero_section()"
    violations = detect_placeholders(code)
    print(f"  violations: {violations}")
    assert len(violations) == 0, f"defined function flagged as placeholder: {violations}"
    print("  [PASS]")


def test_todo_detection():
    print("\n=== TODO detection ===")
    code = "x = 42\n# TODO implement this\nprint(x)"
    violations = detect_placeholders(code)
    print(f"  violations: {violations}")
    assert len(violations) >= 1, f"TODO not detected"
    print("  [PASS]")


def test_pass_only_detection():
    print("\n=== pass-only detection ===")
    code = "pass"
    violations = detect_placeholders(code)
    print(f"  violations: {violations}")
    assert len(violations) >= 1, f"pass-only not detected"
    print("  [PASS]")


def test_missing_import_detection():
    print("\n=== missing import detection ===")
    bad_code = "response = requests.get('https://example.com')\ndata = response.json()"
    missing = detect_missing_imports(bad_code)
    print(f"  missing: {missing}")
    assert "requests" in missing, f"requests not detected as missing"
    print("  [PASS] requests flagged as missing")

    good_code = "import requests\nresponse = requests.get('https://example.com')"
    missing2 = detect_missing_imports(good_code)
    print(f"  good code missing: {missing2}")
    assert len(missing2) == 0, f"false positive: {missing2}"
    print("  [PASS] import present = no flags")


def test_quality_scoring_high():
    print("\n=== quality scoring — high quality ===")
    code = """import os
import json

def process_data(input_path):
    if not os.path.exists(input_path):
        return None
    with open(input_path, 'r') as f:
        data = json.load(f)
    for item in data:
        item['processed'] = True
    return data

result = process_data('data.json')
if result:
    print(f"Processed {len(result)} items")
"""
    score = score_quality(code, "data_transform")
    print(f"  score: {score}")
    assert score["implementation_quality"] >= 0.5, f"quality too low: {score['implementation_quality']}"
    assert not score["has_placeholders"], "false positive placeholders"
    assert not score["has_missing_imports"], "false positive missing imports"
    print("  [PASS]")


def test_quality_scoring_low():
    print("\n=== quality scoring — low quality ===")
    code = "pass"
    score = score_quality(code, "general")
    print(f"  score: {score}")
    assert score["implementation_quality"] < 0.5, f"quality too high for 'pass': {score['implementation_quality']}"
    assert score["has_placeholders"], "pass-only not detected"
    print("  [PASS]")


def test_website_quality_scoring():
    print("\n=== website quality scoring ===")
    code = """hero_html = '''
<section class="hero">
  <h1>Welcome to Coffee Shop</h1>
  <nav><a href="#menu">Menu</a></nav>
  <div class="content">Our finest beans</div>
</section>
'''
"""
    score = score_quality(code, "website_builder")
    print(f"  score: {score}")
    assert score["semantic_completeness"] >= 0.5, f"semantic too low: {score['semantic_completeness']}"
    assert not score["has_placeholders"], "false positive placeholders"
    print("  [PASS]")


if __name__ == "__main__":
    print("=" * 60)
    print("QUALITY TESTS")
    print("=" * 60)

    test_indent_detection()
    test_reindent_basic()
    test_reindent_with_existing_indent()
    test_reindent_blank_lines()
    test_injection_indentation()
    test_injection_multiline_indent()
    test_injection_empty_code()
    test_placeholder_detection()
    test_placeholder_with_definition()
    test_todo_detection()
    test_pass_only_detection()
    test_missing_import_detection()
    test_quality_scoring_high()
    test_quality_scoring_low()
    test_website_quality_scoring()

    print("\n" + "=" * 60)
    print("ALL 15 QUALITY TESTS PASSED")
    print("=" * 60)
