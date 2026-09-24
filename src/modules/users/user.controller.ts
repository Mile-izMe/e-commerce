import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import type { AuthenticatedRequest } from '../auth/guards/auth.guard.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UsersService } from './user.service.js';
import { CreateAddressDto } from './dto/create-address.dto.js';
import { UpdateAddressDto } from './dto/update-address.dto.js';
import { AddressResponseDto } from './dto/address-response.dto.js';
import { SuccessMessage } from '../../common/api/success-message.decorator.js';
import { ApiWrappedResponse } from '../../common/api/api-success.decorator.js';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @SuccessMessage('Profile retrieved')
  @ApiWrappedResponse(UserResponseDto)
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@Req() request: AuthenticatedRequest): Promise<UserResponseDto> {
    return this.users.getProfile(request.user.id);
  }

  @Patch('me')
  @SuccessMessage('Profile updated')
  @ApiWrappedResponse(UserResponseDto)
  @ApiOperation({ summary: 'Update current user name or phone' })
  updateMe(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return this.users.updateProfile(request.user.id, dto);
  }

  @Get('me/addresses')
  @SuccessMessage('Addresses retrieved')
  @ApiWrappedResponse(AddressResponseDto, { isArray: true })
  @ApiOperation({ summary: 'List current user addresses' })
  listAddresses(
    @Req() request: AuthenticatedRequest,
  ): Promise<AddressResponseDto[]> {
    return this.users.listAddresses(request.user.id);
  }

  @Post('me/addresses')
  @SuccessMessage('Address created')
  @ApiWrappedResponse(AddressResponseDto, { status: 201 })
  @ApiOperation({ summary: 'Create a shipping address' })
  createAddress(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateAddressDto,
  ): Promise<AddressResponseDto> {
    return this.users.createAddress(request.user.id, dto);
  }

  @Patch('me/addresses/:addressId')
  @SuccessMessage('Address updated')
  @ApiWrappedResponse(AddressResponseDto)
  @ApiOperation({ summary: 'Update one of the current user addresses' })
  updateAddress(
    @Req() request: AuthenticatedRequest,
    @Param('addressId', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAddressDto,
  ): Promise<AddressResponseDto> {
    return this.users.updateAddress(request.user.id, id, dto);
  }

  @Delete('me/addresses/:addressId')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiOperation({ summary: 'Delete one of the current user addresses' })
  deleteAddress(
    @Req() request: AuthenticatedRequest,
    @Param('addressId', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.users.deleteAddress(request.user.id, id);
  }
}
