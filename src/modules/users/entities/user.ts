export type UserRole = 'CUSTOMER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export interface UserProfile {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
}

// This shape never leaves the Users/Auth service boundary.
export interface UserCredentials extends UserProfile {
  passwordHash: string;
  deletedAt: string | null;
}

export interface UserAccount extends UserProfile {
  deletedAt: string | null;
}
