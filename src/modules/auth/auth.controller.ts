import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { LoginRequestDto } from './dto/login-request.dto.js';
import { RegisterRequestDto } from './dto/register-request.dto.js';
import { AuthResponseDto } from './dto/auth-response.dto.js';
import { RefreshRequestDto } from './dto/refresh-request.dto.js';
import { SuccessMessage } from '../../common/api/success-message.decorator.js';
import { ApiWrappedResponse } from '../../common/api/api-success.decorator.js';

@Controller('auth')
@ApiTags('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @SuccessMessage('Account registered')
  @ApiWrappedResponse(AuthResponseDto, { status: 201 })
  @ApiOperation({ summary: 'Register a customer account' })
  register(@Body() dto: RegisterRequestDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @SuccessMessage('Signed in')
  @HttpCode(HttpStatus.OK)
  @ApiWrappedResponse(AuthResponseDto)
  @ApiOperation({ summary: 'Sign in with username or email' })
  login(@Body() dto: LoginRequestDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @SuccessMessage('Token refreshed')
  @HttpCode(HttpStatus.OK)
  @ApiWrappedResponse(AuthResponseDto)
  @ApiOperation({
    summary: 'Rotate refresh token and issue a new access token',
  })
  refresh(@Body() dto: RefreshRequestDto): Promise<AuthResponseDto> {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiOperation({ summary: 'Revoke a refresh-token session' })
  logout(@Body() dto: RefreshRequestDto): Promise<void> {
    return this.authService.logout(dto);
  }
}
