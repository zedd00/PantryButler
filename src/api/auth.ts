import { api } from '@/lib/api-client';

export interface AuthResponse {
  token: string;
  user: { id: string; email: string };
}

export interface RegisterResponse extends Partial<AuthResponse> {
  requiresEmailVerification?: boolean;
}

export async function verifyEmail(token: string): Promise<AuthResponse> {
  return api.get<AuthResponse>(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
}

export async function resendVerification(email: string): Promise<{ success: boolean }> {
  return api.post<{ success: boolean }>('/api/auth/resend-verification', { email });
}