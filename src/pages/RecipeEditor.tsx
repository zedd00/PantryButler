import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';
import { createRecipe, updateRecipe, getRecipeById, getAllFolders, createFolder } from '@/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { CreateRecipeInput, Folder, GridRecipe } from '@/types/types';
import { api } from '@/lib/api-client';
import IngredientEditor from '@/components/recipes/IngredientEditor';
import EquipmentEditor from '@/components/recipes/EquipmentEditor';
import TagSelector from '@/components/recipes/TagSelector';
import CooklangUpload from '@/components/recipes/CooklangUpload';
import UrlImport from '@/components/recipes/UrlImport';
import PublicRecipeSettings from '@/components/recipes/PublicRecipeSettings';
import GridRecipeEditor from '@/components/recipes/GridRecipeEditor';
import { useTranslation } from 'react-i18next';

export default function RecipeEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { t } = useTranslation(['recipes', 'common']);
  const isEditing = !!id;

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
  const [equipment, setEquipment] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([
    { name: '', preparation: '', quantity: 0, unit: 'grams', is_optional: false, order_index: 0 }
  ]);
  const [sections, setSections] = useState<any[]>([
    { title: 'Main', order_index: 0, steps: [{ order_index: 0, instruction: '', image_url: '', timer_minutes: 0 }] }
  ]);
  const [isPublic, setIsPublic] = useState(false);
  const [publicSlug, setPublicSlug] = useState<string | null>(null);
  const [isGridRecipe, setIsGridRecipe] = useState(false);
  const [gridRecipe, setGridRecipe] = useState<GridRecipe | null>(null);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [uploading, setUploading] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const foldersData = await getAllFolders();
    setFolders(foldersData);

    if (isEditing) {
      const recipe = await getRecipeById(id!);
      if (recipe) {
        setTitle(recipe.title);
        setDescription(recipe.description || '');
        setImageUrl(recipe.image_url || '');
        setFolderId(recipe.folder_id || '');
        setServings(recipe.servings);
        setPrepTimeMinutes(recipe.prep_time_minutes || undefined);
        setCookTimeMinutes(recipe.cook_time_minutes || undefined);
        setNotes(recipe.notes || '');
        setSelectedTags(recipe.tags?.map(t => t.name) || []);
        
        // Load equipment - ensure it's an array of strings
        const recipeEquipment = recipe.equipment?.map((e: any) => e.equipment_name || e.name || '').filter((e: string) => e.trim()) || [];
        setEquipment(recipeEquipment.length > 0 ? recipeEquipment : []);
        
        // Clean ingredients - remove database fields and coerce NUMERIC
        // quantity (pg returns it as a string) back to a number
        const cleanIngredients = recipe.ingredients?.map((ing: any) => ({
          name: ing.name,
          preparation: ing.preparation || '',
          quantity: Number(ing.quantity) || 0,
          unit: ing.unit,
          is_optional: ing.is_optional || false,
          substitutions: ing.substitutions || '',
          notes: ing.notes || '',
          prep_style: ing.prep_style || null,
          nutrition_food_id: ing.nutrition_food_id || null,
          group_name: ing.group_name || null
        })) || [{ name: '', preparation: '', quantity: 0, unit: 'grams', is_optional: false, order_index: 0 }];
        
        setIngredients(cleanIngredients);
        setSections(recipe.sections || [{ title: 'Main', order_index: 0, steps: [{ order_index: 0, instruction: '', image_url: '', timer_minutes: 0 }] }]);
        setIsPublic(recipe.is_public || false);
        setPublicSlug(recipe.public_slug || null);
        setIsGridRecipe(!!recipe.grid_recipe);
        setGridRecipe(recipe.grid_recipe || null);
      }
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      toast.error(t('recipeEditor.imageMustBeLess5'));
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('recipeEditor.fileMustBeImage'));
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
      toast.success(t('recipeEditor.imageUploaded'));
    } catch (error: any) {
      toast.error(t('recipeEditor.uploadFailed', { error: error.message }));
    } finally {
      setUploading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error(t('recipeEditor.folderNameRequired'));
      return;
    }

    try {
      const folder = await createFolder(newFolderName, profile?.id);
      toast.success(t('recipeEditor.folderCreated'));
      setFolderDialogOpen(false);
      setNewFolderName('');
      
      // Add the new folder to the list and select it
      setFolders((prev) => [...prev, folder]);
      setFolderId(folder.id);
    } catch (error: any) {
      toast.error(t('recipeEditor.failedToCreateFolder', { error: error.message }));
    }
  };

  const handleStepImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, sectionIndex: number, stepIndex: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 1MB)
    if (file.size > 1024 * 1024) {
      toast.error(t('recipeEditor.imageMustBeLess1'));
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('recipeEditor.fileMustBeImage'));
      return;
    }

    try {
      setUploading(true);
      
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `steps/${fileName}`;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', 'recipe-step-images');
      formData.append('folder', filePath);
      const stepResult = await api.upload<{ url: string }>('/api/files/upload', formData);
      const url = stepResult.url;

      const newSections = [...sections];
      newSections[sectionIndex].steps[stepIndex].image_url = url;
      setSections(newSections);

      toast.success(t('recipeEditor.imageUploadedSuccess'));
    } catch (error: any) {
      toast.error(t('recipeEditor.imageUploadFailed', { error: error.message }));
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveStepImage = async (sectionIndex: number, stepIndex: number) => {
    const step = sections[sectionIndex].steps[stepIndex];
    if (!step.image_url) return;

    try {
      // Extract file path from URL
      const url = new URL(step.image_url, window.location.origin);
      const pathParts = url.pathname.split('/');
      const bucketIndex = pathParts.findIndex(p => p === 'recipe-step-images');
      if (bucketIndex !== -1) {
        const filePath = pathParts.slice(bucketIndex + 1).join('/');
        await api.delete('/api/files/', { bucket: 'recipe-step-images', path: filePath });
      }

      // Remove URL from step
      const newSections = [...sections];
      newSections[sectionIndex].steps[stepIndex].image_url = '';
      setSections(newSections);

      toast.success(t('recipeEditor.imageRemoved'));
    } catch (error: any) {
      toast.error(t('recipeEditor.imageRemoveFailed', { error: error.message }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profile) return;

    // Validation: Check if ingredients are missing
    const validIngredients = ingredients.filter(i => i.name.trim());
    if (validIngredients.length === 0) {
      toast.error(t('recipeEditor.atLeastOneIngredient'));
      // Scroll to ingredients section
      const ingredientsSection = document.getElementById('ingredients-section');
      if (ingredientsSection) {
        ingredientsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        ingredientsSection.classList.add('ring-2', 'ring-destructive', 'rounded-lg');
        setTimeout(() => {
          ingredientsSection.classList.remove('ring-2', 'ring-destructive', 'rounded-lg');
        }, 3000);
      }
      return;
    }

    const recipeData: CreateRecipeInput = {
      title,
      description: description || undefined,
      image_url: imageUrl || undefined,
      folder_id: folderId && folderId !== 'none' ? folderId : undefined,
      servings,
      prep_time_minutes: prepTimeMinutes,
      cook_time_minutes: cookTimeMinutes,
      notes: notes.trim() === '' ? null : notes,
      tags: selectedTags,
      equipment: equipment.filter(e => e.trim()),
      grid_recipe: isGridRecipe ? gridRecipe : null,
      ingredients: validIngredients.map((ing, idx) => ({ ...ing, order_index: idx })),
      sections: sections.map((sec, idx) => ({
        title: sec.title,
        order_index: idx,
        steps: sec.steps.filter((s: any) => s.instruction.trim()).map((step: any, stepIdx: number) => ({
          ...step,
          order_index: stepIdx
        }))
      }))
    };

    try {
      if (isEditing) {
        await updateRecipe({ ...recipeData, id: id! });
        toast.success(t('recipeEditor.recipeUpdated'));
        navigate(`/recipes/${id}`);
      } else {
        const newRecipe = await createRecipe(recipeData, profile.id);
        toast.success(t('recipeEditor.recipeCreated'));
        navigate(`/recipes/${newRecipe.id}`);
      }
    } catch (error: any) {
      toast.error(t('recipeEditor.failedToSave', { error: error.message }));
    }
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-semibold">{isEditing ? t('editRecipe') : t('newRecipe')}</h1>
            <div className="flex gap-2">
              {!isEditing && (
                <>
                  <UrlImport buttonVariant="outline" />
                  <CooklangUpload
                    onRecipeParsed={(recipe) => {
                      // Navigate to import review page
                      navigate('/import-review', {
                        state: {
                          importData: {
                            recipe: {
                              title: recipe.title,
                              description: recipe.description,
                              servings: recipe.servings,
                              prep_time_minutes: recipe.prep_time_minutes,
                              cook_time_minutes: recipe.cook_time_minutes,
                              notes: recipe.notes,
                            },
                            ingredients: recipe.ingredients || [],
                            equipment: recipe.equipment || [],
                            sections: recipe.sections || [],
                            tags: recipe.tags || [],
                          }
                        }
                      });
                    }}
                    buttonVariant="outline"
                  />
                </>
              )}
              <Button type="button" variant="outline" onClick={() => navigate('/recipes')}>
                {t('common:cancel')}
              </Button>
              <Button type="submit">{t('recipeEditor.saveRecipe')}</Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('recipeEditor.basicInformation')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">{t('recipeTitle')} *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('common:description')}</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder={t('recipeEditor.descriptionPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="image">{t('recipeImage')}</Label>
                <div className="flex gap-2">
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

              <div className="space-y-2">
                <Label htmlFor="tags">{t('tags')}</Label>
                <TagSelector selectedTags={selectedTags} onChange={setSelectedTags} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="folder">{t('recipeEditor.folder')}</Label>
                  <div className="flex gap-2">
                    <Select value={folderId} onValueChange={setFolderId}>
                      <SelectTrigger id="folder" className="flex-1">
                        <SelectValue placeholder={t('recipeEditor.selectFolder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('common:none')}</SelectItem>
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
                      onClick={() => setFolderDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="servings">{t('servings')} *</Label>
                  <Input
                    id="servings"
                    type="number"
                    min="1"
                    value={servings}
                    onChange={(e) => setServings(Math.max(1, Number(e.target.value)))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prep-time">{t('recipeEditor.prepTimeMinutes')}</Label>
                  <Input
                    id="prep-time"
                    type="number"
                    min="0"
                    value={prepTimeMinutes ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : undefined;
                      setPrepTimeMinutes(val);
                      setPrepTimeError(val !== undefined && val < 0 ? t('recipeEditor.prepTimeNegative') : '');
                    }}
                    placeholder={t('common:optional')}
                  />
                  {prepTimeError && <p className="text-sm text-destructive">{prepTimeError}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cook-time">{t('recipeEditor.cookTimeMinutes')}</Label>
                  <Input
                    id="cook-time"
                    type="number"
                    min="0"
                    value={cookTimeMinutes ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : undefined;
                      setCookTimeMinutes(val);
                      setCookTimeError(val !== undefined && val < 0 ? t('recipeEditor.cookTimeNegative') : '');
                    }}
                    placeholder={t('common:optional')}
                  />
                  {cookTimeError && <p className="text-sm text-destructive">{cookTimeError}</p>}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <Label className="font-medium">{t('shared.gridRecipe')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('recipeEditor.gridRecipeDesc')}
                  </p>
                </div>
                <Switch
                  checked={isGridRecipe}
                  onCheckedChange={(checked) => {
                    setIsGridRecipe(checked);
                    if (checked) {
                      setGridRecipe((prev) => prev ?? { root: { type: 'step', text: '', inputs: [] } });
                    }
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('equipment')}</CardTitle>
            </CardHeader>
            <CardContent>
              <EquipmentEditor equipment={equipment} onChange={setEquipment} />
            </CardContent>
          </Card>

          <Card id="ingredients-section">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('ingredients')}</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const usedGroups = new Set(
                    ingredients.map((i: any) => i.group_name).filter(Boolean)
                  );
                  setIngredients((prev) => [...prev, {
                    name: '',
                    preparation: '',
                    quantity: 0,
                    unit: 'grams',
                    is_optional: false,
                    order_index: prev.length,
                    substitutions: '',
                    notes: '',
                    nutrition_food_id: null,
                    group_name: t('ingredientEditor.newGroup', { number: usedGroups.size + 1 })
                  }]);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('ingredientEditor.addGroup')}
              </Button>
            </CardHeader>
            <CardContent>
              <IngredientEditor ingredients={ingredients} onChange={setIngredients} instanceId={profile?.instance_id} />
            </CardContent>
          </Card>

          {isGridRecipe && (
            <Card>
              <CardHeader>
                <CardTitle>{t('shared.gridRecipe')}</CardTitle>
              </CardHeader>
              <CardContent>
                <GridRecipeEditor
                  gridRecipe={gridRecipe}
                  ingredients={ingredients}
                  onChange={setGridRecipe}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('shared.instructions')}</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSections([...sections, {
                    title: `Section ${sections.length + 1}`,
                    order_index: sections.length,
                    steps: [{ order_index: 0, instruction: '', image_url: '', timer_minutes: 0 }]
                  }]);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Section
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {sections.map((section, secIdx) => (
                <div key={secIdx} className="space-y-4 border border-border rounded-lg p-4">
                  <div className="flex gap-2 items-center">
                  <Input
                    placeholder={t('shared.sectionTitlePlaceholder')}
                      value={section.title}
                      onChange={(e) => {
                        const newSections = [...sections];
                        newSections[secIdx].title = e.target.value;
                        setSections(newSections);
                      }}
                      className="flex-1"
                    />
                    {sections.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setSections(sections.filter((_, i) => i !== secIdx));
                        }}
                        title={t('recipeEditor.removeSection')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {section.steps.map((step: any, stepIdx: number) => (
                    <div key={stepIdx} className="space-y-2 border border-border rounded p-3">
                      <div className="flex gap-2">
                        <span className="text-muted-foreground mt-2">{stepIdx + 1}.</span>
                        <Textarea
                          placeholder={t('shared.instructionPlaceholder')}
                          value={step.instruction}
                          onChange={(e) => {
                            const newSections = [...sections];
                            newSections[secIdx].steps[stepIdx].instruction = e.target.value;
                            setSections(newSections);
                          }}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const newSections = [...sections];
                            newSections[secIdx].steps = newSections[secIdx].steps.filter((_: any, i: number) => i !== stepIdx);
                            setSections(newSections);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 ml-6">
                        <Label htmlFor={`timer-${secIdx}-${stepIdx}`} className="text-xs">{t('shared.timerMinutesLabel')}</Label>
                        <Input
                          id={`timer-${secIdx}-${stepIdx}`}
                          type="number"
                          min="0"
                          value={step.timer_minutes || 0}
                          onChange={(e) => {
                            const newSections = [...sections];
                            newSections[secIdx].steps[stepIdx].timer_minutes = parseInt(e.target.value) || 0;
                            setSections(newSections);
                          }}
                          className="w-24"
                        />
                      </div>

                      {/* Step Image Upload */}
                      <div className="space-y-2">
                        <Label className="text-xs">{t('shared.stepImageOptional')}</Label>
                        {step.image_url ? (
                          <div className="relative inline-block">
                            <img
                              src={step.image_url}
                              alt={t('shared.stepNumberAlt', { number: step.order_index })}
                              className="w-full max-w-xs rounded border"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute top-1 right-1"
                              onClick={() => handleRemoveStepImage(secIdx, stepIdx)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleStepImageUpload(e, secIdx, stepIdx)}
                            className="max-w-xs text-xs"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newSections = [...sections];
                      newSections[secIdx].steps.push({ order_index: newSections[secIdx].steps.length, instruction: '', image_url: '', timer_minutes: 0 });
                      setSections(newSections);
                    }}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('shared.addSection')}
              </Button>
                </div>
              ))}
              {/* Add Section button at bottom for convenience */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSections([...sections, {
                    title: `Section ${sections.length + 1}`,
                    order_index: sections.length,
                    steps: [{ order_index: 0, instruction: '', image_url: '', timer_minutes: 0 }]
                  }]);
                }}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('shared.addSection')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('notes')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('shared.notesPlaceholder')}
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Public Sharing Settings - Only show when editing existing recipe */}
          {isEditing && id && (
            <PublicRecipeSettings
              recipeId={id}
              isPublic={isPublic}
              publicSlug={publicSlug}
              onUpdate={(newIsPublic, newSlug) => {
                setIsPublic(newIsPublic);
                setPublicSlug(newSlug);
              }}
            />
          )}

          {/* Bottom Save Button */}
          <div className="flex justify-end">
            <Button type="submit" size="lg">
              {t('recipeEditor.saveRecipe')}
            </Button>
          </div>
        </form>
      </div>

      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('shared.createNewFolder')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">{t('folderName')}</Label>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={t('enterFolderName')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>{t('common:cancel')}</Button>
            <Button onClick={handleCreateFolder}>{t('common:create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
