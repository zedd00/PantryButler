import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink } from 'lucide-react';
import PageMeta from '@/components/common/PageMeta';
import { useTranslation } from 'react-i18next';

export default function Attribution() {
  const { t } = useTranslation(['legal', 'common']);

  return (
    <div className="min-h-screen bg-background">
      <PageMeta
        title={t('legal:attribution.metaTitle')}
        description={t('legal:attribution.metaDescription')}
      />
      
      <div className="container mx-auto px-4 py-8 md:py-12 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-balance">{t('legal:attribution.title')}</h1>
          <p className="text-lg text-muted-foreground text-pretty">
            {t('legal:attribution.intro')}
          </p>
        </div>

        <div className="space-y-6">
          {/* Cooklang */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Cooklang
                <a
                  href="https://cooklang.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80"
                  aria-label={t('legal:attribution.projects.cooklang.ariaLabel')}
                >
                  <ExternalLink className="h-5 w-5" />
                </a>
              </CardTitle>
              <CardDescription>{t('legal:attribution.projects.cooklang.tagline')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-pretty">
                {t('legal:attribution.projects.cooklang.description')}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>{t('legal:attribution.projects.cooklang.websiteLabel')}</strong>{' '}
                <a
                  href="https://cooklang.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  https://cooklang.org
                </a>
              </p>
            </CardContent>
          </Card>

          {/* Grid Recipe */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Grid Recipe
                <a
                  href="https://github.com/mossblaser/recipe_grid"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80"
                  aria-label={t('legal:attribution.projects.gridRecipe.ariaLabel')}
                >
                  <ExternalLink className="h-5 w-5" />
                </a>
              </CardTitle>
              <CardDescription>{t('legal:attribution.projects.gridRecipe.tagline')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-pretty">
                {t('legal:attribution.projects.gridRecipe.description')}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>{t('legal:attribution.projects.gridRecipe.sourceLabel')}</strong>{' '}
                <a
                  href="https://github.com/mossblaser/recipe_grid"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  https://github.com/mossblaser/recipe_grid
                </a>
              </p>
            </CardContent>
          </Card>

          {/* Open Food Facts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Open Food Facts
                <a
                  href="https://world.openfoodfacts.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80"
                  aria-label={t('legal:attribution.projects.openFoodFacts.ariaLabel')}
                >
                  <ExternalLink className="h-5 w-5" />
                </a>
              </CardTitle>
              <CardDescription>{t('legal:attribution.projects.openFoodFacts.tagline')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-pretty">
                {t('legal:attribution.projects.openFoodFacts.description')}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>{t('legal:attribution.projects.openFoodFacts.websiteLabel')}</strong>{' '}
                <a
                  href="https://world.openfoodfacts.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  https://world.openfoodfacts.org
                </a>
              </p>
              <p className="text-sm text-muted-foreground">
                {t('legal:attribution.projects.openFoodFacts.licenseLabel')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('legal:attribution.projects.openFoodFacts.attributionLabel')}
              </p>
            </CardContent>
          </Card>

          {/* Open Nutrition */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                OpenNutrition
                <a
                  href="https://www.opennutrition.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80"
                  aria-label={t('legal:attribution.projects.openNutrition.ariaLabel')}
                >
                  <ExternalLink className="h-5 w-5" />
                </a>
              </CardTitle>
              <CardDescription>{t('legal:attribution.projects.openNutrition.tagline')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-pretty">
                {t('legal:attribution.projects.openNutrition.description')}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>{t('legal:attribution.projects.openNutrition.websiteLabel')}</strong>{' '}
                <a
                  href="https://www.opennutrition.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  https://www.opennutrition.app
                </a>
              </p>
              <p className="text-sm text-muted-foreground">
                {t('legal:attribution.projects.openNutrition.licenseLabel')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('legal:attribution.projects.openNutrition.attributionLabel')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('legal:attribution.projects.openNutrition.requirementsLabel')}
              </p>
            </CardContent>
          </Card>

          {/* Additional Information */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle>{t('legal:attribution.licenseCompliance.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-pretty">
                {t('legal:attribution.licenseCompliance.description')}
              </p>
              <p className="text-pretty">
                {t('legal:attribution.licenseCompliance.contactNote')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Footer Navigation */}
        <div className="mt-12 pt-6 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            <a href="/" className="text-primary hover:underline">
              {t('legal:attribution.footer.home')}
            </a>
            {' • '}
            <a href="/privacy" className="text-primary hover:underline">
              {t('legal:attribution.footer.privacy')}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
