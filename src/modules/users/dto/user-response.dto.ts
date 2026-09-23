import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { UserRole, UserStatus } from '../entities/user.js';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'alice@example.com' })
  email!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  username!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  name!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  phone!: string | null;

  @ApiProperty({ enum: ['CUSTOMER', 'ADMIN'] })
  role!: UserRole;

  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED', 'DELETED'] })
  status!: UserStatus;
}
