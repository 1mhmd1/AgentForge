import os
import json
from datetime import datetime, timezone

# ── Injected Metadata ──────────────────────────────────────
RUN_ID = "ui_2ff7175b"
OUTPUT_DIR = "output"
DOMAIN = "web_research"
GOAL = "Generate a technical report about claude architecture best practices"
COMPLEXITY = "simple"
SUCCESS_CRITERIA = "Task completed"
STEPS = ["Search for information", "Summarize findings"]
TOOLS = ["search", "summarize"]
INPUTS = []
OUTPUTS = []

# ── Research Content ─────────────────────────────────────
RESEARCH_CONTENT = """<h1>Claude Architecture Best Practices</h1>
<p>Claude is a cloud-based platform for building and deploying machine learning models. Here are some best practices for designing and implementing Claude architecture:</p>
<ul>
<li><strong>Modularity**: Break down the architecture into smaller, independent modules that can be developed, tested, and deployed separately.</strong></li>
<li><strong>Scalability**: Design the architecture to scale horizontally, allowing for easy addition of new resources as needed.</strong></li>
<li><strong>Flexibility**: Use a flexible data format, such as JSON or Avro, to enable easy data integration and processing.</strong></li>
<li><strong>Security**: Implement robust security measures, including encryption, access controls, and monitoring, to protect sensitive data and prevent unauthorized access.</strong></li>
<li><strong>Monitoring and Logging**: Set up comprehensive monitoring and logging to track system performance, detect issues, and optimize the architecture.</strong></li>
</ul>
<p>By following these best practices, you can build a robust, scalable, and maintainable Claude architecture that meets the needs of your organization.</p>
<h1>Claude Architecture Best Practices</h1><p>Claude is a cloud-based platform for building and deploying machine learning models. Here are some best practices for designing and implementing Claude architecture:</p><ul><li><strong>Modularity**: Break down the architecture into smaller, independent modules that can be developed, tested, and deployed separately.</strong></li><li><strong>Scalability**: Design the architecture to scale horizontally, allowing for easy addition of new resources as needed.</strong></li><li><strong>Flexibility**: Use a flexible data format, such as JSON or Avro, to enable easy data integration and processing.</strong></li><li><strong>Security**: Implement robust security measures, including encryption, access controls, and monitoring, to protect sensitive data.</strong></li><li><strong>Monitoring**: Implement monitoring tools to track system performance, identify bottlenecks, and optimize resource utilization.</strong></li></ul>"""


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
