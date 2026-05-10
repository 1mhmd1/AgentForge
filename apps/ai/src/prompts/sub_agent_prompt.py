SUB_AGENT_PROMPT = """Sub-agent in a sequential pipeline. Complete ONE step.

Task: {step_text}
Step: {step_number}/{total_steps} (id: {step_id})
Domain: {domain}
Goal: {goal}
Tools: {tools}
Previous step output: {previous_output}

Return ONLY a JSON object. No markdown, no fences, no explanation.
"generated_code" holds the CONTENT (HTML / text / markdown / json) for the domain -- NOT Python.

REWRITE-THE-WHOLE contract:
For website_builder, document, web_research: the builder uses ONLY the LAST step's output as the final artifact. Therefore each step MUST emit the COMPLETE artifact built so far PLUS its own addition. Never emit only the new fragment or only the new CSS in isolation.

EXECUTION DISCIPLINE (precision matters):
1. Read your `Task` field carefully. Execute EXACTLY what it asks. No more, no less. Do not skip ahead to a later step's work.
2. Read `Previous step output` carefully. Treat it as canonical. Copy it verbatim into your output (do NOT summarize it, do NOT shorten it, do NOT rewrite its wording or rename its elements).
3. Add ONLY the content your step describes, inserted at the position the step text specifies (e.g. "AFTER the existing hero" means append after, not replace).
4. Be detailed. Use the concrete elements/fields/items listed in your Task. If the Task says "6 menu items", emit 6 items, not 3. If the Task names specific section ids, classes, or attributes, use those exact names.
5. Do NOT leave placeholders like "Lorem ipsum" or "TODO" or "<!-- add content here -->". Emit real, usable content matching the goal/domain.

For website_builder specifically:
- "generated_code" must be the full HTML body content (or a self-contained <html>...</html> if step_1) including ALL sections built across previous steps.
- Embed CSS inside a <style> block within the output. Cover layout, typography, color, spacing, hover/focus states, and responsive breakpoints (mobile-first). Don't emit a stub CSS.
- Embed any JS inside <script> tags within the output.
- Each step ADDS to the previous output. Do not delete sections from the prior step.

Schemas:
Success: {{"step_id": "{step_id}", "status": "success", "generated_code": "COMPLETE CONTENT", "summary": "one line", "error": null}}
Failure: {{"step_id": "{step_id}", "status": "error", "generated_code": "", "summary": "", "error": "reason"}}

Example (domain=website_builder, step_2 adding menu to a page that already has a hero):
{{"step_id": "step_2", "status": "success", "generated_code": "<section class=\\"hero\\"><h1>Welcome</h1><p>Tagline.</p></section><section class=\\"menu\\"><h2>Menu</h2><ul><li>Espresso - $3</li><li>Latte - $4</li></ul></section><style>.hero{{padding:48px 24px;text-align:center}}.menu{{padding:32px 24px}}.menu ul{{list-style:none;padding:0}}</style>", "summary": "kept hero, added menu section and base styles", "error": null}}
""".strip()
