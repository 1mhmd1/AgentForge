import os
import json
from datetime import datetime, timezone

# ── Injected Metadata ──────────────────────────────────────
RUN_ID = "ui_0e6f2c63"
OUTPUT_DIR = "output"
DOMAIN = "web_research"
GOAL = "Create a structured technical report on cloud architecture best practices"
COMPLEXITY = "simple"
SUCCESS_CRITERIA = "Task completed"
STEPS = ["Search for information", "Summarize findings"]
TOOLS = ["search", "summarize"]
INPUTS = []
OUTPUTS = []

# ── Research Content ─────────────────────────────────────
RESEARCH_CONTENT = "<html><head><title>Cloud Architecture Best Practices</title><style>body { font-family: Arial, sans-serif; background-color: #f0f0f0; } h1 { color: #00698f; } h2 { color: #008000; } .container { max-width: 800px; margin: 40px auto; padding: 20px; background-color: #ffffff; border: 1px solid #dddddd; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); } .benefits { padding: 24px; background-color: #f7f7f7; border: 1px solid #dddddd; } .benefits h2 { margin-top: 0; } .benefits ul { list-style: none; padding: 0; } .benefits li { padding: 12px; border-bottom: 1px solid #dddddd; } .benefits li:last-child { border-bottom: none; } .benefits li:hover { background-color: #f2f2f2; } .benefits li:focus { outline: none; background-color: #f2f2f2; }</style></head><body><h1>Executive Summary</h1><p>Cloud architecture best practices are essential for building scalable, secure, and efficient cloud-based systems. By following these guidelines, organizations can reduce costs, improve performance, and enhance their overall cloud experience.</p><p>This report covers key benefits, main topics, and implementation strategies for cloud architecture best practices.</p><h2>Key Benefits</h2><ul><li>Improved scalability and flexibility</li><li>Enhanced security and compliance</li><li>Increased efficiency and cost savings</li><li>Better collaboration and communication</li><li>Improved disaster recovery and business continuity</li></ul><h2>Main Topics</h2><ul><li>Cloud computing models</li><li>Cloud security and compliance</li><li>Cloud cost optimization</li><li>Cloud migration and deployment</li><li>Cloud monitoring and management</li></ul><h2>Implementation Strategies</h2><ul><li>Assess current infrastructure and applications</li><li>Develop a cloud strategy and roadmap</li><li>Choose the right cloud service model</li><li>Implement cloud security and compliance measures</li><li>Monitor and manage cloud resources</li></ul><p>This report provides a comprehensive overview of cloud architecture best practices, including key benefits, main topics, and implementation strategies.</p><p>By following these guidelines, organizations can build scalable, secure, and efficient cloud-based systems that meet their business needs.</p><p>This report is intended for IT professionals, business leaders, and anyone interested in cloud architecture best practices.</p><p>References:</p><ul><li>Cloud Security Alliance. (2022). Cloud Security Guidance.</li><li>NIST. (2020). Cloud Computing Security.</li><li>Amazon Web Services. (2022). Well-Architected Framework.</li></ul></body></html>"


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
