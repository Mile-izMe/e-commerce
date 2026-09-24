import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class RefreshRequestDto {
  @ApiProperty({
    description: 'Opaque refresh token returned by login or refresh',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  refreshToken!: string;
}
