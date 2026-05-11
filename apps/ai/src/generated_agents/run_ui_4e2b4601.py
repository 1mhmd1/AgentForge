import os
import json
from datetime import datetime, timezone

# ── Injected Metadata ──────────────────────────────────────
RUN_ID = "ui_4e2b4601"
OUTPUT_DIR = "output"
DOMAIN = "document"
GOAL = "Create a structured technical report on cloud architecture best practices"
COMPLEXITY = "simple"
SUCCESS_CRITERIA = "Task completed"
STEPS = ["Research topic", "Format report"]
TOOLS = ["generate", "summarize"]
INPUTS = []
OUTPUTS = []

# ── Document Content ─────────────────────────────────────
DOCUMENT_CONTENT = "<html><head><title>Cloud Architecture Best Practices</title></head><body><h1>Executive Summary</h1><p>Cloud architecture best practices are essential for building scalable, secure, and efficient cloud-based systems. By following these guidelines, organizations can reduce costs, improve performance, and enhance their overall cloud experience.</p><p>This report covers key benefits, main topics, and implementation strategies for cloud architecture best practices. It provides a comprehensive overview of the best practices and serves as a valuable resource for cloud architects, developers, and IT professionals.</p><style>body { font-family: Arial, sans-serif; font-size: 16px; } h1 { color: #00698f; } p { margin-bottom: 24px; }</style><h1>Key Takeaways</h1><ul><li>Implement a defense-in-depth strategy to protect against cyber threats.</li><li>Use cloud-native services to improve scalability and reliability.</li><li>Monitor and optimize cloud resources to reduce costs.</li><li>Implement a robust backup and disaster recovery strategy.</li><li>Use secure authentication and authorization mechanisms.</li></ul><h1>Recommendations</h1><p>Based on the key takeaways, we recommend that organizations implement the following best practices:</p><ul><li>Conduct a thorough risk assessment to identify potential security threats.</li><li>Develop a comprehensive cloud security strategy that includes defense-in-depth measures.</li><li>Implement cloud-native services to improve scalability and reliability.</li><li>Monitor and optimize cloud resources to reduce costs.</li><li>Implement a robust backup and disaster recovery strategy.</li></ul><style>.key-takeaways { padding: 24px; }</style><script>console.log('Cloud architecture best practices implemented successfully!');</script></body></html>"


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
