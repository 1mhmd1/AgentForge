export const MOCK_RUNS = [
  { id: 'run_7f3a1c', prompt: 'Research top 10 AI startups in 2025 and summarize their funding', status: 'success', agent: 'Web Research', timestamp: '2 min ago', duration: '5.3s' },
  { id: 'run_2b9e4d', prompt: 'Transform this CSV into a normalized JSON schema with type inference', status: 'success', agent: 'Data Transform', timestamp: '14 min ago', duration: '3.1s' },
  { id: 'run_a1f8c2', prompt: 'Generate an investor pitch deck outline for a B2B SaaS company', status: 'running', agent: 'Document Generator', timestamp: '22 min ago', duration: '—' },
  { id: 'run_3d6b7e', prompt: 'Build a landing page for a productivity app called FocusFlow', status: 'failed', agent: 'Website Builder', timestamp: '1 hr ago', duration: '2.0s' },
  { id: 'run_9c2a5f', prompt: 'Scrape and summarize the top 5 Hacker News stories today', status: 'success', agent: 'Web Research', timestamp: '3 hr ago', duration: '7.8s' },
];

export const MOCK_AGENTS = [
  { id: 'web', name: 'Web Research', icon: 'GlobeIcon', accent: '#06B6D4', tag: 'Research', desc: 'Autonomously browses the web, extracts data, and synthesizes research reports in seconds.', emoji: '⚡' },
  { id: 'data', name: 'Data Transform', icon: 'TransformIcon', accent: '#7C3AED', tag: 'Processing', desc: 'Ingests raw datasets in any format and outputs clean, structured, analysis-ready data.', emoji: '🔄' },
  { id: 'doc', name: 'Document Generator', icon: 'DocIcon', accent: '#3B82F6', tag: 'Generation', desc: 'Generates professional documents, reports, and contracts from your specifications.', emoji: '📄' },
  { id: 'site', name: 'Website Builder', icon: 'LayoutIcon', accent: '#F59E0B', tag: 'Builder', desc: 'Designs and codes full landing pages, dashboards, and apps from a single prompt.', emoji: '🌐' },
];

export const MOCK_LOGS = [
  { t: '00:00.001', g: '◈', txt: 'Initializing AgentForge runtime...', stage: 0, kind: 'info' },
  { t: '00:00.043', g: '◈', txt: 'Loading agent configuration: web_research_v2', stage: 0, kind: 'info' },
  { t: '00:00.118', g: '✦', txt: 'PLANNER  Analyzing task requirements...', stage: 0, kind: 'info' },
  { t: '00:00.234', g: '✦', txt: 'PLANNER  Decomposing into 4 subtasks', stage: 0, kind: 'info' },
  { t: '00:00.412', g: '✦', txt: 'PLANNER  Dependency graph computed', stage: 0, kind: 'info' },
  { t: '00:00.601', g: '✓', txt: 'PLANNER  Complete — 4 tasks queued', stage: 0, kind: 'ok', stageDone: 0 },
  { t: '00:00.843', g: '◈', txt: 'BUILDER  Spawning execution context...', stage: 1, kind: 'info' },
  { t: '00:01.021', g: '◈', txt: 'BUILDER  Task 1/4: Fetching data sources', stage: 1, kind: 'info' },
  { t: '00:01.445', g: '◈', txt: 'BUILDER  Task 2/4: Processing with GPT-4o', stage: 1, kind: 'info' },
  { t: '00:01.889', g: '⚠', txt: 'BUILDER  Rate limit hit — retrying in 1.2s', stage: 1, kind: 'warn' },
  { t: '00:03.112', g: '◈', txt: 'BUILDER  Task 3/4: Structuring output schema', stage: 1, kind: 'info' },
  { t: '00:03.678', g: '◈', txt: 'BUILDER  Task 4/4: Writing final artifact', stage: 1, kind: 'info' },
  { t: '00:04.001', g: '✓', txt: 'BUILDER  Complete — artifact generated', stage: 1, kind: 'ok', stageDone: 1 },
  { t: '00:04.089', g: '◈', txt: 'VALIDATOR Initializing validation suite...', stage: 2, kind: 'info' },
  { t: '00:04.234', g: '◈', txt: 'VALIDATOR Running schema checks (12 rules)', stage: 2, kind: 'info' },
  { t: '00:04.567', g: '◈', txt: 'VALIDATOR Running output quality checks...', stage: 2, kind: 'info' },
  { t: '00:04.890', g: '✓', txt: 'VALIDATOR Schema: PASSED', stage: 2, kind: 'ok' },
  { t: '00:05.112', g: '✓', txt: 'VALIDATOR Quality: PASSED', stage: 2, kind: 'ok', stageDone: 2 },
  { t: '00:05.334', g: '✦', txt: 'AgentForge run completed successfully', stage: 2, kind: 'ok' },
  { t: '00:05.334', g: '◈', txt: 'Result artifact ready — 2.4kb', stage: 2, kind: 'info' },
];

export const MOCK_RESULT = `{
  "agent": "web_research_v2",
  "task": "Top 10 AI startups in 2025",
  "results": [
    { "rank": 1, "name": "Anthropic", "funding": "$7.3B", "stage": "Series C" },
    { "rank": 2, "name": "OpenAI", "funding": "$13B", "stage": "Strategic" },
    { "rank": 3, "name": "Mistral", "funding": "$640M", "stage": "Series B" }
  ],
  "summary": "AI funding remains concentrated in foundation model providers.",
  "generated_at": "2026-05-04T12:34:56Z"
}`;
