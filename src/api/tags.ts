import { api } from '@/lib/api-client';
import type { Tag } from '@/types/types';

function getInstanceId(): string {
  const id = localStorage.getItem('currentInstanceId');
  if (!id) throw new Error('No instance selected');
  return id;
}

export async function getAllTags(): Promise<Tag[]> {
  const instanceId = getInstanceId();
  return api.get<Tag[]>(`/api/tags?instance_id=${instanceId}`);
}
