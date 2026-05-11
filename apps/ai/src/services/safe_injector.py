"""
Safe Code Injector
Injects content into Python agent templates using serialization layer
Prevents syntax errors from unsafe string embedding
"""

import json
from typing import Dict, Any
from services.code_serializer import serialize_for_domain, CodeSerializer
from services.code_sanitizer import pre_syntax_check


class SafeCodeInjector:
    """Safely inject content into Python agent code"""

    AGENT_TEMPLATE = '''import os
import json
from datetime import datetime, timezone

# ── Injected Metadata ──────────────────────────────────────
RUN_ID = "{run_id}"
OUTPUT_DIR = "{output_dir}"
DOMAIN = "{domain}"
GOAL = "{goal}"
COMPLEXITY = "{complexity}"
SUCCESS_CRITERIA = "{success_criteria}"
STEPS = {steps}
TOOLS = {tools}
INPUTS = []
OUTPUTS = []

{content_section}

# ── Sub-Agent Functions ────────────────────────────────────
{agent_functions}

# ── Main Execution ─────────────────────────────────────────
def main():
    """Execute agent pipeline"""
    print(f"Starting {{DOMAIN}} pipeline: {{GOAL}}")

    try:
{main_body}

        # Save output
        save_output(final_result)
        return final_result

    except Exception as e:
        print(f"Execution error: {{str(e)}}")
        raise

def save_output(data):
    """Save final output to file"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    extensions = {{
        "website_builder": "html",
        "document": "md",
        "web_research": "txt",
        "data_transform": "json"
    }}
    ext = extensions.get(DOMAIN, "txt")

    filepath = f"{{OUTPUT_DIR}}/{{RUN_ID}}_{{DOMAIN}}.{{ext}}"

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(str(data))

    print(f"Saved to {{filepath}}")

if __name__ == "__main__":
    main()
'''

    @staticmethod
    def inject_safe(
        domain: str,
        goal: str,
        steps: list,
        tools: list,
        content: Dict[str, Any],
        agent_functions: str,
        main_body: str,
        run_id: str = "ui_generated",
        complexity: str = "simple",
        success_criteria: str = "Task completed"
    ) -> str:
        """
        Safely inject content into agent template

        Returns:
            Complete Python agent code
        """
        content_section = serialize_for_domain(domain, **content)

        serializer = CodeSerializer()
        steps_safe = json.dumps(steps)
        tools_safe = json.dumps(tools)

        code = SafeCodeInjector.AGENT_TEMPLATE.format(
            run_id=run_id,
            output_dir="output",
            domain=domain,
            goal=serializer.escape_for_python(goal),
            complexity=complexity,
            success_criteria=serializer.escape_for_python(success_criteria),
            steps=steps_safe,
            tools=tools_safe,
            content_section=content_section,
            agent_functions=agent_functions,
            main_body=main_body
        )

        return code

    @staticmethod
    def build_website_agent(
        goal: str,
        html: str,
        css: str = "",
        js: str = "",
        run_id: str = "ui_generated"
    ) -> str:
        """Build website_builder domain agent"""

        agent_functions = '''def step_1_generate_page():
    """Generate complete HTML page"""
    full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{GOAL}</title>
    <style>
    {CSS_CONTENT}
    </style>
</head>
<body>
{HTML_CONTENT}
    <script>
    {JS_CONTENT}
    </script>
</body>
</html>"""
    return full_html
'''

        main_body = '''        # Step 1: Generate page
        result = step_1_generate_page()
        print(f"Generated HTML: {len(result)} chars")

        final_result = result'''

        return SafeCodeInjector.inject_safe(
            domain="website_builder",
            goal=goal,
            steps=["Generate HTML page"],
            tools=["generate", "code"],
            content={"html": html, "css": css, "js": js},
            agent_functions=agent_functions,
            main_body=main_body,
            run_id=run_id
        )

    @staticmethod
    def build_research_agent(
        goal: str,
        query: str,
        run_id: str = "ui_generated"
    ) -> str:
        """Build web_research domain agent"""

        agent_functions = '''def step_1_search():
    """Search for information"""
    import requests
    sources = []
    search_url = f"https://www.google.com/search?q={RESEARCH_CONTENT}"
    try:
        resp = requests.get(search_url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
        sources.append({"url": search_url, "status": resp.status_code, "length": len(resp.text)})
    except Exception as e:
        sources.append({"error": str(e)})
    return json.dumps(sources, indent=2)

def step_2_summarize(search_results):
    """Summarize findings into a report"""
    report = f"""# Research Report: {GOAL}

## Sources Found
{search_results}

## Summary
Research completed for: {RESEARCH_CONTENT}

Generated: {datetime.now(timezone.utc).isoformat()}
"""
    return report
'''

        main_body = '''        # Step 1: Search
        search_results = step_1_search()
        print(f"Search complete: {len(search_results)} chars")

        # Step 2: Summarize (using step 1 output)
        summary = step_2_summarize(search_results)
        print(f"Summary complete: {len(summary)} chars")

        final_result = summary'''

        return SafeCodeInjector.inject_safe(
            domain="web_research",
            goal=goal,
            steps=["Search for information", "Summarize findings"],
            tools=["search", "summarize"],
            content={"content": query},
            agent_functions=agent_functions,
            main_body=main_body,
            run_id=run_id
        )

    @staticmethod
    def build_document_agent(
        goal: str,
        topic: str,
        run_id: str = "ui_generated"
    ) -> str:
        """Build document domain agent"""

        agent_functions = '''def step_1_research():
    """Research topic and gather key points"""
    key_points = [
        f"Overview of {DOCUMENT_CONTENT}",
        f"Key aspects and considerations",
        f"Current trends and developments",
        f"Best practices and recommendations",
        f"Future outlook and implications",
    ]
    return key_points

def step_2_format_report(findings):
    """Format findings as a structured report"""
    sections = "\\n".join(f"- {point}" for point in findings)
    report = f"""# Technical Report: {GOAL}

## Executive Summary
This report covers the key aspects of: {DOCUMENT_CONTENT}

## Key Findings
{sections}

## Conclusion
Report generated on {datetime.now(timezone.utc).isoformat()}
"""
    return report
'''

        main_body = '''        # Step 1: Research
        findings = step_1_research()
        print(f"Research complete: {len(findings)} points")

        # Step 2: Format report (using step 1 output)
        report = step_2_format_report(findings)
        print(f"Report complete: {len(report)} chars")

        final_result = report'''

        return SafeCodeInjector.inject_safe(
            domain="document",
            goal=goal,
            steps=["Research topic", "Format report"],
            tools=["generate", "summarize"],
            content={"content": topic},
            agent_functions=agent_functions,
            main_body=main_body,
            run_id=run_id
        )

    @staticmethod
    def build_data_agent(
        goal: str,
        data: Any,
        run_id: str = "ui_generated"
    ) -> str:
        """Build data_transform domain agent"""

        agent_functions = '''def step_1_parse():
    """Parse input data"""
    return DATA_PARSED

def step_2_transform(data):
    """Transform data into output format"""
    if isinstance(data, dict):
        result = {k: v for k, v in sorted(data.items())}
    elif isinstance(data, list):
        result = sorted(data, key=lambda x: str(x))
    else:
        result = data
    return json.dumps(result, indent=2, ensure_ascii=False)
'''

        main_body = '''        # Step 1: Parse input
        data = step_1_parse()
        print(f"Parsed data: {type(data).__name__}")

        # Step 2: Transform (using step 1 output)
        transformed = step_2_transform(data)
        print(f"Transform complete: {len(transformed)} chars")

        final_result = transformed'''

        return SafeCodeInjector.inject_safe(
            domain="data_transform",
            goal=goal,
            steps=["Parse input data", "Transform to output"],
            tools=["analyze", "code", "validate"],
            content={"content": data},
            agent_functions=agent_functions,
            main_body=main_body,
            run_id=run_id
        )

    @staticmethod
    def build_and_validate(domain: str, **kwargs) -> Dict[str, Any]:
        """
        Build agent and validate before returning

        Returns:
            {"code": str, "valid": bool, "warnings": list, "error": str|None}
        """
        builders = {
            "website_builder": SafeCodeInjector.build_website_agent,
            "web_research": SafeCodeInjector.build_research_agent,
            "document": SafeCodeInjector.build_document_agent,
            "data_transform": SafeCodeInjector.build_data_agent,
        }

        builder = builders.get(domain)
        if not builder:
            return {
                "code": None,
                "valid": False,
                "warnings": [],
                "error": f"Unknown domain: {domain}"
            }

        code = builder(**kwargs)

        sanitized_code, warnings, is_safe = pre_syntax_check(code)

        return {
            "code": sanitized_code,
            "valid": is_safe,
            "warnings": warnings,
            "error": None if is_safe else "Syntax validation failed"
        }
