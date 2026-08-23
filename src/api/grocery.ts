import { api } from '@/lib/api-client';
import type { GroceryListRecipe, CustomGroceryItem, ConsolidatedIngredient } from '@/types/types';

function getInstanceId(): string {
  const id = localStorage.getItem('currentInstanceId');
  if (!id) throw new Error('No instance selected');
  return id;
}

export async function getGroceryListRecipes(_userId: string): Promise<GroceryListRecipe[]> {
  const instanceId = getInstanceId();
  return api.get<GroceryListRecipe[]>(`/api/grocery/recipes?instance_id=${instanceId}`);
}

export async function addRecipeToGroceryList(_userId: string, recipeId: string, servings?: number): Promise<GroceryListRecipe> {
  const instanceId = getInstanceId();
  return api.post<GroceryListRecipe>('/api/grocery/recipes', { instance_id: instanceId, recipe_id: recipeId, servings });
}

export async function removeRecipeFromGroceryList(_userId: string, recipeId: string): Promise<void> {
  await api.delete(`/api/grocery/recipes/${recipeId}`);
}

export async function clearGroceryList(_userId: string): Promise<void> {
  const instanceId = getInstanceId();
  await api.delete(`/api/grocery/recipes?instance_id=${instanceId}`);
}

export async function consolidateGroceryList(_userId: string): Promise<ConsolidatedIngredient[]> {
  const instanceId = getInstanceId();
  return api.post<ConsolidatedIngredient[]>('/api/grocery/consolidate', { instance_id: instanceId });
}

export async function getCustomGroceryItems(_userId: string): Promise<CustomGroceryItem[]> {
  const instanceId = getInstanceId();
  return api.get<CustomGroceryItem[]>(`/api/grocery/custom?instance_id=${instanceId}`);
}

export async function createCustomGroceryItem(_userId: string, item: { name: string; quantity: number; unit: string }): Promise<CustomGroceryItem> {
  const instanceId = getInstanceId();
  return api.post<CustomGroceryItem>('/api/grocery/custom', { instance_id: instanceId, ...item });
}

export async function deleteCustomGroceryItem(id: string): Promise<void> {
  await api.delete(`/api/grocery/custom/${id}`);
}

export async function updateCustomGroceryItem(id: string, data: { is_purchased?: boolean; name?: string; quantity?: number; unit?: string }): Promise<CustomGroceryItem> {
  return api.put<CustomGroceryItem>(`/api/grocery/custom/${id}`, data);
}

export async function clearCustomGroceryItems(_userId: string): Promise<void> {
  const instanceId = getInstanceId();
  await api.delete(`/api/grocery/custom?instance_id=${instanceId}`);
}
