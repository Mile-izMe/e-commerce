import 'reflect-metadata';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from './roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());
  const controller = class TestController {};
  const handler = () => undefined;
  Reflect.defineMetadata(Roles.KEY, ['ADMIN'], handler);

  function context(role?: 'CUSTOMER' | 'ADMIN'): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({
        getRequest: () => ({ user: role ? { role } : undefined }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows the required role', () => {
    expect(guard.canActivate(context('ADMIN'))).toBe(true);
  });

  it('rejects a different role', () => {
    expect(() => guard.canActivate(context('CUSTOMER'))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects missing identity', () => {
    expect(() => guard.canActivate(context())).toThrow(UnauthorizedException);
  });
});
