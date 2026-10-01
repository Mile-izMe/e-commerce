import { Catch, HttpException, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { ChatSocket } from '../gateways/chat-socket.js';

const logger = new Logger('ChatExceptionFilter');

export function chatError(error: unknown) {
  if (error instanceof WsException) {
    const detail = error.getError();
    return typeof detail === 'string'
      ? { code: 'CHAT_ERROR', message: detail }
      : detail;
  }
  if (error instanceof HttpException && error.getStatus() < 500) {
    const status = error.getStatus();
    const codes: Record<number, string> = {
      400: 'VALIDATION_ERROR',
      401: 'AUTH_INVALID',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      429: 'RATE_LIMITED',
    };
    const response = error.getResponse();
    return {
      code: codes[status] ?? 'CHAT_ERROR',
      message:
        typeof response === 'object' && 'message' in response
          ? response.message
          : error.message,
    };
  }
  logger.error(
    'Unexpected chat failure',
    error instanceof Error ? error.stack : String(error),
  );
  return { code: 'INTERNAL_ERROR', message: 'Unable to process this event' };
}

@Catch()
export class ChatExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = { success: false, error: chatError(error) };
    const acknowledge = host.getArgByIndex<unknown>(2);
    if (typeof acknowledge === 'function') acknowledge(response);
    else host.switchToWs().getClient<ChatSocket>().emit('chat.error', response);
  }
}
