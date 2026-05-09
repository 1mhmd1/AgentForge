from __future__ import annotations

import json
import tempfile
from pathlib import Path

from mock_builder_outputs import MOCK_EXECUTION_FAILURE_STATE, MOCK_SUCCESS_STATE
from services.execution_checker import validate_execution


def _write_temp_python(name: str, content: str) -> str:
    temp_dir = Path(tempfile.mkdtemp(prefix="agentforge_exec_tests_"))
    file_path = temp_dir / name
    file_path.write_text(content, encoding="utf-8")
    return str(file_path)


def run() -> dict:
    success_path = _write_temp_python("success.py", 'print("ok")\n')
    runtime_error_path = _write_temp_python("runtime_error.py", 'raise RuntimeError("boom")\n')
    timeout_path = _write_temp_python("timeout.py", 'import time\ntime.sleep(20)\n')

    results = {
        "successful_python": validate_execution(success_path),
        "runtime_error": validate_execution(runtime_error_path),
        "timeout": validate_execution(timeout_path),
        "frontend_skip": validate_execution(MOCK_SUCCESS_STATE["generated_files"][0]),
        "mock_execution_failure_output": validate_execution(MOCK_EXECUTION_FAILURE_STATE["output_path"]),
    }

    assert results["successful_python"]["valid"] is True
    assert results["runtime_error"]["valid"] is False
    assert results["timeout"]["valid"] is False
    assert results["frontend_skip"]["skipped"] is True

    print(json.dumps(results, indent=2))
    return results


if __name__ == "__main__":
    run()