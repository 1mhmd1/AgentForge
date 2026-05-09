import os
import json
from datetime import datetime, timezone

# ── Injected Metadata ──────────────────────────────────────
RUN_ID = "ui_d96a71e0"
OUTPUT_DIR = "output"
DOMAIN = "document"
GOAL = "Generate a technical report about cloud architecture best practices"
COMPLEXITY = "simple"
SUCCESS_CRITERIA = "Task completed"
STEPS = ["Research topic", "Format report"]
TOOLS = ["generate", "summarize"]
INPUTS = []
OUTPUTS = []

# ── Document Content ─────────────────────────────────────
DOCUMENT_CONTENT = """import os
print('Cloud architecture best practices:')
# 1. Use a cloud provider's managed services
# 2. Implement security measures
# 3. Monitor and log resources
# 4. Use a CI/CD pipeline
# 5. Implement disaster recovery
print('Cloud architecture best practices include using managed services, implementing security, monitoring, and disaster recovery.')"""


# ── Sub-Agent Functions ────────────────────────────────────
def step_1_research():
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
    sections = "\n".join(f"- {point}" for point in findings)
    report = f"""# Technical Report: {GOAL}

## Executive Summary
This report covers the key aspects of: {DOCUMENT_CONTENT}

## Key Findings
{sections}

## Conclusion
Report generated on {datetime.now(timezone.utc).isoformat()}
"""
    return report


# ── Main Execution ─────────────────────────────────────────
def main():
    """Execute agent pipeline"""
    print(f"Starting {DOMAIN} pipeline: {GOAL}")

    try:
        # Step 1: Research
        findings = step_1_research()
        print(f"Research complete: {len(findings)} points")

        # Step 2: Format report (using step 1 output)
        report = step_2_format_report(findings)
        print(f"Report complete: {len(report)} chars")

        final_result = report

        # Save output
        save_output(final_result)
        return final_result

    except Exception as e:
        print(f"Execution error: {str(e)}")
        raise

def save_output(data):
    """Save final output to file"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    extensions = {
        "website_builder": "html",
        "document": "md",
        "web_research": "txt",
        "data_transform": "json"
    }
    ext = extensions.get(DOMAIN, "txt")

    filepath = f"{OUTPUT_DIR}/{RUN_ID}_{DOMAIN}.{ext}"

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(str(data))

    print(f"Saved to {filepath}")

if __name__ == "__main__":
    main()
