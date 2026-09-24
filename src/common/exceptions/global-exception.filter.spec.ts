import { HttpStatus, Logger } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { ArgumentsHost } from '@nestjs/common';
import { AppException } from './app.exception.js';
import { ErrorCode } from './error-code.js';
import { GlobalExceptionFilter } from './global-exception.filter.js';

describe('GlobalExceptionFilter', () => {
  function context() {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };
    const request = {
      headers: { 'x-trace-id': 'test-trace' },
      method: 'GET',
      url: '/test',
    };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost;
    return { response, host };
  }

  it('preserves a business code and message', () => {
    const { response, host } = context();
    new GlobalExceptionFilter().catch(
      new AppException(ErrorCode.CONFLICT_ERROR, 'Already exists'),
      host,
    );
    expect(response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        errorCode: 'SYS-409',
        message: 'Already exists',
        traceId: 'test-trace',
      }),
    );
  });

  it('does not expose an unexpected error to the client', () => {
    const { response, host } = context();
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    try {
      new GlobalExceptionFilter().catch(
        new Error('database password leaked'),
        host,
      );
      expect(response.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      const body = response.json.mock.calls[0][0] as { message: string };
      expect(body.message).toBe(ErrorCode.INTERNAL_SERVER_ERROR.defaultMessage);
      expect(JSON.stringify(body)).not.toContain('database password leaked');
    } finally {
      log.mockRestore();
    }
  });
});
