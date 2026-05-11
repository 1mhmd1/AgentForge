"""
Deterministic HTML structural dedup. Runs AFTER the LLM produces its output
and BEFORE the file is written. The LLM cannot bypass this -- if the model
emits two <header>s, we drop the second; if it emits two <style> blocks, we
merge them into one in <head>.

Public API:
  dedup_html(html: str) -> tuple[str, dict]
    -> (cleaned_html, report)
    report has the form: {
      "dropped_duplicates": [{"tag": "<header>", "count": 2, "kept": 1, "removed": 1}, ...],
      "merged_style_blocks": int,
      "deduped_sections": {id: 2, ...},  # how many duplicates removed per section id
      "is_clean": bool,                  # True if no changes were needed
    }

Design choices:
- Uses regex (not a full HTML parser) because:
  (a) the AI service has no html5lib / lxml dep we can pin lightly
  (b) generated HTML follows our prompted shape (canonical tags) closely
  (c) failures are conservative -- if a regex doesn't match, we leave content alone
- Only operates on the well-formed canonical structural tags we control
  (header / footer / nav / main / h1 / title / style + <section id=...>).
- Whitespace-conservative: we preserve original indentation around kept blocks.
"""
from __future__ import annotations

import re
from typing import Any


# Singleton elements: exactly one allowed per document.
_SINGLETONS = ("header", "footer", "nav", "main", "h1", "title")


def _opener_close_re(tag: str) -> re.Pattern[str]:
    # Matches <tag ...>...</tag> spanning newlines. Non-greedy so we don't
    # eat the rest of the document on the first run.
    return re.compile(rf"<{tag}\b[^>]*>.*?</{tag}>", re.IGNORECASE | re.DOTALL)


def _drop_extra_occurrences(html: str, tag: str) -> tuple[str, int]:
    """Keep the FIRST <tag>...</tag>, remove every subsequent one. Returns (new, removed_count)."""
    pattern = _opener_close_re(tag)
    matches = list(pattern.finditer(html))
    if len(matches) <= 1:
        return html, 0
    # Remove from last to first so earlier offsets stay valid.
    removed = 0
    out = html
    for m in reversed(matches[1:]):
        out = out[: m.start()] + out[m.end() :]
        removed += 1
    return out, removed


def _dedup_sections(html: str) -> tuple[str, dict[str, int]]:
    """
    For each <section id="X">, keep only the FIRST occurrence. Returns
    (new_html, {id: duplicates_removed}).
    """
    # Pattern captures the id attribute so we can group on it.
    pattern = re.compile(
        r'<section\b[^>]*\bid=["\']([^"\']+)["\'][^>]*>.*?</section>',
        re.IGNORECASE | re.DOTALL,
    )
    seen: set[str] = set()
    dropped: dict[str, int] = {}
    removed_ranges: list[tuple[int, int]] = []
    for m in pattern.finditer(html):
        section_id = m.group(1)
        if section_id in seen:
            removed_ranges.append((m.start(), m.end()))
            dropped[section_id] = dropped.get(section_id, 0) + 1
        else:
            seen.add(section_id)
    if not removed_ranges:
        return html, dropped
    # Apply removals back-to-front so earlier offsets stay valid.
    out = html
    for start, end in reversed(removed_ranges):
        out = out[:start] + out[end:]
    return out, dropped


def _merge_style_blocks(html: str) -> tuple[str, int]:
    """
    If there are multiple <style>...</style> blocks, concatenate their bodies
    and emit a single block at the end of <head>. Returns (new_html, merged_count).
    """
    pattern = re.compile(r"<style\b[^>]*>(.*?)</style>", re.IGNORECASE | re.DOTALL)
    matches = list(pattern.finditer(html))
    if len(matches) <= 1:
        return html, 0
    # Concatenate bodies preserving order.
    bodies = [m.group(1) for m in matches]
    merged_body = "\n/* merged from " + str(len(bodies)) + " style blocks */\n" + "\n".join(b.strip() for b in bodies if b.strip())
    # Strip every existing style block first.
    out = html
    for m in reversed(matches):
        out = out[: m.start()] + out[m.end() :]
    # Insert one consolidated block at the end of <head>. If we can't find
    # </head> we tack it at the start of <body> as a fallback.
    head_close = re.search(r"</head>", out, re.IGNORECASE)
    new_block = f"<style>{merged_body}</style>"
    if head_close:
        out = out[: head_close.start()] + new_block + out[head_close.start() :]
    else:
        body_open = re.search(r"<body[^>]*>", out, re.IGNORECASE)
        if body_open:
            out = out[: body_open.end()] + new_block + out[body_open.end() :]
        else:
            out = new_block + out
    return out, len(matches) - 1


def dedup_html(html: str) -> tuple[str, dict[str, Any]]:
    """
    Deterministically remove structural duplicates from `html`.
    Returns (cleaned_html, report).
    """
    if not isinstance(html, str) or "<" not in html:
        return html, {"dropped_duplicates": [], "merged_style_blocks": 0, "deduped_sections": {}, "is_clean": True}

    out = html
    report: dict[str, Any] = {
        "dropped_duplicates": [],
        "merged_style_blocks": 0,
        "deduped_sections": {},
        "is_clean": True,
    }

    for tag in _SINGLETONS:
        out, removed = _drop_extra_occurrences(out, tag)
        if removed > 0:
            report["dropped_duplicates"].append({"tag": f"<{tag}>", "removed": removed})
            report["is_clean"] = False

    out, dropped_sections = _dedup_sections(out)
    if dropped_sections:
        report["deduped_sections"] = dropped_sections
        report["is_clean"] = False

    out, merged = _merge_style_blocks(out)
    if merged > 0:
        report["merged_style_blocks"] = merged
        report["is_clean"] = False

    return out, report


def is_html_clean(html: str) -> bool:
    """Cheap structural-quality check without mutating the input."""
    _, report = dedup_html(html)
    return report["is_clean"]
