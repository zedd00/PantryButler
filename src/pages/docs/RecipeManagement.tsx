import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function RecipeManagement() {
  const { t } = useTranslation('docs');
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-4">{t('recipeManagement.title')}</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          {t('recipeManagement.subtitle')}
        </p>
      </div>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('recipeManagement.creating.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('recipeManagement.creating.description')}
        </p>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('recipeManagement.creating.basicInfo.title')}</CardTitle>
            <CardDescription>{t('recipeManagement.creating.basicInfo.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-foreground mb-2">{t('recipeManagement.creating.basicInfo.required.title')}</h4>
                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                  {(t('recipeManagement.creating.basicInfo.required.fields', { returnObjects: true }) as Array<{label: string; description: string}>).map((field, index) => (
                    <li key={index}><span className="font-medium text-foreground">{field.label}</span>: {field.description}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">{t('recipeManagement.creating.basicInfo.optional.title')}</h4>
                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                  {(t('recipeManagement.creating.basicInfo.optional.fields', { returnObjects: true }) as Array<{label: string; description: string}>).map((field, index) => (
                    <li key={index}><span className="font-medium text-foreground">{field.label}</span>: {field.description}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('recipeManagement.creating.ingredientList.title')}</CardTitle>
            <CardDescription>{t('recipeManagement.creating.ingredientList.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-3 text-muted-foreground ml-2">
              {(t('recipeManagement.creating.ingredientList.steps', { returnObjects: true }) as Array<{title: string; description: string}>).map((step, index) => (
                <li key={index}>
                  <span className="font-medium text-foreground">{step.title}</span>
                  <p className="ml-6 mt-1 text-sm">{step.description}</p>
                </li>
              ))}
            </ol>
            <Alert className="border-border bg-muted/30">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {t('recipeManagement.creating.ingredientList.alert')}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('recipeManagement.creating.cookingSteps.title')}</CardTitle>
            <CardDescription>{t('recipeManagement.creating.cookingSteps.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('recipeManagement.creating.cookingSteps.intro')}
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('recipeManagement.creating.cookingSteps.features', { returnObjects: true }) as string[]).slice(0, 4).map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
                <li><span className="font-medium text-foreground">{(t('recipeManagement.creating.cookingSteps.features', { returnObjects: true }) as string[])[4]}</span></li>
              </ul>
            </div>
            <Alert className="border-border bg-muted/30">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {t('recipeManagement.creating.cookingSteps.alert')}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('recipeManagement.creating.stepImages.title')}</CardTitle>
            <CardDescription>{t('recipeManagement.creating.stepImages.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('recipeManagement.creating.stepImages.intro')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
              {(t('recipeManagement.creating.stepImages.features', { returnObjects: true }) as string[]).map((feature, index) => (
                <li key={index}>{feature}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('recipeManagement.creating.equipment.title')}</CardTitle>
            <CardDescription>{t('recipeManagement.creating.equipment.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('recipeManagement.creating.equipment.content')}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('recipeManagement.organizing.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('recipeManagement.organizing.description')}
        </p>

        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('recipeManagement.organizing.folders.title')}</CardTitle>
              <CardDescription>{t('recipeManagement.organizing.folders.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('recipeManagement.organizing.folders.features', { returnObjects: true }) as string[]).map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('recipeManagement.organizing.tags.title')}</CardTitle>
              <CardDescription>{t('recipeManagement.organizing.tags.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t('recipeManagement.organizing.tags.intro')}
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                  {(t('recipeManagement.organizing.tags.categories', { returnObjects: true }) as string[]).map((category, index) => (
                    <li key={index}>{category}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('recipeManagement.organizing.search.title')}</CardTitle>
              <CardDescription>{t('recipeManagement.organizing.search.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('recipeManagement.organizing.search.features', { returnObjects: true }) as string[]).map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('recipeManagement.organizing.cookable.title')}</CardTitle>
              <CardDescription>{t('recipeManagement.organizing.cookable.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('recipeManagement.organizing.cookable.content')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('recipeManagement.organizing.gridRecipes.title')}</CardTitle>
              <CardDescription>{t('recipeManagement.organizing.gridRecipes.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('recipeManagement.organizing.gridRecipes.content')}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('recipeManagement.editing.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('recipeManagement.editing.description')}
        </p>

        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('recipeManagement.editing.edit.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('recipeManagement.editing.edit.steps', { returnObjects: true }) as string[]).map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
              <Alert className="border-border bg-muted/30">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {t('recipeManagement.editing.edit.alert')}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('recipeManagement.editing.delete.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('recipeManagement.editing.delete.content')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('recipeManagement.editing.costTracking.title')}</CardTitle>
              <CardDescription>{t('recipeManagement.editing.costTracking.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('recipeManagement.editing.costTracking.content')}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('recipeManagement.viewing.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('recipeManagement.viewing.description')}
        </p>

        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('recipeManagement.viewing.servingsScaling.title')}</CardTitle>
              <CardDescription>{t('recipeManagement.viewing.servingsScaling.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('recipeManagement.viewing.servingsScaling.content')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('recipeManagement.viewing.unitDisplay.title')}</CardTitle>
              <CardDescription>{t('recipeManagement.viewing.unitDisplay.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('recipeManagement.viewing.unitDisplay.content')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('recipeManagement.viewing.conversions.title')}</CardTitle>
              <CardDescription>{t('recipeManagement.viewing.conversions.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('recipeManagement.viewing.conversions.content')}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('recipeManagement.importing.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('recipeManagement.importing.description')}
        </p>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('recipeManagement.importing.cooklang.title')}</CardTitle>
            <CardDescription>
              {t('recipeManagement.importing.cooklang.description')}{' '}
              <a 
                href="https://cooklang.org" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                Cooklang
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
              {(t('recipeManagement.importing.cooklang.steps', { returnObjects: true }) as string[]).map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
            <Alert className="border-border bg-muted/30">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {t('recipeManagement.importing.cooklang.alert')}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('recipeManagement.importing.url.title')}</CardTitle>
            <CardDescription>{t('recipeManagement.importing.url.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
              {(t('recipeManagement.importing.url.steps', { returnObjects: true }) as string[]).map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('recipeManagement.importing.public.title')}</CardTitle>
            <CardDescription>{t('recipeManagement.importing.public.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
              {(t('recipeManagement.importing.public.steps', { returnObjects: true }) as string[]).map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('recipeManagement.importing.review.title')}</CardTitle>
            <CardDescription>{t('recipeManagement.importing.review.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('recipeManagement.importing.review.content')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('recipeManagement.importing.export.title')}</CardTitle>
            <CardDescription>{t('recipeManagement.importing.export.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('recipeManagement.importing.export.content')}
            </p>
          </CardContent>
        </Card>

      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('recipeManagement.bestPractices.title')}</h2>
        <Card className="border-border">
          <CardContent className="pt-6">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-2">
              {(t('recipeManagement.bestPractices.items', { returnObjects: true }) as string[]).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
