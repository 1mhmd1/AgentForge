SUB_AGENT_PROMPT = """Sub-agent in a sequential pipeline. Complete ONE step.

Task: {step_text}
Step: {step_number}/{total_steps} (id: {step_id})
Domain: {domain}
Goal: {goal}
Tools: {tools}
Previous step output: {previous_output}

Return ONLY a JSON object. No markdown, no fences, no explanation.
"generated_code" holds the CONTENT (HTML / text / markdown / json) for the domain — NOT Python.

Success:
{{"step_id": "{step_id}", "status": "success", "generated_code": "CONTENT", "summary": "one line", "error": null}}

Failure:
{{"step_id": "{step_id}", "status": "error", "generated_code": "", "summary": "", "error": "reason"}}
""".strip()
