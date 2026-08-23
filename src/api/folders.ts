import { api } from '@/lib/api-client';
import type { Folder } from '@/types/types';

function getInstanceId(): string {
  const id = localStorage.getItem('currentInstanceId');
  if (!id) throw new Error('No instance selected');
  return id;
}

export async function getAllFolders(): Promise<Folder[]> {
  const instanceId = getInstanceId();
  return api.get<Folder[]>(`/api/folders?instance_id=${instanceId}`);
}

export async function createFolder(name: string, owner_id?: string): Promise<Folder> {
  const instanceId = getInstanceId();
  return api.post<Folder>('/api/folders', { name, owner_id, instance_id: instanceId });
}

export async function updateFolder(id: string, name: string): Promise<Folder> {
  return api.put<Folder>(`/api/folders/${id}`, { name });
}

export async function deleteFolder(id: string): Promise<void> {
  await api.delete(`/api/folders/${id}`);
}
