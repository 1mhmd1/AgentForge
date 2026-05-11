import os
import json
from datetime import datetime, timezone

# ── Injected Metadata ──────────────────────────────────────
RUN_ID = "ui_c6326a4e"
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
HTML_CONTENT = "<section id='hero'><h1>Artisan Coffee, Crafted Daily</h1><p>Expertly roasted, expertly brewed.</p><button>Order Now</button><a href='#'>Learn More</a></section><section id='menu'><h2>Our Menu</h2><article class='menu-item'><h3>Espresso</h3><p>Rich and bold, our espresso is the perfect pick-me-up.</p><span class='price'>$3-$6</span></article><article class='menu-item'><h3>Cappuccino</h3><p>A perfect balance of espresso, steamed milk, and foam.</p><span class='price'>$4-$7</span></article><article class='menu-item'><h3>Mocha</h3><p>A rich and decadent blend of espresso, chocolate, and steamed milk.</p><span class='price'>$5-$8</span></article><article class='menu-item'><h3>Latte</h3><p>A smooth and creamy blend of espresso and steamed milk.</p><span class='price'>$4-$7</span></article><article class='menu-item'><h3>Macchiato</h3><p>A shot of espresso 'marked' with a small amount of frothed milk.</p><span class='price'>$3-$6</span></article><article class='menu-item'><h3>Cortado</h3><p>A shot of espresso topped with a generous dollop of frothed milk.</p><span class='price'>$4-$7</span></article><article class='menu-item'><h3>Flat White</h3><p>A velvety-smooth blend of espresso and steamed milk.</p><span class='price'>$4-$7</span></article><article class='menu-item'><h3>Americano</h3><p>Espresso diluted with hot water, giving a milder flavor.</p><span class='price'>$3-$6</span></article><section id='about'><h2>About Us</h2><p>We're passionate about serving the best coffee in town. Our expert baristas are dedicated to crafting each cup with love and care.</p></section><section id='contact'><h2>Get in Touch</h2><p>Phone: 555-555-5555 | Email: [info@artisancoffee.com](mailto:info@artisancoffee.com) | Address: 123 Main St, Anytown USA</p></section><footer><p>&copy; 2023 Artisan Coffee. All rights reserved.</p></footer><style>/* CSS Variables */:root {  --coffee: #6F4E37;  --cream: #F5E6D3;  --gold: #D4AF37;  --spacing-scale: 0.25rem 0.5rem 1rem 2rem;  --font-size-scale: 0.875 1 1.125 1.5;}/* Global Styles */body {  font-family: Arial, sans-serif;  margin: 0;  padding: 0;  box-sizing: border-box;}h1, h2, h3, h4, h5, h6 {  font-family: Arial, sans-serif;  font-weight: bold;}h1 {  font-size: var(--font-size-scale);  color: var(--coffee);}h2 {  font-size: var(--font-size-scale);  color: var(--coffee);}h3 {  font-size: var(--font-size-scale);  color: var(--coffee);}h4 {  font-size: var(--font-size-scale);  color: var(--coffee);}h5 {  font-size: var(--font-size-scale);  color: var(--coffee);}h6 {  font-size: var(--font-size-scale);  color: var(--coffee);}p {  font-size: var(--font-size-scale);  color: var(--cream);}button, a {  font-size: var(--font-size-scale);  color: var(--gold);  background-color: var(--coffee);  border: none;  padding: 1rem 2rem;  border-radius: 0.5rem;  cursor: pointer;}button:hover, a:hover {  background-color: var(--gold);  color: var(--coffee);}button:focus, a:focus {  outline: none;  box-shadow: 0 0 0 0.25rem var(--gold);}/* Breakpoints */@media (min-width: 768px) {  /* Tablet */  .menu {    display: grid;    grid-template-columns: repeat(2, 1fr);  }  .menu-item {    grid-column: span 1;  }}@media (min-width: 1024px) {  /* Desktop */  .menu {    display: grid;    grid-template-columns: repeat(3, 1fr);  }  .menu-item {    grid-column: span 1;  }}/* Hero */#hero {  background-image: linear-gradient(to bottom, var(--coffee), var(--gold));  background-size: 100% 300px;  background-position: 0% 100%;  height: 100vh;  display: flex;  justify-content: center;  align-items: center;}#hero h1 {  color: var(--cream);}#hero p {  color: var(--cream);}#hero button, #hero a {  background-color: var(--gold);  color: var(--coffee);}/* Menu */.menu {  background-color: var(--cream);  padding: 2rem;}#menu h2 {  color: var(--coffee);}#menu .menu-item {  background-color: var(--coffee);  padding: 1rem;  border-bottom: 1px solid var(--gold);}#menu .menu-item h3 {  color: var(--cream);}#menu .menu-item p {  color: var(--cream);}#menu .menu-item .price {  color: var(--gold);}/* About */#about {  background-color: var(--coffee);  padding: 2rem;}#about h2 {  color: var(--cream);}#about p {  color: var(--cream);}/* Contact */#contact {  background-color: var(--cream);  padding: 2rem;}#contact h2 {  color: var(--coffee);}#contact p {  color: var(--cream);}footer {  background-color: var(--coffee);  padding: 1rem;  text-align: center;}footer p {  color: var(--cream);}</style>"

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
