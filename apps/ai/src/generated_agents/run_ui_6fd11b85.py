import os
import json
from datetime import datetime, timezone

# ── Injected by Builder ───────────────────────────────────────────────
RUN_ID           = "ui_6fd11b85"
OUTPUT_DIR       = "output"
DOMAIN           = "web_research"
GOAL             = "Research and summarize the top UFC trend for 2026"
COMPLEXITY       = "medium"
SUCCESS_CRITERIA = "A clear summary of the top UFC trend for 2026 from at least 5 reliable sources"
STEPS            = ["Search for recent UFC news and trends from 2026", "Select the top 5 most relevant sources", "Extract key information from each article", "Identify the top trend", "Combine findings into a structured summary"]
TOOLS            = ["search", "scrape", "summarize"]

INPUTS           = []
OUTPUTS          = []




# Domain-specific
def get_input(name: str, default=None):
    for item in INPUTS:
        if item.get("name") == name:
            return item.get("value", default)
    return default

TOPIC             = get_input("topic", "")
RESEARCH_QUESTION = get_input("research_question", "")
SEARCH_TERMS      = get_input("search_terms", [])
REQUIRED_SECTIONS = get_input("required_sections", [])
OUTPUT_FORMAT     = get_input("output_format", "markdown")
MAX_SOURCES       = get_input("max_sources", 10)

# ── Output paths ──────────────────────────────────────────────────────
REPORT_PATH      = os.path.join(OUTPUT_DIR, "report.md")
FINDINGS_PATH    = os.path.join(OUTPUT_DIR, "findings.json")
SOURCES_PATH     = os.path.join(OUTPUT_DIR, "sources.json")
METADATA_PATH    = os.path.join(OUTPUT_DIR, "metadata.json")

# ── Helpers ───────────────────────────────────────────────────────────

def ensure_output_dir() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)

def write_file(path: str, content: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"[+] Written: {path}")

def read_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def write_json(path: str, data: dict | list) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"[+] Written: {path}")

def save_metadata(status: str, error: str | None = None) -> None:
    meta = {
        "run_id": RUN_ID,
        "goal": GOAL,
        "topic": TOPIC,
        "research_question": RESEARCH_QUESTION,
        "status": status,
        "error": error,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }
    write_json(METADATA_PATH, meta)

# ── Core logic (Builder fills these) ─────────────────────────────────

def collect_sources() -> list[dict]:
    """
    Search and collect sources for the research topic.
    Returns a list of source dicts: {url, title, snippet, relevance_score}
    Builder injects search logic here based on tools: search, scrape, summarize
    """
    sources = []
    
    return sources

def extract_findings(sources: list[dict]) -> list[dict]:
    """
    Extract key findings from collected sources.
    Returns a list of finding dicts: {section, content, source_url}
    Builder injects extraction logic here.
    """
    findings = []
    
    return findings

def build_report(findings: list[dict]) -> str:
    """
    Assemble findings into a structured markdown report.
    Required sections: 
    """
    lines = []
    lines.append(f"# {TOPIC}")
    lines.append(f"\n**Research Question:** {RESEARCH_QUESTION}\n")
    lines.append(f"**Goal:** {GOAL}\n")
    lines.append(f"**Generated:** {datetime.now(timezone.utc).isoformat()}\n")
    lines.append("---\n")

    

    lines.append("---")
    lines.append(f"\n**Success Criteria:** {SUCCESS_CRITERIA}")
    return "\n".join(lines)

# ── Runner ────────────────────────────────────────────────────────────

def run() -> None:
    ensure_output_dir()
    print(f"[AgentForge:{DOMAIN}] run_id={RUN_ID}")
    print(f"[AgentForge:{DOMAIN}] topic={TOPIC}")
    print(f"[AgentForge:web_research] steps={len(STEPS)}")

    try:
        
        # Step 1/5: Search for recent UFC news and trends from 2026
        print(f"[Step 1] Search for recent UFC news and trends from 2026")
        import requests

        today = '2026'
        response = requests.get('https://newsapi.org/v2/everything', params={'q': 'UFC 2026', 'sortBy': 'publishedAt', 'apiKey': 'demo'})
        search_results = response.json().get('articles', [])
        
        # Step 2/5: Select the top 5 most relevant sources
        print(f"[Step 2] Select the top 5 most relevant sources")
        import requests
        import json

        today = '2026'
        response = requests.get('https://newsapi.org/v2/everything', params={'q': 'UFC 2026', 'sortBy': 'publishedAt', 'apiKey': 'demo'})
        search_results = response.json().get('articles', [])

        # Define a function to calculate the relevance of each article
        def calculate_relevance(article):
            # For simplicity, let's assume relevance is based on the number of words in the article's description
            return len(article.get('description', '').split())

        # Sort the search results based on relevance
        sorted_results = sorted(search_results, key=calculate_relevance, reverse=True)

        # Select the top 5 most relevant sources
        top_sources = sorted_results[:5]

        # Print the top sources
        for source in top_sources:
            print(source.get('title'), source.get('url'))
        
        # Step 3/5: Extract key information from each article
        print(f"[Step 3] Extract key information from each article")
        import requests
        import json

        today = '2026'
        response = requests.get('https://newsapi.org/v2/everything', params={'q': 'UFC 2026', 'sortBy': 'publishedAt', 'apiKey': 'demo'})
        search_results = response.json().get('articles', [])

        # Define a function to calculate the relevance of each article
        def calculate_relevance(article):
            # For simplicity, let's assume relevance is based on the number of words in the article's description
            return len(article.get('description', '').split())

        # Sort the search results based on relevance
        sorted_results = sorted(search_results, key=calculate_relevance, reverse=True)

        # Select the top 5 most relevant sources
        top_sources = sorted_results[:5]

        # Extract key information from each article
        key_info = []
        for article in top_sources:
            info = {
                'title': article.get('title'),
                'url': article.get('url'),
                'description': article.get('description'),
                'published_at': article.get('publishedAt'),
                'author': article.get('author'),
                'source': article.get('source', {}).get('name')
            }
            key_info.append(info)

        # Print the extracted key information
        for info in key_info:
            print(info)
        
        # Step 4/5: Identify the top trend
        print(f"[Step 4] Identify the top trend")
        import requests
        import json
        from collections import Counter

        today = '2026'
        response = requests.get('https://newsapi.org/v2/everything', params={'q': 'UFC 2026', 'sortBy': 'publishedAt', 'apiKey': 'demo'})
        search_results = response.json().get('articles', [])

        # Define a function to calculate the relevance of each article
        def calculate_relevance(article):
            # For simplicity, let's assume relevance is based on the number of words in the article's description
            return len(article.get('description', '').split())

        # Sort the search results based on relevance
        sorted_results = sorted(search_results, key=calculate_relevance, reverse=True)

        # Select the top 5 most relevant sources
        top_sources = sorted_results[:5]

        # Extract key information from each article
        key_info = []
        for article in top_sources:
            info = {
                'title': article.get('title'),
                'url': article.get('url'),
                'description': article.get('description'),
                'published_at': article.get('publishedAt'),
                'author': article.get('author'),
                'source': article.get('source', {}).get('name')
            }
            key_info.append(info)

        # Identify the top trend by counting the most frequent words in the article titles
        word_counts = Counter(' '.join([info['title'] for info in key_info]).lower().split())

        # Print the top trend
        print('Top trend:', word_counts.most_common(1)[0][0])
        
        # Step 5/5: Combine findings into a structured summary
        print(f"[Step 5] Combine findings into a structured summary")
        import requests
        import json
        from collections import Counter

        today = '2026'
        response = requests.get('https://newsapi.org/v2/everything', params={'q': 'UFC 2026', 'sortBy': 'publishedAt', 'apiKey': 'demo'})
        search_results = response.json().get('articles', [])

        # Define a function to calculate the relevance of each article
        def calculate_relevance(article):
            # For simplicity, let's assume relevance is based on the number of words in the article's description
            return len(article.get('description', '').split())

        # Sort the search results based on relevance
        sorted_results = sorted(search_results, key=calculate_relevance, reverse=True)

        # Select the top 5 most relevant sources
        top_sources = sorted_results[:5]

        # Extract key information from each article
        key_info = []
        for article in top_sources:
            info = {
                'title': article.get('title'),
                'url': article.get('url'),
                'description': article.get('description'),
                'published_at': article.get('publishedAt'),
                'author': article.get('author'),
                'source': article.get('source', {}).get('name')
            }
            key_info.append(info)

        # Identify the top trend by counting the most frequent words in the article titles
        word_counts = Counter(' '.join([info['title'] for info in key_info]).lower().split())

        top_trend = word_counts.most_common(1)[0][0]
        summary = {
            'top_trend': top_trend,
            'top_sources': key_info
        }

        print('Summary:', json.dumps(summary, indent=4))
        

        sources  = collect_sources()
        findings = extract_findings(sources)
        report   = build_report(findings)

        write_json(SOURCES_PATH,  sources)
        write_json(FINDINGS_PATH, findings)

        if OUTPUT_FORMAT in ("markdown", "both"):
            write_file(REPORT_PATH, report)
        if OUTPUT_FORMAT in ("json", "both"):
            write_json(
                os.path.join(OUTPUT_DIR, "report.json"),
                {"report": report, "findings": findings, "sources": sources},
            )

        save_metadata("completed")
        print(f"[AgentForge:web_research] Done. Output: {OUTPUT_DIR}")

    except Exception as exc:
        save_metadata("failed", error=str(exc))
        raise

if __name__ == "__main__":
    run()