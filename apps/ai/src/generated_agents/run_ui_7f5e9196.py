import os
import json
from datetime import datetime, timezone

# ── Injected Metadata ──────────────────────────────────────
RUN_ID = "ui_7f5e9196"
OUTPUT_DIR = "output"
DOMAIN = "website_builder"
GOAL = "Design and generate a modern, high-conversion landing page for a premium coffee shop brand"
COMPLEXITY = "simple"
SUCCESS_CRITERIA = "Task completed"
STEPS = ["Generate HTML page"]
TOOLS = ["generate", "code"]
INPUTS = []
OUTPUTS = []

# ── Website Content ──────────────────────────────────────
HTML_CONTENT = "<!DOCTYPE html><html lang='en'><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'><title>Premium Coffee Shop</title><style>\n  /* CSS Variables */\n  :root {\n    --coffee: #6F4E37;\n    --cream: #F5E6D3;\n    --gold: #D4AF37;\n  }\n\n  /* Spacing Scale */\n  :root {\n    --spacing-xs: 4px;\n    --spacing-sm: 8px;\n    --spacing-md: 16px;\n    --spacing-lg: 32px;\n    --spacing-xl: 48px;\n  }\n\n  /* Font Size Scale */\n  :root {\n    --font-size-xs: 12px;\n    --font-size-sm: 14px;\n    --font-size-md: 16px;\n    --font-size-lg: 20px;\n  }\n\n  /* Base Styles */\n  body {\n    font-family: Arial, sans-serif;\n    margin: 0;\n    padding: 0;\n  }\n\n  h1, h2, h3 {\n    margin-top: 0;\n  }\n\n  p {\n    margin-bottom: 16px;\n  }\n\n  /* Mobile-First Breakpoints */\n  @media (min-width: 768px) {\n    /* Tablet Breakpoint */\n    .container {\n      max-width: 768px;\n      margin: 0 auto;\n    }\n  }\n\n  @media (min-width: 1024px) {\n    /* Desktop Breakpoint */\n    .container {\n      max-width: 1024px;\n      margin: 0 auto;\n    }\n  }\n\n  /* Sticky Nav */\n  .nav {\n    position: sticky;\n    top: 0;\n    background-color: var(--cream);\n    backdrop-filter: blur(10px);\n  }\n\n  /* Hero */\n  .hero {\n    padding: var(--spacing-xl) var(--spacing-lg);\n    text-align: center;\n    background-image: linear-gradient(to bottom, var(--coffee), var(--cream));\n  }\n\n  /* Menu Grid */\n  .menu {\n    padding: var(--spacing-lg) var(--spacing-md);\n  }\n\n  .menu ul {\n    list-style: none;\n    padding: 0;\n  }\n\n  .menu li {\n    margin-bottom: var(--spacing-md);\n  }\n\n  .menu-item {\n    display: grid;\n    grid-template-columns: 1fr;\n    gap: var(--spacing-md);\n  }\n\n  @media (min-width: 768px) {\n    .menu-item {\n      grid-template-columns: 1fr 1fr;\n    }\n  }\n\n  @media (min-width: 1024px) {\n    .menu-item {\n      grid-template-columns: 1fr 1fr 1fr;\n    }\n  }\n\n  /* About Section */\n  .about {\n    padding: var(--spacing-lg) var(--spacing-md);\n  }\n\n  .about h2 {\n    margin-top: 0;\n  }\n\n  .about .left {\n    float: left;\n    width: 60%;\n  }\n\n  .about .right {\n    float: right;\n    width: 40%;\n  }\n\n  .about .value-card {\n    background-color: #f7f7f7;\n    padding: var(--spacing-md);\n    border: 1px solid #ddd;\n    margin-bottom: var(--spacing-md);\n  }\n\n  .about .value-card h3 {\n    margin-top: 0;\n  }\n\n  .about .value-card p {\n    margin-bottom: var(--spacing-md);\n  }\n\n  /* Form Field Styling */\n  .form-field {\n    margin-bottom: var(--spacing-md);\n  }\n\n  .form-field input, .form-field select, .form-field textarea {\n    width: 100%;\n    padding: var(--spacing-md);\n    border: 1px solid #ccc;\n  }\n\n  .form-field input:focus, .form-field select:focus, .form-field textarea:focus {\n    outline: none;\n    border-color: var(--gold);\n  }\n\n  .form-field input:hover, .form-field select:hover, .form-field textarea:hover {\n    border-color: var(--gold);\n  }\n\n  /* Button Transitions */\n  .button {\n    padding: var(--spacing-md) var(--spacing-lg);\n    background-color: var(--gold);\n    border: none;\n    border-radius: var(--spacing-md);\n    cursor: pointer;\n  }\n\n  .button:hover {\n    background-color: var(--coffee);\n  }\n\n  .button:active {\n    transform: scale(0.9);\n  }\n\n  /* Smooth Scroll Behavior */\n  html {\n    scroll-behavior: smooth;\n  }\n</style></head><body><section class=\"hero\"><h1>Welcome</h1><p>Tagline.</p></section><section class=\"menu\"><h2>Menu</h2><ul><li class=\"menu-item\"><h3>Espresso</h3><p>$3</p></li><li class=\"menu-item\"><h3>Latte</h3><p>$4</p></li></ul></section><section class=\"about\"><h2>About Us</h2><div class=\"container\"><div class=\"about left\"><div class=\"value-card\"><h3>Value 1</h3><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p></div><div class=\"value-card\"><h3>Value 2</h3><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p></div></div><div class=\"about right\"><div class=\"value-card\"><h3>Value 3</h3><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p></div><div class=\"value-card\"><h3>Value 4</h3><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p></div></div></div></section><section class=\"contact\"><h2>Contact Us</h2><form class=\"form\"><div class=\"form-field\"><input type=\"text\" placeholder=\"Name\"><input type=\"email\" placeholder=\"Email\"></div><div class=\"form-field\"><textarea placeholder=\"Message\"></textarea></div><button class=\"button\">Send</button></form></section><footer class=\"footer\"><p>&copy; 2023 Premium Coffee Shop</p></footer></body></html>"

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
