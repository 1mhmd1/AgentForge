import os
import json
from datetime import datetime, timezone

# ── Injected Metadata ──────────────────────────────────────
RUN_ID = "ui_ecfd7b1a"
OUTPUT_DIR = "output"
DOMAIN = "website_builder"
GOAL = "Develop a premium, single-file responsive landing page for an artisanal coffee shop with luxury design, filtered menu, and animations."
COMPLEXITY = "simple"
SUCCESS_CRITERIA = "Task completed"
STEPS = ["Generate HTML page"]
TOOLS = ["generate", "code"]
INPUTS = []
OUTPUTS = []

# ── Website Content ──────────────────────────────────────
HTML_CONTENT = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>Artisanal Coffee | Premium Brews & Luxury Experience</title>\n    <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n    <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n    <link href=\"https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@300;400;600&display=swap\" rel=\"stylesheet\">\n    <style>\n        :root {\n            --cream: #F5E6D3;\n            --espresso: #2C1B18;\n            --gold: #C5A059;\n            --glass: rgba(255, 255, 255, 0.1);\n            --glass-border: rgba(255, 255, 255, 0.2);\n            --transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);\n        }\n\n        * {\n            margin: 0;\n            padding: 0;\n            box-sizing: border-box;\n        }\n\n        html {\n            scroll-behavior: smooth;\n        }\n\n        body {\n            background-color: var(--espresso);\n            color: var(--cream);\n            font-family: 'Inter', sans-serif;\n            line-height: 1.6;\n            overflow-x: hidden;\n        }\n\n        h1, h2, h3, .serif {\n            font-family: 'Playfair Display', serif;\n            font-weight: 700;\n        }\n\n        /* Glassmorphism Nav */\n        nav {\n            position: fixed;\n            top: 0;\n            width: 100%;\n            z-index: 1000;\n            background: rgba(44, 27, 24, 0.8);\n            backdrop-filter: blur(10px);\n            border-bottom: 1px solid var(--glass-border);\n            padding: 1rem 5%;\n            display: flex;\n            justify-content: space-between;\n            align-items: center;\n        }\n\n        .nav-links {\n            display: flex;\n            gap: 2rem;\n        }\n\n        .nav-links a {\n            color: var(--cream);\n            text-decoration: none;\n            font-size: 0.9rem;\n            text-transform: uppercase;\n            letter-spacing: 1px;\n            transition: var(--transition);\n        }\n\n        .nav-links a:hover {\n            color: var(--gold);\n        }\n\n        /* Hero Section */\n        .hero {\n            height: 100vh;\n            display: flex;\n            flex-direction: column;\n            justify-content: center;\n            align-items: center;\n            text-align: center;\n            background: linear-gradient(rgba(44, 27, 24, 0.6), rgba(44, 27, 24, 0.6)), url('https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&q=80&w=2070') center/cover;\n            padding: 0 10%;\n        }\n\n        .hero h1 {\n            font-size: clamp(2.5rem, 8vw, 5rem);\n            margin-bottom: 1rem;\n        }\n\n        /* Menu Section */\n        .menu-section {\n            padding: 100px 5%;\n            max-width: 1200px;\n            margin: 0 auto;\n        }\n\n        .filter-buttons {\n            display: flex;\n            justify-content: center;\n            gap: 1rem;\n            margin-bottom: 3rem;\n            flex-wrap: wrap;\n        }\n\n        .filter-btn {\n            background: transparent;\n            border: 1px solid var(--gold);\n            color: var(--gold);\n            padding: 0.5rem 1.5rem;\n            cursor: pointer;\n            transition: var(--transition);\n            font-family: 'Inter', sans-serif;\n        }\n\n        .filter-btn.active, .filter-btn:hover {\n            background: var(--gold);\n            color: var(--espresso);\n        }\n\n        .menu-grid {\n            display: grid;\n            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));\n            gap: 2rem;\n        }\n\n        /* Glassmorphism Cards */\n        .menu-item {\n            background: var(--glass);\n            backdrop-filter: blur(5px);\n            border: 1px solid var(--glass-border);\n            padding: 2rem;\n            border-radius: 4px;\n            transition: var(--transition);\n            opacity: 0;\n            transform: translateY(30px);\n        }\n\n        .menu-item.visible {\n            opacity: 1;\n            transform: translateY(0);\n        }\n\n        .menu-item:hover {\n            border-color: var(--gold);\n            transform: translateY(-5px);\n        }\n\n        .menu-item h3 {\n            color: var(--gold);\n            margin-bottom: 0.5rem;\n        }\n\n        .price {\n            display: block;\n            margin-top: 1rem;\n            font-weight: 600;\n            color: var(--gold);\n        }\n\n        /* Contact Form */\n        .contact-section {\n            padding: 100px 5%;\n            background: #231513;\n        }\n\n        .contact-container {\n            max-width: 800px;\n            margin: 0 auto;\n        }\n\n        form {\n            display: grid;\n            gap: 1.5rem;\n        }\n\n        input, textarea {\n            width: 100%;\n            padding: 1rem;\n            background: var(--glass);\n            border: 1px solid var(--glass-border);\n            color: var(--cream);\n            font-family: 'Inter', sans-serif;\n        }\n\n        button[type=\"submit\"] {\n            background: var(--gold);\n            color: var(--espresso);\n            border: none;\n            padding: 1rem 2rem;\n            font-weight: 600;\n            cursor: pointer;\n            text-transform: uppercase;\n        }\n\n        /* Footer */\n        footer {\n            padding: 50px 5%;\n            border-top: 1px solid var(--glass-border);\n            text-align: center;\n        }\n\n        .hours-table {\n            margin: 2rem auto;\n            border-collapse: collapse;\n        }\n\n        .hours-table td {\n            padding: 0.5rem 2rem;\n            border-bottom: 1px solid var(--glass-border);\n        }\n\n        /* Animations */\n        @keyframes fadeInUp {\n            from {\n                opacity: 0;\n                transform: translateY(30px);\n            }\n            to {\n                opacity: 1;\n                transform: translateY(0);\n            }\n        }\n\n        .reveal {\n            opacity: 0;\n            transition: all 0.8s ease-out;\n        }\n\n        .reveal.active {\n            opacity: 1;\n            transform: translateY(0);\n        }\n\n        /* Mobile Adjustments */\n        @media (max-width: 768px) {\n            .nav-links {\n                display: none;\n            }\n            .hero h1 {\n                font-size: 3rem;\n            }\n        }\n    </style>\n</head>\n<body>\n\n    <nav>\n        <div class=\"logo serif\" style=\"font-size: 1.5rem; color: var(--gold);\">L'Artisan</div>\n        <div class=\"nav-links\">\n            <a href=\"#home\">Home</a>\n            <a href=\"#menu\">Menu</a>\n            <a href=\"#contact\">Contact</a>\n        </div>\n    </nav>\n\n    <section id=\"home\" class=\"hero\">\n        <h1 class=\"reveal\">The Art of the Pour</h1>\n        <p class=\"reveal\" style=\"max-width: 600px;\">Experience the finest single-origin beans, roasted to perfection and served in an atmosphere of quiet luxury.</p>\n    </section>\n\n    <section id=\"menu\" class=\"menu-section\">\n        <h2 style=\"text-align: center; font-size: 2.5rem; margin-bottom: 2rem;\">Our Curated Selection</h2>\n        \n        <div class=\"filter-buttons\">\n            <button class=\"filter-btn active\" data-filter=\"all\">All</button>\n            <button class=\"filter-btn\" data-filter=\"espresso\">Espresso</button>\n            <button class=\"filter-btn\" data-filter=\"pour-over\">Pour Over</button>\n            <button class=\"filter-btn\" data-filter=\"pastry\">Pastries</button>\n        </div>\n\n        <div class=\"menu-grid\">\n            <div class=\"menu-item\" data-category=\"espresso\">\n                <h3>Velvet Latte</h3>\n                <p>Double shot of our house blend with micro-foam milk.</p>\n                <span class=\"price\">$6.50</span>\n            </div>\n            <div class=\"menu-item\" data-category=\"espresso\">\n                <h3>Cortado Gold</h3>\n                <p>Equal parts espresso and warm silky milk.</p>\n                <span class=\"price\">$5.00</span>\n            </div>\n            <div class=\"menu-item\" data-category=\"pour-over\">\n                <h3>Ethiopian Yirgacheffe</h3>\n                <p>Floral notes with a bright, tea-like finish.</p>\n                <span class=\"price\">$8.00</span>\n            </div>\n            <div class=\"menu-item\" data-category=\"pour-over\">\n                <h3>Colombian Reserve</h3>\n                <p>Rich chocolate body with hints of red cherry.</p>\n                <span class=\"price\">$7.50</span>\n            </div>\n            <div class=\"menu-item\" data-category=\"pastry\">\n                <h3>Almond Croissant</h3>\n                <p>Twice-baked with house-made frangipane.</p>\n                <span class=\"price\">$5.50</span>\n            </div>\n            <div class=\"menu-item\" data-category=\"pastry\">\n                <h3>Dark Chocolate Tart</h3>\n                <p>70% cocoa with a sea salt finish.</p>\n                <span class=\"price\">$7.00</span>\n            </div>\n        </div>\n    </section>\n\n    <section id=\"contact\" class=\"contact-section\">\n        <div class=\"contact-container reveal\">\n            <h2 style=\"text-align: center; font-size: 2.5rem; margin-bottom: 2rem;\">Reservations & Inquiries</h2>\n            <form id=\"contactForm\">\n                <input type=\"text\" placeholder=\"Full Name\" required>\n                <input type=\"email\" placeholder=\"Email Address\" required>\n                <textarea rows=\"5\" placeholder=\"Your Message\" required></textarea>\n                <button type=\"submit\">Send Message</button>\n            </form>\n        </div>\n    </section>\n\n    <footer>\n        <div class=\"footer-content\">\n            <h3 class=\"serif\" style=\"color: var(--gold); font-size: 1.8rem;\">L'Artisan Coffee</h3>\n            <p>123 Luxury Lane, Metropolis</p>\n            <table class=\"hours-table\">\n                <tr><td>Mon - Fri</td><td>07:00 - 19:00</td></tr>\n                <tr><td>Sat - Sun</td><td>08:00 - 21:00</td></tr>\n            </table>\n            <div class=\"socials\" style=\"margin-top: 1rem;\">\n                <span style=\"margin: 0 10px;\">Instagram</span>\n                <span style=\"margin: 0 10px;\">Facebook</span>\n            </div>\n            <p style=\"margin-top: 2rem; font-size: 0.8rem; color: var(--gold); opacity: 0.6;\">&copy; 2023 L'Artisan Coffee. All Rights Reserved.</p>\n        </div>\n    </footer>\n\n    <script>\n        // Smooth Scroll\n        document.querySelectorAll('a[href^=\"#\"]').forEach(anchor => {\n            anchor.addEventListener('click', function (e) {\n                e.preventDefault();\n                document.querySelector(this.getAttribute('href')).scrollIntoView({\n                    behavior: 'smooth'\n                });\n            });\n        });\n\n        // Menu Filtering Logic\n        const filterBtns = document.querySelectorAll('.filter-btn');\n        const menuItems = document.querySelectorAll('.menu-item');\n\n        filterBtns.forEach(btn => {\n            btn.addEventListener('click', () => {\n                filterBtns.forEach(b => b.classList.remove('active'));\n                btn.classList.add('active');\n                \n                const filter = btn.getAttribute('data-filter');\n                \n                menuItems.forEach(item => {\n                    if (filter === 'all' || item.getAttribute('data-category') === filter) {\n                        item.style.display = 'block';\n                        setTimeout(() => item.classList.add('visible'), 10);\n                    } else {\n                        item.classList.remove('visible');\n                        setTimeout(() => item.style.display = 'none', 400);\n                    }\n                });\n            });\n        });\n\n        // Intersection Observer for Fade-In\n        const observerOptions = {\n            threshold: 0.1\n        };\n\n        const observer = new IntersectionObserver((entries) => {\n            entries.forEach(entry => {\n                if (entry.isIntersecting) {\n                    entry.target.classList.add('visible');\n                    entry.target.classList.add('active');\n                }\n            });\n        }, observerOptions);\n\n        document.querySelectorAll('.menu-item, .reveal').forEach(el => {\n            observer.observe(el);\n        });\n\n        // Form Submission Mockup\n        document.getElementById('contactForm').addEventListener('submit', (e) => {\n            e.preventDefault();\n            alert('Thank you for your message. Our concierge will contact you shortly.');\n            e.target.reset();\n        });\n    </script>\n</body>\n</html>"

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
