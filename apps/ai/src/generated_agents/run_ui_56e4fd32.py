import os
import json
from datetime import datetime, timezone

# ── Injected Metadata ──────────────────────────────────────
RUN_ID = "ui_56e4fd32"
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
HTML_CONTENT = "<section id='hero'><h1>Welcome to our premium coffee shop</h1><p>Experience the perfect blend of quality and taste</p><button>Order Now</button><a href='#'>Learn More</a></section><section id='menu'><h2>Menu</h2><ul><li>Espresso - $3</li><li>Latte - $4</li></ul></section><section id='about'><h2>Our Story</h2><div class='about-left'><p>We are passionate about serving the finest coffee to our customers. Our team of expert baristas carefully select the highest quality beans to create unique blends that will tantalize your taste buds.</p><p>From the moment you step into our cozy coffee shop, you'll feel the warmth and hospitality that we're known for. Our friendly staff will guide you through our menu, ensuring that you find the perfect cup to suit your mood.</p></div><div class='about-right'><p>Our coffee shop is a place where you can relax and enjoy a cup of coffee with friends or family. We have a wide variety of coffee drinks to choose from, including espresso, cappuccino, and latte.</p><p>Our coffee beans are sourced from the finest farms around the world, ensuring that every cup is of the highest quality. We take pride in our coffee-making process, using only the freshest ingredients and traditional methods to create a truly unique experience.</p></div></section><section id='contact'><h2>Get in Touch</h2><p>Address: 123 Main St, Anytown, USA</p><p>Phone: 555-555-5555</p><p>Email: <a href='mailto:info@coffeeshop.com'>info@coffeeshop.com</a></p></section><footer><p>&copy; 2023 Coffee Shop</p></footer><style>\n  :root {\n    --coffee: #6F4E37;\n    --cream: #F5E6D3;\n    --gold: #D4AF37;\n    --spacing-scale: 0.25rem 0.5rem 1rem 2rem 3rem;\n    --font-size-scale: 0.75rem 1rem 1.25rem 1.5rem 2rem;\n  }\n\n  body {\n    font-family: Arial, sans-serif;\n    margin: 0;\n    padding: 0;\n  }\n\n  .hero {\n    background-image: linear-gradient(to bottom, var(--coffee), var(--cream));\n    background-size: 100% 300px;\n    background-position: 0% 100%;\n    height: 100vh;\n    display: flex;\n    justify-content: center;\n    align-items: center;\n    color: #fff;\n  }\n\n  .hero button, .hero a {\n    background-color: var(--gold);\n    color: #fff;\n    border: none;\n    padding: 1rem 2rem;\n    font-size: 1.5rem;\n    cursor: pointer;\n  }\n\n  .hero button:hover, .hero a:hover {\n    background-color: #ccc;\n  }\n\n  .menu {\n    background-color: #f7f7f7;\n    padding: 2rem;\n  }\n\n  .menu ul {\n    list-style: none;\n    padding: 0;\n    margin: 0;\n  }\n\n  .menu li {\n    padding: 1rem;\n    border-bottom: 1px solid #ccc;\n  }\n\n  .menu li:last-child {\n    border-bottom: none;\n  }\n\n  .menu a {\n    text-decoration: none;\n    color: #333;\n  }\n\n  .menu a:hover {\n    color: #666;\n  }\n\n  .about {\n    display: flex;\n    justify-content: space-between;\n    padding: 2rem;\n  }\n\n  .about-left, .about-right {\n    flex-basis: 45%;\n  }\n\n  .about-left p, .about-right p {\n    margin-bottom: 1rem;\n  }\n\n  .contact {\n    padding: 2rem;\n  }\n\n  .contact p {\n    margin-bottom: 1rem;\n  }\n\n  .contact a {\n    text-decoration: none;\n    color: #333;\n  }\n\n  .contact a:hover {\n    color: #666;\n  }\n\n  footer {\n    background-color: #333;\n    color: #fff;\n    padding: 1rem;\n    text-align: center;\n  }\n\n  @media (min-width: 768px) {\n    .hero {\n      background-size: 100% 400px;\n    }\n  }\n\n  @media (min-width: 1024px) {\n    .hero {\n      background-size: 100% 500px;\n    }\n  }\n\n  html {\n    scroll-behavior: smooth;\n  }\n\n  button {\n    transition: background-color 0.2s ease-in-out;\n  }\n\n  button:hover {\n    background-color: #ccc;\n  }\n\n  a {\n    transition: color 0.2s ease-in-out;\n  }\n\n  a:hover {\n    color: #666;\n  }\n</style>"

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
