import { Inject, Injectable } from '@nestjs/common';
import { DATABASE } from '../../../infrastructure/database/database.constants.js';
import type { DatabaseClient } from '../../../prisma/db.js';
import type {
  UserAccount,
  UserCredentials,
  UserProfile,
} from '../entities/user.js';
import type { UserAddress } from '../entities/user-address.js';
import type { CreateAddressDto } from '../dto/create-address.dto.js';
import type { UpdateAddressDto } from '../dto/update-address.dto.js';

@Injectable()
export class UserRepository {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  findByEmail(email: string): Promise<UserCredentials | null> {
    return this.database.orm.public.User.where({ email })
      .select(
        'id',
        'email',
        'username',
        'name',
        'phone',
        'role',
        'status',
        'deletedAt',
        'passwordHash',
      )
      .first();
  }

  findByUsername(username: string): Promise<UserCredentials | null> {
    return this.database.orm.public.User.where({ username })
      .select(
        'id',
        'email',
        'username',
        'name',
        'phone',
        'role',
        'status',
        'deletedAt',
        'passwordHash',
      )
      .first();
  }

  findProfile(id: string): Promise<UserProfile | null> {
    return this.database.orm.public.User.where({ id })
      .where({ status: 'ACTIVE' })
      .where((user) => user.deletedAt.isNull())
      .select('id', 'email', 'username', 'name', 'phone', 'role', 'status')
      .first();
  }

  findAccount(id: string): Promise<UserAccount | null> {
    return this.database.orm.public.User.where({ id })
      .select(
        'id',
        'email',
        'username',
        'name',
        'phone',
        'role',
        'status',
        'deletedAt',
      )
      .first();
  }

  async createCustomer(input: {
    email: string;
    username: string;
    passwordHash: string;
    name?: string;
  }): Promise<UserProfile> {
    const user = await this.database.orm.public.User.select(
      'id',
      'email',
      'username',
      'name',
      'phone',
      'role',
      'status',
    ).create({ ...input, role: 'CUSTOMER', status: 'ACTIVE' });
    return user;
  }

  async updateProfile(
    id: string,
    changes: { name?: string | null; phone?: string | null },
  ): Promise<UserProfile | null> {
    return this.database.orm.public.User.where({ id })
      .where({ status: 'ACTIVE' })
      .where((user) => user.deletedAt.isNull())
      .select('id', 'email', 'username', 'name', 'phone', 'role', 'status')
      .update(changes);
  }

  async recordLogin(id: string): Promise<void> {
    await this.database.orm.public.User.where({ id }).update({
      lastLoginAt: new Date().toISOString(),
    });
  }

  private addressQuery() {
    return this.database.orm.public.UserAddress.select(
      'id',
      'userId',
      'label',
      'recipientName',
      'phone',
      'addressLine1',
      'addressLine2',
      'ward',
      'district',
      'city',
      'province',
      'postalCode',
      'countryCode',
    );
  }

  async listAddresses(userId: string): Promise<UserAddress[]> {
    return this.addressQuery()
      .where({ userId })
      .orderBy([
        (address) => address.createdAt.asc(),
        (address) => address.id.asc(),
      ])
      .all();
  }

  async createAddress(
    userId: string,
    input: CreateAddressDto,
  ): Promise<UserAddress> {
    return this.addressQuery().create({ ...input, userId });
  }

  async updateAddress(
    userId: string,
    id: string,
    input: UpdateAddressDto,
  ): Promise<UserAddress | null> {
    return this.addressQuery().where({ userId, id }).update(input);
  }

  async deleteAddress(userId: string, id: string): Promise<boolean> {
    const deleted = await this.database.orm.public.UserAddress.where({
      userId,
      id,
    }).delete();
    return deleted !== null;
  }
}
