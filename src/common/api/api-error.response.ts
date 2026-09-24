import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FieldErrorDetail } from './field-error-details.js';

export class ApiErrorResponse {
  @ApiProperty({ example: false })
  readonly success = false;

  @ApiProperty()
  timestamp!: string;

  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'Bad Request' })
  error!: string;

  @ApiPropertyOptional({ example: 'SYS-400' })
  errorCode?: string;

  @ApiProperty({ example: 'Validation error' })
  message!: string;

  @ApiProperty()
  traceId!: string;

  @ApiPropertyOptional({ type: [FieldErrorDetail] })
  subErrors?: FieldErrorDetail[];
}
