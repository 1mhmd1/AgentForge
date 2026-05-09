from __future__ import annotations

import json

from mock_builder_outputs import MOCK_MISSING_AUDIT_STATE, MOCK_SUCCESS_STATE
from services.audit_checker import validate_audit


def run() -> dict:
    valid_audit = validate_audit(MOCK_SUCCESS_STATE["run_audit"])
    missing_total_tokens = validate_audit({"agents_executed": 1, "provider_usage": {"groq": 1}, "failed_step": None})
    negative_token_count = validate_audit({"total_tokens": -1, "agents_executed": 1, "provider_usage": {"groq": 1}, "failed_step": None})
    missing_provider_usage = validate_audit({"total_tokens": 1, "agents_executed": 1, "failed_step": None})
    missing_audit = validate_audit(MOCK_MISSING_AUDIT_STATE["run_audit"])

    results = {
        "valid_audit": valid_audit,
        "missing_total_tokens": missing_total_tokens,
        "negative_token_count": negative_token_count,
        "missing_provider_usage": missing_provider_usage,
        "missing_audit": missing_audit,
    }

    assert valid_audit["valid"] is True
    assert missing_total_tokens["valid"] is False
    assert negative_token_count["valid"] is False
    assert missing_provider_usage["valid"] is False
    assert missing_audit["valid"] is False

    print(json.dumps(results, indent=2))
    return results


if __name__ == "__main__":
    run()