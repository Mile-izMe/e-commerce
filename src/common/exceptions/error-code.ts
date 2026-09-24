import { HttpStatus } from '@nestjs/common';

export type ErrorCodeProps = {
  status: HttpStatus;
  code: string;
  defaultMessage: string;
};

export const ErrorCode = {
  // --- Common Error System ---
  INTERNAL_SERVER_ERROR: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'SYS-500',
    defaultMessage: 'System error not defined!',
  },
  VALIDATION_ERROR: {
    status: HttpStatus.BAD_REQUEST,
    code: 'SYS-400',
    defaultMessage: 'Input not valid!',
  },
  CONFLICT_ERROR: {
    status: HttpStatus.CONFLICT,
    code: 'SYS-409',
    defaultMessage: 'Data has conflicts!',
  },
} as const satisfies Record<string, ErrorCodeProps>;

export type CustomErrorCode = keyof typeof ErrorCode;
