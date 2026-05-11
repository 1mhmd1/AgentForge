import os
import json
from datetime import datetime, timezone

# ── Injected Metadata ──────────────────────────────────────
RUN_ID = "ui_9b7b03aa"
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
HTML_CONTENT = "<section class=\"hero\"><h1>Welcome</h1><p>Tagline.</p></section><section class=\"menu\"><h2>Menu</h2><ul><li>Espresso - $3</li><li>Latte - $4</li></ul></section><section id=\"about\"><h2>Our Story</h2><div class=\"about-values\"><div class=\"left-column\"><p>Our story begins with a passion for crafting the perfect cup of coffee. We source our beans from the finest farms around the world and roast them in-house to bring out the unique flavors and aromas.</p><p>From our humble beginnings as a small coffee shop to our current status as a beloved brand, we've always remained committed to our core values: quality, community, and sustainability.</p></div><div class=\"right-column\"><div class=\"value-card\"><h3>Quality</h3><p>We're dedicated to serving only the highest-quality coffee, sourced from the best farms and roasted to perfection.</p><p>Our commitment to quality extends beyond our coffee to every aspect of our business, from the way we source our ingredients to the way we treat our customers.</p></div></div></div></section><section class=\"contact\"><h2>Get in Touch</h2><p>Address: 123 Main St, Anytown, USA</p><p>Phone: 555-555-5555</p><p>Email: <a href=\"mailto:info@coffeeshop.com\">info@coffeeshop.com</a></p></section><footer><p>&copy; 2023 Coffeeshop</p></footer><style>:root {  --coffee: #6F4E37;  --cream: #F5E6D3;  --gold: #D4AF37;  --spacing-xs: 8px;  --spacing-sm: 16px;  --spacing-md: 24px;  --spacing-lg: 32px;  --spacing-xl: 48px;  --font-size-xs: 12px;  --font-size-sm: 14px;  --font-size-md: 16px;  --font-size-lg: 20px; }  body {  font-family: Arial, sans-serif;  margin: 0;  padding: 0;  }  .hero {  padding: var(--spacing-xl) var(--spacing-md);  text-align: center;  }  .menu {  padding: var(--spacing-md) var(--spacing-md);  }  .menu ul {  list-style: none;  padding: 0;  }  .menu li {  margin-bottom: var(--spacing-sm);  }  .menu li:last-child {  margin-bottom: 0;  }  .about-values {  display: flex;  flex-wrap: wrap;  justify-content: space-between;  }  .about-values .left-column {  flex-basis: 50%;  }  .about-values .right-column {  flex-basis: 50%;  }  .about-values .value-card {  background-color: var(--cream);  padding: var(--spacing-md);  border-radius: var(--spacing-md);  box-shadow: 0 0 var(--spacing-md) rgba(0, 0, 0, 0.1);  }  .contact {  padding: var(--spacing-md);  }  .contact p {  margin-bottom: var(--spacing-sm);  }  .contact a {  text-decoration: none;  color: var(--coffee);  }  .contact a:hover {  color: var(--gold);  }  footer {  background-color: var(--coffee);  color: var(--cream);  padding: var(--spacing-md);  text-align: center;  }  footer p {  margin-bottom: var(--spacing-sm);  }  @media (min-width: 768px) {  .hero {  padding: var(--spacing-lg) var(--spacing-md);  }  .menu {  padding: var(--spacing-lg) var(--spacing-md);  }  .about-values {  flex-direction: row;  }  .about-values .left-column {  flex-basis: 33.33%;  }  .about-values .right-column {  flex-basis: 66.66%;  }  }  @media (min-width: 1024px) {  .hero {  padding: var(--spacing-xl) var(--spacing-lg);  }  .menu {  padding: var(--spacing-xl) var(--spacing-lg);  }  .about-values {  flex-direction: row;  }  .about-values .left-column {  flex-basis: 25%;  }  .about-values .right-column {  flex-basis: 75%;  }  }  .sticky-nav {  position: sticky;  top: 0;  background-color: var(--coffee);  padding: var(--spacing-md);  }  .sticky-nav ul {  list-style: none;  padding: 0;  }  .sticky-nav li {  display: inline-block;  margin-right: var(--spacing-sm);  }  .sticky-nav a {  text-decoration: none;  color: var(--cream);  }  .sticky-nav a:hover {  color: var(--gold);  }  .hero-gradient {  position: relative;  overflow: hidden;  }  .hero-gradient::before {  content: '';  position: absolute;  top: 0;  left: 0;  width: 100%;  height: 100%;  background-image: linear-gradient(to bottom, var(--coffee), var(--cream));  }  .menu-grid {  display: grid;  grid-template-columns: repeat(1, 1fr);  gap: var(--spacing-sm);  }  @media (min-width: 768px) {  .menu-grid {  grid-template-columns: repeat(2, 1fr);  }  }  @media (min-width: 1024px) {  .menu-grid {  grid-template-columns: repeat(3, 1fr);  }  }  .form-field {  display: block;  width: 100%;  padding: var(--spacing-md);  border: none;  border-radius: var(--spacing-md);  box-shadow: 0 0 var(--spacing-md) rgba(0, 0, 0, 0.1);  }  .form-field:focus {  outline: none;  border-color: var(--gold);  box-shadow: 0 0 var(--spacing-md) rgba(0, 0, 0, 0.1);  }  .form-field:hover {  border-color: var(--gold);  box-shadow: 0 0 var(--spacing-md) rgba(0, 0, 0, 0.1);  }  .button {  display: inline-block;  padding: var(--spacing-md);  border: none;  border-radius: var(--spacing-md);  background-color: var(--coffee);  color: var(--cream);  cursor: pointer;  }  .button:hover {  background-color: var(--gold);  color: var(--cream);  }  .button:active {  background-color: var(--cream);  color: var(--coffee);  }  html {  scroll-behavior: smooth;  }  .smooth-scroll {  scroll-behavior: smooth;  }</style>"

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
