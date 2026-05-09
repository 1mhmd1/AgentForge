# AgentForge — Safe Agent Generation Architecture

## Core Principle

**SEPARATE CONTENT FROM EXECUTION CODE**

The root cause of syntax failures is unsafe content injection into executable Python.

### The Problem
```python
# UNSAFE — Raw content floating in Python
<div>
    <h1>Title</h1>
</div>

body {
    padding: 20px;
}

def main():
    # This will fail syntax validation
```

### The Solution
```python
# SAFE — Content serialized into constants
HTML_CONTENT = """<div>
    <h1>Title</h1>
</div>"""

CSS_CONTENT = """
body {
    padding: 20px;
}
"""

def main():
    process(HTML_CONTENT, CSS_CONTENT)
```

---

## Service Layer

### 1. CodeSerializer (`services/code_serializer.py`)
Safely wraps content into Python string constants per domain:
- `serialize_for_domain("website_builder", html=..., css=..., js=...)`
- `serialize_for_domain("document", content=...)`
- `serialize_for_domain("web_research", content=...)`
- `serialize_for_domain("data_transform", content=...)`

### 2. CodeSanitizer (`services/code_sanitizer.py`)
Pre-syntax cleanup before Python parser:
- Detects raw HTML/CSS outside strings
- Fixes broken indentation (tabs → spaces, non-4 alignment)
- Checks unmatched triple quotes
- Flags module-level print statements
- `pre_syntax_check(code)` → `(sanitized, warnings, is_safe)`

### 3. SafeCodeInjector (`services/safe_injector.py`)
Template-based agent builder with guaranteed-valid output:
- Domain-specific builders: `build_website_agent()`, `build_research_agent()`, etc.
- `build_and_validate(domain, ...)` → `{"code", "valid", "warnings", "error"}`
- Used as fallback when template injection produces syntax errors

---

## Builder Pipeline Integration

```
Phase 1: Spec Validation
Phase 2: Execution Planning (from planner's staged plan)
Phase 3: Sequential Sub-Agent Execution
Phase 4: Template Loading
Phase 5: Template Rendering
Phase 6: Code Injection (marker-based)
Phase 6.5: Code Sanitization (pre_syntax_check)
Phase 7: Quality Validation
Phase 8: Syntax Validation
         ↓ if fails → SafeCodeInjector fallback
Phase 9: File Writing
```

---

## Sequential Execution Rules

### Required Pattern
```python
output_1 = execute_agent_1()
output_2 = execute_agent_2(input=output_1)
output_3 = execute_agent_3(input=output_2)
final = output_3
```

### Forbidden
- No parallel execution
- No async gather
- No thread pools
- No shared state mutation

---

## Token Optimization

| Rule | Example |
|------|---------|
| Terse prompts | "Extract 5 AI trends as JSON" not "Carefully analyze..." |
| Explicit limits | `call_llm(prompt, max_tokens=200)` |
| Structured outputs | Request JSON, not prose |
| Cheapest provider | Use MiniMax/Groq unless context > 4k |
| Compressed context | Pass only last agent's summary |

---

## Provider Selection

| Provider | Cost | Use For |
|----------|------|---------|
| Groq | Lowest | Default, simple tasks |
| MiniMax | Low | General reasoning, summaries |
| Kimi | Medium | Long context (>4k tokens) |
| Gemini | Higher | Complex reasoning |

---

## Sanitization Checklist

Before syntax validation:
- [ ] No raw HTML outside strings
- [ ] No raw CSS outside strings
- [ ] No module-level print statements
- [ ] Matched triple quotes (even count)
- [ ] Proper indentation (multiples of 4)
- [ ] No mixed tabs/spaces
- [ ] All content in CONSTANTS at top
- [ ] All logic in functions
