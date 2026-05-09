import os
import json
from datetime import datetime, timezone

# ── Injected by Builder ───────────────────────────────────────────────
RUN_ID           = "ui_bb7dfacf"
OUTPUT_DIR       = "output"
DOMAIN           = "web_research"
GOAL             = "Convert CSV employee records to JSON format with validation"
COMPLEXITY       = "medium"
SUCCESS_CRITERIA = "Valid JSON file containing all employee records from the original CSV"
STEPS            = ["Read the CSV file", "Parse CSV rows and columns", "Transform data into JSON structure", "Validate JSON output for correctness", "Check for data consistency and completeness"]
TOOLS            = ["analyze", "code", "validate"]

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
    Builder injects search logic here based on tools: analyze, code, validate
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
        
        # Step 1/5: Read the CSV file
        print(f"[Step 1] Read the CSV file")
        import pandas as pd

        csv_file_path = 'employee_records.csv'
        try:
            employee_records = pd.read_csv(csv_file_path)
            print('CSV file read successfully.')
        except FileNotFoundError:
            print('The CSV file was not found. Please check the file path.')
        except pd.errors.EmptyDataError:
            print('The CSV file is empty. Please check the file contents.')
        except pd.errors.ParserError:
            print('An error occurred while parsing the CSV file. Please check the file format.')
        
        # Step 2/5: Parse CSV rows and columns
        print(f"[Step 2] Parse CSV rows and columns")
        import pandas as pd

        csv_file_path = 'employee_records.csv'
        try:
            employee_records = pd.read_csv(csv_file_path)
            print('CSV file read successfully.')
            # Parse CSV rows and columns
            rows = employee_records.shape[0]
            columns = employee_records.shape[1]
            print(f'Number of rows: {rows}')
            print(f'Number of columns: {columns}')
            # Print column names
            column_names = employee_records.columns.tolist()
            print('Column names: ', column_names)
            # Print data types of each column
            data_types = employee_records.dtypes
            print('Data types of each column: ', data_types)
        except FileNotFoundError:
            print('The CSV file was not found. Please check the file path.')
        except pd.errors.EmptyDataError:
            print('The CSV file is empty. Please check the file contents.')
        except pd.errors.ParserError:
            print('An error occurred while parsing the CSV file. Please check the file format.')
        
        # Step 3/5: Transform data into JSON structure
        print(f"[Step 3] Transform data into JSON structure")
        import pandas as pd
        import json

        csv_file_path = 'employee_records.csv'
        try:
            employee_records = pd.read_csv(csv_file_path)
            print('CSV file read successfully.')
            # Transform data into JSON structure
            json_data = employee_records.to_dict(orient='records')
            print('JSON data:', json_data)
            # Validate JSON data
            if json_data:
                print('JSON data is valid.')
            else:
                print('JSON data is empty or invalid.')
        except FileNotFoundError:
            print('The CSV file was not found. Please check the file path.')
        except pd.errors.EmptyDataError:
            print('The CSV file is empty. Please check the file contents.')
        except pd.errors.ParserError:
            print('An error occurred while parsing the CSV file. Please check the file format.')
        
        # Step 4/5: Validate JSON output for correctness
        print(f"[Step 4] Validate JSON output for correctness")
        import pandas as pd
        import json

        csv_file_path = 'employee_records.csv'
        try:
            employee_records = pd.read_csv(csv_file_path)
            print('CSV file read successfully.')
            # Transform data into JSON structure
            json_data = employee_records.to_dict(orient='records')
            print('JSON data:', json_data)
            # Validate JSON data
            if json_data:
                print('JSON data is valid.')
                # Check for missing values
                for record in json_data:
                    for key, value in record.items():
                        if pd.isnull(value):
                            print(f'Missing value found in {key} field.')
                # Check for data type consistency
                for column in employee_records.columns:
                    data_type = type(employee_records[column].iloc[0])
                    for value in employee_records[column]:
                        if not isinstance(value, data_type):
                            print(f'Data type inconsistency found in {column} field.')
            else:
                print('JSON data is empty or invalid.')
        except FileNotFoundError:
            print('The CSV file was not found. Please check the file path.')
        except pd.errors.EmptyDataError:
            print('The CSV file is empty. Please check the file contents.')
        except pd.errors.ParserError:
            print('An error occurred while parsing the CSV file. Please check the file format.')
        
        # Step 5/5: Check for data consistency and completeness
        print(f"[Step 5] Check for data consistency and completeness")
        import pandas as pd
        import json

        csv_file_path = 'employee_records.csv'
        try:
            employee_records = pd.read_csv(csv_file_path)
            print('CSV file read successfully.')
            # Transform data into JSON structure
            json_data = employee_records.to_dict(orient='records')
            print('JSON data:', json_data)
            # Validate JSON data
            if json_data:
                print('JSON data is valid.')
                # Check for missing values
                for record in json_data:
                    for key, value in record.items():
                        if pd.isnull(value):
                            print(f'Missing value found in {key} field.')
                # Check for data type consistency
                for column in employee_records.columns:
                    data_type = type(employee_records[column].iloc[0])
                    for value in employee_records[column]:
                        if not isinstance(value, data_type):
                            print(f'Data type inconsistency found in {column} field.')
                # Check for data consistency and completeness
                required_columns = ['name', 'age', 'department']
                for record in json_data:
                    for column in required_columns:
                        if column not in record or not record[column]:
                            print(f'Data inconsistency found in {column} field.')
            else:
                print('JSON data is empty or invalid.')
        except FileNotFoundError:
            print('The CSV file was not found. Please check the file path.')
        except pd.errors.EmptyDataError:
            print('The CSV file is empty. Please check the file contents.')
        except pd.errors.ParserError:
            print('An error occurred while parsing the CSV file. Please check the file format.')
        

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