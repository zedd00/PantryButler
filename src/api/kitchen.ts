import { api } from '@/lib/api-client';
import type { KitchenModel, KitchenElement, KitchenElementWithPlacements, ElementItemPlacement, CreateKitchenModelInput, CreateKitchenElementInput, UpdateKitchenElementInput } from '@/types/types';

function getInstanceId(): string {
  const id = localStorage.getItem('currentInstanceId');
  if (!id) throw new Error('No instance selected');
  return id;
}

export async function getKitchenModels(_userId: string): Promise<KitchenModel[]> {
  const instanceId = getInstanceId();
  return api.get<KitchenModel[]>(`/api/kitchen/models?instance_id=${instanceId}`);
}

export async function createKitchenModel(_userId: string, input: CreateKitchenModelInput, instanceId?: string): Promise<KitchenModel> {
  const id = instanceId || getInstanceId();
  return api.post<KitchenModel>('/api/kitchen/models', { ...input, instance_id: id });
}

export async function updateKitchenModel(modelId: string, updates: Partial<CreateKitchenModelInput>): Promise<KitchenModel> {
  return api.put<KitchenModel>(`/api/kitchen/models/${modelId}`, updates);
}

export async function deleteKitchenModel(modelId: string): Promise<void> {
  await api.delete(`/api/kitchen/models/${modelId}`);
}

export async function getKitchenElements(modelId: string): Promise<KitchenElementWithPlacements[]> {
  return api.get<KitchenElementWithPlacements[]>(`/api/kitchen/models/${modelId}/elements`);
}

export async function createKitchenElement(input: CreateKitchenElementInput): Promise<KitchenElement> {
  return api.post<KitchenElement>('/api/kitchen/elements', input);
}

export async function updateKitchenElement(elementId: string, updates: UpdateKitchenElementInput): Promise<KitchenElement> {
  return api.put<KitchenElement>(`/api/kitchen/elements/${elementId}`, updates);
}

export async function deleteKitchenElement(elementId: string): Promise<void> {
  await api.delete(`/api/kitchen/elements/${elementId}`);
}

export async function getElementPlacements(elementId: string): Promise<ElementItemPlacement[]> {
  return api.get<ElementItemPlacement[]>(`/api/kitchen/elements/${elementId}/placements`);
}

export async function createElementPlacement(elementId: string, itemType: 'ingredient' | 'equipment', itemId: string): Promise<ElementItemPlacement> {
  return api.post<ElementItemPlacement>('/api/kitchen/placements', { element_id: elementId, item_type: itemType, item_id: itemId });
}

export async function deleteElementPlacementByItem(elementId: string, itemType: 'ingredient' | 'equipment', itemId: string): Promise<void> {
  await api.delete('/api/kitchen/placements/by-item', { data: { element_id: elementId, item_type: itemType, item_id: itemId } });
}

export async function getKitchenElementLocations(_userId: string): Promise<string[]> {
  const instanceId = getInstanceId();
  return api.get<string[]>(`/api/kitchen/locations?instance_id=${instanceId}`);
}
