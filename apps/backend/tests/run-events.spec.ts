import { Domain, RunStatus } from '@prisma/client';
import { parseDomain, statusFromStage, tokensFromAudit } from '../src/runs/run-events';

describe('statusFromStage', () => {
  it('maps top-level pipeline phases', () => {
    expect(statusFromStage('PROMPT_OPTIMIZER')).toBe(RunStatus.PLANNING);
    expect(statusFromStage('PLANNER')).toBe(RunStatus.PLANNING);
    expect(statusFromStage('VALIDATOR')).toBe(RunStatus.VALIDATING);
  });

  it('maps every builder sub-phase to BUILDING', () => {
    for (const sub of [
      'Spec Validation',
      'Execution Planning',
      'Template Loading',
      'Template Rendering',
      'Code Injection',
      'Quality Validation',
      'Syntax Validation',
      'File Writing',
    ]) {
      expect(statusFromStage(sub)).toBe(RunStatus.BUILDING);
    }
  });

  it('returns null for unknown stage names', () => {
    expect(statusFromStage('Mystery')).toBeNull();
  });
});

describe('parseDomain', () => {
  it('accepts canonical lowercase strings', () => {
    expect(parseDomain('web_research')).toBe(Domain.web_research);
  });
  it('normalizes uppercase / whitespace', () => {
    expect(parseDomain('  WEB_RESEARCH ')).toBe(Domain.web_research);
  });
  it('returns null for unknown domain', () => {
    expect(parseDomain('image_generation')).toBeNull();
    expect(parseDomain(undefined)).toBeNull();
  });
});

describe('tokensFromAudit', () => {
  it('returns zeros for missing/invalid audit', () => {
    expect(tokensFromAudit(null)).toEqual({
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
    });
  });
  it('rounds and falls back when fields are missing', () => {
    expect(
      tokensFromAudit({ total_tokens: 412.7, prompt_tokens: 200 }),
    ).toEqual({ totalTokens: 413, promptTokens: 200, completionTokens: 0 });
  });
});
