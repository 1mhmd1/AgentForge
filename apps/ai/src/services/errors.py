SUPPORTED_DOMAINS = {
    "web_research",
    "document",
    "data_transform",
    "website_builder",
}

ERROR_CODES = {
    # Spec validation
    "INVALID_SPEC": "builder_invalid_spec",
    "TEMPLATE_EMPTY": "template_empty",
    "TEMPLATE_NOT_FOUND": "template_not_found",
    "RENDER_ERROR": "template_render_error",
    "MARKER_MISSING": "marker_not_found",
    # Generation
    "SYNTAX_ERROR": "syntax_validation_failed",
    "FILE_WRITE_FAILED": "file_write_failed",
    "STEP_CONSISTENCY": "step_consistency_failed",
    # Sub-agent
    "SUB_AGENT_FAILED": "sub_agent_failed",  # callers append :step_id
    # Pipeline
    "PLANNER_FAILED": "planner_failed",
    "AI_SERVICE_DISCONNECTED": "ai_service_disconnected",
}
