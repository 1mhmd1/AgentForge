import os
import json
from datetime import datetime, timezone

# ── Injected Metadata ──────────────────────────────────────
RUN_ID = "ui_03654ce4"
OUTPUT_DIR = "output"
DOMAIN = "website_builder"
GOAL = "Design and generate a world-class, visually immersive, emotionally engaging landing page for a premium modern coffee shop brand"
COMPLEXITY = "simple"
SUCCESS_CRITERIA = "Task completed"
STEPS = ["Generate HTML page"]
TOOLS = ["generate", "code"]
INPUTS = []
OUTPUTS = []

# ── Website Content ──────────────────────────────────────
HTML_CONTENT = "<section id='hero'><h1>Experience the Perfect Cup</h1><p>Our expertly crafted coffee blends will transport you to a world of pure delight.</p></section><section id='menu'><h2>Menu</h2><ul><li><a href='#'>Espresso</a></li><li><a href='#'>Latte</a></li><li><a href='#'>Cappuccino</a></li><li><a href='#'>Mocha</a></li><li><a href='#'>Cold Brew</a></li></ul></section><section id='about'><h2>Our Story</h2><div class='about-left'><p>At Cozy Grounds, we're passionate about serving the finest, small-batch coffee to our community. Our expert roasters carefully select the highest-quality beans to create unique blends that will delight your senses.</p><p>From our cozy coffee shop to your doorstep, we're dedicated to providing an exceptional experience that will leave you feeling warm and fuzzy inside....</p></div></section><section id='contact'><h2>Get in Touch</h2><p>Phone: 555-555-5555</p><p>Email: <a href='mailto:info@cozygrounds.com'>info@cozygrounds.com</a></p><p>Address: 123 Main St, Anytown, USA</p></section><footer><p>&copy; 2023 Cozy Grounds</p></footer><style>\n  :root {\n    --coffee: #6F4E37;\n    --cream: #F5E6D3;\n    --gold: #D4AF37;\n    --spacing-scale: 0.25rem 0.5rem 1rem 2rem 3rem;\n    --font-size-scale: 0.875rem 1rem 1.125rem 1.25rem 1.5rem;\n  }\n\n  body {\n    font-family: Arial, sans-serif;\n    margin: 0;\n    padding: 0;\n    box-sizing: border-box;\n  }\n\n  .hero {\n    padding: 48px 24px;\n    text-align: center;\n    background-image: linear-gradient(to bottom, var(--coffee), var(--cream));\n    background-size: 100% 300px;\n    background-position: 0% 100%;\n    transition: background-position 0.5s ease-in-out;\n  }\n\n  .hero:hover {\n    background-position: 0% 0%;\n  }\n\n  .menu {\n    padding: 32px 24px;\n  }\n\n  .menu ul {\n    list-style: none;\n    padding: 0;\n  }\n\n  .menu li {\n    margin-bottom: 16px;\n  }\n\n  .menu a {\n    text-decoration: none;\n    color: var(--coffee);\n  }\n\n  .menu a:hover {\n    color: var(--gold);\n  }\n\n  .about {\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    padding: 48px 24px;\n  }\n\n  .about-left {\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    padding: 24px;\n    background-color: var(--cream);\n    border-radius: 8px;\n    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);\n  }\n\n  .about-left p {\n    margin-bottom: 16px;\n  }\n\n  .contact {\n    padding: 48px 24px;\n  }\n\n  .contact p {\n    margin-bottom: 16px;\n  }\n\n  .contact a {\n    text-decoration: none;\n    color: var(--coffee);\n  }\n\n  .contact a:hover {\n    color: var(--gold);\n  }\n\n  footer {\n    padding: 16px;\n    background-color: var(--coffee);\n    color: var(--cream);\n    text-align: center;\n  }\n\n  @media (min-width: 768px) {\n    .hero {\n      padding: 64px 32px;\n    }\n\n    .menu {\n      padding: 40px 32px;\n    }\n\n    .about {\n      flex-direction: row;\n      align-items: center;\n    }\n\n    .about-left {\n      padding: 32px;\n    }\n\n    .contact {\n      padding: 64px 32px;\n    }\n  }\n\n  @media (min-width: 1024px) {\n    .hero {\n      padding: 80px 40px;\n    }\n\n    .menu {\n      padding: 48px 40px;\n    }\n\n    .about {\n      flex-direction: row;\n      align-items: center;\n    }\n\n    .about-left {\n      padding: 40px;\n    }\n\n    .contact {\n      padding: 80px 40px;\n    }\n  }\n\n  html {\n    scroll-behavior: smooth;\n  }\n\n  button {\n    background-color: var(--coffee);\n    color: var(--cream);\n    border: none;\n    padding: 16px 32px;\n    font-size: var(--font-size-scale);\n    cursor: pointer;\n  }\n\n  button:hover {\n    background-color: var(--gold);\n  }\n\n  button:active {\n    transform: scale(0.9);\n  }\n</style>"

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
