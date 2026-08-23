import { api } from '@/lib/api-client';
import type { PantryItem, CreatePantryItemInput } from '@/types/types';

function getInstanceId(): string {
  const id = localStorage.getItem('currentInstanceId');
  if (!id) throw new Error('No instance selected');
  return id;
}

export async function getPantryItems(userId: string): Promise<PantryItem[]> {
  const instanceId = getInstanceId();
  const items = await api.get<PantryItem[]>(`/api/pantry?instance_id=${instanceId}`);
  return items.filter(i => String(i.user_id) === userId);
}

export async function createPantryItem(_userId: string, input: CreatePantryItemInput): Promise<PantryItem> {
  const instanceId = getInstanceId();
  return api.post<PantryItem>('/api/pantry', { ...input, instance_id: instanceId });
}

export async function updatePantryItem(id: string, updates: Partial<CreatePantryItemInput>): Promise<PantryItem> {
  return api.put<PantryItem>(`/api/pantry/${id}`, updates);
}

export async function checkPantryItemUsage(pantryItemId: string): Promise<{ isUsed: boolean; recipes: Array<{ id: string; title: string }> }> {
  return api.get(`/api/pantry/${pantryItemId}/usage`);
}

export async function deletePantryItem(id: string): Promise<void> {
  await api.delete(`/api/pantry/${id}`);
}
