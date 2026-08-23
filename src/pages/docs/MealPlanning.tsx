import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function MealPlanning() {
  const { t } = useTranslation('docs');
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-4">{t('mealPlanning.title')}</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          {t('mealPlanning.subtitle')}
        </p>
      </div>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('mealPlanning.calendarView.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('mealPlanning.calendarView.description')}
        </p>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('mealPlanning.calendarView.viewModesTitle')}</CardTitle>
            <CardDescription>{t('mealPlanning.calendarView.viewModesDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-foreground mb-2">{t('mealPlanning.calendarView.days7.title')}</h4>
                <p className="text-sm text-muted-foreground ml-2">
                  {t('mealPlanning.calendarView.days7.description')}
                </p>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">{t('mealPlanning.calendarView.days14.title')}</h4>
                <p className="text-sm text-muted-foreground ml-2">
                  {t('mealPlanning.calendarView.days14.description')}
                </p>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">{t('mealPlanning.calendarView.days30.title')}</h4>
                <p className="text-sm text-muted-foreground ml-2">
                  {t('mealPlanning.calendarView.days30.description')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('mealPlanning.calendarView.costTracking.title')}</CardTitle>
            <CardDescription>{t('mealPlanning.calendarView.costTracking.description')}</CardDescription>
          </CardHeader>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('mealPlanning.addingMeals.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('mealPlanning.addingMeals.description')}
        </p>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('mealPlanning.addingMeals.stepsTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-3 text-muted-foreground ml-2">
              {(t('mealPlanning.addingMeals.steps', { returnObjects: true }) as Array<{title: string; description: string}>).map((step, index) => (
                <li key={index}>
                  <span className="font-medium text-foreground">{step.title}</span>
                  <p className="ml-6 mt-1 text-sm">{step.description}</p>
                </li>
              ))}
            </ol>
            <Alert className="border-border bg-muted/30">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {t('mealPlanning.addingMeals.alert')}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('mealPlanning.addingMeals.unscheduledRecipes.title')}</CardTitle>
            <CardDescription>{t('mealPlanning.addingMeals.unscheduledRecipes.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('mealPlanning.addingMeals.unscheduledRecipes.content')}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('mealPlanning.managingPlans.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('mealPlanning.managingPlans.description')}
        </p>

        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('mealPlanning.managingPlans.edit.title')}</CardTitle>
              <CardDescription>{t('mealPlanning.managingPlans.edit.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('mealPlanning.managingPlans.edit.steps', { returnObjects: true }) as string[]).map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('mealPlanning.managingPlans.delete.title')}</CardTitle>
              <CardDescription>{t('mealPlanning.managingPlans.delete.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('mealPlanning.managingPlans.delete.content')}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('mealPlanning.shoppingIntegration.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('mealPlanning.shoppingIntegration.description')}
        </p>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('mealPlanning.shoppingIntegration.generateTitle')}</CardTitle>
            <CardDescription>{t('mealPlanning.shoppingIntegration.generateDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-3 text-muted-foreground ml-2">
              {(t('mealPlanning.shoppingIntegration.steps', { returnObjects: true }) as Array<{title: string; description: string}>).map((step, index) => (
                <li key={index}>
                  <span className="font-medium text-foreground">{step.title}</span>
                  <p className="ml-6 mt-1 text-sm">{step.description}</p>
                </li>
              ))}
            </ol>
            <Alert className="border-border bg-muted/30">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {t('mealPlanning.shoppingIntegration.alert')}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('mealPlanning.bestPractices.title')}</h2>
        <Card className="border-border">
          <CardContent className="pt-6">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-2">
              {(t('mealPlanning.bestPractices.items', { returnObjects: true }) as string[]).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
