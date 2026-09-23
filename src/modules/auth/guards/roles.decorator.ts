import { Reflector } from '@nestjs/core';
import type { UserRole } from '../../users/entities/user.js';

export const Roles = Reflector.createDecorator<UserRole[]>();
