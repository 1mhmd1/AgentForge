import os
import json
from datetime import datetime, timezone

# ── Injected Metadata ──────────────────────────────────────
RUN_ID = "ui_e3b5874e"
OUTPUT_DIR = "output"
DOMAIN = "website_builder"
GOAL = "Build a responsive single-file coffee shop landing page"
COMPLEXITY = "simple"
SUCCESS_CRITERIA = "Task completed"
STEPS = ["Generate HTML page"]
TOOLS = ["generate", "code"]
INPUTS = []
OUTPUTS = []

# ── Website Content ──────────────────────────────────────
HTML_CONTENT = "<style>\n/* Mobile-first design */\nbody {\n  font-family: Arial, sans-serif;\n  margin: 0;\n  padding: 0;\n}\n\n/* Flexbox layout for menu */\n#menu {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  padding: 20px;\n}\n\n/* Grid layout for menu items */\n#menu ul {\n  display: grid;\n  grid-template-columns: repeat(2, 1fr);\n  gap: 10px;\n}\n\n/* Media query for screens under 768px */\n@media (max-width: 768px) {\n  #menu {\n    flex-direction: column;\n  }\n  #menu ul {\n    grid-template-columns: 1fr;\n  }\n}\n</style>"

CSS_CONTENT = ""

JS_CONTENT = ""


# ── Sub-Agent Functions ────────────────────────────────────
def step_1_generate_page():
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


# ── Main Execution ─────────────────────────────────────────
def main():
    """Execute agent pipeline"""
    print(f"Starting {DOMAIN} pipeline: {GOAL}")

    try:
        # Step 1: Generate page
        result = step_1_generate_page()
        print(f"Generated HTML: {len(result)} chars")

        final_result = result

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
