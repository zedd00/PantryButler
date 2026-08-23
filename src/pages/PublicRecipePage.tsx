import { useState, useEffect, Fragment } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Clock, Users, ChefHat, Check, Loader2, UserPlus, LogIn, Info, Download } from 'lucide-react';
import { getPublicRecipe, getSettings, getAllRecipes } from '@/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { StepTimer } from '@/components/recipe/StepTimer';
import { formatInstanceName } from '@/lib/format';
import { downloadCooklangFile } from '@/lib/cooklang-exporter';
import PageMeta from '@/components/common/PageMeta';
import { calculateRecipeNutrition, type RecipeNutrition } from '@/api/nutrition-calculator';
import NutritionLabel from '@/components/recipe/NutritionLabel';
import { proxiedImage } from '@/api/images';

export default function PublicRecipePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { t } = useTranslation('recipes');

  const [recipe, setRecipe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [nutritionData, setNutritionData] = useState<RecipeNutrition | null>(null);
  const [loadingNutrition, setLoadingNutrition] = useState(false);

  useEffect(() => {
    loadRecipe();
    loadSettings();
  }, [slug]);

  useEffect(() => {
    if (recipe && settings?.nutrition_enabled) {
      loadNutritionData(recipe.ingredients, recipe.servings);
    }
  }, [recipe, settings]);

  useEffect(() => {
    if (!user || !recipe?.id) return;
    let cancelled = false;
    getAllRecipes()
      .then((recipes) => {
        if (!cancelled) {
          setSaved(recipes.some((r) => r.imported_from_recipe_id === recipe.id));
        }
      })
      .catch(() => {
        // No instance selected or fetch failed — treat as not saved
      });
    return () => {
      cancelled = true;
    };
  }, [user, recipe?.id]);

  const loadSettings = async () => {
    try {
      const data = await getSettings();
      setSettings(data);
    } catch (err) {
      console.error('Error loading settings:', err);
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

  const loadRecipe = async () => {
    if (!slug) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getPublicRecipe(slug);

      if (data.error) {
        setError(data.error);
      } else {
        const recipeData = data.recipe || data;
        if (recipeData && recipeData.title) {
          setRecipe(recipeData);
        } else {
          setError('notFound');
        }
      }
    } catch (err: any) {
      console.error('Error loading public recipe:', err);
      setError('notFound');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToKitchen = async () => {
    if (!user || !profile || !recipe) return;

    setSaving(true);

    try {
      // Navigate to import review page with recipe data
      navigate('/import-review', {
        state: {
          importData: {
            recipe: {
              title: recipe.title,
              description: recipe.description,
              image_url: recipe.image_url,
              servings: recipe.servings || 1,
              prep_time_minutes: recipe.prep_time_minutes,
              cook_time_minutes: recipe.cook_time_minutes,
              notes: recipe.notes,
              imported_from_recipe_id: recipe.id,
            },
            ingredients: recipe.ingredients || [],
            equipment: recipe.equipment || [],
            sections: recipe.sections || [],
            tags: recipe.tags || []
          }
        }
      });
    } catch (error: any) {
      console.error('Error preparing import:', error);
      toast.error(error.message || 'Failed to prepare import');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadCook = () => {
    if (!recipe) return;
    try {
      downloadCooklangFile(recipe);
      toast.success(t('recipeDetail.exportedAsCook'));
    } catch (error: any) {
      console.error('Error exporting recipe to .cook:', error);
      toast.error(error.message || 'Failed to export recipe');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="text-4xl">🍳</div>
            <h2 className="text-2xl font-semibold">{t('public.notFound')}</h2>
            <p className="text-muted-foreground">
              This recipe may have been removed or is no longer publicly available.
            </p>
            <Button onClick={() => navigate('/')}>
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0) + (recipe.wait_time_minutes || 0);

  // Prepare meta description
  const metaDescription = recipe.description 
    ? recipe.description.slice(0, 160) 
    : `${recipe.title} - A delicious recipe shared on PantryButler. ${recipe.servings ? `Serves ${recipe.servings}.` : ''} ${totalTime > 0 ? `Total time: ${totalTime} minutes.` : ''}`.slice(0, 160);

  return (
    <div className="min-h-screen bg-background">
      <PageMeta
        title={recipe.title}
        description={metaDescription}
        image={recipe.image_url}
        type="article"
      />
      
      {/* CTA Banner for Unauthenticated Users */}
      {!user && (
        <div className="bg-primary text-primary-foreground py-4 px-4 md:px-6">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-center md:text-left font-medium">
              {t('public.signUpCta')}
            </p>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/setup-kitchen')}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                {t('public.signUpButton')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/login')}
                className="border border-primary-foreground/60 text-primary-foreground hover:bg-primary-foreground/10"
              >
                <LogIn className="h-4 w-4 mr-2" />
                {t('public.logInLink')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
        {/* Recipe Header */}
        <div className="space-y-4">
          {recipe.image_url && (
            <div className="aspect-video w-full overflow-hidden rounded-lg">
              <img
                src={proxiedImage(recipe.image_url)}
                alt={recipe.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-balance">{recipe.title}</h1>
            
            {recipe.instance_name && (
              <p className="text-muted-foreground">
                {t('public.sharedBy')} <span className="font-medium">{formatInstanceName(recipe.instance_name)}</span>
              </p>
            )}

            {recipe.description && (
              <p className="text-lg text-muted-foreground text-pretty">
                {recipe.description}
              </p>
            )}
          </div>

          {/* Recipe Meta */}
          <div className="flex flex-wrap gap-4 text-sm">
            {recipe.prep_time_minutes && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{t('publicRecipePage.prep', { x: recipe.prep_time_minutes })}</span>
              </div>
            )}
            {recipe.cook_time_minutes && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{t('publicRecipePage.cook', { x: recipe.cook_time_minutes })}</span>
              </div>
            )}
            {totalTime > 0 && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{t('publicRecipePage.total', { x: totalTime })}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{recipe.servings} {t('servings')}</span>
            </div>
            {recipe.equipment && recipe.equipment.length > 0 && (
              <div className="flex items-center gap-2">
                <ChefHat className="h-4 w-4 text-muted-foreground" />
                <span>{recipe.equipment.length} {t('equipment')}</span>
              </div>
            )}
          </div>

          {/* Tags */}
          {recipe.tags && recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {recipe.tags.map((tag: any, idx: number) => (
                <Badge key={idx} variant="secondary">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            {user && !saved && (
              <Button
                onClick={handleSaveToKitchen}
                disabled={saving}
                size="lg"
                className="w-full md:w-auto"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('public.savingRecipe')}
                  </>
                ) : (
                  t('public.saveToKitchen')
                )}
              </Button>
            )}

            {saved && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Check className="h-5 w-5" />
                <span className="font-medium">{t('public.saved')}</span>
              </div>
            )}

            {/* Save to .cook Button */}
            <Button
              variant="outline"
              size="lg"
              onClick={handleDownloadCook}
              className="w-full md:w-auto"
            >
              <Download className="mr-2 h-4 w-4" />
              {t('recipeDetail.exportCook')}
            </Button>
          </div>
        </div>

        <Separator />

        {/* Ingredients */}
        {recipe.ingredients && recipe.ingredients.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('ingredients')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full">
                <table className="w-full">
                  <tbody>
                    {recipe.ingredients.map((ing: any, index: number) => {
                      const groupName = (() => {
                        const group = recipe.ingredients[index]?.group_name;
                        if (!group) return null;
                        return recipe.ingredients[index - 1]?.group_name === group ? null : group;
                      })();
                      return (
                        <Fragment key={ing.id}>
                          {groupName && (
                            <tr>
                              <td colSpan={3} className="pt-4 pb-1">
                                <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                  {groupName}
                                </span>
                              </td>
                            </tr>
                          )}
                          <tr className="border-b border-border/50 last:border-0">
                        <td className="py-3 pr-4 align-top">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{ing.name}</span>
                            {ing.preparation && (
                              <span className="text-sm text-muted-foreground">({ing.preparation})</span>
                            )}
                            {ing.is_optional && (
                              <span className="text-xs text-muted-foreground italic">(optional)</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 align-top">
                          {ing.quantity > 0 && (
                            <span>{ing.quantity} {ing.unit}</span>
                          )}
                        </td>
                        <td className="py-3 pl-4 align-top">
                          {ing.location && (
                            <Badge variant="outline" className="text-xs">
                              📍 {ing.location}
                            </Badge>
                          )}
                        </td>
                      </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t('ingredients')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">{t('publicRecipePage.noIngredients')}</p>
            </CardContent>
          </Card>
        )}

        {/* Equipment */}
        {recipe.equipment && recipe.equipment.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-2">
                {recipe.equipment.map((eq: any, idx: number) => (
                  <div key={idx} className="flex items-center">
                    <span>{eq.equipment_name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        {recipe.sections && recipe.sections.map((section: any) => (
          <Card key={section.id}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-6">
                {section.steps && section.steps.map((step: any) => (
                  <li key={step.id} className="flex gap-4">
                    <span className="font-semibold text-muted-foreground shrink-0">
                      {step.order_index + 1}.
                    </span>
                    <div className="space-y-2 flex-1 min-w-0">
                      <p className="text-pretty whitespace-pre-wrap">{step.instruction}</p>
                      {step.image_url && (
                        <div className="aspect-video w-full max-w-md overflow-hidden rounded-lg">
                          <img
                            src={proxiedImage(step.image_url)}
                            alt={`Step ${step.order_index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      {step.timer_minutes && step.timer_minutes > 0 && (
                        <div className="mt-2">
                          <StepTimer 
                            minutes={step.timer_minutes} 
                            stepNumber={step.order_index + 1}
                            variant="button"
                          />
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ))}

        {/* Notes */}
        {recipe.notes && (
          <Card>
            <CardHeader>
              <CardTitle>{t('notes')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-pretty whitespace-pre-wrap">{recipe.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Nutrition Information - Only shown if enabled in settings */}
        {settings?.nutrition_enabled && (
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Nutrition Information
                <Info className="h-4 w-4 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingNutrition ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : nutritionData ? (
                <div className="space-y-4">
                  {nutritionData.matched_count < nutritionData.total_count && (
                    <p className="text-sm text-muted-foreground">
                      {nutritionData.matched_count} of {nutritionData.total_count} ingredients matched. Some nutrition data may be incomplete.
                    </p>
                  )}
                  <NutritionLabel
                    nutrition={{
                      servings: recipe.servings,
                      ...nutritionData.per_serving,
                    }}
                    className="bg-background"
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-pretty">
                  Nutrition data is currently being calculated. This feature requires ingredient matching with the nutrition database.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Bottom CTA for Unauthenticated Users */}
        {!user && (
          <Card className="bg-muted">
            <CardContent className="pt-6 text-center space-y-4">
              <h3 className="text-xl font-semibold">{t('public.signUpCta')}</h3>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button onClick={() => navigate('/login?mode=signup')}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t('public.signUpButton')}
                </Button>
                <Button variant="outline" onClick={() => navigate('/login')}>
                  <LogIn className="h-4 w-4 mr-2" />
                  {t('public.logInLink')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t bg-card px-4 py-6 mt-12">
        <div className="container mx-auto max-w-4xl">
          <div className="flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
            <p>{t('publicRecipePage.copyright')}</p>
            <nav aria-label={t('publicRecipePage.footerNavigation')}>
              <div className="flex gap-4">
                <Link to="/privacy" className="hover:text-foreground transition-colors">
                  {t('publicRecipePage.privacyPolicy')}
                </Link>
                <Link to="/attribution" className="hover:text-foreground transition-colors">
                  {t('publicRecipePage.attribution')}
                </Link>
              </div>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
