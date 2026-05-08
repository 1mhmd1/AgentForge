import os
import json
from datetime import datetime, timezone

# ── Injected by Builder ───────────────────────────────────────────────
RUN_ID           = "ui_9e4b8c72"
OUTPUT_DIR       = "output"
DOMAIN           = "website_builder"
GOAL             = "Build a landing page for a coffee shop"
COMPLEXITY       = "medium"
SUCCESS_CRITERIA = "A fully functional HTML landing page with menu, contact form, and map"
STEPS            = ["Design page layout with hero section", "Add menu section with coffee items", "Create contact form", "Add location map", "Style with responsive CSS"]
TOOLS            = ["generate", "code"]







INPUTS           = []
OUTPUTS          = []

# ── Domain-specific (website_builder) ────────────────────────────────
def get_input(name: str, default=None):
    for item in INPUTS:
        if item.get("name") == name:
            return item.get("value", default)
    return default

SITE_NAME           = get_input("site_name", "AgentForge Site")
SITE_DESCRIPTION    = get_input("site_description", "")
PAGES               = get_input("pages", [])              # e.g. ["index", "about", "contact"]
SECTIONS            = get_input("sections", [])           # e.g. ["hero", "features", "footer"]
STYLE_TOKENS        = get_input("style_tokens", {})       # e.g. {"primary": "#3C3489", "font": "Inter"}
JS_FEATURES         = get_input("js_features", [])        # e.g. ["mobile-menu", "form-validation"]
LAYOUT_CONSTRAINTS  = get_input("layout_constraints", {})  # e.g. {"max_width": "1200px", "responsive": true}

# ── Output paths ──────────────────────────────────────────────────────
HTML_PATH      = os.path.join(OUTPUT_DIR, "index.html")
CSS_PATH       = os.path.join(OUTPUT_DIR, "style.css")
JS_PATH        = os.path.join(OUTPUT_DIR, "script.js")
ASSETS_DIR     = os.path.join(OUTPUT_DIR, "assets")
METADATA_PATH  = os.path.join(OUTPUT_DIR, "metadata.json")

# ── Helpers ───────────────────────────────────────────────────────────

def ensure_output_dir() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(ASSETS_DIR, exist_ok=True)

def write_file(path: str, content: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"[+] Written: {path}")

def read_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def write_json(path: str, data: dict | list) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"[+] Written: {path}")

def save_metadata(status: str, files: list | None = None, error: str | None = None) -> None:
    meta = {
        "run_id": RUN_ID,
        "domain": DOMAIN,
        "goal": GOAL,
        "site_name": SITE_NAME,
        "site_description": SITE_DESCRIPTION,
        "pages": PAGES,
        "sections": SECTIONS,
        "js_features": JS_FEATURES,
        "files_generated": files or [],
        "status": status,
        "error": error,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }
    write_json(METADATA_PATH, meta)

# ── Builder Injection Functions ───────────────────────────────────────

def generate_html() -> str:
    """
    Generate the HTML structure for the website.
    Builder injects the full HTML content here.
    """

    

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{SITE_NAME}</title>
    <meta name="description" content="{SITE_DESCRIPTION}">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="site-shell">
        
    </div>

    <script src="script.js"></script>
</body>
</html>"""
    return html

def generate_css() -> str:
    """
    Generate the CSS stylesheet for the website.
    Builder injects the full CSS content here.
    """

    

    primary = STYLE_TOKENS.get("primary", "#3C3489")
    secondary = STYLE_TOKENS.get("secondary", "#085041")
    font = STYLE_TOKENS.get("font", "Inter, sans-serif")
    max_width = LAYOUT_CONSTRAINTS.get("max_width", "1200px")

    css = f"""/* AgentForge — {SITE_NAME} */
/* Generated: {datetime.now(timezone.utc).isoformat()} */

:root {{
    --primary: {primary};
    --secondary: {secondary};
    --font: {font};
    --max-width: {max_width};
}}

*, *::before, *::after {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}}

body {{
    font-family: var(--font);
    color: #1a1a1a;
    line-height: 1.6;
}}

.site-shell {{
    max-width: var(--max-width);
    margin: 0 auto;
    padding: 0 1.5rem;
}}



/* ── Responsive ── */
@media (max-width: 768px) {{
    
}}
"""
    return css

def generate_js() -> str:
    """
    Generate JavaScript for the website.
    Builder injects the full JS content here.
    """

    

    js = f"""// AgentForge — {SITE_NAME}
// Generated: {datetime.now(timezone.utc).isoformat()}
// Features: {", ".join(JS_FEATURES)}

document.addEventListener("DOMContentLoaded", () => {{

    

    

    

    

}});
"""
    return js

# ── Step Execution Functions ──────────────────────────────────────────



def execute_step_1():
    """
    Step 1/5

    Design page layout with hero section
    """

    hero_section = create_hero_section()




def execute_step_2():
    """
    Step 2/5

    Add menu section with coffee items
    """

    menu_section = create_menu_section('coffee')




def execute_step_3():
    """
    Step 3/5

    Create contact form
    """

    contact_form = create_contact_form()




def execute_step_4():
    """
    Step 4/5

    Add location map
    """

    location_map = create_location_map()




def execute_step_5():
    """
    Step 5/5

    Style with responsive CSS
    """

    responsive_css = apply_responsive_css()




# ── Runner ────────────────────────────────────────────────────────────

def run() -> None:
    ensure_output_dir()

    print(f"[AgentForge:{DOMAIN}] run_id={RUN_ID}")
    print(f"[AgentForge:{DOMAIN}] site={SITE_NAME}")
    print(f"[AgentForge:{DOMAIN}] steps={len(STEPS)}")

    try:
        step_results = {}

        
        print(f"[Step 1] Design page layout with hero section")
        step_results["step_1"] = execute_step_1()
        
        print(f"[Step 2] Add menu section with coffee items")
        step_results["step_2"] = execute_step_2()
        
        print(f"[Step 3] Create contact form")
        step_results["step_3"] = execute_step_3()
        
        print(f"[Step 4] Add location map")
        step_results["step_4"] = execute_step_4()
        
        print(f"[Step 5] Style with responsive CSS")
        step_results["step_5"] = execute_step_5()
        

        html = generate_html()
        css = generate_css()
        js = generate_js()

        write_file(HTML_PATH, html)
        write_file(CSS_PATH, css)
        write_file(JS_PATH, js)

        files_generated = [HTML_PATH, CSS_PATH, JS_PATH]
        save_metadata("completed", files=files_generated)
        print(f"[AgentForge:{DOMAIN}] Done. Output: {OUTPUT_DIR}")

    except Exception as exc:
        save_metadata("failed", error=str(exc))
        raise

if __name__ == "__main__":
    run()