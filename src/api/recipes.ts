import { api } from '@/lib/api-client';
import type { Recipe, RecipeWithDetails, Tag, CreateRecipeInput, UpdateRecipeInput } from '@/types/types';

function getInstanceId(): string {
  const id = localStorage.getItem('currentInstanceId');
  if (!id) throw new Error('No instance selected');
  return id;
}

export async function getAllRecipes(folderId?: string, tagId?: string): Promise<(Recipe & { tags?: Tag[] })[]> {
  const instanceId = getInstanceId();
  let path = `/api/recipes?instance_id=${instanceId}`;
  if (folderId) path += `&folder_id=${folderId}`;
  if (tagId) path += `&tag_id=${tagId}`;
  return api.get<(Recipe & { tags?: Tag[] })[]>(path);
}

export async function getRecipeById(id: string): Promise<RecipeWithDetails | null> {
  try {
    return await api.get<RecipeWithDetails>(`/api/recipes/${id}`);
  } catch {
    return null;
  }
}

export async function createRecipe(input: CreateRecipeInput, _owner_id: string): Promise<Recipe> {
  const instanceId = getInstanceId();
  return api.post<Recipe>('/api/recipes', { ...input, instance_id: instanceId });
}

export async function updateRecipe(input: UpdateRecipeInput): Promise<Recipe> {
  const { id, ...data } = input;
  return api.put<Recipe>(`/api/recipes/${id}`, data);
}

export async function updateRecipeServings(id: string, servings: number): Promise<Recipe> {
  return api.put<Recipe>(`/api/recipes/${id}/servings`, { servings });
}

export async function deleteRecipe(id: string): Promise<void> {
  await api.delete(`/api/recipes/${id}`);
}

export async function toggleRecipePublic(recipeId: string, isPublic: boolean): Promise<{ publicSlug: string | null }> {
  return api.put<{ publicSlug: string | null }>(`/api/recipes/${recipeId}/public`, { is_public: isPublic });
}

export async function getPublicRecipe(slug: string): Promise<any> {
  return api.get<any>(`/api/recipes/public/${slug}`);
}
