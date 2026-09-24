export interface UserSession {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
}
