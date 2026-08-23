import { api } from '@/lib/api-client';
import type { NutritionFood } from '@/types/types';

export async function searchNutritionFoods(query: string, limit = 10): Promise<NutritionFood[]> {
  if (!query || query.trim().length === 0) return [];
  return api.get<NutritionFood[]>(`/api/nutrition/search?q=${encodeURIComponent(query)}&limit=${limit}`);
}

export async function getSuggestedNutritionMatch(ingredientName: string): Promise<NutritionFood | null> {
  if (!ingredientName || ingredientName.trim().length === 0) return null;
  const results = await searchNutritionFoods(ingredientName, 1);
  return results.length > 0 ? results[0] : null;
}

export async function getNutritionFoodById(id: string): Promise<NutritionFood | null> {
  try {
    return await api.get<NutritionFood>(`/api/nutrition/${id}`);
  } catch {
    return null;
  }
}

export async function exportNutritionFoods(): Promise<NutritionFood[]> {
  return api.get<NutritionFood[]>('/api/nutrition/export');
}
