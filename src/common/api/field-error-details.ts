import { ApiProperty } from '@nestjs/swagger';

export class FieldErrorDetail {
  @ApiProperty({ example: 'sku' })
  readonly field: string;

  @ApiProperty({ example: 'Missing field sku in request' })
  readonly message: string;

  constructor(body: FieldErrorDetail) {
    this.field = body.field;
    this.message = body.message;
  }
}
