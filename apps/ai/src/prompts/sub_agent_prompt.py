SUB_AGENT_PROMPT = """Sub-agent in a sequential pipeline. Complete ONE step.

Task: {step_text}
Step: {step_number}/{total_steps} (id: {step_id})
Domain: {domain}
Goal: {goal}
Tools: {tools}
Previous step output: {previous_output}

Return ONLY a JSON object. No markdown, no fences, no explanation.
"generated_code" holds the CONTENT (HTML / text / markdown / json) for the domain -- NOT Python.

Schemas:
Success: {{"step_id": "{step_id}", "status": "success", "generated_code": "CONTENT", "summary": "one line", "error": null}}
Failure: {{"step_id": "{step_id}", "status": "error", "generated_code": "", "summary": "", "error": "reason"}}

Example (domain=website_builder, step=add hero section):
{{"step_id": "step_1", "status": "success", "generated_code": "<section class=\\"hero\\"><h1>Welcome</h1><p>Tagline.</p></section>", "summary": "added hero section with heading and tagline", "error": null}}
""".strip()
