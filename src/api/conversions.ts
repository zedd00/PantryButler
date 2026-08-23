import { api } from '@/lib/api-client';
import type { UnitConversion } from '@/types/types';

function getInstanceId(): string {
  const id = localStorage.getItem('currentInstanceId');
  if (!id) throw new Error('No instance selected');
  return id;
}

export async function getAllConversions(): Promise<UnitConversion[]> {
  const instanceId = getInstanceId();
  return api.get<UnitConversion[]>(`/api/conversions?instance_id=${instanceId}`);
}
