import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginRequestDto {
  @ApiProperty({
    example: 'alice',
    description: 'Username or email',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  identifier!: string;

  @ApiProperty({
    example: 'correct horse battery staple',
  })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
