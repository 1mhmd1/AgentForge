"""Quick debug: call sub-agent for a later step and print raw LLM output."""
import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))
os.chdir(os.path.join(os.path.dirname(__file__), "src"))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

from llm.llm import call_llm
from prompts.website_builder_prompt import WEBSITE_BUILDER_PROMPT

# Simulate step 4 with compressed previous results
prev = {
    "step_1": {"status": "success", "summary": "Created hero section HTML", "code_length": 350},
    "step_2": {"status": "success", "summary": "Created menu section HTML", "code_length": 400},
    "step_3": {"status": "success", "summary": "Created contact form HTML", "code_length": 300},
}

prompt = WEBSITE_BUILDER_PROMPT.format(
    step_number=4,
    total_steps=5,
    step_id="step_4",
    step_text="Style with basic responsive CSS for mobile and desktop",
    tools=["generate", "code"],
    previous_results=json.dumps(prev),
    domain="website_builder",
    goal="Create a coffee shop landing page",
)

print(f"=== PROMPT LENGTH: {len(prompt)} chars ===")
print()

try:
    raw = call_llm(prompt)
    print(f"=== RAW RESPONSE ({len(raw)} chars) ===")
    print(raw[:2000])
    print("..." if len(raw) > 2000 else "")
    print()
    
    # Try to parse
    cleaned = raw.strip().replace("```json", "").replace("```python", "").replace("```", "").strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end > start:
        try:
            data = json.loads(cleaned[start:end+1])
            print(f"=== JSON PARSE OK === status={data.get('status')}, code_len={len(str(data.get('generated_code', '')))}")
        except json.JSONDecodeError as e:
            print(f"=== JSON PARSE FAILED: {e} ===")
            print(f"First 500 of json candidate: {cleaned[start:start+500]}")
    else:
        print("=== NO JSON FOUND ===")
except Exception as e:
    print(f"=== LLM CALL FAILED: {type(e).__name__}: {e} ===")
