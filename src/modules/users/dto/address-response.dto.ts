import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddressResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) label!: string | null;
  @ApiProperty() recipientName!: string;
  @ApiProperty() phone!: string;
  @ApiProperty() addressLine1!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) addressLine2!:
    string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) ward!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) district!:
    string | null;
  @ApiProperty() city!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) province!:
    string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) postalCode!:
    string | null;
  @ApiProperty({ example: 'VN' }) countryCode!: string;
}
