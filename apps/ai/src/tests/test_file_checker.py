from __future__ import annotations

import json
from pathlib import Path

from mock_builder_outputs import EMPTY_MAIN, MOCK_EMPTY_FILE_STATE, MOCK_SUCCESS_STATE
from services.file_checker import validate_file


def run() -> dict:
    results = {
        "existing_valid": validate_file(MOCK_SUCCESS_STATE["output_path"]),
        "missing_file": validate_file(str(Path(EMPTY_MAIN).with_name("missing.py"))),
        "empty_file": validate_file(MOCK_EMPTY_FILE_STATE["output_path"]),
        "disallowed_extension": validate_file(str(Path(EMPTY_MAIN).with_name("disallowed.exe"))),
    }

    assert results["existing_valid"]["valid"] is True
    assert results["missing_file"]["valid"] is False
    assert results["empty_file"]["valid"] is False
    assert results["disallowed_extension"]["valid"] is False

    print(json.dumps(results, indent=2))
    return results


if __name__ == "__main__":
    run()