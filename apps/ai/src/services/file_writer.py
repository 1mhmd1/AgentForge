from pathlib import Path


def write_generated_agent(run_id: str, code: str) -> str:
    try:
        if not isinstance(run_id, str) or not run_id.strip():
            raise RuntimeError("Invalid run_id")
        if not isinstance(code, str) or not code.strip():
            raise RuntimeError("Generated code is empty")
        base_dir = Path(__file__).resolve().parents[1]
        output_dir = base_dir / "generated_agents"
        output_dir.mkdir(parents=True, exist_ok=True)

        file_path = output_dir / f"run_{run_id}.py"
        file_path.write_text(code, encoding="utf-8")
        return str(file_path)
    except Exception as exc:
        raise RuntimeError(f"Failed to write generated agent: {exc}") from exc
