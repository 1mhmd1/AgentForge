import os
import json
from datetime import datetime, timezone

# ── Injected Metadata ──────────────────────────────────────
RUN_ID = "ui_2b50f053"
OUTPUT_DIR = "output"
DOMAIN = "web_research"
GOAL = "Research React hooks and summarize findings"
COMPLEXITY = "simple"
SUCCESS_CRITERIA = "Task completed"
STEPS = ["Search for information", "Summarize findings"]
TOOLS = ["search", "summarize"]
INPUTS = []
OUTPUTS = []

# ── Research Content ─────────────────────────────────────
RESEARCH_CONTENT = """import { useState, useEffect } from 'react';

function App() {
const [count, setCount] = useState(0);

useEffect(() => {
    document.title = `Count: ${count}`;
}, [count]);

return (
    <div>
    <p>You clicked {count} times</p>
    <button onClick={() => setCount(count + 1)}>Click me</button>
    </div>
);
}

export default App;
def react_hooks():
# React hooks are a way to use state and other React features without writing a class.
pass
react_hooks()"""


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
