import os
import json
from datetime import datetime, timezone

# ── Injected Metadata ──────────────────────────────────────
RUN_ID = "ui_becc20f4"
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
HTML_CONTENT = "<header><nav><div class='logo'>Logo</div><a href='#'>Home</a><a href='#'>Menu</a><a href='#'>About</a><a href='#'>Contact</a></nav></header><section id='hero'><h1>Artisan Coffee, Crafted with Love</h1><p>Experience the perfect blend of art and science in every cup.</p></section><section id='menu'><h2>Our Menu</h2><ul><li>Espresso - $3</li><li>Latte - $4</li><li>Cappuccino - $5</li><li>Mocha - $5</li><li>Tea - $3</li></ul></section><section id='about'><div class='left'><p>Our story began with a passion for coffee and a dream to share it with the world.</p><p>We source our beans from the finest farms around the globe to bring you the perfect cup every time.</p></div><div class='right'><div class='card'><h3>Our Mission</h3><p>To provide exceptional coffee and a welcoming atmosphere that inspires our customers to live their best lives.</p></div></section><section id='contact'><h2>Get in Touch</h2><p>Phone: 555-555-5555</p><p>Email: <a href='mailto:info@artisancoffee.com'>info@artisancoffee.com</a></p></section><footer><p>&copy; 2023 Artisan Coffee</p></footer><style>\n  :root {\n    --coffee: #6F4E37;\n    --cream: #F5E6D3;\n    --gold: #D4AF37;\n    --spacing-scale: 0.25rem 0.5rem 1rem 2rem 3rem;\n    --font-size-scale: 0.875rem 1rem 1.125rem 1.25rem 1.5rem;\n  }\n\n  body {\n    margin: 0;\n    padding: 0;\n    font-family: Arial, sans-serif;\n    line-height: 1.6;\n    color: var(--coffee);\n    background-color: #f9f9f9;\n  }\n\n  header {\n    background-color: var(--gold);\n    color: #fff;\n    padding: 1rem;\n    text-align: center;\n  }\n\n  nav {\n    display: flex;\n    justify-content: space-between;\n    align-items: center;\n  }\n\n  nav a {\n    color: #fff;\n    text-decoration: none;\n    margin: 0 1rem;\n  }\n\n  nav a:hover {\n    color: #ccc;\n  }\n\n  #hero {\n    background-image: linear-gradient(to bottom, var(--gold), var(--cream));\n    background-size: 100% 300px;\n    background-position: 0% 100%;\n    height: 100vh;\n    display: flex;\n    justify-content: center;\n    align-items: center;\n    color: #fff;\n  }\n\n  #hero h1 {\n    font-size: 3rem;\n  }\n\n  #hero p {\n    font-size: 1.5rem;\n  }\n\n  #menu {\n    display: grid;\n    grid-template-columns: 1fr;\n    gap: 1rem;\n    padding: 2rem;\n  }\n\n  #menu ul {\n    list-style: none;\n    padding: 0;\n  }\n\n  #menu li {\n    background-color: var(--cream);\n    padding: 1rem;\n    border-radius: 0.5rem;\n    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);\n  }\n\n  #menu li:hover {\n    background-color: var(--gold);\n  }\n\n  #menu a {\n    text-decoration: none;\n    color: var(--coffee);\n  }\n\n  #menu a:hover {\n    color: var(--gold);\n  }\n\n  #about {\n    display: flex;\n    gap: 2rem;\n    padding: 2rem;\n  }\n\n  #about .left {\n    flex-basis: 50%;\n  }\n\n  #about .right {\n    flex-basis: 50%;\n  }\n\n  #about .card {\n    background-color: var(--cream);\n    padding: 2rem;\n    border-radius: 0.5rem;\n    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);\n  }\n\n  #about .card h3 {\n    margin-top: 0;\n  }\n\n  #contact {\n    padding: 2rem;\n  }\n\n  footer {\n    background-color: var(--gold);\n    color: #fff;\n    padding: 1rem;\n    text-align: center;\n    clear: both;\n  }\n\n  @media (min-width: 768px) {\n    #menu {\n      grid-template-columns: repeat(2, 1fr);\n    }\n  }\n\n  @media (min-width: 1024px) {\n    #menu {\n      grid-template-columns: repeat(3, 1fr);\n    }\n  }\n\n  html {\n    scroll-behavior: smooth;\n  }\n\n  button {\n    background-color: var(--gold);\n    color: #fff;\n    border: none;\n    padding: 1rem 2rem;\n    font-size: 1.5rem;\n    cursor: pointer;\n  }\n\n  button:hover {\n    background-color: var(--cream);\n  }\n\n  button:focus {\n    outline: none;\n    box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);\n  }\n</style>"

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
