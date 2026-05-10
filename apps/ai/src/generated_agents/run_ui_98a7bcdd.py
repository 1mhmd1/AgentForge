import os
import json
from datetime import datetime, timezone

# ── Injected Metadata ──────────────────────────────────────
RUN_ID = "ui_98a7bcdd"
OUTPUT_DIR = "output"
DOMAIN = "website_builder"
GOAL = "Design a world-class premium landing page for a modern coffee shop brand"
COMPLEXITY = "simple"
SUCCESS_CRITERIA = "Task completed"
STEPS = ["Generate HTML page"]
TOOLS = ["generate", "code"]
INPUTS = []
OUTPUTS = []

# ── Website Content ──────────────────────────────────────
HTML_CONTENT = "<script>document.addEventListener('DOMContentLoaded', function(){var sections = document.querySelectorAll('section');var currentSection = 0;function smoothScroll(sectionIndex){var section = sections[sectionIndex];var sectionTop = section.offsetTop;var sectionHeight = section.offsetHeight;var windowTop = window.scrollY;var windowBottom = windowTop + window.innerHeight;var scrollPosition;if(sectionTop < windowBottom && sectionTop + sectionHeight > windowTop){scrollPosition = sectionTop - (windowTop + window.innerHeight / 2 - sectionHeight / 2);}else if(sectionTop < windowTop){scrollPosition = sectionTop;}else{scrollPosition = sectionTop - sectionHeight;}window.scrollTo({top: scrollPosition, behavior: 'smooth'});}function animateSectionTransition(currentSectionIndex, nextSectionIndex){var currentSection = sections[currentSectionIndex];var nextSection = sections[nextSectionIndex];currentSection.style.opacity = 0;setTimeout(function(){currentSection.style.display = 'none';}, 500);setTimeout(function(){nextSection.style.display = 'block';}, 500);setTimeout(function(){nextSection.style.opacity = 1;}, 1000);setTimeout(function(){smoothScroll(nextSectionIndex);}, 1500);}document.addEventListener('wheel', function(event){if(event.deltaY > 0){animateSectionTransition(currentSection, currentSection + 1);}else if(event.deltaY < 0){animateSectionTransition(currentSection, currentSection - 1);}});var currentSection = 0;animateSectionTransition(currentSection, currentSection);});</script>"

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
