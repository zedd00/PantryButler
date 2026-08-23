import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import UrlImport from '@/components/recipes/UrlImport';
import CooklangUpload from '@/components/recipes/CooklangUpload';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Clock, ChefHat } from 'lucide-react';
import { getAllRecipes, getAllFolders, getAllTags, createFolder, deleteFolder, updateFolder, getCurrentUserRole, getPantryItems } from '@/api';
import type { Recipe, Folder, Tag, PantryItem } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { proxiedImage } from '@/api/images';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
import { useTranslation } from 'react-i18next';
import { PageTutorial } from '@/components/tutorial/PageTutorial';
import { getRecipesTutorialSteps } from '@/components/tutorial/tutorialSteps';

export default function Recipes() {
  const { t } = useTranslation(['recipes', 'common', 'tutorial']);
  const navigate = useNavigate();
  const { profile, currentInstance } = useAuth();
  const [recipes, setRecipes] = useState<(Recipe & { tags?: Tag[] })[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [maxTimeMinutes, setMaxTimeMinutes] = useState<string>('');
  const [tagSearchTerm, setTagSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [recipeIngredients, setRecipeIngredients] = useState<Record<string, any[]>>({});

  useEffect(() => {
    if (currentInstance) {
      loadData();
      checkAdminRole();
    }
  }, [currentInstance]);

  const checkAdminRole = async () => {
    try {
      const role = await getCurrentUserRole();
      setIsAdmin(role === 'admin');
    } catch (error) {
      console.error('Failed to check admin role:', error);
    }
  };

  const loadData = async () => {
    try {
      const [recipesData, foldersData, tagsData, pantryData] = await Promise.all([
        getAllRecipes(),
        getAllFolders(),
        getAllTags(),
        profile ? getPantryItems(profile.id) : Promise.resolve([]),
      ]);
      setRecipes(recipesData);
      setFolders(foldersData);
      setTags(tagsData);
      setPantryItems(pantryData);
      
      // Load ingredients for all recipes
      await loadRecipeIngredients(recipesData.map(r => r.id));
    } catch (error: any) {
      // Don't show error if it's an abort error (user navigated away)
      if (error.name === 'AbortError' || error.message?.includes('abort')) {
        console.log('Request was aborted');
        return;
      }
      toast.error(t('recipesList.failedToLoad', { error: error.message }));
    } finally {
      setLoading(false);
    }
  };

  const loadRecipeIngredients = async (recipeIds: string[]) => {
    if (recipeIds.length === 0) {
      setRecipeIngredients({});
      return;
    }

    try {
      const ingredients = await api.get<any[]>('/api/recipe-ingredients?ids=' + recipeIds.join(','));

      if (ingredients) {
        const grouped = ingredients.reduce((acc, ing) => {
          if (!acc[ing.recipe_id]) acc[ing.recipe_id] = [];
          acc[ing.recipe_id].push(ing);
          return acc;
        }, {} as Record<string, any[]>);
        setRecipeIngredients(grouped);
      }
    } catch (error) {
      console.error('Failed to load recipe ingredients:', error);
    }
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      toast.error(t('recipesList.folderNameEmpty'));
      return;
    }

    try {
      if (editingFolder) {
        await updateFolder(editingFolder.id, folderName);
        toast.success(t('recipesList.folderUpdated'));
      } else {
        await createFolder(folderName);
        toast.success(t('recipesList.folderCreated'));
      }
      setFolderDialogOpen(false);
      setFolderName('');
      setEditingFolder(null);
      loadData();
    } catch (error: any) {
      toast.error(t('recipesList.failedToSaveFolder', { error: error.message }));
    }
  };

  const handleDeleteFolder = async () => {
    if (!folderToDelete) return;

    try {
      await deleteFolder(folderToDelete.id);
      toast.success(t('recipesList.folderDeleted'));
      setDeleteDialogOpen(false);
      setFolderToDelete(null);
      if (selectedFolder === folderToDelete.id) {
        setSelectedFolder(null);
      }
      loadData();
    } catch (error: any) {
      toast.error(t('recipesList.failedToDeleteFolder', { error: error.message }));
    }
  };

  const filteredRecipes = recipes.filter((recipe) => {
    const matchesFolder = !selectedFolder || recipe.folder_id === selectedFolder;
    const matchesTag = !selectedTag || recipe.tags?.some(tag => tag.id === selectedTag);
    
    // Search by title
    const matchesSearch = !searchTerm || 
      recipe.title.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filter by max time
    const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);
    const matchesTime = !maxTimeMinutes || totalTime <= parseInt(maxTimeMinutes);
    
    return matchesFolder && matchesTag && matchesSearch && matchesTime;
  });

  // Check if a recipe can be made with available pantry items
  const canMakeRecipe = (recipeId: string): boolean => {
    const ingredients = recipeIngredients[recipeId] || [];
    
    // Check if all non-optional ingredients are available in sufficient quantities
    for (const ingredient of ingredients) {
      if (ingredient.is_optional) continue;

      const pantryItem = pantryItems.find(
        item => item.ingredient_name.toLowerCase() === ingredient.name.toLowerCase()
      );

      // If ingredient not in pantry or insufficient amount, can't make recipe
      // Unlimited items are always sufficient
      if (!pantryItem || (!pantryItem.is_unlimited && pantryItem.amount < (ingredient.quantity || 0))) {
        return false;
      }
    }

    return ingredients.length > 0; // Only show recipes that have ingredients
  };

  // Get recipes that can be made now
  const recipesYouCanMakeNow = filteredRecipes.filter(recipe => canMakeRecipe(recipe.id));

  if (loading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64 bg-muted" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-64 bg-muted" />
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageTutorial tutorialId="recipes-page" steps={getRecipesTutorialSteps(t)} />
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">
              {currentInstance?.name ? `${currentInstance.name} - ${t('recipes:title')}` : t('recipes:myRecipes')}
            </h1>
            <p className="text-muted-foreground mt-1">{t('recipes:manageCollection')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/recipes/new">
              <Button data-tutorial="add-recipe">
                <Plus className="mr-2 h-4 w-4" />
                {t('recipes:newRecipe')}
              </Button>
            </Link>
            <UrlImport buttonVariant="outline" />
            <CooklangUpload
              onRecipeParsed={(recipe) => {
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
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('recipes:searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-tutorial="search-recipes"
            />
          </div>
          <div className="relative w-full md:w-64">
            <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="number"
              placeholder={t('recipes:maxTime')}
              value={maxTimeMinutes}
              onChange={(e) => setMaxTimeMinutes(e.target.value)}
              className="pl-10"
              min="0"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Folders */}
            <Card data-tutorial="filter-folder">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">{t('recipes:folders')}</h3>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingFolder(null);
                        setFolderName('');
                        setFolderDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => setSelectedFolder(null)}
                    className={`w-full text-left px-3 py-2 text-sm rounded transition-minimal ${
                      !selectedFolder ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'
                    }`}
                  >
                    {t('recipes:allRecipes')}
                  </button>
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      className={`flex items-center justify-between px-3 py-2 text-sm rounded transition-minimal ${
                        selectedFolder === folder.id ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'
                      }`}
                    >
                      <button
                        onClick={() => setSelectedFolder(folder.id)}
                        className="flex-1 text-left"
                      >
                        {folder.name}
                      </button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setFolderToDelete(folder);
                            setDeleteDialogOpen(true);
                          }}
                          className="h-6 w-6 p-0"
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Tags */}
            <Card data-tutorial="filter-tags">
              <CardContent className="p-4">
                <h3 className="font-medium mb-4">{t('common:tags')}</h3>
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                      placeholder={t('recipes:filterTags')}
                      value={tagSearchTerm}
                      onChange={(e) => setTagSearchTerm(e.target.value)}
                      className="pl-7 h-8 text-sm"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tags
                      .filter(tag => tag.name.toLowerCase().includes(tagSearchTerm.toLowerCase()))
                      .map((tag) => (
                        <Badge
                          key={tag.id}
                          variant={selectedTag === tag.id ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => setSelectedTag(selectedTag === tag.id ? null : tag.id)}
                        >
                          {tag.name}
                        </Badge>
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recipe Grid */}
          <div className="lg:col-span-3 space-y-8">
            {/* Recipes You Can Make Now Section */}
            {recipesYouCanMakeNow.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <ChefHat className="h-5 w-5 text-primary" />
                  <h2 className="text-2xl font-semibold">{t('recipes:canMakeNow')}</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {recipesYouCanMakeNow.slice(0, 6).map((recipe) => (
                    <Link key={recipe.id} to={`/recipes/${recipe.id}`}>
                      <Card className="hover:shadow-md transition-minimal cursor-pointer h-full border-primary/50">
                        <CardContent className="p-0">
                          {recipe.image_url && (
                            <img
                              src={proxiedImage(recipe.image_url)}
                              alt={recipe.title}
                              className="w-full h-48 object-cover rounded-t"
                            />
                          )}
                          <div className="p-4 space-y-2">
                            <h3 className="font-medium line-clamp-1">{recipe.title}</h3>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {(recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)}m
                              </div>
                            </div>
                            {recipe.tags && recipe.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {recipe.tags.map((tag) => (
                                  <Badge key={tag.id} variant="secondary" className="text-xs">
                                    {tag.name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* All Recipes Section */}
            <div>
              <h2 className="text-2xl font-semibold mb-4">{t('recipes:allRecipes')}</h2>
              {filteredRecipes.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <p className="text-muted-foreground">{t('recipes:noRecipesFound')}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredRecipes.map((recipe, index) => (
                    <Link key={recipe.id} to={`/recipes/${recipe.id}`}>
                      <Card className="hover:shadow-md transition-minimal cursor-pointer h-full" data-tutorial={index === 0 ? "recipe-card" : undefined}>
                        <CardContent className="p-0">
                          {recipe.image_url && (
                            <img
                              src={proxiedImage(recipe.image_url)}
                              alt={recipe.title}
                              className="w-full h-48 object-cover rounded-t"
                            />
                          )}
                          <div className="p-4 space-y-2">
                            <h3 className="font-medium line-clamp-1">{recipe.title}</h3>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {(recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)}m
                              </div>
                            </div>
                            {recipe.tags && recipe.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {recipe.tags.map((tag) => (
                                  <Badge key={tag.id} variant="secondary" className="text-xs">
                                    {tag.name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Folder Dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFolder ? t('recipes:editFolder') : t('recipes:newFolder')}</DialogTitle>
            <DialogDescription>
              {editingFolder ? t('recipes:updateFolderName') : t('recipes:createFolderDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">{t('recipes:folderName')}</Label>
              <Input
                id="folder-name"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder={t('recipes:enterFolderName')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>
              {t('common:cancel')}
            </Button>
            <Button onClick={handleCreateFolder}>
              {editingFolder ? t('common:update') : t('common:create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Folder Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('recipes:deleteFolder')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('recipes:deleteFolderConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFolder}>{t('common:delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
