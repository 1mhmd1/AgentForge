import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Map AI service error strings to HTTP responses + taxonomy codes.
 *
 * The AI service emits errors as opaque strings ("INVALID_SPEC:steps_missing",
 * "sub_agent_failed_step_2", etc.). The contract maps known prefixes to
 * NestJS error codes; unknowns become PIPELINE_FAILURE 500.
 */
export interface MappedAiError {
  status: HttpStatus;
  errorCode: string;
  message: string;
  raw: string;
}

export function mapAiError(raw: string | null | undefined): MappedAiError {
  const value = (raw ?? '').toString().trim();

  if (!value) {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: 'PIPELINE_FAILURE',
      message: 'Pipeline failed without an error message',
      raw: '',
    };
  }

  if (value.startsWith('INVALID_SPEC')) {
    return {
      status: HttpStatus.BAD_REQUEST,
      errorCode: 'BAD_SPEC',
      message: `Spec rejected by planner: ${value}`,
      raw: value,
    };
  }
  if (value.startsWith('TEMPLATE_NOT_FOUND')) {
    return {
      status: HttpStatus.BAD_REQUEST,
      errorCode: 'UNSUPPORTED_DOMAIN',
      message: `Domain template missing: ${value}`,
      raw: value,
    };
  }
  if (value.startsWith('sub_agent_failed')) {
    return {
      status: HttpStatus.BAD_GATEWAY,
      errorCode: 'LLM_FAILURE',
      message: `LLM sub-agent failure: ${value}`,
      raw: value,
    };
  }
  if (value === 'file_write_failed') {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: 'STORAGE_FAILURE',
      message: 'AI service failed to write generated file',
      raw: value,
    };
  }
  if (value === 'ai_service_disconnected') {
    return {
      status: HttpStatus.BAD_GATEWAY,
      errorCode: 'AI_SERVICE_DISCONNECTED',
      message: 'Lost connection to AI service mid-pipeline',
      raw: value,
    };
  }
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    errorCode: 'PIPELINE_FAILURE',
    message: value,
    raw: value,
  };
}

export function aiErrorAsHttpException(raw: string): HttpException {
  const mapped = mapAiError(raw);
  return new HttpException(
    {
      message: mapped.message,
      errorCode: mapped.errorCode,
      details: { raw: mapped.raw },
    },
    mapped.status,
  );
}
