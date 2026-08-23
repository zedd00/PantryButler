import { describe, it, expect, vi, beforeEach } from 'vitest';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock('../src/db/pool', () => ({
  query: queryMock,
  pool: { query: queryMock },
  withTransaction: vi.fn(
    async (fn: (client: { query: typeof queryMock }) => unknown) => fn({ query: queryMock })
  ),
}));

import { calculateRecipeNutrition } from '../src/utils/nutrition-calculator';

describe('calculateRecipeNutrition batching', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('resolves all food ids in a single query', async () => {
    const food = {
      id: 'food-1', name: 'Cheese', cup_to_g: 113, tbsp_to_g: 7,
      calories: 100, protein_g: 10, carbs_g: 2, fat_g: 6,
      fiber_g: 0, sugar_g: 1, sodium_mg: 200, cholesterol_mg: 20,
    };
    queryMock.mockResolvedValueOnce({ rows: [food] } as never);

    const result = await calculateRecipeNutrition(
      [
        { name: 'Cheese', quantity: 2, unit: 'cup', nutrition_food_id: 'food-1' },
        { name: 'Cheese', quantity: 1, unit: 'tbsp', nutrition_food_id: 'food-1' },
      ],
      2
    );

    expect(result).not.toBeNull();
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][0]).toContain('id = ANY');
    expect(result!.ingredients).toHaveLength(2);
    expect(result!.matched_count).toBe(2);
  });

  it('falls back to a single name lookup when ids are unresolved', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({
        rows: [{ id: 'food-2', name: 'Milk', calories: 50, protein_g: 3, carbs_g: 5, fat_g: 2 }],
      } as never);

    const result = await calculateRecipeNutrition(
      [{ name: 'Milk', quantity: 1, unit: 'cup', nutrition_food_id: 'unknown' }],
      1
    );

    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[0][0]).toContain('id = ANY');
    expect(queryMock.mock.calls[1][0]).toContain('name ILIKE ANY');
    expect(result!.ingredients[0].matched_food_id).toBe('food-2');
  });
});