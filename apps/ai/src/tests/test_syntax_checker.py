from __future__ import annotations

import json

from mock_builder_outputs import MOCK_FRONTEND_STATE, MOCK_SUCCESS_STATE
from services.syntax_checker import validate_syntax


def run() -> dict:
    results = {
        "valid_python": validate_syntax('print("ok")\n', ".py"),
        "broken_python": validate_syntax('def broken(:\n    pass\n', ".py"),
        "valid_js": validate_syntax('console.log("ok");\n', ".js"),
        "broken_js": validate_syntax('function broken( {\n', ".js"),
        "html_skip": validate_syntax('<html><body></body></html>', ".html"),
        "mock_success_generated": validate_syntax(MOCK_SUCCESS_STATE["generated_code"], ".py"),
        "mock_frontend_generated": validate_syntax(MOCK_FRONTEND_STATE["generated_code"], ".py"),
    }

    assert results["valid_python"]["valid"] is True
    assert results["broken_python"]["valid"] is False
    assert results["html_skip"]["valid"] is True

    print(json.dumps(results, indent=2))
    return results


if __name__ == "__main__":
    run()