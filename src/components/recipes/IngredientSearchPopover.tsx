import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { stripPreparations } from '@/lib/preparation';
import { api } from '@/lib/api-client';
import { useTranslation } from 'react-i18next';

interface PantryItem {
  id: string;
  ingredient_name: string;
  nutrition_food_id?: string | null;
}

interface NutritionFood {
  food_id: string;
  food_name: string;
  alternate_names?: string;
}

interface IngredientSearchPopoverProps {
  value: string;
  nutritionFoodId?: string | null;
  onSelect: (name: string, nutritionFoodId?: string | null) => void;
  instanceId?: string;
  placeholder?: string;
  filterPlaceholder?: string;
  pantryItems?: PantryItem[];
}


export function IngredientSearchPopover({
  value,
  nutritionFoodId,
  onSelect,
  instanceId,
  placeholder,
  filterPlaceholder,
  pantryItems: externalPantry,
}: IngredientSearchPopoverProps) {
  const { t } = useTranslation('recipes');
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(value || '');
  const [nutritionFoods, setNutritionFoods] = useState<NutritionFood[]>([]);
  const [internalPantry, setInternalPantry] = useState<PantryItem[]>([]);
  const [recentIngredients, setRecentIngredients] = useState<string[]>([]);

  const pantryItems = externalPantry || internalPantry;

  useEffect(() => {
    loadNutritionFoods();
    if (!externalPantry) loadPantryItems();
    loadRecentIngredients();
  }, []);

  useEffect(() => {
    if (open) setSearchValue(value || '');
  }, [open, value]);

  const loadNutritionFoods = async () => {
    try {
      const data = await api.get<any[]>('/api/nutrition/foods');
      if (data) {
        setNutritionFoods(data.map((f: any) => ({
          food_id: f.id,
          food_name: f.name,
        })));
      }
    } catch (error) {
      console.error('Failed to load nutrition foods:', error);
    }
  };

  const loadPantryItems = async () => {
    if (!instanceId) return;
    try {
      const data = await api.get<any[]>(`/api/pantry?instance_id=${instanceId}`);
      if (data) {
        setInternalPantry(data.map((d: any) => ({
          id: d.id,
          ingredient_name: d.ingredient_name,
          nutrition_food_id: d.nutrition_food_id,
        })));
      }
    } catch (error) {
      console.error('Failed to load pantry items:', error);
    }
  };

  const loadRecentIngredients = async () => {
    try {
      const data = await api.get<any[]>('/api/recipe-ingredients/names');
      if (data) {
        const unique = Array.from(new Set(data.map((d: any) => d.name).filter(Boolean)));
        setRecentIngredients(unique);
      }
    } catch (error) {
      console.error('Failed to load recent ingredients:', error);
    }
  };

  const wordMatchScore = (text: string, query: string, queryWords: string[]): number => {
    const lower = text.toLowerCase();
    if (!query || !lower) return 0;
    if (lower.includes(query)) return 1000;
    let matched = 0;
    for (const word of queryWords) {
      if (lower.includes(word)) matched++;
    }
    return matched;
  };

  const searchNutritionFoods = (query: string): NutritionFood[] => {
    if (!query || query.length < 2) return [];
    const lowerQuery = query.toLowerCase().trim();
    const strippedQuery = stripPreparations(lowerQuery);
    const queryWords = lowerQuery.split(/\s+/).filter(w => w.length >= 3);
    const strippedWords = strippedQuery && strippedQuery !== lowerQuery
      ? strippedQuery.split(/\s+/).filter(w => w.length >= 3)
      : [];

    const scored = nutritionFoods
      .map(food => {
        const nameScore = wordMatchScore(food.food_name, lowerQuery, queryWords);
        const strippedScore = strippedQuery && strippedQuery !== lowerQuery
          ? wordMatchScore(food.food_name, strippedQuery, strippedWords)
          : 0;
        const altScore = food.alternate_names
          ? wordMatchScore(food.alternate_names, lowerQuery, queryWords)
          : 0;
        return { food, score: Math.max(nameScore, strippedScore, altScore) };
      })
      .filter(m => m.score > 0)
      .sort((a, b) => {
        const aName = a.food.food_name.toLowerCase();
        const bName = b.food.food_name.toLowerCase();
        if (aName === lowerQuery) return -1;
        if (bName === lowerQuery) return 1;
        if (aName.startsWith(lowerQuery)) return -1;
        if (bName.startsWith(lowerQuery)) return 1;
        if (b.score !== a.score) return b.score - a.score;
        return aName.localeCompare(bName);
      })
      .map(m => m.food)
      .slice(0, 20);

    return scored;
  };

  const searchPantryItems = (query: string): PantryItem[] => {
    if (!query || query.length < 1) return [];
    const lowerQuery = query.toLowerCase().trim();
    const queryWords = lowerQuery.split(/\s+/).filter(w => w.length >= 3);
    return pantryItems
      .map(item => {
        const score = wordMatchScore(item.ingredient_name, lowerQuery, queryWords);
        return { item, score };
      })
      .filter(m => m.score > 0)
      .sort((a, b) => {
        if (a.item.ingredient_name.toLowerCase().startsWith(lowerQuery)) return -1;
        if (b.item.ingredient_name.toLowerCase().startsWith(lowerQuery)) return 1;
        if (b.score !== a.score) return b.score - a.score;
        return a.item.ingredient_name.localeCompare(b.item.ingredient_name);
      })
      .map(m => m.item)
      .slice(0, 10);
  };

  const handleSelectPantry = (item: PantryItem) => {
    onSelect(item.ingredient_name, item.nutrition_food_id || null);
    setOpen(false);
    setSearchValue('');
  };

  const handleSelectNutrition = (food: NutritionFood) => {
    onSelect(food.food_name, food.food_id);
    setOpen(false);
    setSearchValue('');
  };

  const handleSelectCustom = () => {
    onSelect(searchValue, null);
    setOpen(false);
    setSearchValue('');
  };

  const hasPantryResults = searchValue && searchPantryItems(searchValue).length > 0;
  const hasNutritionResults = searchValue && searchNutritionFoods(searchValue).length > 0;
  const hasRecent = recentIngredients.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{value || placeholder || t('shared.selectOrType')}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={filterPlaceholder || t('shared.searchIngredient')}
            value={searchValue}
            onValueChange={setSearchValue}
            onKeyDown={(e) => { if (e.key === 'Tab') setOpen(false); }}
          />
          <CommandList>
            {hasPantryResults || hasNutritionResults || (searchValue && hasRecent) ? (
              <>
                {hasPantryResults && (
                  <CommandGroup heading={t('ingredientSearchPopover.pantryItems')}>
                    {searchPantryItems(searchValue).map((item) => (
                      <CommandItem
                        key={item.ingredient_name}
                        value={item.ingredient_name}
                        onSelect={() => handleSelectPantry(item)}
                      >
                        {item.ingredient_name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {hasNutritionResults && (
                  <CommandGroup heading={t('ingredientSearchPopover.nutritionMatches')}>
                    {searchNutritionFoods(searchValue).map((food) => (
                      <CommandItem
                        key={food.food_id}
                        value={food.food_name}
                        onSelect={() => handleSelectNutrition(food)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            nutritionFoodId === food.food_id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex-1">
                          <div>{food.food_name}</div>
                          {food.alternate_names && (
                            <div className="text-xs text-muted-foreground">
                              {t('ingredientSearchPopover.also', { name: food.alternate_names.split(',').slice(0, 2).join(', ') })}
                            </div>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {searchValue && (
                  <CommandGroup heading={t('ingredientSearchPopover.custom')}>
                    <CommandItem
                      value={`custom-${searchValue}`}
                      onSelect={handleSelectCustom}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t('ingredientSearchPopover.useCustom', { value: searchValue })}
                    </CommandItem>
                  </CommandGroup>
                )}
                {hasRecent && (
                  <CommandGroup heading={t('ingredientSearchPopover.recentIngredients')}>
                    {recentIngredients
                      .filter(name => !searchValue || name.toLowerCase().includes(searchValue.toLowerCase()))
                      .slice(0, 10)
                      .map((name) => (
                        <CommandItem
                          key={name}
                          value={name}
                          onSelect={() => { onSelect(name, null); setOpen(false); setSearchValue(''); }}
                        >
                          {name}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                )}
              </>
            ) : (
              <>
                {searchValue ? (
                  <CommandGroup heading={t('ingredientSearchPopover.custom')}>
                    <CommandItem
                      value={`custom-${searchValue}`}
                      onSelect={handleSelectCustom}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t('ingredientSearchPopover.useCustom', { value: searchValue })}
                    </CommandItem>
                  </CommandGroup>
                ) : (
                  <CommandEmpty>{t('ingredientSearchPopover.startTyping')}</CommandEmpty>
                )}
                {hasRecent && (
                  <CommandGroup heading={t('ingredientSearchPopover.recentIngredients')}>
                    {recentIngredients.slice(0, 20).map((name) => (
                      <CommandItem
                        key={name}
                        value={name}
                        onSelect={() => { onSelect(name, null); setOpen(false); setSearchValue(''); }}
                      >
                        {name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
