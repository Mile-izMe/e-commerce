import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { RegisterRequestDto } from '../auth/dto/register-request.dto.js';
import type { UserCredentials, UserProfile } from './entities/user.js';
import { UserRepository } from './repositories/user.repository.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { CreateAddressDto } from './dto/create-address.dto.js';
import type { UpdateAddressDto } from './dto/update-address.dto.js';
import type { UserAddress } from './entities/user-address.js';

@Injectable()
export class UsersService {
  constructor(private readonly users: UserRepository) {}

  findForLogin(identifier: string): Promise<UserCredentials | null> {
    const normalized = identifier.trim().toLowerCase();
    return normalized.includes('@')
      ? this.users.findByEmail(normalized)
      : this.users.findByUsername(normalized);
  }

  async register(
    input: RegisterRequestDto,
    passwordHash: string,
  ): Promise<UserProfile> {
    const email = input.email.trim().toLowerCase();
    const username = input.username.trim().toLowerCase();
    if (input.name !== undefined && !input.name.trim())
      throw new BadRequestException('Name cannot be blank');
    if (await this.users.findByEmail(email))
      throw new ConflictException('Email or username is already registered');
    if (await this.users.findByUsername(username))
      throw new ConflictException('Email or username is already registered');
    try {
      return await this.users.createCustomer({
        email,
        username,
        passwordHash,
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
      });
    } catch (error) {
      // The unique constraints are the final arbiter if two registrations race.
      if (
        (await this.users.findByEmail(email)) ||
        (await this.users.findByUsername(username))
      ) {
        throw new ConflictException('Email or username is already registered');
      }
      throw error;
    }
  }

  async getActiveProfile(id: string): Promise<UserProfile | null> {
    return this.users.findProfile(id);
  }

  async getForSession(id: string): Promise<UserProfile> {
    const account = await this.users.findAccount(id);
    if (
      !account ||
      account.deletedAt !== null ||
      account.status === 'DELETED'
    ) {
      throw new UnauthorizedException();
    }
    if (account.status !== 'ACTIVE')
      throw new ForbiddenException('Account is not active');
    return {
      id: account.id,
      email: account.email,
      username: account.username,
      name: account.name,
      phone: account.phone,
      role: account.role,
      status: account.status,
    };
  }

  async getProfile(id: string): Promise<UserProfile> {
    const user = await this.getActiveProfile(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(
    id: string,
    input: UpdateProfileDto,
  ): Promise<UserProfile> {
    if (input.name === undefined && input.phone === undefined) {
      throw new BadRequestException('Provide name or phone to update');
    }
    const changes = {
      ...(input.name === undefined
        ? {}
        : { name: input.name === null ? null : input.name.trim() }),
      ...(input.phone === undefined
        ? {}
        : { phone: input.phone === null ? null : input.phone.trim() }),
    };
    const name = changes.name;
    if (name !== undefined && name !== null && name.length === 0)
      throw new BadRequestException('Name cannot be blank');
    const profile = await this.users.updateProfile(id, changes);
    if (!profile) throw new NotFoundException('User not found');
    return profile;
  }

  recordLogin(id: string): Promise<void> {
    return this.users.recordLogin(id);
  }

  listAddresses(userId: string): Promise<UserAddress[]> {
    return this.users.listAddresses(userId);
  }

  createAddress(userId: string, input: CreateAddressDto): Promise<UserAddress> {
    const address = {
      ...input,
      recipientName: input.recipientName.trim(),
      phone: input.phone.trim(),
      addressLine1: input.addressLine1.trim(),
      city: input.city.trim(),
      countryCode: input.countryCode?.toUpperCase() ?? 'VN',
    };
    if (!address.recipientName || !address.addressLine1 || !address.city) {
      throw new BadRequestException('Required address fields cannot be blank');
    }
    return this.users.createAddress(userId, address);
  }

  async updateAddress(
    userId: string,
    id: string,
    input: UpdateAddressDto,
  ): Promise<UserAddress> {
    if (Object.keys(input).length === 0)
      throw new BadRequestException('Provide address fields to update');
    const changes = { ...input };
    for (const field of [
      'recipientName',
      'phone',
      'addressLine1',
      'city',
    ] as const) {
      if (changes[field] !== undefined) {
        if (typeof changes[field] !== 'string' || !changes[field].trim())
          throw new BadRequestException(`${field} cannot be blank`);
        changes[field] = changes[field].trim();
      }
    }
    if (changes.countryCode !== undefined) {
      if (typeof changes.countryCode !== 'string')
        throw new BadRequestException('countryCode cannot be null');
      changes.countryCode = changes.countryCode.toUpperCase();
    }
    const address = await this.users.updateAddress(userId, id, changes);
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  async deleteAddress(userId: string, id: string): Promise<void> {
    if (!(await this.users.deleteAddress(userId, id)))
      throw new NotFoundException('Address not found');
  }
}
