import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function GroceryLists() {
  const { t } = useTranslation('docs');
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-4">{t('groceryLists.title')}</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          {t('groceryLists.subtitle')}
        </p>
      </div>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('groceryLists.creating.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('groceryLists.creating.description')}
        </p>

        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('groceryLists.creating.fromMealPlan.title')}</CardTitle>
              <CardDescription>{t('groceryLists.creating.fromMealPlan.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal list-inside space-y-3 text-muted-foreground ml-2">
                {(t('groceryLists.creating.fromMealPlan.steps', { returnObjects: true }) as Array<{title: string; description: string}>).map((step, index) => (
                  <li key={index}>
                    <span className="font-medium text-foreground">{step.title}</span>
                    <p className="ml-6 mt-1 text-sm">{step.description}</p>
                  </li>
                ))}
              </ol>
              <Alert className="border-border bg-muted/30">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {t('groceryLists.creating.fromMealPlan.alert')}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('groceryLists.creating.fromRecipe.title')}</CardTitle>
              <CardDescription>{t('groceryLists.creating.fromRecipe.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('groceryLists.creating.fromRecipe.steps', { returnObjects: true }) as string[]).map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('groceryLists.creating.manual.title')}</CardTitle>
              <CardDescription>{t('groceryLists.creating.manual.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('groceryLists.creating.manual.content')}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('groceryLists.managing.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('groceryLists.managing.description')}
        </p>

        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('groceryLists.managing.view.title')}</CardTitle>
              <CardDescription>{t('groceryLists.managing.view.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground mb-3">
                {t('groceryLists.managing.view.intro')}
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('groceryLists.managing.view.categories', { returnObjects: true }) as string[]).map((category, index) => (
                  <li key={index}>{category}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('groceryLists.managing.markPurchased.title')}</CardTitle>
              <CardDescription>{t('groceryLists.managing.markPurchased.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('groceryLists.managing.markPurchased.content')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('groceryLists.managing.edit.title')}</CardTitle>
              <CardDescription>{t('groceryLists.managing.edit.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('groceryLists.managing.edit.actions', { returnObjects: true }) as string[]).map((action, index) => (
                  <li key={index}>{action}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('groceryLists.managing.addCustom.title')}</CardTitle>
              <CardDescription>{t('groceryLists.managing.addCustom.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('groceryLists.managing.addCustom.content')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('groceryLists.managing.delete.title')}</CardTitle>
              <CardDescription>{t('groceryLists.managing.delete.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('groceryLists.managing.delete.content')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('groceryLists.managing.costTracking.title')}</CardTitle>
              <CardDescription>{t('groceryLists.managing.costTracking.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('groceryLists.managing.costTracking.content')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('groceryLists.managing.costTracking.purchasePrice')}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('groceryLists.history.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('groceryLists.history.description')}
        </p>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('groceryLists.history.recordsTitle')}</CardTitle>
            <CardDescription>{t('groceryLists.history.recordsDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground mb-3">
              {t('groceryLists.history.intro')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
              {(t('groceryLists.history.actions', { returnObjects: true }) as string[]).map((action, index) => (
                <li key={index}>{action}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('groceryLists.sharing.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('groceryLists.sharing.description')}
        </p>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('groceryLists.sharing.syncTitle')}</CardTitle>
            <CardDescription>{t('groceryLists.sharing.syncDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground mb-3">
              {t('groceryLists.sharing.intro')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
              {(t('groceryLists.sharing.features', { returnObjects: true }) as string[]).map((feature, index) => (
                <li key={index}>{feature}</li>
              ))}
            </ul>
            <Alert className="border-border bg-muted/30 mt-4">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {t('groceryLists.sharing.alert')}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('groceryLists.smartFeatures.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('groceryLists.smartFeatures.description')}
        </p>

        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('groceryLists.smartFeatures.unitConversion.title')}</CardTitle>
              <CardDescription>{t('groceryLists.smartFeatures.unitConversion.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('groceryLists.smartFeatures.unitConversion.content')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('groceryLists.smartFeatures.inventoryIntegration.title')}</CardTitle>
              <CardDescription>{t('groceryLists.smartFeatures.inventoryIntegration.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('groceryLists.smartFeatures.inventoryIntegration.content')}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('groceryLists.bestPractices.title')}</h2>
        <Card className="border-border">
          <CardContent className="pt-6">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-2">
              {(t('groceryLists.bestPractices.items', { returnObjects: true }) as string[]).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
