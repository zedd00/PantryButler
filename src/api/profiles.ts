import { api } from '@/lib/api-client';
import type { Profile } from '@/types/types';

function getInstanceId(): string {
  const id = localStorage.getItem('currentInstanceId');
  if (!id) throw new Error('No instance selected');
  return id;
}

export async function getAllProfiles(): Promise<(Profile & { role?: string })[]> {
  const instanceId = getInstanceId();
  return api.get<(Profile & { role?: string })[]>(`/api/profiles?instance_id=${instanceId}`);
}

export async function deleteProfile(id: string): Promise<void> {
  await api.delete(`/api/profiles/${id}`);
}

export async function getCurrentUserRole(): Promise<'admin' | 'user' | 'viewer' | null> {
  try {
    const instanceId = getInstanceId();
    const result = await api.get<{ role: string }>(`/api/profiles/role?instance_id=${instanceId}`);
    return result.role as 'admin' | 'user' | 'viewer';
  } catch {
    return null;
  }
}
