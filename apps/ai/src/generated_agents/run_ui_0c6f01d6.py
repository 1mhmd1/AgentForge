import os
import json
from datetime import datetime, timezone

# ── Injected Metadata ──────────────────────────────────────
RUN_ID = "ui_0c6f01d6"
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
HTML_CONTENT = "<style>\n/* Mobile-first layout */\nbody {\\  display: block;\\ }\n\n/* Modern typography */\nh1, h2, h3 {\\  font-family: Arial, sans-serif;\\  font-weight: bold;\\ }\nh1 {\\  font-size: 36px;\\ }\nh2 {\\  font-size: 24px;\\ }\nh3 {\\  font-size: 18px;\\ }\n\n/* Flexbox/grid structures */\n.container {\\  display: flex;\\  flex-direction: column;\\  align-items: center;\\  justify-content: center;\\  height: 100vh;\\ }\n\n.menu, .contact {\\  display: flex;\\  flex-direction: column;\\  align-items: center;\\  padding: 20px;\\  border: 1px solid #ccc;\\  border-radius: 10px;\\  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);\\ }\n\n.menu ul, .contact form {\\  display: flex;\\  flex-direction: column;\\  align-items: center;\\  padding: 10px;\\ }\n\n.menu li, .contact label {\\  margin-bottom: 10px;\\ }\n\n.menu ul li, .contact input, .contact textarea {\\  width: 100%;\\  padding: 10px;\\  margin-bottom: 10px;\\  border: 1px solid #ccc;\\ }\n\n.menu ul li ul, .contact input[type=\"submit\"] {\\  width: 50%;\\ }\n\n@media (min-width: 768px) {\n  .container {\\    display: grid;\\    grid-template-columns: 1fr 1fr;\\    grid-gap: 20px;\\  }\n  .menu, .contact {\\    grid-column: 1 / -1;\\  }\n  .menu ul, .contact form {\\    grid-column: 1 / -1;\\  }\n  .menu li, .contact label {\\    grid-column: 1 / -1;\\  }\n  .menu ul li, .contact input, .contact textarea {\\    grid-column: 1 / -1;\\  }\n}\n</style>"

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
