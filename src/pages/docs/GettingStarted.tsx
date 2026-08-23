import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function GettingStarted() {
  const { t } = useTranslation('docs');
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-4">{t('gettingStarted.title')}</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          {t('gettingStarted.subtitle')}
        </p>
      </div>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('gettingStarted.whatIsKitchen.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('gettingStarted.whatIsKitchen.description')}
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li>{t('gettingStarted.whatIsKitchen.familyKitchen')}</li>
          <li>{t('gettingStarted.whatIsKitchen.personalKitchen')}</li>
          <li>{t('gettingStarted.whatIsKitchen.teamKitchen')}</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('gettingStarted.steps.title')}</h2>
        
        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('gettingStarted.steps.step1.title')}</CardTitle>
              <CardDescription>
                {t('gettingStarted.steps.step1.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-2">
                {(t('gettingStarted.steps.step1.items', { returnObjects: true }) as string[]).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ol>
              <Alert className="border-border bg-muted/30">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {t('gettingStarted.steps.step1.alert')}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('gettingStarted.steps.step2.title')}</CardTitle>
              <CardDescription>
                {t('gettingStarted.steps.step2.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-2">
                {(t('gettingStarted.steps.step2.items', { returnObjects: true }) as string[]).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('gettingStarted.steps.step3.title')}</CardTitle>
              <CardDescription>
                {t('gettingStarted.steps.step3.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-2">
                {(t('gettingStarted.steps.step3.items', { returnObjects: true }) as string[]).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('gettingStarted.navigation.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('gettingStarted.navigation.description')}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">{t('gettingStarted.navigation.recipes.title')}</CardTitle>
              <CardDescription className="text-sm">
                {t('gettingStarted.navigation.recipes.description')}
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">{t('gettingStarted.navigation.calendar.title')}</CardTitle>
              <CardDescription className="text-sm">
                {t('gettingStarted.navigation.calendar.description')}
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">{t('gettingStarted.navigation.shoppingList.title')}</CardTitle>
              <CardDescription className="text-sm">
                {t('gettingStarted.navigation.shoppingList.description')}
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">{t('gettingStarted.navigation.pantry.title')}</CardTitle>
              <CardDescription className="text-sm">
                {t('gettingStarted.navigation.pantry.description')}
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">{t('gettingStarted.navigation.equipment.title')}</CardTitle>
              <CardDescription className="text-sm">
                {t('gettingStarted.navigation.equipment.description')}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('gettingStarted.nextSteps.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('gettingStarted.nextSteps.description')}
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          {(t('gettingStarted.nextSteps.items', { returnObjects: true }) as string[]).map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
