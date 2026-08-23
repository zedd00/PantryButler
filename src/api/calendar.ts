import { api } from '@/lib/api-client';
import type { CalendarMeal, CalendarMealWithRecipe } from '@/types/types';

function getInstanceId(): string {
  const id = localStorage.getItem('currentInstanceId');
  if (!id) throw new Error('No instance selected');
  return id;
}

export async function getCalendarMeals(_userId: string, startDate: string, endDate: string): Promise<CalendarMealWithRecipe[]> {
  const instanceId = getInstanceId();
  return api.get<CalendarMealWithRecipe[]>(
    `/api/calendar?instance_id=${instanceId}&start_date=${startDate}&end_date=${endDate}`
  );
}

export async function createCalendarMeal(_userId: string, recipeId: string, mealDate: string, mealType: string): Promise<CalendarMeal> {
  const instanceId = getInstanceId();
  return api.post<CalendarMeal>('/api/calendar', {
    instance_id: instanceId,
    recipe_id: recipeId,
    meal_date: mealDate,
    meal_type: mealType,
  });
}

export async function markMealAsCooked(mealId: string, _userId: string): Promise<void> {
  await api.post(`/api/calendar/${mealId}/cook`);
}

export async function deleteCalendarMeal(mealId: string): Promise<void> {
  await api.delete(`/api/calendar/${mealId}`);
}
