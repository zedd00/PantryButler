import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function PantryEquipment() {
  const { t } = useTranslation('docs');
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-4">{t('pantryEquipment.title')}</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          {t('pantryEquipment.subtitle')}
        </p>
      </div>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('pantryEquipment.pantryManagement.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('pantryEquipment.pantryManagement.description')}
        </p>

        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('pantryEquipment.pantryManagement.addIngredients.title')}</CardTitle>
              <CardDescription>{t('pantryEquipment.pantryManagement.addIngredients.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal list-inside space-y-3 text-muted-foreground ml-2">
                {(t('pantryEquipment.pantryManagement.addIngredients.steps', { returnObjects: true }) as Array<{title: string; description: string}>).map((step, index) => (
                  <li key={index}>
                    <span className="font-medium text-foreground">{step.title}</span>
                    <p className="ml-6 mt-1 text-sm">{step.description}</p>
                  </li>
                ))}
              </ol>
              <Alert className="border-border bg-muted/30">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {t('pantryEquipment.pantryManagement.addIngredients.alert')}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('pantryEquipment.pantryManagement.viewInventory.title')}</CardTitle>
              <CardDescription>{t('pantryEquipment.pantryManagement.viewInventory.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground mb-3">
                {t('pantryEquipment.pantryManagement.viewInventory.intro')}
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('pantryEquipment.pantryManagement.viewInventory.methods', { returnObjects: true }) as Array<{label: string; description: string}>).map((method, index) => (
                  <li key={index}><span className="font-medium text-foreground">{method.label}</span>: {method.description}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('pantryEquipment.pantryManagement.ingredientFeatures.title')}</CardTitle>
              <CardDescription>{t('pantryEquipment.pantryManagement.ingredientFeatures.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('pantryEquipment.pantryManagement.ingredientFeatures.features', { returnObjects: true }) as string[]).map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('pantryEquipment.pantryManagement.updateInventory.title')}</CardTitle>
              <CardDescription>{t('pantryEquipment.pantryManagement.updateInventory.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-foreground mb-2">{t('pantryEquipment.pantryManagement.updateInventory.manual.title')}</h4>
                  <p className="text-sm text-muted-foreground ml-2">
                    {t('pantryEquipment.pantryManagement.updateInventory.manual.description')}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">{t('pantryEquipment.pantryManagement.updateInventory.auto.title')}</h4>
                  <p className="text-sm text-muted-foreground ml-2">
                    {t('pantryEquipment.pantryManagement.updateInventory.auto.description')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('pantryEquipment.pantryManagement.costTracking.title')}</CardTitle>
              <CardDescription>{t('pantryEquipment.pantryManagement.costTracking.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground mb-3">
                {t('pantryEquipment.pantryManagement.costTracking.content')}
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('pantryEquipment.pantryManagement.costTracking.fields', { returnObjects: true }) as Array<{label: string; description: string}>).map((field, index) => (
                  <li key={index}><span className="font-medium text-foreground">{field.label}</span>: {field.description}</li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground mt-3">
                {t('pantryEquipment.pantryManagement.costTracking.unitPrice')}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('pantryEquipment.equipmentManagement.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('pantryEquipment.equipmentManagement.description')}
        </p>

        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('pantryEquipment.equipmentManagement.addEquipment.title')}</CardTitle>
              <CardDescription>{t('pantryEquipment.equipmentManagement.addEquipment.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal list-inside space-y-3 text-muted-foreground ml-2">
                {(t('pantryEquipment.equipmentManagement.addEquipment.steps', { returnObjects: true }) as Array<{title: string; description: string}>).map((step, index) => (
                  <li key={index}>
                    <span className="font-medium text-foreground">{step.title}</span>
                    <p className="ml-6 mt-1 text-sm">{step.description}</p>
                  </li>
                ))}
              </ol>
              <Alert className="border-border bg-muted/30">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {t('pantryEquipment.equipmentManagement.addEquipment.alert')}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('pantryEquipment.equipmentManagement.recipeAssociation.title')}</CardTitle>
              <CardDescription>{t('pantryEquipment.equipmentManagement.recipeAssociation.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground mb-3">
                {t('pantryEquipment.equipmentManagement.recipeAssociation.intro')}
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('pantryEquipment.equipmentManagement.recipeAssociation.features', { returnObjects: true }) as string[]).map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('pantryEquipment.equipmentManagement.maintenance.title')}</CardTitle>
              <CardDescription>{t('pantryEquipment.equipmentManagement.maintenance.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('pantryEquipment.equipmentManagement.maintenance.content')}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('pantryEquipment.integration.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('pantryEquipment.integration.description')}
        </p>

        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('pantryEquipment.integration.shoppingList.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('pantryEquipment.integration.shoppingList.features', { returnObjects: true }) as string[]).map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('pantryEquipment.integration.recipeRecommendations.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('pantryEquipment.integration.recipeRecommendations.features', { returnObjects: true }) as string[]).map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('pantryEquipment.integration.mealPlanning.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('pantryEquipment.integration.mealPlanning.features', { returnObjects: true }) as string[]).map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('pantryEquipment.kitchenLayout.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('pantryEquipment.kitchenLayout.description')}
        </p>

        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('pantryEquipment.kitchenLayout.createLayout.title')}</CardTitle>
              <CardDescription>{t('pantryEquipment.kitchenLayout.createLayout.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal list-inside space-y-3 text-muted-foreground ml-2">
                {(t('pantryEquipment.kitchenLayout.createLayout.steps', { returnObjects: true }) as Array<{title: string; description: string}>).map((step, index) => (
                  <li key={index}>
                    <span className="font-medium text-foreground">{step.title}</span>
                    <p className="ml-6 mt-1 text-sm">{step.description}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('pantryEquipment.kitchenLayout.addElements.title')}</CardTitle>
              <CardDescription>{t('pantryEquipment.kitchenLayout.addElements.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('pantryEquipment.kitchenLayout.addElements.items', { returnObjects: true }) as string[]).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('pantryEquipment.kitchenLayout.organizeItems.title')}</CardTitle>
              <CardDescription>{t('pantryEquipment.kitchenLayout.organizeItems.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal list-inside space-y-3 text-muted-foreground ml-2">
                {(t('pantryEquipment.kitchenLayout.organizeItems.steps', { returnObjects: true }) as Array<{title: string; description: string}>).map((step, index) => (
                  <li key={index}>
                    <span className="font-medium text-foreground">{step.title}</span>
                    <p className="ml-6 mt-1 text-sm">{step.description}</p>
                  </li>
                ))}
              </ol>
              <Alert className="border-border bg-muted/30">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {t('pantryEquipment.kitchenLayout.organizeItems.alert')}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('pantryEquipment.kitchenLayout.features.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('pantryEquipment.kitchenLayout.features.items', { returnObjects: true }) as string[]).map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('pantryEquipment.bestPractices.title')}</h2>
        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-foreground mb-2">{t('pantryEquipment.bestPractices.pantry.title')}</h4>
                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                  {(t('pantryEquipment.bestPractices.pantry.items', { returnObjects: true }) as string[]).map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">{t('pantryEquipment.bestPractices.equipment.title')}</h4>
                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                  {(t('pantryEquipment.bestPractices.equipment.items', { returnObjects: true }) as string[]).map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
