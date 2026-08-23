import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Trash2, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { api } from '@/lib/api-client';
import { IngredientSearchPopover } from './IngredientSearchPopover';
import { useTranslation } from 'react-i18next';

interface IngredientEditorProps {
  ingredients: any[];
  onChange: (ingredients: any[]) => void;
  instanceId?: string;
}

const COMMON_UNITS = ['grams', 'kg', 'whole', 'cups', 'ml', 'liters', 'oz', 'lbs', 'tsp', 'tbsp', 'ratio', "baker's %"];

interface DisplayItem {
  ing: any;
  index: number;
}

interface DisplayGroup {
  title: string | null;
  items: DisplayItem[];
}

export default function IngredientEditor({ ingredients, onChange, instanceId }: IngredientEditorProps) {
  const { t } = useTranslation('recipes');
  const [preparations, setPreparations] = useState<string[]>([]);
  const [units, setUnits] = useState<string[]>(COMMON_UNITS);
  const [prepPopoverOpen, setPrepPopoverOpen] = useState<number | null>(null);
  const [unitPopoverOpen, setUnitPopoverOpen] = useState<number | null>(null);

  useEffect(() => {
    loadSuggestions();
  }, []);

  // Group consecutive ingredients by their group_name (same style as instruction sections).
  const groups: DisplayGroup[] = useMemo(() => {
    const result: DisplayGroup[] = [];
    let current: DisplayGroup | null = null;
    ingredients.forEach((ing, index) => {
      const title = ing.group_name || null;
      if (!current || current.title !== title) {
        current = { title, items: [] };
        result.push(current);
      }
      current.items.push({ ing, index });
    });
    return result;
  }, [ingredients]);

  const loadSuggestions = async () => {
    try {
      const [prepData, unitData] = await Promise.all([
        api.get<any[]>('/api/recipe-ingredients/preparations'),
        api.get<any[]>('/api/recipe-ingredients/units'),
      ]);

      if (prepData) {
        const uniquePreps = Array.from(new Set(prepData.map((d: any) => d.preparation).filter(Boolean)));
        setPreparations(uniquePreps);
      }

      if (unitData) {
        const uniqueUnits = Array.from(new Set(unitData.map((d: any) => d.unit).filter(Boolean)));
        setUnits(prev => Array.from(new Set([...prev, ...uniqueUnits])));
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  };

  const updateIngredient = (index: number, field: string, value: any) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    onChange(newIngredients);
  };

  const setNutritionFood = (index: number, foodId: string, foodName: string) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = {
      ...newIngredients[index],
      nutrition_food_id: foodId,
      name: foodName
    };
    onChange(newIngredients);
  };

  const setName = (index: number, name: string) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = {
      ...newIngredients[index],
      name,
      nutrition_food_id: null
    };
    onChange(newIngredients);
  };

  const removeIngredient = (index: number) => {
    onChange(ingredients.filter((_, i) => i !== index));
  };

  const moveInGroup = (group: DisplayGroup, localIndex: number, direction: 'up' | 'down') => {
    const target = group.items[localIndex + (direction === 'up' ? -1 : 1)];
    if (!target) return;
    const from = group.items[localIndex].index;
    const to = target.index;
    const newIngredients = [...ingredients];
    [newIngredients[from], newIngredients[to]] = [newIngredients[to], newIngredients[from]];
    onChange(newIngredients);
  };

  const renameGroup = (group: DisplayGroup, newTitle: string) => {
    const trimmed = newTitle.trim() || null;
    const newIngredients = [...ingredients];
    group.items.forEach(({ index }) => {
      newIngredients[index] = { ...newIngredients[index], group_name: trimmed };
    });
    onChange(newIngredients);
  };

  const removeGroup = (group: DisplayGroup) => {
    const indices = new Set(group.items.map(({ index }) => index));
    onChange(ingredients.filter((_, i) => !indices.has(i)));
  };

  const addIngredientToGroup = (group: DisplayGroup) => {
    const lastIndex = group.items.length > 0 ? group.items[group.items.length - 1].index : -1;
    const newIngredient = {
      name: '',
      preparation: '',
      quantity: 0,
      unit: 'grams',
      is_optional: false,
      order_index: ingredients.length,
      substitutions: '',
      notes: '',
      nutrition_food_id: null,
      group_name: group.title
    };
    const newIngredients = [...ingredients];
    newIngredients.splice(lastIndex + 1, 0, newIngredient);
    onChange(newIngredients);
  };

  const addGroup = () => {
    onChange([...ingredients, {
      name: '',
      preparation: '',
      quantity: 0,
      unit: 'grams',
      is_optional: false,
      order_index: ingredients.length,
      substitutions: '',
      notes: '',
      nutrition_food_id: null,
      group_name: t('ingredientEditor.newGroup', { number: groups.length + 1 })
    }]);
  };

  return (
    <div className="space-y-4">
      {groups.map((group, groupIdx) => (
        <div key={groupIdx} className="space-y-4 border border-border rounded-lg p-4">
          <div className="flex gap-2 items-center">
            <Input
              placeholder={t('ingredientEditor.groupNamePlaceholder')}
              value={group.title || ''}
              onChange={(e) => renameGroup(group, e.target.value)}
              className="flex-1"
            />
            {groups.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => removeGroup(group)}
                title={t('ingredientEditor.removeGroup')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {group.items.map(({ ing, index: globalIndex }, itemIdx) => (
            <div key={globalIndex} className="space-y-2 border border-border rounded p-3">
              <div className="flex gap-2">
                <div className="flex flex-col items-center gap-0.5 mt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => moveInGroup(group, itemIdx, 'up')}
                    disabled={itemIdx === 0}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => moveInGroup(group, itemIdx, 'down')}
                    disabled={itemIdx === group.items.length - 1}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>

                <span className="text-muted-foreground mt-2 shrink-0">{itemIdx + 1}.</span>

                <div className="flex-1 space-y-1">
                  <IngredientSearchPopover
                    value={ing.name}
                    nutritionFoodId={ing.nutrition_food_id}
                    onSelect={(name, nutritionFoodId) => {
                      if (nutritionFoodId) {
                        setNutritionFood(globalIndex, nutritionFoodId, name);
                      } else {
                        setName(globalIndex, name);
                      }
                    }}
                    instanceId={instanceId}
                    placeholder={t('shared.selectOrType')}
                    filterPlaceholder={t('shared.searchIngredient')}
                  />
                  {ing.nutrition_food_id && (
                    <span className="text-green-600 text-xs">{t('ingredientEditor.nutritionLinked')}</span>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeIngredient(globalIndex)}
                  title={t('ingredientEditor.removeIngredient')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2 ml-8 flex-wrap">
                <Input
                  type="number"
                  step="0.01"
                  value={ing.quantity}
                  onChange={(e) => updateIngredient(globalIndex, 'quantity', Number(e.target.value) || 0)}
                  className="w-24 h-8"
                  placeholder={t('shared.zeroPlaceholder')}
                />
                <Popover
                  open={unitPopoverOpen === globalIndex}
                  onOpenChange={(open) => setUnitPopoverOpen(open ? globalIndex : null)}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className="w-24 h-8 justify-between font-normal px-2"
                    >
                      <span className="truncate">{ing.unit || 'unit'}</span>
                      <ChevronDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder={t('shared.searchOrType')}
                        value={ing.unit}
                        onValueChange={(value) => updateIngredient(globalIndex, 'unit', value)}
                        onKeyDown={(e) => { if (e.key === 'Tab') setUnitPopoverOpen(null); }}
                      />
                      <CommandList>
                        <CommandEmpty>
                          <Button
                            variant="ghost"
                            className="w-full"
                            onClick={() => {
                              if (ing.unit && !units.includes(ing.unit)) {
                                setUnits([...units, ing.unit]);
                              }
                              setUnitPopoverOpen(null);
                            }}
                          >
                            {t('shared.useValue', { value: ing.unit })}
                          </Button>
                        </CommandEmpty>
                        <CommandGroup>
                          {units.map((unit) => (
                            <CommandItem
                              key={unit}
                              value={unit}
                              onSelect={() => { updateIngredient(globalIndex, 'unit', unit); setUnitPopoverOpen(null); }}
                            >
                              {unit}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                <Popover
                  open={prepPopoverOpen === globalIndex}
                  onOpenChange={(open) => setPrepPopoverOpen(open ? globalIndex : null)}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className="flex-1 h-8 justify-between font-normal"
                    >
                      <span className="truncate">{ing.preparation || t('ingredientEditor.preparation')}</span>
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0">
                    <Command>
                      <CommandInput
                        placeholder={t('shared.searchOrType')}
                        value={ing.preparation || ''}
                        onValueChange={(value) => updateIngredient(globalIndex, 'preparation', value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (ing.preparation && !preparations.includes(ing.preparation)) {
                              setPreparations([...preparations, ing.preparation]);
                            }
                            setPrepPopoverOpen(null);
                            (e.target as HTMLElement).blur();
                          }
                          if (e.key === 'Tab') setPrepPopoverOpen(null);
                        }}
                      />
                      <CommandList>
                        <CommandEmpty>
                          <Button
                            variant="ghost"
                            className="w-full"
                            onClick={() => {
                              if (ing.preparation && !preparations.includes(ing.preparation)) {
                                setPreparations([...preparations, ing.preparation]);
                              }
                              setPrepPopoverOpen(null);
                            }}
                          >
                            {t('shared.useValue', { value: ing.preparation })}
                          </Button>
                        </CommandEmpty>
                        <CommandGroup>
                          {preparations.map((prep) => (
                            <CommandItem
                              key={prep}
                              value={prep}
                              onSelect={() => { updateIngredient(globalIndex, 'preparation', prep); setPrepPopoverOpen(null); }}
                            >
                              {prep}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-8">
                <div className="space-y-1">
                  <Label className="text-xs">{t('ingredientEditor.substitutions')}</Label>
                  <Input
                    value={ing.substitutions || ''}
                    onChange={(e) => updateIngredient(globalIndex, 'substitutions', e.target.value)}
                    placeholder={t('ingredientEditor.substitutionPlaceholder')}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">{t('notes')}</Label>
                  <Input
                    value={ing.notes || ''}
                    onChange={(e) => updateIngredient(globalIndex, 'notes', e.target.value)}
                    placeholder={t('ingredientEditor.notesPlaceholder')}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 ml-8">
                <Checkbox
                  id={`optional-${globalIndex}`}
                  checked={ing.is_optional}
                  onCheckedChange={(checked) => updateIngredient(globalIndex, 'is_optional', checked)}
                />
                <Label htmlFor={`optional-${globalIndex}`} className="text-sm cursor-pointer">
                  {t('ingredientEditor.optionalIngredient')}
                </Label>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" onClick={() => addIngredientToGroup(group)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('addIngredient')}
          </Button>
        </div>
      ))}

      <Button type="button" variant="outline" onClick={addGroup} className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        {t('ingredientEditor.addGroup')}
      </Button>
    </div>
  );
}
