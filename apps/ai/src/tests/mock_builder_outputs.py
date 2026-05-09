from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any

from state.State import initial_state


_MOCK_ROOT = Path(tempfile.mkdtemp(prefix="agentforge_validator_mocks_"))


def _write_file(name: str, content: str) -> str:
    file_path = _MOCK_ROOT / name
    file_path.write_text(content, encoding="utf-8")
    return str(file_path)


def _base_state(run_id: str, user_prompt: str) -> dict[str, Any]:
    return initial_state(run_id, user_prompt)


SUCCESS_MAIN = _write_file(
    "success_main.py",
    'print("validator success")\n',
)
SUCCESS_HELPER = _write_file("success_notes.md", "# notes\n")
SUCCESS_CONFIG = _write_file("success_config.json", '{"ok": true}\n')

MOCK_SUCCESS_STATE = _base_state("success", "Build a validator test agent")
MOCK_SUCCESS_STATE.update(
    {
        "stage": "building",
        "status": "running",
        "generated_code": 'print("validator success")\n',
        "generated_files": [SUCCESS_HELPER, SUCCESS_CONFIG],
        "file_manifest": [
            {"path": SUCCESS_HELPER, "type": "markdown"},
            {"path": SUCCESS_CONFIG, "type": "json"},
        ],
        "output_path": SUCCESS_MAIN,
        "sub_agent_results": {"step_1": {"generated_code": 'print("step")\n'}},
        "run_audit": {
            "total_tokens": 120,
            "agents_executed": 2,
            "provider_usage": {"groq": 2},
            "failed_step": None,
        },
        "sandbox_workdir": None,
        "sandbox_output": None,
        "sandbox_exit_code": None,
    }
)

SYNTAX_HELPER = _write_file("syntax_helper.md", "# helper\n")
EXECUTION_MAIN = _write_file(
    "execution_main.py",
    'raise RuntimeError("boom")\n',
)
EXECUTION_HELPER = _write_file("execution_helper.txt", "helper\n")

MOCK_SYNTAX_FAILURE_STATE = _base_state("syntax-failure", "Break syntax")
MOCK_SYNTAX_FAILURE_STATE.update(
    {
        "stage": "building",
        "status": "running",
        "generated_code": "def broken(:\n    pass\n",
        "generated_files": [SYNTAX_HELPER],
        "file_manifest": [{"path": SYNTAX_HELPER, "type": "markdown"}],
        "output_path": SUCCESS_MAIN,
        "sub_agent_results": {"step_1": {"generated_code": 'print("step")\n'}},
        "run_audit": {
            "total_tokens": 50,
            "agents_executed": 1,
            "provider_usage": {"groq": 1},
            "failed_step": None,
        },
    }
)

MOCK_EXECUTION_FAILURE_STATE = _base_state("execution-failure", "Runtime error")
MOCK_EXECUTION_FAILURE_STATE.update(
    {
        "stage": "building",
        "status": "running",
        "generated_code": 'print("main")\n',
        "generated_files": [EXECUTION_HELPER],
        "file_manifest": [{"path": EXECUTION_HELPER, "type": "text"}],
        "output_path": EXECUTION_MAIN,
        "sub_agent_results": {"step_1": {"generated_code": 'print("step")\n'}},
        "run_audit": {
            "total_tokens": 80,
            "agents_executed": 1,
            "provider_usage": {"groq": 1},
            "failed_step": None,
        },
    }
)

EMPTY_MAIN = _write_file("empty_main.py", "")
EMPTY_HELPER = _write_file("empty_helper.md", "# helper\n")

MOCK_EMPTY_FILE_STATE = _base_state("empty-file", "Empty output path")
MOCK_EMPTY_FILE_STATE.update(
    {
        "stage": "building",
        "status": "running",
        "generated_code": 'print("hello")\n',
        "generated_files": [EMPTY_HELPER],
        "file_manifest": [{"path": EMPTY_HELPER, "type": "markdown"}],
        "output_path": EMPTY_MAIN,
        "sub_agent_results": {"step_1": {"generated_code": 'print("step")\n'}},
        "run_audit": {
            "total_tokens": 15,
            "agents_executed": 1,
            "provider_usage": {"groq": 1},
            "failed_step": None,
        },
    }
)

MOCK_MISSING_AUDIT_STATE = _base_state("missing-audit", "Missing audit")
MOCK_MISSING_AUDIT_STATE.update(
    {
        "stage": "building",
        "status": "running",
        "generated_code": 'print("hello")\n',
        "generated_files": [SUCCESS_HELPER],
        "file_manifest": [{"path": SUCCESS_HELPER, "type": "markdown"}],
        "output_path": SUCCESS_MAIN,
        "sub_agent_results": {"step_1": {"generated_code": 'print("step")\n'}},
        "run_audit": None,
    }
)

FRONTEND_HTML = _write_file("frontend_index.html", "<html><body><h1>Validator</h1></body></html>\n")
FRONTEND_CSS = _write_file("frontend_styles.css", "body { margin: 0; }\n")
FRONTEND_JS = _write_file("frontend_app.js", "console.log('validator');\n")

MOCK_FRONTEND_STATE = _base_state("frontend", "Build a website")
MOCK_FRONTEND_STATE.update(
    {
        "stage": "building",
        "status": "running",
        "domain": "website_builder",
        "generated_code": 'print("frontend orchestrator")\n',
        "generated_files": [FRONTEND_HTML, FRONTEND_CSS, FRONTEND_JS],
        "file_manifest": [
            {"path": FRONTEND_HTML, "type": "html"},
            {"path": FRONTEND_CSS, "type": "css"},
            {"path": FRONTEND_JS, "type": "javascript"},
        ],
        "output_path": FRONTEND_HTML,
        "sub_agent_results": {"step_1": {"generated_code": 'print("step")\n'}},
        "run_audit": {
            "total_tokens": 42,
            "agents_executed": 3,
            "provider_usage": {"groq": 3},
            "failed_step": None,
        },
    }
)