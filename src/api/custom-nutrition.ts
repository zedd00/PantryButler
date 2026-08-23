import { api } from '@/lib/api-client';
import type { CustomNutrition } from '@/types/types';

export async function createCustomNutrition(_userId: string, data: {
  ingredient_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
  cholesterol_mg?: number;
  serving_size?: string;
  serving_unit?: string;
}): Promise<CustomNutrition> {
  const instance_id = localStorage.getItem('currentInstanceId');
  if (!instance_id) throw new Error('No instance selected');
  return api.post<CustomNutrition>('/api/custom-nutrition', { ...data, instance_id });
}
