import os
import json
from datetime import datetime, timezone

# ── Injected Metadata ──────────────────────────────────────
RUN_ID = "ui_6407793e"
OUTPUT_DIR = "output"
DOMAIN = "website_builder"
GOAL = "Build a responsive, single-file coffee shop landing page with hero, menu, and contact sections."
COMPLEXITY = "simple"
SUCCESS_CRITERIA = "Task completed"
STEPS = ["Generate HTML page"]
TOOLS = ["generate", "code"]
INPUTS = []
OUTPUTS = []

# ── Website Content ──────────────────────────────────────
HTML_CONTENT = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <meta name=\"description\" content=\"Experience the finest crafted coffee and community spirit at our local coffee shop.\">\n    <title>Crafted Coffee | Community Spirit</title>\n    <style>\n        :root {\n            --bean-brown: #3d2b1f;\n            --cream: #f5f5dc;\n            --accent: #c0a080;\n            --white: #ffffff;\n            --text-dark: #2c1e16;\n            --spacing-sm: 1rem;\n            --spacing-md: 2rem;\n            --spacing-lg: 4rem;\n            --transition: all 0.3s ease;\n        }\n\n        * {\n            box-sizing: border-box;\n            margin: 0;\n            padding: 0;\n        }\n\n        html {\n            scroll-behavior: smooth;\n        }\n\n        body {\n            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;\n            line-height: 1.6;\n            color: var(--text-dark);\n            background-color: var(--white);\n        }\n\n        h1, h2, h3 {\n            color: var(--bean-brown);\n            margin-bottom: var(--spacing-sm);\n            line-height: 1.2;\n        }\n\n        img {\n            max-width: 100%;\n            display: block;\n        }\n\n        /* Layout Containers */\n        .container {\n            width: 90%;\n            max-width: 1200px;\n            margin: 0 auto;\n            padding: var(--spacing-lg) 0;\n        }\n\n        /* Hero Section */\n        .hero {\n            height: 80vh;\n            background: linear-gradient(rgba(61, 43, 31, 0.7), rgba(61, 43, 31, 0.7)), url('https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&q=80&w=1920');\n            background-size: cover;\n            background-position: center;\n            display: flex;\n            align-items: center;\n            justify-content: center;\n            text-align: center;\n            color: var(--cream);\n        }\n\n        .hero-content h1 {\n            color: var(--cream);\n            font-size: 2.5rem;\n            margin-bottom: 1rem;\n        }\n\n        .btn {\n            display: inline-block;\n            padding: 0.8rem 2rem;\n            background-color: var(--accent);\n            color: var(--bean-brown);\n            text-decoration: none;\n            font-weight: bold;\n            border-radius: 4px;\n            transition: var(--transition);\n            border: none;\n            cursor: pointer;\n        }\n\n        .btn:hover {\n            background-color: var(--bean-brown);\n            color: var(--cream);\n            transform: translateY(-2px);\n        }\n\n        /* Menu Grid */\n        .menu-grid {\n            display: grid;\n            grid-template-columns: 1fr;\n            gap: var(--spacing-md);\n        }\n\n        .menu-item {\n            padding: var(--spacing-sm);\n            border-bottom: 1px solid var(--accent);\n            transition: var(--transition);\n        }\n\n        .menu-item:hover {\n            background-color: var(--cream);\n        }\n\n        /* About Section */\n        .about {\n            background-color: var(--cream);\n        }\n\n        /* Contact Form */\n        .contact-form {\n            display: flex;\n            flex-direction: column;\n            gap: 1rem;\n            max-width: 600px;\n            margin: 0 auto;\n        }\n\n        .contact-form input, .contact-form textarea {\n            padding: 0.8rem;\n            border: 1px solid var(--accent);\n            border-radius: 4px;\n            width: 100%;\n        }\n\n        /* Footer */\n        footer {\n            background-color: var(--bean-brown);\n            color: var(--cream);\n            text-align: center;\n            padding: var(--spacing-md) 0;\n        }\n\n        /* Responsive Breakpoints */\n        @media (min-width: 768px) {\n            .hero-content h1 { font-size: 3.5rem; }\n            .menu-grid {\n                grid-template-columns: repeat(2, 1fr);\n            }\n            .about-content {\n                display: grid;\n                grid-template-columns: 1fr 1fr;\n                gap: var(--spacing-md);\n                align-items: center;\n            }\n        }\n\n        @media (min-width: 1024px) {\n            .menu-grid {\n                grid-template-columns: repeat(3, 1fr);\n            }\n        }\n    </style>\n</head>\n<body>\n\n    <header>\n        <section class=\"hero\">\n            <div class=\"hero-content\">\n                <h1>Crafted Coffee, Community Spirit</h1>\n                <p>Your daily escape into rich aromas and warm smiles.</p>\n                <br>\n                <a href=\"#menu\" class=\"btn\">View Menu</a>\n            </div>\n        </section>\n    </header>\n\n    <main>\n        <section id=\"menu\" class=\"container\">\n            <h2 style=\"text-align: center;\">Our Signature Brews</h2>\n            <div class=\"menu-grid\">\n                <div class=\"menu-item\">\n                    <h3>Classic Espresso</h3>\n                    <p>Bold, rich, and smooth. The heart of everything we do.</p>\n                    <span>$3.50</span>\n                </div>\n                <div class=\"menu-item\">\n                    <h3>Velvet Latte</h3>\n                    <p>Steamed milk poured over our signature espresso blend.</p>\n                    <span>$4.75</span>\n                </div>\n                <div class=\"menu-item\">\n                    <h3>Cold Brew Reserve</h3>\n                    <p>Steeped for 18 hours for a low-acid, high-caffeine kick.</p>\n                    <span>$5.00</span>\n                </div>\n                <div class=\"menu-item\">\n                    <h3>Caramel Macchiato</h3>\n                    <p>Freshly steamed milk with vanilla-flavored syrup marked with espresso.</p>\n                    <span>$5.25</span>\n                </div>\n                <div class=\"menu-item\">\n                    <h3>Pour Over</h3>\n                    <p>Single-origin beans rotated weekly for the true connoisseur.</p>\n                    <span>$4.50</span>\n                </div>\n                <div class=\"menu-item\">\n                    <h3>Artisan Pastry</h3>\n                    <p>Flaky, buttery croissants baked fresh every morning.</p>\n                    <span>$3.95</span>\n                </div>\n            </div>\n        </section>\n\n        <section id=\"about\" class=\"about\">\n            <div class=\"container\">\n                <div class=\"about-content\">\n                    <div>\n                        <h2>Our Story</h2>\n                        <p>Founded in 2015, Crafted Coffee began with a simple mission: to serve the perfect cup while fostering a space where neighbors become friends. We source our beans ethically from small-batch farmers, ensuring every sip supports global communities as much as our local one.</p>\n                    </div>\n                    <img src=\"https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&q=80&w=600\" alt=\"Coffee shop interior\">\n                </div>\n            </div>\n        </section>\n\n        <section id=\"contact\" class=\"container\">\n            <h2 style=\"text-align: center;\">Get in Touch</h2>\n            <form class=\"contact-form\">\n                <input type=\"text\" placeholder=\"Your Name\" required>\n                <input type=\"email\" placeholder=\"Your Email\" required>\n                <textarea rows=\"5\" placeholder=\"How can we help you?\" required></textarea>\n                <button type=\"submit\" class=\"btn\">Send Message</button>\n            </form>\n        </section>\n    </main>\n\n    <footer>\n        <div class=\"container\">\n            <p>123 Brew Lane, Coffee City, CK 54321</p>\n            <p>&copy; 2023 Crafted Coffee. All rights reserved.</p>\n        </div>\n    </footer>\n\n</body>\n</html>"

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
