import os
import json
from datetime import datetime, timezone

# ── Injected Metadata ──────────────────────────────────────
RUN_ID = "ui_3b6e1ef8"
OUTPUT_DIR = "output"
DOMAIN = "website_builder"
GOAL = "Build a landing page for a restaurant"
COMPLEXITY = "simple"
SUCCESS_CRITERIA = "Task completed"
STEPS = ["Generate HTML page"]
TOOLS = ["generate", "code"]
INPUTS = []
OUTPUTS = []

# ── Website Content ──────────────────────────────────────
HTML_CONTENT = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Restaurant Landing Page</title>
<style>
    body {
    font-family: Arial, sans-serif;
    }
    .hero {
    background-image: linear-gradient(to bottom, #333, #555);
    color: #fff;
    padding: 20px;
    text-align: center;
    }
    .menu {
    background-color: #f0f0f0;
    padding: 20px;
    text-align: center;
    }
</style>
</head>
<body>
<header class="hero">
    <h1>Restaurant Name</h1>
    <p>Welcome to our restaurant!</p>
</header>
<nav class="menu">
    <ul>
    <li><a href="#">Home</a></li>
    <li><a href="#">Menu</a></li>
    <li><a href="#">About</a></li>
    </ul>
</nav>
</body>
</html>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Restaurant Landing Page</title>
<style>
    body {
    font-family: Arial, sans-serif;
    }
    .hero {
    background-image: linear-gradient(to bottom, #333, #555);
    color: #fff;
    padding: 20px;
    text-align: center;
    max-width: 800px;
    margin: 0 auto;
    }
    .menu {
    background-color: #f0f0f0;
    padding: 20px;
    text-align: center;
    max-width: 800px;
    margin: 0 auto;
    }
    @media (max-width: 768px) {
    .hero, .menu {
        padding: 10px;
    }
    }
    @media (max-width: 480px) {
    .hero, .menu {
        padding: 5px;
    }
    }
</style>
</head>
<body>
<header class="hero">
    <h1>Restaurant Name</h1>
    <p>Welcome to our restaurant!</p>
</header>
<nav class="menu">
    <ul>
    <li><a href="#">Home</a></li>
    <li><a href="#">Menu</a></li>
    <li><a href="#">About</a></li>
    </ul>
</nav>
</body>
</html>
<header class="hero"><h1>Welcome to Our Restaurant</h1><p>Enjoy delicious food in a cozy atmosphere</p></header><div class="menu"><h2>Our Menu</h2><ul><li>Burgers</li><li>Pizzas</li><li>Sandwiches</li></ul></div>"""

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
