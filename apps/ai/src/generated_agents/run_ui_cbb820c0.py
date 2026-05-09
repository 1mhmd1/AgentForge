import os
import json
from datetime import datetime, timezone

# ── Injected Metadata ──────────────────────────────────────
RUN_ID = "ui_cbb820c0"
OUTPUT_DIR = "output"
DOMAIN = "web_research"
GOAL = "Generate a technical report about tailwind best practices"
COMPLEXITY = "simple"
SUCCESS_CRITERIA = "Task completed"
STEPS = ["Search for information", "Summarize findings"]
TOOLS = ["search", "summarize"]
INPUTS = []
OUTPUTS = []

# ── Research Content ─────────────────────────────────────
RESEARCH_CONTENT = """import tailwindcss
# Install Tailwind CSS
pip install tailwindcss
# Import Tailwind CSS in your CSS file
@tailwind base;
@tailwind components;
@tailwind utilities;
import json
print(json.dumps({'step_id': 'step_2', 'status': 'success', 'summary': 'Summarize findings into a report', 'error': None}))"""


# ── Sub-Agent Functions ────────────────────────────────────
def step_1_search():
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


# ── Main Execution ─────────────────────────────────────────
def main():
    """Execute agent pipeline"""
    print(f"Starting {DOMAIN} pipeline: {GOAL}")

    try:
        # Step 1: Search
        search_results = step_1_search()
        print(f"Search complete: {len(search_results)} chars")

        # Step 2: Summarize (using step 1 output)
        summary = step_2_summarize(search_results)
        print(f"Summary complete: {len(summary)} chars")

        final_result = summary

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
