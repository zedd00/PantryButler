import { useEffect, useMemo, useState, Fragment } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, Edit, Trash2, Info, Timer, Play, Pause, Calendar as CalendarIcon, AlertTriangle, Download, Copy, Check, Code, Globe } from 'lucide-react';
import { getRecipeById, deleteRecipe, updateRecipeServings, addRecipeToGroceryList, removeRecipeFromGroceryList, getGroceryListRecipes, getSettings, createCalendarMeal, getCurrentUserRole, getAllConversions, getPantryItems } from '@/api';
import type { PantryItem, RecipeWithDetails, Settings, UnitConversion } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { convertWithSettings, formatQuantity, getPreferredUnits, isMeasurableUnit, normalizeUnit } from '@/lib/conversions';
import { computeRecipeCost, formatCurrency } from '@/lib/cost';
import { formatInstanceName } from '@/lib/format';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useTranslation } from 'react-i18next';
import { ConversionDialog } from '@/components/dialogs/ConversionDialog';
import { downloadCooklangFile } from '@/lib/cooklang-exporter';
import { calculateRecipeNutrition, type RecipeNutrition } from '@/api/nutrition-calculator';
import NutritionLabel from '@/components/recipe/NutritionLabel';
import { proxiedImage } from '@/api/images';
import GridRecipeTable from '@/components/recipe/GridRecipeTable';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageTutorial } from '@/components/tutorial/PageTutorial';
import { getRecipeDetailTutorialSteps } from '@/components/tutorial/tutorialSteps';

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { t, i18n } = useTranslation(['recipes', 'common', 'tutorial']);
  const [recipe, setRecipe] = useState<RecipeWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [servings, setServings] = useState<number>(1);
  const [customServingMode, setCustomServingMode] = useState(false);
  const [scalingMode, setScalingMode] = useState<'servings' | 'ingredient'>('servings');
  const [scalingIngredientId, setScalingIngredientId] = useState<string | null>(null);
  const [scalingFactor, setScalingFactor] = useState<number>(1);
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null);
  const [tempQuantity, setTempQuantity] = useState<string>('');
  const [inGroceryList, setInGroceryList] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedMealType, setSelectedMealType] = useState('dinner');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [conversions, setConversions] = useState<UnitConversion[]>([]);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [showOriginalUnits, setShowOriginalUnits] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [conversionDialogOpen, setConversionDialogOpen] = useState(false);
  const [selectedIngredient] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [showEmbedDialog, setShowEmbedDialog] = useState(false);
  const [nutritionData, setNutritionData] = useState<RecipeNutrition | null>(null);
  const [loadingNutrition, setLoadingNutrition] = useState(false);
  const [ingredientMatchDialogOpen, setIngredientMatchDialogOpen] = useState(false);
  
  // Timer state
  const [activeTimers, setActiveTimers] = useState<Record<string, { remaining: number; total: number; running: boolean }>>({});

  // Prevent screen sleep while viewing recipe
  useWakeLock(true);

  const isOwner = recipe?.owner_id === profile?.id;
  const canEdit = isOwner || isAdmin;
  const canDelete = isOwner || isAdmin;

  const showCost = isOwner && !!settings?.cost_tracking_enabled;

  const costData = useMemo(() => {
    if (!showCost || !recipe || !recipe.ingredients || recipe.ingredients.length === 0 || recipe.servings <= 0) {
      return null;
    }
    const scaledIngredients = recipe.ingredients.map((ing) => ({
      ...ing,
      quantity: (ing.quantity * servings) / recipe.servings,
    }));
    return computeRecipeCost({
      ingredients: scaledIngredients,
      pantryItems,
      conversions,
      baseServings: servings,
    });
  }, [showCost, recipe, pantryItems, conversions, servings]);

  useEffect(() => {
    if (id) {
      loadRecipe();
      checkGroceryList();
      checkAdminRole();
    }
  }, [id]);

  useEffect(() => {
    if (profile && id) {
      getPantryItems(profile.id)
        .then(setPantryItems)
        .catch(() => setPantryItems([]));
    }
  }, [profile, id]);

  const checkAdminRole = async () => {
    try {
      const role = await getCurrentUserRole();
      setIsAdmin(role === 'admin');
    } catch (error) {
      console.error('Failed to check admin role:', error);
    }
  };

  // Timer countdown effect
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTimers(prev => {
        const updated = { ...prev };
        let hasChanges = false;

        Object.keys(updated).forEach(key => {
          if (updated[key].running && updated[key].remaining > 0) {
            updated[key].remaining -= 1;
            hasChanges = true;

            if (updated[key].remaining === 0) {
              // Timer finished
              updated[key].running = false;
              const stepInfo = key.split('-');
              
              // Play sound based on timer duration (min 3, max 10 times)
              const totalMinutes = updated[key].total / 60;
              const repetitions = Math.min(Math.max(Math.round(totalMinutes), 3), 10);
              playTimerSound(repetitions);
              
              toast.success(t('recipeDetail.timerFinished', { step: stepInfo[1] }), {
                duration: 5000,
              });
              
              // Browser notification
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('PantryButler Timer', {
                  body: t('recipeDetail.timerFinished', { step: stepInfo[1] }),
                  icon: '/favicon.ico',
                });
              }
            }
          }
        });

        return hasChanges ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const loadRecipe = async () => {
    try {
      const [data, userSettings, allConversions] = await Promise.all([
        getRecipeById(id!),
        getSettings(),
        getAllConversions()
      ]);
      
      setRecipe(data);
      setServings(data?.servings || 1);
      setSettings(userSettings);
      setConversions(allConversions);
      
      // Load nutrition data if enabled
      if (userSettings?.nutrition_enabled && data?.ingredients) {
        loadNutritionData(data.ingredients, data.servings);
      }
    } catch (error: any) {
      toast.error(t('recipeDetail.failedToLoad', { error: error.message }));
    } finally {
      setLoading(false);
    }
  };

  const loadNutritionData = async (ingredients: any[], recipeServings: number) => {
    setLoadingNutrition(true);
    try {
      const nutrition = await calculateRecipeNutrition(ingredients, recipeServings);
      setNutritionData(nutrition);
    } catch (error) {
      console.error('Failed to load nutrition data:', error);
    } finally {
      setLoadingNutrition(false);
    }
  };

  const checkGroceryList = async () => {
    if (!profile) return;
    try {
      const groceryRecipes = await getGroceryListRecipes(profile.id);
      setInGroceryList(groceryRecipes.some(gr => gr.recipe_id === id));
    } catch (error) {
      console.error('Failed to check grocery list:', error);
    }
  };

  const handleGroceryListToggle = async (checked: boolean) => {
    if (!profile || !id) return;

    try {
      if (checked) {
        await addRecipeToGroceryList(profile.id, id, servings);
        toast.success(t('recipeDetail.addedToGroceryList'));
      } else {
        await removeRecipeFromGroceryList(profile.id, id);
        toast.success(t('recipeDetail.removedFromGroceryList'));
      }
      setInGroceryList(checked);
    } catch (error: any) {
      toast.error(t('recipeDetail.failedToUpdateGroceryList', { error: error.message }));
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    try {
      await deleteRecipe(id);
      toast.success(t('recipeDetail.recipeDeleted'));
      navigate('/recipes');
    } catch (error: any) {
      toast.error(t('recipeDetail.failedToDelete', { error: error.message }));
    }
  };

  const handleAddToCalendar = async () => {
    if (!profile || !id || !selectedDate) {
      toast.error(t('recipeDetail.selectDate'));
      return;
    }

    try {
      await createCalendarMeal(profile.id, id, selectedDate, selectedMealType);
      toast.success(t('recipeDetail.addedToCalendar'));
      setCalendarDialogOpen(false);
      setSelectedDate('');
    } catch (error: any) {
      toast.error(t('recipeDetail.failedToAddToCalendar', { error: error.message }));
    }
  };

  const handleCopyPublicLink = async () => {
    if (!recipe?.public_slug) return;
    const publicUrl = `${window.location.origin}/r/${recipe.public_slug}`;
    
    try {
      await navigator.clipboard.writeText(publicUrl);
      setLinkCopied(true);
      toast.success(t('recipeDetail.linkCopied'));
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      toast.error(t('recipeDetail.failedToCopyLink'));
    }
  };

  const handleCopyEmbedCode = async () => {
    if (!recipe?.public_slug) return;
    const embedCode = `<div id="pantrybutler-recipe-card" data-recipe-slug="${recipe.public_slug}"></div>\n<script src="${window.location.origin}/embed.js"></script>`;
    
    try {
      await navigator.clipboard.writeText(embedCode);
      setEmbedCopied(true);
      toast.success(t('recipeDetail.embedCopied'));
      setTimeout(() => setEmbedCopied(false), 2000);
    } catch (error) {
      toast.error(t('recipeDetail.failedToCopyEmbedCode'));
    }
  };

  // Play timer sound with repetitions
  const playTimerSound = async (repetitions: number) => {
    try {
      // Use the custom timer.wav file, play the requested number of times
      const audio = new Audio('/timer.wav');
      let playCount = 0;
      const timesToPlay = Math.min(Math.max(repetitions, 1), 10);
      
      const playNext = () => {
        if (playCount < timesToPlay) {
          audio.currentTime = 0;
          audio.play().catch(() => {
            // If wav file doesn't exist, use Web Audio API to generate beep
            generateBeep();
          });
          playCount++;
        }
      };
      
      audio.addEventListener('ended', playNext);
      audio.addEventListener('error', () => {
        // Fallback to generated beep sound
        for (let i = 0; i < timesToPlay; i++) {
          setTimeout(() => generateBeep(), i * 500);
        }
      });
      
      // Start playing
      playNext();
    } catch (error) {
      console.error('Error playing timer sound:', error);
    }
  };

  // Generate beep sound using Web Audio API
  const generateBeep = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800; // 800 Hz beep
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  };

  const startTimer = (sectionIdx: number, stepIdx: number, minutes: number) => {
    const key = `timer-${sectionIdx}-${stepIdx}`;
    setActiveTimers(prev => ({
      ...prev,
      [key]: {
        remaining: minutes * 60,
        total: minutes * 60,
        running: true,
      }
    }));
  };

  const toggleTimer = (sectionIdx: number, stepIdx: number) => {
    const key = `timer-${sectionIdx}-${stepIdx}`;
    setActiveTimers(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        running: !prev[key]?.running,
      }
    }));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const scaleQuantity = (quantity: number) => {
    if (!recipe) return quantity;
    if (scalingMode === 'ingredient') {
      return quantity * scalingFactor;
    }
    // Default servings-based scaling
    return (quantity * servings) / recipe.servings;
  };

  const handleIngredientQuantityChange = (ingredientId: string, originalQuantity: number) => {
    const newQuantity = parseFloat(tempQuantity);
    if (isNaN(newQuantity) || newQuantity <= 0) {
      toast.error(t('recipeDetail.enterValidQuantity'));
      return;
    }

    // Calculate scaling factor based on this ingredient
    const factor = newQuantity / originalQuantity;
    
    setScalingMode('ingredient');
    setScalingIngredientId(ingredientId);
    setScalingFactor(factor);
    setEditingIngredientId(null);
    setTempQuantity('');
    
    toast.success(t('recipeDetail.recipeScaled'));
  };

  const applyServings = (value: number) => {
    const next = Math.max(1, Math.round(value));
    setServings(next);
    // Reset ingredient scaling when changing servings
    if (scalingMode === 'ingredient') {
      setScalingMode('servings');
      setScalingIngredientId(null);
      setScalingFactor(1);
    }
    if (!recipe || next === recipe.servings) return;

    // The selected servings becomes the recipe's new default: rescale the
    // stored ingredient quantities by the same factor so the recipe (and any
    // grocery list it's added to) stays proportional to the new default.
    const factor = next / recipe.servings;
    const scaledIngredients = (recipe.ingredients || []).map(ing => ({
      ...ing,
      quantity: Math.round(ing.quantity * factor * 10000) / 10000,
    }));
    setRecipe({ ...recipe, servings: next, ingredients: scaledIngredients });

    // Nutrition totals depend on the ingredient amounts; refresh so the label
    // reflects the rescaled recipe.
    if (settings?.nutrition_enabled) {
      loadNutritionData(scaledIngredients, next);
    }

    updateRecipeServings(recipe.id, next).catch((error: any) => {
      toast.error(t('recipeDetail.failedToSaveServings', { error: error.message }));
      loadRecipe();
    });
  };

  const resetScaling = () => {
    setScalingMode('servings');
    setScalingIngredientId(null);
    setScalingFactor(1);
    setServings(recipe?.servings || 1);
    toast.success(t('recipeDetail.scalingReset'));
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64 bg-muted" />
          <Skeleton className="h-96 w-full bg-muted" />
        </div>
      </MainLayout>
    );
  }

  if (!recipe) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">{t('recipeDetail.recipeNotFound')}</p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageTutorial tutorialId="recipe-detail-page" steps={getRecipeDetailTutorialSteps(t)} />
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-2 flex-1">
              <h1 className="text-3xl font-semibold">{recipe.title}</h1>
              
              {/* Import Metadata */}
              {recipe.imported_from_instance_id && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary" className="gap-1">
                    <span>↓</span>
                    {t('recipeDetail.fromInstance', { instance: formatInstanceName(recipe.imported_from_instance_name) })}
                  </Badge>
                  {recipe.import_count > 0 && (
                    <span className="text-xs">🔁 {t('recipeDetail.importTimes', { count: recipe.import_count })}</span>
                  )}
                </div>
              )}
              
              <div className="flex flex-wrap gap-2">
                {recipe.tags?.map((tag) => (
                  <Badge key={tag.id} variant="outline">{tag.name}</Badge>
                ))}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={() => setCalendarDialogOpen(true)}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {t('addToCalendar')}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                if (recipe) {
                  downloadCooklangFile(recipe);
                  toast.success(t('recipeDetail.exportedAsCook'));
                }
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              {t('recipeDetail.exportCook')}
            </Button>
            {canEdit && (
              <Link to={`/recipes/${id}/edit`}>
                <Button variant="outline">
                  <Edit className="mr-2 h-4 w-4" />
                  {t('common:edit')}
                </Button>
              </Link>
            )}
            {canDelete && (
              <Button variant="outline" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                {t('common:delete')}
              </Button>
            )}
          </div>
        </div>
        
        {recipe.description && (
          <p className="text-muted-foreground">{recipe.description}</p>
        )}
      </div>

        {/* Image */}
        {recipe.image_url && (
          <img
            src={proxiedImage(recipe.image_url)}
            alt={recipe.title}
            className="w-full h-96 object-cover rounded"
          />
        )}

        {/* Basic Info */}
        <Card>
          <CardContent className="p-6 space-y-4">
            {/* Time Information - All on one line, with cost alongside */}
            {(recipe.prep_time_minutes || recipe.cook_time_minutes || (showCost && costData)) && (
              <div className="flex flex-wrap items-center gap-6">
                {recipe.prep_time_minutes && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{t('prepTime')}:</span>
                    <span className="font-medium">{recipe.prep_time_minutes} {t('shared.min')}</span>
                  </div>
                )}
                {recipe.cook_time_minutes && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{t('cookTime')}:</span>
                    <span className="font-medium">{recipe.cook_time_minutes} {t('shared.min')}</span>
                  </div>
                )}
                {(recipe.prep_time_minutes || recipe.cook_time_minutes) && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{t('totalTime')}:</span>
                    <span className="font-medium">
                      {(recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)} {t('shared.min')}
                    </span>
                  </div>
                )}
                {showCost && costData && costData.total !== null && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{t('recipeDetail.costPerServing')}:</span>
                      <span className="font-medium">
                        {formatCurrency(costData.perServing ?? 0, settings?.currency, i18n.language)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{t('recipeDetail.costPerMeal')}:</span>
                      <span className="font-medium">
                        {formatCurrency(costData.total, settings?.currency, i18n.language)}
                      </span>
                    </div>
                  </>
                )}
                {showCost && costData && costData.total === null && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{t('recipeDetail.noCostData')}</span>
                  </div>
                )}
              </div>
            )}

            <Separator />

            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1" data-tutorial="scale-servings">
                <Label htmlFor="servings">{t('servings')}</Label>
                {customServingMode ? (
                  <Input
                    id="servings"
                    type="number"
                    min="1"
                    defaultValue={servings}
                    autoFocus
                    className="w-full md:w-48"
                    disabled={scalingMode === 'ingredient'}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                    onBlur={(e) => {
                      setCustomServingMode(false);
                      applyServings(Math.max(1, Number(e.target.value) || 1));
                    }}
                  />
                ) : (
                  <Select
                    value={servings.toString()}
                    onValueChange={(v) => {
                      if (v === 'custom') {
                        setCustomServingMode(true);
                        return;
                      }
                      applyServings(Number(v));
                    }}
                    disabled={scalingMode === 'ingredient'}
                  >
                    <SelectTrigger id="servings" className="w-full md:w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        // Recommend the recipe's own serving count plus the
                        // common 1, 2, 4 servings; anything else via Custom.
                        const options = [...new Set([recipe.servings, 1, 2, 4, servings])].sort((a, b) => a - b);
                        return options.map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            {num} {num === recipe.servings ? t('recipeDetail.defaultOption') : ''}
                          </SelectItem>
                        ));
                      })()}
                      <SelectItem value="custom">{t('recipeDetail.custom')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {scalingMode === 'ingredient' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('recipeDetail.disabledIngredientScaling')}
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="grocery-list"
                  checked={inGroceryList}
                  onCheckedChange={handleGroceryListToggle}
                />
                <Label htmlFor="grocery-list" className="cursor-pointer">
                  {t('shared.addToGroceryList')}
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Equipment */}
        {recipe.equipment && recipe.equipment.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('equipment')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recipe.equipment.map((eq: any) => (
                  <div key={eq.id} className="flex items-center gap-2">
                    <span className="font-medium">{eq.equipment_name || t('equipment')}</span>
                    {eq.equipment_location && (
                      <Badge variant="outline" className="text-xs">
                        📍 {eq.equipment_location}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ingredients */}
        <Card data-tutorial="ingredients-list">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle>{t('ingredients')}</CardTitle>
                {scalingMode === 'servings' && (
                  <CardDescription className="text-xs">
                    {t('recipeDetail.clickQuantityToScale')}
                  </CardDescription>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="original-units" className="text-xs cursor-pointer">
                  {t('shared.original')}
                </Label>
                <Switch
                  id="original-units"
                  checked={showOriginalUnits}
                  onCheckedChange={setShowOriginalUnits}
                />
              </div>
              {scalingMode === 'ingredient' && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={resetScaling}
                >
                  {t('shared.resetScaling')}
                </Button>
              )}
            </div>
            {scalingMode === 'ingredient' && (
              <CardDescription className="flex items-center gap-2 mt-2">
                <Info className="h-4 w-4" />
                {t('recipeDetail.scaledByIngredient')}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {recipe.ingredients && recipe.ingredients.length > 0 ? (
              <div className="w-full">
                <table className="w-full">
                  {showCost && (
                    <thead>
                      <tr className="border-b border-border/50 text-sm text-muted-foreground">
                        <th className="py-2 pr-4 font-medium text-left">{t('ingredient')}</th>
                        <th className="py-2 px-4 font-medium text-left">{t('common:quantity')}</th>
                        <th className="py-2 pl-4 font-medium text-left">{t('pantry:ingredientsPage.location')}</th>
                        <th className="py-2 pl-4 font-medium text-right">{t('recipeDetail.costPerIngredient')}</th>
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {recipe.ingredients.map((ing, index) => {
                      const groupName = (() => {
                        const group = recipe.ingredients?.[index]?.group_name;
                        if (!group) return null;
                        return recipe.ingredients?.[index - 1]?.group_name === group ? null : group;
                      })();
                      const scaledQuantity = scaleQuantity(ing.quantity);
                      const ingredientName = (ing as any).ingredient_name || ing.name;
                      const ingredientPrep = ing.preparation;
                      const ingredientLocation = (ing as any).location;
                      const isScalingIngredient = scalingMode === 'ingredient' && scalingIngredientId === ing.id;
                      const isEditing = editingIngredientId === ing.id;
                      const ingredientCost = costData && costData.total !== null
                        ? costData.perIngredient.find((i) => i.name === ing.name)
                        : undefined;

                      // Determine display values
                      const converted = !showOriginalUnits ? convertWithSettings(
                        scaledQuantity,
                        ing.unit,
                        ingredientName,
                        settings,
                        conversions
                      ) : null;

                      const displayQuantity = showOriginalUnits ? scaledQuantity : (converted?.quantity ?? scaledQuantity);
                      const displayUnit = showOriginalUnits ? ing.unit : (converted?.unit ?? ing.unit);
                      const displayConverted = converted?.converted ?? false;
                      const displayOriginalQuantity = converted?.originalQuantity;
                      const displayOriginalUnit = converted?.originalUnit;

                      // Check if conversion was needed but not available
                      const preferredUnits = getPreferredUnits(settings?.preferred_unit_system);
                      const normalizedUnit = normalizeUnit(ing.unit);
                      const normalizedPreferredUnits = preferredUnits.map(u => normalizeUnit(u));
                      const isInPreferredSystem = normalizedPreferredUnits.includes(normalizedUnit);
                      
                      // Only show warning if user has set a preferred system AND unit is not in that system AND no conversion available
                      const hasPreferredSystem = preferredUnits.length > 0;
                      const needsConversion = hasPreferredSystem && !isInPreferredSystem;
                      const hasConversion = displayConverted || !needsConversion || !isMeasurableUnit(ing.unit);

                      return (
                        <Fragment key={ing.id}>
                          {groupName && (
                            <tr>
                              <td colSpan={showCost ? 4 : 3} className="pt-4 pb-1">
                                <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                  {groupName}
                                </span>
                              </td>
                            </tr>
                          )}
                          <tr className={`border-b border-border/50 last:border-0 ${isScalingIngredient ? 'bg-primary/5' : ''}`}>
                          <td className="py-3 pr-4 align-top">
                            <div className="flex flex-col gap-1">
                              <span className="font-medium">{ingredientName}</span>
                              {ingredientPrep && (
                                <span className="text-sm text-muted-foreground">({ingredientPrep})</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 align-top">
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={tempQuantity}
                                  onChange={(e) => setTempQuantity(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleIngredientQuantityChange(ing.id, ing.quantity);
                                    } else if (e.key === 'Escape') {
                                      setEditingIngredientId(null);
                                      setTempQuantity('');
                                    }
                                  }}
                                  className="w-24 h-8"
                                  autoFocus
                                />
                                <span className="text-sm">{ing.unit}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleIngredientQuantityChange(ing.id, ing.quantity)}
                                  className="h-8 px-2"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    setEditingIngredientId(ing.id);
                                    setTempQuantity(scaledQuantity.toString());
                                  }}
                                  className="hover:bg-accent hover:text-accent-foreground px-2 py-1 rounded transition-colors"
                                >
                                  <span>
                                    {formatQuantity(displayQuantity, displayUnit)} {displayUnit}
                                  </span>
                                </button>
                                {isScalingIngredient && (
                                  <Badge variant="secondary" className="text-xs ml-2">
                                    {t('recipeDetail.scalingBase')}
                                  </Badge>
                                )}
                                {!hasConversion && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <AlertTriangle 
                                          className="inline-block h-4 w-4 text-amber-500 cursor-pointer" 
                                          onClick={() => setIngredientMatchDialogOpen(true)}
                                        />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-sm">{t('recipeDetail.noConversionTo', { unit: settings?.preferred_unit_system || t('recipeDetail.preferredUnits') })}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{t('recipeDetail.clickForMoreInfo')}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                {!showOriginalUnits && displayConverted && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Info className="inline-block h-3 w-3 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-sm">{t('recipeDetail.original', { x: formatQuantity(displayOriginalQuantity!, displayOriginalUnit!), unit: displayOriginalUnit })}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-3 pl-4 align-top">
                            {ingredientLocation && (
                              <Badge variant="outline" className="text-xs">
                                📍 {ingredientLocation}
                              </Badge>
                            )}
                          </td>
                          {showCost && (
                            <td className="py-3 pl-4 text-right align-top">
                              {ingredientCost && ingredientCost.cost !== null
                                ? formatCurrency(ingredientCost.cost, settings?.currency, i18n.language)
                                : '—'}
                            </td>
                          )}
                        </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{t('recipeDetail.noIngredientsAdded')}</p>
            )}
          </CardContent>
        </Card>

        {/* Grid Recipe */}
        {recipe.grid_recipe && (
          <Card>
            <CardHeader>
              <CardTitle>{t('shared.gridRecipe')}</CardTitle>
            </CardHeader>
            <CardContent>
              <GridRecipeTable
                gridRecipe={recipe.grid_recipe}
                ingredients={(recipe.ingredients || []).map((i) => ({
                  name: i.name,
                  quantity: i.quantity,
                  unit: i.unit,
                }))}
              />
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        {recipe.sections && recipe.sections.length > 0 && (
          <Card data-tutorial="cooking-steps">
            <CardHeader>
              <CardTitle>{t('shared.instructions')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {recipe.sections.map((section, sectionIdx) => (
                <div key={section.id} className="space-y-4">
                  {sectionIdx > 0 && <Separator className="my-6" />}
                  <h3 className="text-lg font-semibold">{section.title}</h3>
                  <ol className="space-y-4">
                    {section.steps.map((step, stepIdx) => {
                      const timerKey = `timer-${sectionIdx}-${stepIdx}`;
                      const timerState = activeTimers[timerKey];
                      
                      return (
                        <li key={step.id} className="flex gap-4">
                          <span className="font-medium text-muted-foreground">{stepIdx + 1}.</span>
                          <div className="flex-1 space-y-2">
                            <p className="whitespace-pre-wrap">{step.instruction}</p>
                            {step.image_url && (
                              <img
                                src={proxiedImage(step.image_url)}
                                alt={`Step ${stepIdx + 1}`}
                                className="w-full max-w-md h-48 object-cover rounded"
                              />
                            )}
                            {(step.timer_minutes ?? 0) > 0 && (
                              <div className="flex items-center gap-2 mt-2">
                                {!timerState ? (
                                  <Button
                                    size="sm"
                                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                                    onClick={() => startTimer(sectionIdx, stepIdx, step.timer_minutes ?? 0)}
                                    data-tutorial="timer-button"
                                  >
                                    <Timer className="mr-2 h-4 w-4" />
                                    {t('recipeDetail.startTimer', { minutes: step.timer_minutes })}
                                  </Button>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <Badge variant={timerState.remaining === 0 ? 'default' : 'secondary'} className="text-sm px-3 py-1">
                                      <Clock className="mr-1 h-4 w-4" />
                                      {formatTime(timerState.remaining)}
                                    </Badge>
                                    {timerState.remaining > 0 && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => toggleTimer(sectionIdx, stepIdx)}
                                      >
                                        {timerState.running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {recipe.notes && (
          <Card data-tutorial="recipe-notes">
            <CardHeader>
              <CardTitle>{t('notes')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{recipe.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Nutrition Information */}
        {settings?.nutrition_enabled && (
          <>
            {loadingNutrition ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : nutritionData && nutritionData.matched_count > 0 && nutritionData.per_serving && nutritionData.per_serving.calories > 0 ? (
              <div className="space-y-4">
                <NutritionLabel
                  nutrition={{
                    servings: servings,
                    calories: nutritionData.per_serving.calories * servings,
                    protein_g: nutritionData.per_serving.protein_g * servings,
                    carbs_g: nutritionData.per_serving.carbs_g * servings,
                    fat_g: nutritionData.per_serving.fat_g * servings,
                    fiber_g: nutritionData.per_serving.fiber_g * servings,
                    sugar_g: nutritionData.per_serving.sugar_g * servings,
                    sodium_mg: nutritionData.per_serving.sodium_mg * servings,
                    cholesterol_mg: nutritionData.per_serving.cholesterol_mg * servings,
                    ...(nutritionData.per_serving.calcium_mg && { calcium_mg: nutritionData.per_serving.calcium_mg * servings }),
                    ...(nutritionData.per_serving.iron_mg && { iron_mg: nutritionData.per_serving.iron_mg * servings }),
                    ...(nutritionData.per_serving.magnesium_mg && { magnesium_mg: nutritionData.per_serving.magnesium_mg * servings }),
                    ...(nutritionData.per_serving.phosphorus_mg && { phosphorus_mg: nutritionData.per_serving.phosphorus_mg * servings }),
                    ...(nutritionData.per_serving.potassium_mg && { potassium_mg: nutritionData.per_serving.potassium_mg * servings }),
                    ...(nutritionData.per_serving.zinc_mg && { zinc_mg: nutritionData.per_serving.zinc_mg * servings }),
                    ...(nutritionData.per_serving.vitamin_a_mcg && { vitamin_a_mcg: nutritionData.per_serving.vitamin_a_mcg * servings }),
                    ...(nutritionData.per_serving.vitamin_c_mg && { vitamin_c_mg: nutritionData.per_serving.vitamin_c_mg * servings }),
                    ...(nutritionData.per_serving.vitamin_d_mcg && { vitamin_d_mcg: nutritionData.per_serving.vitamin_d_mcg * servings }),
                    ...(nutritionData.per_serving.vitamin_e_mg && { vitamin_e_mg: nutritionData.per_serving.vitamin_e_mg * servings }),
                    ...(nutritionData.per_serving.vitamin_k_mcg && { vitamin_k_mcg: nutritionData.per_serving.vitamin_k_mcg * servings }),
                    ...(nutritionData.per_serving.thiamin_mg && { thiamin_mg: nutritionData.per_serving.thiamin_mg * servings }),
                    ...(nutritionData.per_serving.riboflavin_mg && { riboflavin_mg: nutritionData.per_serving.riboflavin_mg * servings }),
                    ...(nutritionData.per_serving.niacin_mg && { niacin_mg: nutritionData.per_serving.niacin_mg * servings }),
                    ...(nutritionData.per_serving.vitamin_b6_mg && { vitamin_b6_mg: nutritionData.per_serving.vitamin_b6_mg * servings }),
                    ...(nutritionData.per_serving.folate_mcg && { folate_mcg: nutritionData.per_serving.folate_mcg * servings }),
                    ...(nutritionData.per_serving.vitamin_b12_mcg && { vitamin_b12_mcg: nutritionData.per_serving.vitamin_b12_mcg * servings }),
                    ...(nutritionData.per_serving.pantothenic_acid_mg && { pantothenic_acid_mg: nutritionData.per_serving.pantothenic_acid_mg * servings }),
                  }}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-pretty">
                  {t('recipeDetail.noNutritionData')}
                </p>
                <p className="text-sm text-muted-foreground text-pretty">
                  {t('recipeDetail.matchIngredientsInfo')}
                </p>
                <p className="text-xs text-muted-foreground mt-4">
                  {t('recipeDetail.nutritionProvidedBy')}{' '}
                  <a href="/attribution" className="text-primary hover:underline">
                    OpenNutrition
                  </a>
                  .
                </p>
              </div>
            )}
          </>
        )}

        {/* Public Link Section - Only visible to owner when recipe is public */}
        {isOwner && recipe.is_public && recipe.public_slug && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                {t('recipeDetail.publicRecipeLink')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('recipeDetail.shareThisLink')}</Label>
                <div className="flex gap-2">
                  <Input
                    value={`${window.location.origin}/r/${recipe.public_slug}`}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyPublicLink}
                  >
                    {linkCopied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('recipeDetail.anyoneWithLink')}
                </p>
              </div>

              <Button
                variant="outline"
                onClick={() => setShowEmbedDialog(true)}
                className="w-full"
              >
                <Code className="h-4 w-4 mr-2" />
                {t('shared.getEmbedCode')}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteRecipe')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('recipeDetail.deleteConfirmMessage')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('common:delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add to Calendar Dialog */}
      <Dialog open={calendarDialogOpen} onOpenChange={setCalendarDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addToCalendar')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="date">{t('common:date')}</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meal-type">{t('recipeDetail.mealType')}</Label>
              <Select value={selectedMealType} onValueChange={setSelectedMealType}>
                <SelectTrigger id="meal-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="breakfast">{t('recipeDetail.mealTypes.breakfast')}</SelectItem>
                  <SelectItem value="lunch">{t('recipeDetail.mealTypes.lunch')}</SelectItem>
                  <SelectItem value="dinner">{t('recipeDetail.mealTypes.dinner')}</SelectItem>
                  <SelectItem value="snack">{t('recipeDetail.mealTypes.snack')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCalendarDialogOpen(false)}>
              {t('common:cancel')}
            </Button>
            <Button onClick={handleAddToCalendar}>
              {t('addToCalendar')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conversion Dialog */}
      <ConversionDialog
        open={conversionDialogOpen}
        onOpenChange={setConversionDialogOpen}
        ingredientName={selectedIngredient}
        onConversionsUpdated={async () => {
          const newConversions = await getAllConversions();
          setConversions(newConversions);
        }}
        instanceId={profile?.instance_id}
      />

      {/* Ingredient Matching Info Dialog */}
      <AlertDialog open={ingredientMatchDialogOpen} onOpenChange={setIngredientMatchDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              {t('recipeDetail.ingredientMatchingRequired')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-pretty">
              <p>
                {t('recipeDetail.matchingP1')}
              </p>
              <p>
                {t('recipeDetail.matchingP2Before')} <strong>{t('ingredients')}</strong> {t('recipeDetail.matchingP2After')}
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{t('recipeDetail.matchingLi1')}</li>
                <li>{t('recipeDetail.matchingLi2')}</li>
                <li>{t('recipeDetail.matchingLi3')}</li>
              </ul>
              <p className="text-sm">
                {t('recipeDetail.matchingP3')}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:close')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate('/ingredients')}>
              {t('shared.goToIngredientsPage')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Embed Code Dialog */}
      {recipe?.public_slug && (
        <Dialog open={showEmbedDialog} onOpenChange={setShowEmbedDialog}>
          <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('shared.embedCode')}</DialogTitle>
              <DialogDescription>
                {t('recipeDetail.embedDialogDescription')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <Textarea
                value={`<div id="pantrybutler-recipe-card" data-recipe-slug="${recipe.public_slug}"></div>\n<script src="${window.location.origin}/embed.js"></script>`}
                readOnly
                rows={4}
                className="font-mono text-sm"
              />
              <Button
                onClick={handleCopyEmbedCode}
                className="w-full"
              >
                {embedCopied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    {t('recipeDetail.copied')}
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    {t('recipeDetail.copyEmbedCode')}
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </MainLayout>
  );
}
