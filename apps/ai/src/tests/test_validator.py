from __future__ import annotations

import json

from mock_builder_outputs import (
    MOCK_EXECUTION_FAILURE_STATE,
    MOCK_FRONTEND_STATE,
    MOCK_SUCCESS_STATE,
    MOCK_SYNTAX_FAILURE_STATE,
)
from nodes.validator import validator_node


def run() -> dict:
    success = validator_node(MOCK_SUCCESS_STATE)
    syntax_failure = validator_node(MOCK_SYNTAX_FAILURE_STATE)
    execution_failure = validator_node(MOCK_EXECUTION_FAILURE_STATE)
    frontend = validator_node(MOCK_FRONTEND_STATE)

    results = {
        "success": success,
        "syntax_failure": syntax_failure,
        "execution_failure": execution_failure,
        "frontend": frontend,
    }

    assert success["validation_status"] == "passed"
    assert syntax_failure["validation_status"] == "failed"
    assert execution_failure["validation_status"] == "failed"
    assert frontend["validation_status"] == "passed"

    print(json.dumps(results, indent=2))
    return results


if __name__ == "__main__":
    run()