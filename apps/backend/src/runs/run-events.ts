import { Domain, RunStatus } from '@prisma/client';

/**
 * Maps the AI service's `stage` event names to RunStatus.
 *
 * The AI service emits stage events with names like:
 *   - "PROMPT_OPTIMIZER", "PLANNER", "VALIDATOR" (top-level pipeline phases)
 *   - "Spec Validation", "Execution Planning", ..., "File Writing" (builder sub-phases)
 *
 * We persist the raw stage label on `Run.currentStage` (string) and bump the
 * coarse RunStatus only at the top-level transitions.
 */
export function statusFromStage(stage: string): RunStatus | null {
  const normalised = stage.trim().toUpperCase();
  switch (normalised) {
    case 'PROMPT_OPTIMIZER':
    case 'PLANNER':
      return RunStatus.PLANNING;
    case 'VALIDATOR':
      return RunStatus.VALIDATING;
    default:
      // builder sub-phases — keep status as BUILDING
      if (BUILDER_SUBPHASES.has(stage)) return RunStatus.BUILDING;
      return null;
  }
}

export const BUILDER_SUBPHASES = new Set<string>([
  'Spec Validation',
  'Execution Planning',
  'Template Loading',
  'Template Rendering',
  'Code Injection',
  'Quality Validation',
  'Syntax Validation',
  'File Writing',
]);

/**
 * Domain string → enum. Returns null if unknown — caller decides whether to
 * 400 the request (we 400 at submit time so the AI service never sees it).
 */
export function parseDomain(value: string | null | undefined): Domain | null {
  if (!value) return null;
  const lower = value.toString().trim().toLowerCase();
  if ((Object.values(Domain) as string[]).includes(lower)) return lower as Domain;
  return null;
}

/**
 * Pull token totals from the `success`/`failed` event's `run_audit` payload.
 * Defensive — the AI service has been observed to omit fields under heavy load.
 */
export interface AuditTokens {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
}

export function tokensFromAudit(audit: any): AuditTokens {
  if (!audit || typeof audit !== 'object') {
    return { totalTokens: 0, promptTokens: 0, completionTokens: 0 };
  }
  return {
    totalTokens: numericField(audit, 'total_tokens'),
    promptTokens: numericField(audit, 'prompt_tokens'),
    completionTokens: numericField(audit, 'completion_tokens'),
  };
}

function numericField(obj: any, key: string): number {
  const v = obj?.[key];
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  return 0;
}
