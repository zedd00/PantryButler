import { useState, useEffect, Fragment } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertCircle, Check, AlertTriangle, ChefHat, ChevronDown, Package, Plus, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { getPantryItems, getAllEquipment, createRecipe, getAllFolders, createFolder } from '@/api';
import { findFuzzyMatches, hasExactMatch } from '@/lib/fuzzy-match';
import type { PantryItem, Equipment, Folder } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import TagSelector from '@/components/recipes/TagSelector';
import { SearchableMapper } from '@/components/recipes/SearchableMapper';
import { IngredientSearchPopover } from '@/components/recipes/IngredientSearchPopover';
import { api } from '@/lib/api-client';

interface ImportData {
  recipe: any;
  ingredients: any[];
  equipment: any[];
  sections: any[];
  tags: any[];
}

interface IngredientMapping {
  original: any;
  currentName: string; // The name being used (updated when mapped)
  matchStatus: 'exact' | 'fuzzy' | 'new';
  matchedItem?: PantryItem;
  fuzzyMatches?: PantryItem[];
  selectedMatch?: string; // pantry item id or 'new'
  nutritionFoodId?: string | null; // nutrition_food_id from matched item
  quantity: number; // Editable amount
  unit: string; // Editable unit
}

interface EquipmentMapping {
  original: any;
  currentName: string; // The name being used (updated when mapped)
  matchStatus: 'exact' | 'fuzzy' | 'new';
  matchedItem?: Equipment;
  fuzzyMatches?: Equipment[];
  selectedMatch?: string; // equipment id or 'new'
}

const INGREDIENT_UNITS = ['cup', 'tbsp', 'tsp', 'oz', 'lb', 'g', 'kg', 'ml', 'L', 'whole', 'clove', 'slice', 'pinch', 'fl oz', 'pint', 'quart', 'gallon'];

export default function ImportReviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const { t } = useTranslation(['recipes', 'common']);
  
  const [importData, setImportData] = useState<ImportData | null>(null);
  
  // Recipe fields (editable)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [folderId, setFolderId] = useState('');
  const [servings, setServings] = useState(4);
  const [prepTimeMinutes, setPrepTimeMinutes] = useState<number | undefined>(undefined);
  const [cookTimeMinutes, setCookTimeMinutes] = useState<number | undefined>(undefined);
  const [prepTimeError, setPrepTimeError] = useState('');
  const [cookTimeError, setCookTimeError] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sections, setSections] = useState<any[]>([
    { title: 'Main', order_index: 0, steps: [{ order_index: 0, instruction: '', image_url: '', timer_minutes: 0 }] }
  ]);
  
  // Mapping data
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [ingredientMappings, setIngredientMappings] = useState<IngredientMapping[]>([]);
  const [equipmentMappings, setEquipmentMappings] = useState<EquipmentMapping[]>([]);

  // Debug: Log when mappings change
  useEffect(() => {
    console.log('Ingredient mappings updated:', ingredientMappings.length);
  }, [ingredientMappings]);

  useEffect(() => {
    console.log('Equipment mappings updated:', equipmentMappings.length);
  }, [equipmentMappings]);
  
  // UI state
  const [folders, setFolders] = useState<Folder[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [newItemsToCreate, setNewItemsToCreate] = useState<{ ingredients: string[]; equipment: string[] }>({ ingredients: [], equipment: [] });
  const [saving, setSaving] = useState(false);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [unitPopoverOpen, setUnitPopoverOpen] = useState<number | null>(null);

  useEffect(() => {
    // Get import data from location state
    const data = location.state?.importData as ImportData;
    if (!data) {
      toast.error(t('importReview.noImportData'));
      navigate('/recipes');
      return;
    }

    console.log('ImportReviewPage - Received import data:', data);
    console.log('ImportReviewPage - Ingredients count:', data.ingredients?.length);
    console.log('ImportReviewPage - Equipment count:', data.equipment?.length);

    setImportData(data);
    
    // Initialize recipe fields
    setTitle(data.recipe.title || '');
    setDescription(data.recipe.description || '');
    setImageUrl(data.recipe.image_url || '');
    setServings(data.recipe.servings || 4);
    setPrepTimeMinutes(data.recipe.prep_time_minutes || undefined);
    setCookTimeMinutes(data.recipe.cook_time_minutes || undefined);
    setNotes(data.recipe.notes || '');
    setSelectedTags(data.tags?.map((t: any) => t.name) || []);
    setSections(data.sections || [{ title: 'Main', order_index: 0, steps: [{ order_index: 0, instruction: '', image_url: '', timer_minutes: 0 }] }]);
    
    loadData();
  }, [location.state]);

  const loadData = async () => {
    if (!profile) return;
    
    try {
      const [pantry, equipment, foldersData] = await Promise.all([
        getPantryItems(profile.id),
        getAllEquipment(),
        getAllFolders()
      ]);
      
      setPantryItems(pantry);
      setEquipmentList(equipment);
      setFolders(foldersData);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error(t('importReview.failedToLoadData'));
    }
  };

  useEffect(() => {
    if (!importData) return;

    console.log('Processing ingredient mappings. Pantry items:', pantryItems.length);

    // Map ingredients
    const ingredientMaps: IngredientMapping[] = importData.ingredients.map(ing => {
      // If no pantry items, all ingredients are new
      if (pantryItems.length === 0) {
        return {
          original: ing,
          currentName: ing.name,
          matchStatus: 'new',
          selectedMatch: 'new',
          nutritionFoodId: ing.nutrition_food_id || null,
          quantity: ing.quantity || 0,
          unit: ing.unit || ''
        };
      }

      const hasExact = hasExactMatch(ing.name, pantryItems, (item) => item.ingredient_name);
      
      if (hasExact) {
        const exactMatch = pantryItems.find(item => 
          item.ingredient_name.toLowerCase().trim() === ing.name.toLowerCase().trim()
        );
        return {
          original: ing,
          currentName: ing.name, // Keep original name for exact match
          matchStatus: 'exact',
          matchedItem: exactMatch,
          selectedMatch: exactMatch?.id,
          nutritionFoodId: exactMatch?.nutrition_food_id || ing.nutrition_food_id || null,
          quantity: ing.quantity || 0,
          unit: ing.unit || ''
        };
      }

      const fuzzyMatches = findFuzzyMatches(ing.name, pantryItems, (item) => item.ingredient_name, 0.5);
      
      if (fuzzyMatches.length > 0) {
        return {
          original: ing,
          currentName: ing.name, // Start with original name
          matchStatus: 'fuzzy',
          fuzzyMatches: fuzzyMatches.map(m => m.item),
          selectedMatch: fuzzyMatches[0].item.id, // Default to best match
          nutritionFoodId: fuzzyMatches[0].item.nutrition_food_id || ing.nutrition_food_id || null,
          quantity: ing.quantity || 0,
          unit: ing.unit || ''
        };
      }

      return {
        original: ing,
        currentName: ing.name, // Keep original name for new items
        matchStatus: 'new',
        selectedMatch: 'new',
        nutritionFoodId: ing.nutrition_food_id || null,
        quantity: ing.quantity || 0,
        unit: ing.unit || ''
      };
    });

    console.log('Created ingredient mappings:', ingredientMaps.length);
    setIngredientMappings(ingredientMaps);
  }, [importData, pantryItems]);

  useEffect(() => {
    if (!importData) return;

    // Map equipment (even if equipmentList is empty, we still need to map imported equipment)
    const equipmentMaps: EquipmentMapping[] = importData.equipment.map(eq => {
      const eqName = eq.equipment_name || eq.name || eq;
      
      // If no equipment list, all are new
      if (equipmentList.length === 0) {
        return {
          original: eq,
          currentName: eqName,
          matchStatus: 'new',
          selectedMatch: 'new'
        };
      }
      
      const hasExact = hasExactMatch(eqName, equipmentList, (item) => item.name);
      
      if (hasExact) {
        const exactMatch = equipmentList.find(item => 
          item.name.toLowerCase().trim() === eqName.toLowerCase().trim()
        );
        return {
          original: eq,
          currentName: eqName, // Keep original name for exact match
          matchStatus: 'exact',
          matchedItem: exactMatch,
          selectedMatch: exactMatch?.id
        };
      }

      const fuzzyMatches = findFuzzyMatches(eqName, equipmentList, (item) => item.name, 0.6);
      
      if (fuzzyMatches.length > 0) {
        return {
          original: eq,
          currentName: eqName, // Start with original name
          matchStatus: 'fuzzy',
          fuzzyMatches: fuzzyMatches.map(m => m.item),
          selectedMatch: fuzzyMatches[0].item.id // Default to best match
        };
      }

      return {
        original: eq,
        currentName: eqName, // Keep original name for new items
        matchStatus: 'new',
        selectedMatch: 'new'
      };
    });

    setEquipmentMappings(equipmentMaps);
  }, [importData, equipmentList]);

  const handleIngredientSearchSelect = (index: number, name: string, nutritionFoodId?: string | null) => {
    const newMappings = [...ingredientMappings];
    newMappings[index].currentName = name;
    newMappings[index].nutritionFoodId = nutritionFoodId || null;
    const pantryItem = pantryItems.find(p => p.ingredient_name.toLowerCase() === name.toLowerCase());
    newMappings[index].selectedMatch = pantryItem ? pantryItem.id : 'new';
    setIngredientMappings(newMappings);
  };

  const handleIngredientQuantityChange = (index: number, value: string) => {
    const newMappings = [...ingredientMappings];
    const num = Number(value);
    newMappings[index].quantity = Number.isFinite(num) && num >= 0 ? num : 0;
    setIngredientMappings(newMappings);
  };

  const handleIngredientUnitChange = (index: number, value: string) => {
    const newMappings = [...ingredientMappings];
    newMappings[index].unit = value;
    setIngredientMappings(newMappings);
  };

  const handleEquipmentMappingChange = (index: number, value: string) => {
    const newMappings = [...equipmentMappings];
    newMappings[index].selectedMatch = value;
    
    // Update currentName based on selection
    if (value === 'new') {
      const originalName = newMappings[index].original.equipment_name || newMappings[index].original.name || newMappings[index].original;
      newMappings[index].currentName = originalName;
    } else {
      const selectedItem = equipmentList.find(item => item.id === value);
      if (selectedItem) {
        newMappings[index].currentName = selectedItem.name;
      }
    }
    
    setEquipmentMappings(newMappings);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error(t('importReview.enterFolderName'));
      return;
    }

    try {
      const folder = await createFolder(newFolderName);
      setFolders([...folders, folder]);
      setFolderId(folder.id);
      setNewFolderDialogOpen(false);
      setNewFolderName('');
      toast.success(t('importReview.folderCreated'));
    } catch (error: any) {
      toast.error(t('importReview.failedToCreateFolder', { error: error.message }));
    }
  };

  const removeIngredientMapping = (index: number) => {
    setIngredientMappings(prev => prev.filter((_, i) => i !== index));
  };

  const removeEquipmentMapping = (index: number) => {
    setEquipmentMappings(prev => prev.filter((_, i) => i !== index));
  };

  const updateStepInstruction = (secIdx: number, stepIdx: number, value: string) => {
    setSections(prev => prev.map((sec, si) =>
      si === secIdx
        ? { ...sec, steps: sec.steps.map((s: any, i: number) => i === stepIdx ? { ...s, instruction: value } : s) }
        : sec
    ));
  };

  const updateStepTimer = (secIdx: number, stepIdx: number, value: string) => {
    setSections(prev => prev.map((sec, si) =>
      si === secIdx
        ? { ...sec, steps: sec.steps.map((s: any, i: number) => i === stepIdx ? { ...s, timer_minutes: parseInt(value) || 0 } : s) }
        : sec
    ));
  };

  const deleteStep = (secIdx: number, stepIdx: number) => {
    setSections(prev => prev.map((sec, si) =>
      si === secIdx
        ? { ...sec, steps: sec.steps.filter((_: any, i: number) => i !== stepIdx) }
        : sec
    ));
  };

  const addStep = (secIdx: number) => {
    setSections(prev => prev.map((sec, si) =>
      si === secIdx
        ? { ...sec, steps: [...sec.steps, { order_index: sec.steps.length, instruction: '', image_url: '', timer_minutes: 0 }] }
        : sec
    ));
  };

  const renameSection = (secIdx: number, title: string) => {
    setSections(prev => prev.map((sec, si) => si === secIdx ? { ...sec, title } : sec));
  };

  const deleteSection = (secIdx: number) => {
    setSections(prev => prev.filter((_, i) => i !== secIdx));
  };

  const addSection = () => {
    setSections(prev => [...prev, {
      title: 'New Section',
      order_index: prev.length,
      steps: [{ order_index: 0, instruction: '', image_url: '', timer_minutes: 0 }],
    }]);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(t('importReview.imageMustBeLess5'));
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('importReview.fileMustBeImage'));
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', 'recipe-images');
      formData.append('folder', filePath);
      const result = await api.upload<{ url: string }>('/api/files/upload', formData);
      setImageUrl(result.url);
      toast.success(t('importReview.imageUploaded'));
    } catch (error: any) {
      toast.error(t('importReview.uploadFailed', { error: error.message }));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    // Validation
    if (!title.trim()) {
      toast.error(t('importReview.enterRecipeTitle'));
      return;
    }

    const validIngredients = ingredientMappings.filter(m => m.currentName.trim());
    if (validIngredients.length === 0) {
      toast.error(t('importReview.atLeastOneIngredient'));
      return;
    }

    // Check for new items that need to be created
    const newIngredients = ingredientMappings
      .filter(m => m.selectedMatch === 'new')
      .map(m => m.currentName);
    
    const newEquipment = equipmentMappings
      .filter(m => m.selectedMatch === 'new')
      .map(m => m.currentName);

    if (newIngredients.length > 0 || newEquipment.length > 0) {
      setNewItemsToCreate({ ingredients: newIngredients, equipment: newEquipment });
      setShowConfirmDialog(true);
    } else {
      saveRecipe();
    }
  };

  const saveRecipe = async () => {
    if (!profile || !importData) return;

    setSaving(true);
    try {
      console.log('Saving recipe with ingredient mappings:', ingredientMappings);
      console.log('Ingredient names being saved:', ingredientMappings.map(m => m.currentName));

      // Create recipe with edited data
      const recipeData = {
        title,
        description: description || undefined,
        image_url: imageUrl || undefined,
        folder_id: folderId && folderId !== 'none' ? folderId : undefined,
        servings,
        prep_time_minutes: prepTimeMinutes,
        cook_time_minutes: cookTimeMinutes,
        notes: notes.trim() === '' ? null : notes,
        tags: selectedTags,
        equipment: equipmentMappings.map(m => m.currentName),
        ingredients: ingredientMappings.map((m, idx) => ({
          name: m.currentName,
          preparation: m.original.preparation,
          quantity: m.quantity,
          unit: m.unit,
          is_optional: m.original.is_optional,
          order_index: idx,
          substitutions: m.original.substitutions,
          notes: m.original.notes,
          prep_style: m.original.prep_style || null,
          nutrition_food_id: m.nutritionFoodId || null,
          group_name: m.original.group_name || null,
        })),
        sections: sections.map((sec, idx) => ({
          title: sec.title,
          order_index: idx,
          steps: sec.steps.filter((s: any) => s.instruction.trim()).map((step: any, stepIdx: number) => ({
            ...step,
            order_index: stepIdx
          }))
        })),
        imported_from_recipe_id: importData.recipe.imported_from_recipe_id,
        imported_from_user_id: importData.recipe.imported_from_user_id,
        imported_from_instance_id: importData.recipe.imported_from_instance_id,
      };

      console.log('Recipe data being sent to createRecipe:', recipeData);

      const newRecipe = await createRecipe(recipeData, profile.id);
      toast.success(t('importSuccess'));
      navigate(`/recipes/${newRecipe.id}`);
    } catch (error: any) {
      console.error('Failed to import recipe:', error);
      toast.error(t('importReview.failedToImport', { error: error.message }));
    } finally {
      setSaving(false);
    }
  };

  if (!importData) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">{t('shared.loadingImportData')}</p>
        </div>
      </MainLayout>
    );
  }

  const hasUnmatchedItems = ingredientMappings.some(m => m.matchStatus !== 'exact') || 
                           equipmentMappings.some(m => m.matchStatus !== 'exact');

  const groupNameAt = (index: number): string | null => {
    const group = ingredientMappings[index]?.original?.group_name;
    if (!group) return null;
    const prev = ingredientMappings[index - 1]?.original?.group_name;
    return prev === group ? null : group;
  };

  return (
    <MainLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-semibold">{t('importReview.reviewImportedRecipe')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('importReview.matchIngredientsText')}
          </p>
        </div>

        {/* Recipe Info - Now Editable */}
        <Card>
          <CardHeader>
            <CardTitle>{t('recipeDetails')}</CardTitle>
            <CardDescription>{t('importReview.editBeforeImporting')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">{t('importReview.titleRequired')}</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('importReview.recipeTitlePlaceholder')}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">{t('common:description')}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('importReview.descriptionPlaceholder')}
                rows={3}
              />
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label htmlFor="image">{t('recipeImage')}</Label>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                  />
                </div>
                {imageUrl && (
                  <img src={imageUrl} alt={t('shared.preview')} className="w-32 h-32 object-cover rounded" />
                )}
              </div>
            </div>

            {/* Folder */}
            <div className="space-y-2">
              <Label htmlFor="folder">{t('importReview.folder')}</Label>
              <div className="flex gap-2">
                <Select value={folderId} onValueChange={setFolderId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t('importReview.selectFolder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('shared.noFolder')}</SelectItem>
                    {folders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setNewFolderDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Servings, Prep Time, Cook Time */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="servings">{t('servings')}</Label>
                <Input
                  id="servings"
                  type="number"
                  min="1"
                  value={servings}
                  onChange={(e) => setServings(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prepTime">{t('importReview.prepTimeMinutes')}</Label>
                <Input
                  id="prepTime"
                  type="number"
                  min="0"
                  value={prepTimeMinutes ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : undefined;
                    setPrepTimeMinutes(val);
                    setPrepTimeError(val !== undefined && val < 0 ? t('importReview.prepTimeNegative') : '');
                  }}
                  placeholder={t('common:optional')}
                />
                {prepTimeError && <p className="text-sm text-destructive">{prepTimeError}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cookTime">{t('importReview.cookTimeMinutes')}</Label>
                <Input
                  id="cookTime"
                  type="number"
                  min="0"
                  value={cookTimeMinutes ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : undefined;
                    setCookTimeMinutes(val);
                    setCookTimeError(val !== undefined && val < 0 ? t('importReview.cookTimeNegative') : '');
                  }}
                  placeholder={t('common:optional')}
                />
                {cookTimeError && <p className="text-sm text-destructive">{cookTimeError}</p>}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>{t('tags')}</Label>
              <TagSelector
                selectedTags={selectedTags}
                onChange={setSelectedTags}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">{t('notes')}</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('importReview.additionalNotesPlaceholder')}
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Warning if there are unmatched items */}
        {hasUnmatchedItems && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t('importReview.reviewRequired')}</AlertTitle>
            <AlertDescription>
              {t('importReview.unmatchedWarning')}
            </AlertDescription>
          </Alert>
        )}

        {/* Ingredients Mapping */}
        {ingredientMappings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {t('shared.ingredientsCount', { count: ingredientMappings.length })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ingredientMappings.map((mapping, index) => (
                <Fragment key={index}>
                  {groupNameAt(index) && (
                    <div className="pt-2 first:pt-0">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        {groupNameAt(index)}
                      </h3>
                    </div>
                  )}
                  <div
                    className={`flex items-start gap-4 p-4 border rounded-lg ${
                      mapping.matchStatus === 'fuzzy'
                        ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30'
                        : 'border-border'
                    }`}
                  >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{mapping.currentName}</span>
                      {mapping.currentName !== mapping.original.name && (
                        <span className="text-xs text-muted-foreground">{t('importReview.was', { name: mapping.original.name })}</span>
                      )}
                      {mapping.matchStatus === 'exact' && (
                        <Badge variant="default" className="gap-1">
                          <Check className="h-3 w-3" />
                          {t('importReview.exactMatch')}
                        </Badge>
                      )}
                      {mapping.matchStatus === 'fuzzy' && (
                        <Badge variant="secondary" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {t('importReview.similarMatch')}
                        </Badge>
                      )}
                      {mapping.matchStatus === 'new' && (
                        <Badge variant="outline" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {t('importReview.newItem')}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground shrink-0">{t('importReview.amount')}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={mapping.quantity}
                        onChange={(e) => handleIngredientQuantityChange(index, e.target.value)}
                        className="w-24 h-8"
                        placeholder={t('shared.zeroPlaceholder')}
                      />
                      <Popover
                        open={unitPopoverOpen === index}
                        onOpenChange={(open) => setUnitPopoverOpen(open ? index : null)}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            className="w-24 h-8 justify-between font-normal px-2"
                          >
                            <span className="truncate">{mapping.unit || 'unit'}</span>
                            <ChevronDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-0" align="start">
                          <Command>
                            <CommandInput
                              placeholder={t('shared.searchOrType')}
                              value={mapping.unit}
                              onValueChange={(value) => handleIngredientUnitChange(index, value)}
                              onKeyDown={(e) => { if (e.key === 'Tab') setUnitPopoverOpen(null); }}
                            />
                            <CommandList>
                              <CommandEmpty>{t('shared.useValue', { value: mapping.unit || '' })}</CommandEmpty>
                              <CommandGroup>
                                {INGREDIENT_UNITS.map((unit) => (
                                  <CommandItem
                                    key={unit}
                                    value={unit}
                                    onSelect={() => { handleIngredientUnitChange(index, unit); setUnitPopoverOpen(null); }}
                                  >
                                    {unit}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {mapping.original.preparation && (
                        <span className="text-sm text-muted-foreground">({mapping.original.preparation})</span>
                      )}
                    </div>
                  </div>

                  <div className="w-72">
                    <Label className="text-xs">{t('importReview.name')}:</Label>
                    <IngredientSearchPopover
                      value={mapping.currentName}
                      nutritionFoodId={mapping.nutritionFoodId}
                      onSelect={(name, nfid) => handleIngredientSearchSelect(index, name, nfid)}
                      pantryItems={pantryItems.map(p => ({
                        id: p.id,
                        ingredient_name: p.ingredient_name,
                        nutrition_food_id: p.nutrition_food_id,
                      }))}
                      placeholder={t('shared.selectOrType')}
                      filterPlaceholder={t('shared.searchIngredient')}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeIngredientMapping(index)}
                    title={t('importReview.removeIngredient')}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                  </div>
                </Fragment>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Equipment Mapping */}
        {equipmentMappings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ChefHat className="h-5 w-5" />
                {t('shared.equipmentCount', { count: equipmentMappings.length })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {equipmentMappings.map((mapping, index) => {
                const eqName = mapping.original.equipment_name || mapping.original.name || mapping.original;
                return (
                  <div key={index} className="flex items-start gap-4 p-4 border rounded-lg">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{mapping.currentName}</span>
                        {mapping.currentName !== eqName && (
                          <span className="text-xs text-muted-foreground">{t('importReview.was', { name: eqName })}</span>
                        )}
                        {mapping.matchStatus === 'exact' && (
                          <Badge variant="default" className="gap-1">
                            <Check className="h-3 w-3" />
                            {t('importReview.exactMatch')}
                          </Badge>
                        )}
                        {mapping.matchStatus === 'fuzzy' && (
                          <Badge variant="secondary" className="gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {t('importReview.similarMatch')}
                          </Badge>
                        )}
                        {mapping.matchStatus === 'new' && (
                          <Badge variant="outline" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {t('importReview.newItem')}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="w-64">
                      <Label className="text-xs">{t('importReview.name')}:</Label>
                      <SearchableMapper
                        value={mapping.selectedMatch || 'new'}
                        onValueChange={(value) => handleEquipmentMappingChange(index, value)}
                        items={equipmentList.map(item => ({ id: item.id, name: item.name }))}
                        originalName={mapping.currentName}
                        placeholder={t('importReview.searchEquipment')}
                        emptyText={t('equipmentEditor.noEquipmentFound')}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEquipmentMapping(index)}
                      title={t('importReview.removeEquipment')}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Instructions Preview */}
        {sections && sections.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('shared.instructions')}</CardTitle>
              <CardDescription>{t('importReview.reviewStepsBeforeImporting')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {sections.map((section: any, secIdx: number) => (
                <div key={secIdx} className="space-y-4 border rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <Input
                      className="font-semibold"
                      value={section.title}
                      onChange={(e) => renameSection(secIdx, e.target.value)}
                      placeholder={t('importReview.sectionTitlePlaceholder')}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteSection(secIdx)}
                      title={t('importReview.deleteSection')}
                      disabled={sections.length <= 1}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                  <ol className="space-y-4">
                    {section.steps && section.steps.map((step: any, stepIdx: number) => (
                      <li key={stepIdx} className="flex gap-4">
                        <span className="font-semibold text-muted-foreground shrink-0 pt-2">
                          {stepIdx + 1}.
                        </span>
                        <div className="space-y-2 flex-1 min-w-0">
                          <Textarea
                            value={step.instruction}
                            onChange={(e) => updateStepInstruction(secIdx, stepIdx, e.target.value)}
                            rows={2}
                            placeholder={t('importReview.stepInstructionPlaceholder')}
                          />
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`timer-${secIdx}-${stepIdx}`} className="text-xs">{t('shared.timerMinutesLabel')}</Label>
                            <Input
                              id={`timer-${secIdx}-${stepIdx}`}
                              type="number"
                              min="0"
                              value={step.timer_minutes || 0}
                              onChange={(e) => updateStepTimer(secIdx, stepIdx, e.target.value)}
                              className="w-24 h-8"
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteStep(secIdx, stepIdx)}
                          title={t('importReview.deleteStep')}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </li>
                    ))}
                  </ol>
                  <Button type="button" variant="outline" size="sm" onClick={() => addStep(secIdx)}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('addStep')}
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addSection}>
                <Plus className="h-4 w-4 mr-2" />
                {t('shared.addSection')}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/recipes')}
            disabled={saving}
          >
            {t('common:cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? t('importReview.importing') : t('importRecipe')}
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog for New Items */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90vh] flex flex-col">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('importReview.createNewItems')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('importReview.itemsToCreate')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 overflow-y-auto min-h-0 flex-1">
            {newItemsToCreate.ingredients.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">{t('importReview.newIngredients')}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {newItemsToCreate.ingredients.map((ing, idx) => (
                    <li key={idx}>{ing}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {newItemsToCreate.equipment.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">{t('importReview.newEquipment')}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {newItemsToCreate.equipment.map((eq, idx) => (
                    <li key={idx}>{eq}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <AlertDialogFooter className="shrink-0">
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowConfirmDialog(false);
              saveRecipe();
            }}>
              {t('importReview.createAndImport')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Folder Dialog */}
      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('shared.createNewFolder')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folderName">{t('folderName')}</Label>
              <Input
                id="folderName"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={t('enterFolderName')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateFolder();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderDialogOpen(false)}>
              {t('common:cancel')}
            </Button>
            <Button onClick={handleCreateFolder}>
              {t('common:create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
