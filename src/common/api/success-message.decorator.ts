import { SetMetadata } from '@nestjs/common';

export const SUCCESS_MESSAGE = 'api:success-message';
export const SuccessMessage = (message: string) =>
  SetMetadata(SUCCESS_MESSAGE, message);
