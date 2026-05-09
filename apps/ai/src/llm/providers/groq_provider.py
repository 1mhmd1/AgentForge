import os
from groq import Groq

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def call_groq(prompt: str, max_tokens: int = 1024) -> str:
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        max_tokens=max_tokens,
    )

    return response.choices[0].message.content.strip()