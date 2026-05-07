# import os

# from dotenv import load_dotenv
# from groq import Groq


# def call_groq(prompt: str) -> str:
#     load_dotenv()
#     api_key = os.getenv("GROQ_API_KEY", "").strip()

#     if not api_key:
#         raise RuntimeError("GROQ_API_KEY is missing. Add it to .env")

#     try:
#         client = Groq(api_key=api_key)
#         response = client.chat.completions.create(
#             model="llama-3.1-8b-instant",
#             temperature=0,
#             messages=[{"role": "user", "content": prompt}],
#         )
#         text = (response.choices[0].message.content or "").strip()

#         if not text:
#             raise RuntimeError("Groq returned an empty response")

#         return text
#     except Exception as exc:
#         raise RuntimeError(f"Groq API error: {exc}") from exc
import os
from groq import Groq

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def call_groq(prompt: str) -> str:
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0
    )

    return response.choices[0].message.content.strip()