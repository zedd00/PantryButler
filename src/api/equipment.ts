import { api } from '@/lib/api-client';
import type { Equipment } from '@/types/types';

function getInstanceId(): string {
  const id = localStorage.getItem('currentInstanceId');
  if (!id) throw new Error('No instance selected');
  return id;
}

export async function getAllEquipment(): Promise<Equipment[]> {
  const instanceId = getInstanceId();
  return api.get<Equipment[]>(`/api/equipment?instance_id=${instanceId}`);
}

export async function createEquipment(name: string, location?: string): Promise<Equipment> {
  const instanceId = getInstanceId();
  return api.post<Equipment>('/api/equipment', { name, location: location || null, instance_id: instanceId });
}

export async function updateEquipment(id: string, name: string, location?: string): Promise<Equipment> {
  const updates: Record<string, unknown> = { name };
  if (location !== undefined) updates.location = location;
  return api.put<Equipment>(`/api/equipment/${id}`, updates);
}

export async function checkEquipmentUsage(equipmentId: string): Promise<{ isUsed: boolean; recipes: Array<{ id: string; title: string }> }> {
  return api.get(`/api/equipment/${equipmentId}/usage`);
}

export async function deleteEquipment(id: string): Promise<void> {
  await api.delete(`/api/equipment/${id}`);
}
