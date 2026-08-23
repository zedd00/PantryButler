import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, X, Check, Plus } from 'lucide-react';
import { searchNutritionFoods, getSuggestedNutritionMatch, getNutritionFoodById } from '@/api/nutrition';
import { CustomNutritionDialog } from './CustomNutritionDialog';
import { createCustomNutrition } from '@/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { NutritionFood, CustomNutrition } from '@/types/types';
import { cn } from '@/lib/utils';

interface NutritionFoodSearchProps {
  ingredientName: string;
  selectedFoodId: string | null;
  onSelect: (food: NutritionFood | null) => void;
  onCustomNutrition?: (customData: CustomNutrition) => void;
}

export function NutritionFoodSearch({ ingredientName, selectedFoodId, onSelect, onCustomNutrition }: NutritionFoodSearchProps) {
  const { profile } = useAuth();
  const { t } = useTranslation('recipes');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NutritionFood[]>([]);
  const [suggestedMatch, setSuggestedMatch] = useState<NutritionFood | null>(null);
  const [selectedFood, setSelectedFood] = useState<NutritionFood | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showCustomDialog, setShowCustomDialog] = useState(false);

  // Resolve selectedFoodId to a NutritionFood object
  useEffect(() => {
    if (selectedFoodId) {
      getNutritionFoodById(selectedFoodId)
        .then(food => setSelectedFood(food))
        .catch(() => setSelectedFood(null));
    } else {
      setSelectedFood(null);
    }
  }, [selectedFoodId]);

  // Get suggested match when ingredient name changes
  useEffect(() => {
    // Only auto-suggest if no food is selected and user hasn't manually cleared
    if (ingredientName && !selectedFoodId && !selectedFood) {
      getSuggestedNutritionMatch(ingredientName)
        .then(match => {
          setSuggestedMatch(match);
          // Don't auto-select, just show suggestion
        })
        .catch(console.error);
    }
  }, [ingredientName, selectedFoodId, selectedFood]);

  // Search when query changes
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      searchNutritionFoods(searchQuery, 10)
        .then(results => {
          setSearchResults(results);
          setShowResults(true);
          setIsSearching(false);
        })
        .catch(error => {
          console.error('Search error:', error);
          setIsSearching(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelect = (food: NutritionFood) => {
    setSelectedFood(food);
    setSearchQuery('');
    setShowResults(false);
    setSuggestedMatch(null);
    onSelect(food);
  };

  const handleClear = () => {
    setSelectedFood(null);
    setSuggestedMatch(null);
    setSearchQuery('');
    setShowResults(false);
    onSelect(null);
  };

  const handleAcceptSuggestion = () => {
    if (suggestedMatch) {
      handleSelect(suggestedMatch);
    }
  };

  const handleCustomNutritionSave = async (data: any) => {
    if (!profile) return;
    
    try {
      const customNutrition = await createCustomNutrition(profile.id, {
        ingredient_name: ingredientName,
        ...data,
      });
      
      toast.success(t('nutritionFoodSearch.savedSuccess'));
      
      if (onCustomNutrition) {
        onCustomNutrition(customNutrition);
      }
    } catch (error: any) {
      console.error('Error saving custom nutrition:', error);
      toast.error(t('nutritionFoodSearch.saveFailed'));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-normal">{t('nutritionFoodSearch.title')}</Label>
        {selectedFood && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-6 px-2 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            {t('nutritionFoodSearch.clear')}
          </Button>
        )}
      </div>

      {/* Selected Food Display */}
      {selectedFood && (
        <div className="p-3 border border-border rounded-md bg-muted/30">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <p className="font-medium text-sm">{selectedFood.name}</p>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {selectedFood.category}
                </Badge>
                {selectedFood.serving_unit && (
                  <span className="text-xs text-muted-foreground">
                    {t('nutritionFoodSearch.serving', { unit: selectedFood.serving_unit })}
                  </span>
                )}
              </div>
              {selectedFood.cup_to_g && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('nutritionFoodSearch.conversionsAvailable')} {selectedFood.cup_to_g && 'cup'}{selectedFood.tbsp_to_g && ', tbsp'}{selectedFood.oz_to_g && ', oz'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Suggested Match */}
      {!selectedFood && suggestedMatch && (
        <div className="p-3 border border-primary/30 rounded-md bg-primary/5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-primary mb-1">{t('nutritionFoodSearch.suggestedMatch')}</p>
              <p className="font-medium text-sm">{suggestedMatch.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {suggestedMatch.category}
                </Badge>
                {suggestedMatch.serving_unit && (
                  <span className="text-xs text-muted-foreground">
                    {suggestedMatch.serving_unit}
                  </span>
                )}
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleAcceptSuggestion}
              className="shrink-0 h-8"
            >
              {t('nutritionFoodSearch.accept')}
            </Button>
          </div>
        </div>
      )}

      {/* Search Input */}
      {!selectedFood && (
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('nutritionFoodSearch.searchPlaceholder')}
              className="pl-9"
            />
          </div>

          {/* Search Results */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-50 w-full mt-1 border border-border rounded-md bg-popover shadow-lg max-h-64 overflow-y-auto">
              {searchResults.map((food) => (
                <button
                  key={food.id}
                  onClick={() => handleSelect(food)}
                  className={cn(
                    "w-full text-left px-3 py-2 hover:bg-accent transition-colors",
                    "border-b border-border last:border-b-0"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{food.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {food.category}
                        </Badge>
                        {food.serving_unit && (
                          <span className="text-xs text-muted-foreground">
                            {food.serving_unit}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {showResults && searchResults.length === 0 && !isSearching && (
            <div className="absolute z-50 w-full mt-1 border border-border rounded-md bg-popover shadow-lg p-3">
              <p className="text-sm text-muted-foreground text-center">
                {t('nutritionFoodSearch.noMatches')}
              </p>
            </div>
          )}
        </div>
      )}

      {!selectedFood && !suggestedMatch && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {t('nutritionFoodSearch.description')}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowCustomDialog(true)}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('nutritionFoodSearch.addCustom')}
          </Button>
        </div>
      )}

      <CustomNutritionDialog
        open={showCustomDialog}
        onOpenChange={setShowCustomDialog}
        ingredientName={ingredientName}
        onSave={handleCustomNutritionSave}
      />
    </div>
  );
}
