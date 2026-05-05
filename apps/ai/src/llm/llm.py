import os
from openai import OpenAI

def call_llm(prompt: str) -> str:
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))  # ① Get API key
    response = client.chat.completions.create(             # ② Call OpenAI
        model="gpt-4o-mini",        # Use GPT-4o-mini model
        temperature=0,              # Deterministic (same input = same output)
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content.strip()     # ③ Return AI's answer