import { useEffect, useMemo, useState } from 'react';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { getCalendarMeals, createCalendarMeal, markMealAsCooked, deleteCalendarMeal, getAllRecipes, getPantryItems, getSettings, getAllConversions } from '@/api';
import type { CalendarMealWithRecipe, Recipe, PantryItem, Settings, UnitConversion, RecipeIngredient } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { computeRecipeCost, formatCurrency } from '@/lib/cost';
import { format, addDays, startOfDay } from 'date-fns';
import { PageTutorial } from '@/components/tutorial/PageTutorial';
import { getMealPlanTutorialSteps } from '@/components/tutorial/tutorialSteps';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

export default function Calendar() {
  const { t, i18n } = useTranslation(['tutorial', 'calendar', 'common']);
  const { profile } = useAuth();
  const [view, setView] = useState<'7' | '14' | '30'>('7');
  const [meals, setMeals] = useState<CalendarMealWithRecipe[]>([]);
  const [availableRecipes, setAvailableRecipes] = useState<Recipe[]>([]);
  const [unscheduledRecipes, setUnscheduledRecipes] = useState<Recipe[]>([]);
  const [startDate] = useState(startOfDay(new Date()));
  const [mealSlotConfig, setMealSlotConfig] = useState({
    breakfast: true,
    lunch: true,
    dinner: true,
    snack: true,
  });
  const [insufficientDialog, setInsufficientDialog] = useState<{
    open: boolean;
    mealId: string;
    missing: { ingredient: string; required: number; available: number; unit: string }[];
  }>({ open: false, mealId: '', missing: [] });
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [conversions, setConversions] = useState<UnitConversion[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [recipeIngredients, setRecipeIngredients] = useState<Record<string, RecipeIngredient[]>>({});

  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'].filter(type => mealSlotConfig[type as keyof typeof mealSlotConfig]);

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile, view]);

  const loadData = async () => {
    if (!profile) return;

    const days = Number.parseInt(view);
    const endDate = addDays(startDate, days - 1);

    try {
      const [mealsData, recipesData, pantryData, userSettings, allConversions] = await Promise.all([
        getCalendarMeals(profile.id, format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')),
        getAllRecipes(),
        getPantryItems(profile.id),
        getSettings(),
        getAllConversions()
      ]);

      setMeals(mealsData);
      setAvailableRecipes(recipesData);
      setPantryItems(pantryData);
      setConversions(allConversions);
      setSettings(userSettings);

      const scheduledRecipeIds = new Set(mealsData.map(m => m.recipe_id));
      const unscheduled = recipesData.filter(r => !scheduledRecipeIds.has(r.id));
      setUnscheduledRecipes(unscheduled);

      const mealRecipeIds = Array.from(scheduledRecipeIds);
      if (mealRecipeIds.length > 0) {
        const ingRows = await api.get<RecipeIngredient[]>('/api/recipe-ingredients?ids=' + mealRecipeIds.join(','));
        const grouped: Record<string, RecipeIngredient[]> = {};
        for (const row of ingRows) {
          (grouped[row.recipe_id] ??= []).push(row);
        }
        setRecipeIngredients(grouped);
      } else {
        setRecipeIngredients({});
      }
    } catch (error: any) {
      toast.error(t('calendar:mealCalendar.errorLoading', { error: error.message }));
    }
  };

  const handleAddMeal = async (date: Date, mealType: string, recipeId: string) => {
    if (!profile) return;

    try {
      await createCalendarMeal(profile.id, recipeId, format(date, 'yyyy-MM-dd'), mealType);
      toast.success(t('calendar:mealCalendar.mealAdded'));
      await loadData();
    } catch (error: any) {
      toast.error(t('calendar:mealCalendar.errorAddingMeal', { error: error.message }));
    }
  };

  const handleRemoveMeal = async (mealId: string) => {
    if (!profile) return;

    try {
      await deleteCalendarMeal(mealId);
      toast.success(t('calendar:mealCalendar.mealRemoved'));
      await loadData();
    } catch (error: any) {
      toast.error(t('calendar:mealCalendar.errorRemovingMeal', { error: error.message }));
    }
  };

  const handleMarkCooked = async (mealId: string, skipCheck = false) => {
    if (!profile) return;

    if (!skipCheck) {
      // Check pantry availability first
      // This is a simplified version - in production you'd check actual quantities
      try {
        await markMealAsCooked(mealId, profile.id);
        toast.success(t('calendar:mealCalendar.mealMarkedCooked'));
        setInsufficientDialog({ open: false, mealId: '', missing: [] });
        loadData();
      } catch (error: any) {
        // If error mentions missing ingredients, show dialog
        if (error.message.includes('Missing')) {
          setInsufficientDialog({
            open: true,
            mealId,
            missing: [{ ingredient: 'Example', required: 100, available: 50, unit: 'g' }]
          });
        } else {
          toast.error(t('calendar:mealCalendar.errorMarkingCooked', { error: error.message }));
        }
      }
    } else {
      // Deduct what's available
      try {
        await markMealAsCooked(mealId, profile.id);
        toast.success(t('calendar:mealCalendar.mealMarkedCookedPartial'));
        setInsufficientDialog({ open: false, mealId: '', missing: [] });
        loadData();
      } catch (error: any) {
        toast.error(t('calendar:mealCalendar.errorMarkingCooked', { error: error.message }));
      }
    }
  };

  const getMealsForSlot = (date: Date, mealType: string) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return meals
      .filter(m => {
        const mealDate = typeof m.meal_date === 'string'
          ? m.meal_date.substring(0, 10)
          : format(new Date(m.meal_date), 'yyyy-MM-dd');
        return mealDate === dateStr && m.meal_type === mealType;
      })
      .sort((a, b) => (a.recipe?.title ?? '').localeCompare(b.recipe?.title ?? ''));
  };

  const showCost = !!settings?.cost_tracking_enabled;

  const mealCosts = useMemo(() => {
    const map: Record<string, number | null> = {};
    if (!showCost) return map;
    for (const meal of meals) {
      const ings = recipeIngredients[meal.recipe_id];
      const recipeServings = meal.recipe?.servings ?? 1;
      if (!ings || ings.length === 0 || recipeServings <= 0) {
        map[meal.id] = null;
        continue;
      }
      const result = computeRecipeCost({
        ingredients: ings,
        pantryItems,
        conversions,
        baseServings: recipeServings,
      });
      map[meal.id] = result.total;
    }
    return map;
  }, [showCost, meals, recipeIngredients, pantryItems, conversions]);

  const days = Number.parseInt(view);
  const dates = Array.from({ length: days }, (_, i) => addDays(startDate, i));

  return (
    <MainLayout>
      <PageTutorial tutorialId="meal-plan-page" steps={getMealPlanTutorialSteps(t)} />
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">{t('calendar:mealCalendar.title')}</h1>
            <p className="text-muted-foreground mt-1">{t('calendar:mealCalendar.planYourMeals')}</p>
          </div>
          <div className="flex gap-2">
            <Select value={view} onValueChange={(v) => setView(v as any)} data-tutorial="calendar-view">
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">{t('calendar:mealCalendar.days7')}</SelectItem>
                <SelectItem value="14">{t('calendar:mealCalendar.days14')}</SelectItem>
                <SelectItem value="30">{t('calendar:mealCalendar.days30')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Meal Slot Configuration */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-6">
              <span className="text-sm font-medium">{t('calendar:mealCalendar.showMealSlots')}</span>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="breakfast"
                  checked={mealSlotConfig.breakfast}
                  onCheckedChange={(checked) => setMealSlotConfig({ ...mealSlotConfig, breakfast: checked as boolean })}
                />
                <Label htmlFor="breakfast" className="cursor-pointer">{t('calendar:breakfast')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="lunch"
                  checked={mealSlotConfig.lunch}
                  onCheckedChange={(checked) => setMealSlotConfig({ ...mealSlotConfig, lunch: checked as boolean })}
                />
                <Label htmlFor="lunch" className="cursor-pointer">{t('calendar:lunch')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dinner"
                  checked={mealSlotConfig.dinner}
                  onCheckedChange={(checked) => setMealSlotConfig({ ...mealSlotConfig, dinner: checked as boolean })}
                />
                <Label htmlFor="dinner" className="cursor-pointer">{t('calendar:dinner')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="snack"
                  checked={mealSlotConfig.snack}
                  onCheckedChange={(checked) => setMealSlotConfig({ ...mealSlotConfig, snack: checked as boolean })}
                />
                <Label htmlFor="snack" className="cursor-pointer">{t('calendar:snack')}</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="overflow-x-auto">
          <div className="min-w-full">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
              {dates.map((date, dateIndex) => (
                <Card key={date.toISOString()}>
                  <CardContent className="p-4">
                    <h3 className="font-medium mb-4">{format(date, 'EEE, MMM d')}</h3>
                    <div className="space-y-3">
                      {mealTypes.map((mealType, mealIndex) => {
                        const slotMeals = getMealsForSlot(date, mealType);
                        return (
                          <div key={mealType} className="space-y-2" data-tutorial={dateIndex === 0 && mealIndex === 0 ? "add-meal" : undefined}>
                            <p className="text-sm text-muted-foreground capitalize">{mealType}</p>
                            {slotMeals.map((meal) => (
                              <div key={meal.id} className="p-2 bg-accent rounded text-sm group relative">
                                <div className="flex items-center justify-between gap-1">
                                  <p className="font-medium">{meal.recipe?.title}</p>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => handleRemoveMeal(meal.id)}
                                    aria-label={t('calendar:mealCalendar.removeRecipe')}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                                {showCost && (() => {
                                  const mealCost = mealCosts[meal.id];
                                  return mealCost != null ? (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {t('calendar:mealCalendar.mealCost')}: {formatCurrency(mealCost, settings?.currency, i18n.language)}
                                    </p>
                                  ) : null;
                                })()}
                                {!meal.is_cooked && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="mt-2 w-full"
                                    onClick={() => handleMarkCooked(meal.id)}
                                    data-tutorial={dateIndex === 0 && mealIndex === 0 ? "mark-cooked" : undefined}
                                  >
                                    {t('calendar:mealCalendar.markCooked')}
                                  </Button>
                                )}
                              </div>
                            ))}
                            <SearchableSelect
                              groups={[
                                {
                                  label: t('calendar:mealCalendar.unscheduledRecipes'),
                                  options: unscheduledRecipes.map(recipe => ({
                                    value: recipe.id,
                                    label: recipe.title
                                  }))
                                },
                                {
                                  label: t('calendar:mealCalendar.allRecipes'),
                                  options: availableRecipes.map(recipe => ({
                                    value: recipe.id,
                                    label: recipe.title
                                  }))
                                }
                              ]}
                              onValueChange={(recipeId) => handleAddMeal(date, mealType, recipeId)}
                              placeholder={slotMeals.length > 0
                                ? t('calendar:mealCalendar.addAnotherRecipe')
                                : t('calendar:mealCalendar.addRecipePlaceholder')}
                              searchPlaceholder={t('calendar:mealCalendar.searchRecipes')}
                              className="h-8 text-xs w-full"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-medium mb-4">{t('calendar:mealCalendar.unscheduledRecipes')}</h3>
            <div className="flex flex-wrap gap-2">
              {unscheduledRecipes.map((recipe) => (
                <div key={recipe.id} className="px-3 py-2 bg-accent rounded text-sm">
                  {recipe.title}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insufficient Pantry Dialog */}
      <Dialog open={insufficientDialog.open} onOpenChange={(open) => setInsufficientDialog({ ...insufficientDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('calendar:mealCalendar.insufficientPantryItems')}</DialogTitle>
            <DialogDescription>
              {t('calendar:mealCalendar.insufficientDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {insufficientDialog.missing.map((item, idx) => (
              <div key={idx} className="text-sm">
                <span className="font-medium">{item.ingredient}:</span> {t('calendar:mealCalendar.needHave', { required: item.required, unit: item.unit, available: item.available })}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInsufficientDialog({ open: false, mealId: '', missing: [] })}>
              {t('common:cancel')}
            </Button>
            <Button onClick={() => handleMarkCooked(insufficientDialog.mealId, true)}>
              {t('calendar:mealCalendar.deductAvailable')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
