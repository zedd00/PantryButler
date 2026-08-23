import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Plus, Trash2, X, AlertCircle } from 'lucide-react';
import { getAllRecipes, getGroceryListRecipes, addRecipeToGroceryList, removeRecipeFromGroceryList, clearGroceryList, getPantryItems, getSettings, getAllConversions, getCustomGroceryItems, createCustomGroceryItem, deleteCustomGroceryItem, clearCustomGroceryItems, getRecipeById } from '@/api';
import type { Recipe, RecipeIngredient, Settings, UnitConversion } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { convertWithSettings, formatQuantity } from '@/lib/conversions';
import { useTranslation } from 'react-i18next';

interface RecipeWithIngredients extends Recipe {
  ingredients?: RecipeIngredient[];
  missingIngredients?: RecipeIngredient[];
}

export default function GroceryListCreation() {
  const { t } = useTranslation(['grocery', 'common']);
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [selectedRecipes, setSelectedRecipes] = useState<RecipeWithIngredients[]>([]);
  const [customItems, setCustomItems] = useState<any[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [conversions, setConversions] = useState<UnitConversion[]>([]);
  
  // Custom item form state
  const [customItemName, setCustomItemName] = useState('');
  const [customItemQuantity, setCustomItemQuantity] = useState(1);
  const [customItemUnit, setCustomItemUnit] = useState('whole');

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    if (!profile) return;
    try {
      const [recipesData, groceryRecipes, pantry, userSettings, allConversions] = await Promise.all([
        getAllRecipes(),
        getGroceryListRecipes(profile.id),
        getPantryItems(profile.id),
        getSettings(),
        getAllConversions()
      ]);
      setAllRecipes(recipesData);
      setSettings(userSettings);
      setConversions(allConversions);
      
      // Get full recipe objects for selected recipes with ingredients
      const selectedRecipeIds = new Set(groceryRecipes.map(gr => gr.recipe_id));
      const selected = recipesData.filter(r => selectedRecipeIds.has(r.id));
      
      // Load ingredients for each selected recipe
      const recipesWithIngredients = await Promise.all(
        selected.map(async (recipe) => {
          const recipeDetail = await getRecipeById(recipe.id);
          const ingredients = recipeDetail?.ingredients || [];
          
          // Check which ingredients are missing from pantry
          const missingIngredients = (ingredients || []).filter(ingredient => {
            // Normalize ingredient name for comparison (lowercase, trim)
            const ingredientName = ingredient.name.toLowerCase().trim();
            return !pantry.some(pantryItem => 
              pantryItem.ingredient_name.toLowerCase().trim() === ingredientName && 
              (pantryItem.is_unlimited || pantryItem.amount > 0)
            );
          });
          
          return {
            ...recipe,
            ingredients: ingredients || [],
            missingIngredients
          };
        })
      );
      
      setSelectedRecipes(recipesWithIngredients);
      
      // Load custom items
      const customData = await getCustomGroceryItems(profile.id);
      setCustomItems(customData.filter(i => !i.is_purchased) || []);
    } catch (error: any) {
      toast.error(t('grocery:groceryListCreation.errorLoading', { error: error.message }));
    }
  };

  const handleAddRecipe = async (recipeId: string) => {
    if (!profile || !recipeId) return;

    try {
      await addRecipeToGroceryList(profile.id, recipeId);
      toast.success(t('grocery:groceryListCreation.recipeAdded'));
      loadData();
    } catch (error: any) {
      toast.error(t('grocery:groceryListCreation.errorAddingRecipe', { error: error.message }));
    }
  };

  const handleRemoveRecipe = async (recipeId: string) => {
    if (!profile) return;

    try {
      await removeRecipeFromGroceryList(profile.id, recipeId);
      toast.success(t('grocery:groceryListCreation.recipeRemoved'));
      loadData();
    } catch (error: any) {
      toast.error(t('grocery:groceryListCreation.errorRemovingRecipe', { error: error.message }));
    }
  };

  const handleClearAll = async () => {
    if (!profile) return;

    try {
      await clearGroceryList(profile.id);
      
      // Also clear custom items
      await clearCustomGroceryItems(profile.id);
      
      setSelectedRecipes([]);
      setCustomItems([]);
      toast.success(t('grocery:groceryListCreation.listCleared'));
    } catch (error: any) {
      toast.error(t('grocery:groceryListCreation.errorClearingList', { error: error.message }));
    }
  };

  const handleAddCustomItem = async () => {
    if (!profile || !customItemName.trim()) {
      toast.error(t('grocery:groceryListCreation.itemNameRequired'));
      return;
    }

    try {
      await createCustomGroceryItem(profile.id, {
        name: customItemName,
        quantity: customItemQuantity,
        unit: customItemUnit,
      });

      toast.success(t('grocery:groceryListCreation.customItemAdded'));
      setCustomItemName('');
      setCustomItemQuantity(1);
      setCustomItemUnit('whole');
      loadData();
    } catch (error: any) {
      toast.error(t('grocery:groceryListCreation.errorAddingCustomItem', { error: error.message }));
    }
  };

  const handleDeleteCustomItem = async (itemId: string) => {
    try {
      await deleteCustomGroceryItem(itemId);

      toast.success(t('grocery:groceryListCreation.customItemDeleted'));
      loadData();
    } catch (error: any) {
      toast.error(t('grocery:groceryListCreation.errorDeletingCustomItem', { error: error.message }));
    }
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">{t('grocery:groceryListCreation.title')}</h1>
            <p className="text-muted-foreground mt-1">{t('grocery:groceryListCreation.subtitle')}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClearAll}>
              {t('grocery:groceryListCreation.clearAll')}
            </Button>
            <Button onClick={() => navigate('/grocery-list')}>
              {t('grocery:groceryListCreation.viewGroceryList')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Selected Recipes */}
          <Card>
            <CardHeader>
              <CardTitle>{t('grocery:groceryListCreation.selectedRecipesCount', { count: selectedRecipes.length })}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {selectedRecipes.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    {t('grocery:groceryListCreation.noRecipesSelected')}
                  </p>
                ) : (
                  selectedRecipes.map((recipe) => (
                    <div key={recipe.id} className="border border-border rounded-lg overflow-hidden">
                      <div className="flex items-center gap-3 p-3 bg-muted/30">
                        <div className="flex-1">
                          <p className="font-medium">{recipe.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {t('grocery:groceryListCreation.recipeMeta', { minutes: (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0), servings: recipe.servings })}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveRecipe(recipe.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {recipe.missingIngredients && recipe.missingIngredients.length > 0 && (
                        <div className="p-3 bg-orange-50 dark:bg-orange-950/20 border-t border-border">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-1">
                                {t('grocery:groceryListCreation.missingFromPantryCount', { count: recipe.missingIngredients.length })}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {recipe.missingIngredients.map((ingredient, idx) => {
                                  // Convert to preferred unit system using unified API
                                  const converted = convertWithSettings(
                                    ingredient.quantity,
                                    ingredient.unit,
                                    ingredient.name,
                                    settings,
                                    conversions
                                  );
                                  
                                  return (
                                    <Badge 
                                      key={idx} 
                                      variant="outline" 
                                      className="text-xs bg-background"
                                    >
                                      {formatQuantity(converted.quantity, converted.unit)} {converted.unit} {ingredient.name}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Add Recipe Dropdown */}
          <Card>
            <CardHeader>
              <CardTitle>{t('grocery:groceryListCreation.addRecipe')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>{t('grocery:groceryListCreation.searchAndAddRecipe')}</Label>
                  <SearchableSelect
                    options={allRecipes
                      .filter(r => !selectedRecipes.some(sr => sr.id === r.id))
                      .map(recipe => ({
                        value: recipe.id,
                        label: recipe.title
                      }))}
                    onValueChange={handleAddRecipe}
                    placeholder={t('grocery:groceryListCreation.selectRecipePlaceholder')}
                    searchPlaceholder={t('grocery:groceryListCreation.searchRecipes')}
                    emptyText={t('grocery:groceryListCreation.noRecipesFound')}
                    className="w-full"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('grocery:groceryListCreation.addRecipeDescription')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('grocery:groceryListCreation.customItems')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label htmlFor="item-name">{t('grocery:itemName')}</Label>
                <Input
                  id="item-name"
                  value={customItemName}
                  onChange={(e) => setCustomItemName(e.target.value)}
                  placeholder={t('grocery:groceryListCreation.itemNamePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">{t('grocery:itemQuantity')}</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={customItemQuantity}
                  onChange={(e) => setCustomItemQuantity(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">{t('grocery:itemUnit')}</Label>
                <Select value={customItemUnit} onValueChange={setCustomItemUnit}>
                  <SelectTrigger id="unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whole">whole</SelectItem>
                    <SelectItem value="grams">grams</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="cups">cups</SelectItem>
                    <SelectItem value="ml">ml</SelectItem>
                    <SelectItem value="liters">liters</SelectItem>
                    <SelectItem value="oz">oz</SelectItem>
                    <SelectItem value="lbs">lbs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleAddCustomItem} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('grocery:addItem')}
                </Button>
              </div>
            </div>

            {customItems.length > 0 && (
              <div className="space-y-2 mt-4">
                <p className="text-sm font-medium">{t('grocery:groceryListCreation.addedCustomItems')}</p>
                {customItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 border border-border rounded bg-muted/30">
                    <div>
                      <p className="font-medium">{item.item_name} <span className="text-xs text-muted-foreground">{t('grocery:groceryListCreation.customSuffix')}</span></p>
                      <p className="text-sm text-muted-foreground">
                        {item.quantity} {item.unit}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteCustomItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
