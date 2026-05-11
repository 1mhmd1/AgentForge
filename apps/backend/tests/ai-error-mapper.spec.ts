import { HttpStatus } from '@nestjs/common';
import { mapAiError } from '../src/runs/ai-error-mapper';

describe('mapAiError', () => {
  it.each([
    ['INVALID_SPEC:steps_missing', HttpStatus.BAD_REQUEST, 'BAD_SPEC'],
    ['TEMPLATE_NOT_FOUND:web_research', HttpStatus.BAD_REQUEST, 'UNSUPPORTED_DOMAIN'],
    ['sub_agent_failed_step_2', HttpStatus.BAD_GATEWAY, 'LLM_FAILURE'],
    ['file_write_failed', HttpStatus.INTERNAL_SERVER_ERROR, 'STORAGE_FAILURE'],
    ['ai_service_disconnected', HttpStatus.BAD_GATEWAY, 'AI_SERVICE_DISCONNECTED'],
    ['something_random', HttpStatus.INTERNAL_SERVER_ERROR, 'PIPELINE_FAILURE'],
  ])('maps %s -> %s %s', (raw, status, code) => {
    const m = mapAiError(raw);
    expect(m.status).toBe(status);
    expect(m.errorCode).toBe(code);
    expect(m.raw).toBe(raw);
  });

  it('handles empty / nullish input', () => {
    expect(mapAiError(undefined).errorCode).toBe('PIPELINE_FAILURE');
    expect(mapAiError(null).errorCode).toBe('PIPELINE_FAILURE');
    expect(mapAiError('').errorCode).toBe('PIPELINE_FAILURE');
  });
});
