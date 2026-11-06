import { HttpException, HttpStatus } from '@nestjs/common';

export type ErrorCode =
  | 'SESSION_NOT_FOUND'
  | 'SESSION_FULL'
  | 'ALREADY_REGISTERED'
  | 'NOT_REGISTERED'
  | 'REGISTRATION_NOT_OPEN'
  | 'REGISTRATION_CLOSED'
  | 'SESSION_STARTED'
  | 'INVALID_WINDOW';

export class ApiError extends HttpException {
  constructor(status: HttpStatus, code: ErrorCode, message: string) {
    super({ statusCode: status, code, message }, status);
  }
}
