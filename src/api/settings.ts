import { api } from '@/lib/api-client';
import type { Settings } from '@/types/types';

function getInstanceId(): string {
  const id = localStorage.getItem('currentInstanceId');
  if (!id) throw new Error('No instance selected');
  return id;
}

export async function getSettings(): Promise<Settings | null> {
  try {
    const instanceId = getInstanceId();
    return await api.get<Settings>(`/api/settings?instance_id=${instanceId}`);
  } catch {
    return null;
  }
}

export async function updateSettings(updates: Partial<Settings>): Promise<Settings> {
  const instanceId = getInstanceId();
  return api.put<Settings>('/api/settings', { ...updates, instance_id: instanceId });
}
