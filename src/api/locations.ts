import { api } from '@/lib/api-client';

function getInstanceId(): string {
  const id = localStorage.getItem('currentInstanceId');
  if (!id) throw new Error('No instance selected');
  return id;
}

export async function getCustomLocations(instanceId?: string): Promise<string[]> {
  const id = instanceId || getInstanceId();
  return api.get<string[]>(`/api/locations?instance_id=${id}`);
}

export async function addCustomLocation(instanceId: string, locationName: string): Promise<void> {
  await api.post('/api/locations', { instance_id: instanceId, location_name: locationName });
}
