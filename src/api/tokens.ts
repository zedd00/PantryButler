import { api } from '@/lib/api-client';
import type { ApiToken } from '@/types/types';

function getInstanceId(): string {
  const id = localStorage.getItem('currentInstanceId');
  if (!id) throw new Error('No instance selected');
  return id;
}

export async function getApiTokens(): Promise<ApiToken[]> {
  return api.get<ApiToken[]>('/api/tokens');
}

export interface CreateApiTokenInput {
  instance_id: string;
  name: string;
  scopes?: string[];
  expires_at?: string;
}

export interface CreateApiTokenResult {
  id: string;
  user_id: string;
  instance_id: string;
  name: string;
  scopes: string[];
  expires_at: string | null;
  created_at: string;
  token: string; // plaintext, shown exactly once
}

export async function createApiToken(input: CreateApiTokenInput): Promise<CreateApiTokenResult> {
  return api.post<CreateApiTokenResult>('/api/tokens', input);
}

export async function revokeApiToken(id: string): Promise<void> {
  await api.delete(`/api/tokens/${id}`);
}

export async function revokeAllApiTokens(): Promise<void> {
  await api.delete('/api/tokens');
}

export { getInstanceId };
