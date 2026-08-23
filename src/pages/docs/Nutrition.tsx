import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Nutrition() {
  const { t } = useTranslation('docs');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-4">{t('nutrition.title')}</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          {t('nutrition.subtitle')}
        </p>
      </div>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('nutrition.overview.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('nutrition.overview.description')}
        </p>
        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('nutrition.overview.what.title')}</CardTitle>
              <CardDescription>{t('nutrition.overview.what.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('nutrition.overview.what.features', { returnObjects: true }) as string[]).map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('nutrition.enabling.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('nutrition.enabling.description')}
        </p>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('nutrition.enabling.stepsTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
              {(t('nutrition.enabling.steps', { returnObjects: true }) as string[]).map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
            <Alert className="border-border bg-muted/30">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {t('nutrition.enabling.alert')}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('nutrition.matching.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('nutrition.matching.description')}
        </p>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('nutrition.matching.how.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
              {(t('nutrition.matching.how.steps', { returnObjects: true }) as Array<{title: string; description: string}>).map((step, index) => (
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
            <CardTitle className="text-lg">{t('nutrition.matching.custom.title')}</CardTitle>
            <CardDescription>{t('nutrition.matching.custom.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
              {(t('nutrition.matching.custom.fields', { returnObjects: true }) as Array<{label: string; description: string}>).map((field, index) => (
                <li key={index}><span className="font-medium text-foreground">{field.label}</span>: {field.description}</li>
              ))}
            </ul>
            <Alert className="border-border bg-muted/30">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {t('nutrition.matching.custom.alert')}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('nutrition.calculation.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('nutrition.calculation.description')}
        </p>
        <Card className="border-border">
          <CardContent className="pt-6">
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
              {(t('nutrition.calculation.items', { returnObjects: true }) as string[]).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('nutrition.nutritionFacts.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('nutrition.nutritionFacts.description')}
        </p>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('nutrition.nutritionFacts.label.title')}</CardTitle>
            <CardDescription>{t('nutrition.nutritionFacts.label.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
              {(t('nutrition.nutritionFacts.label.rows', { returnObjects: true }) as string[]).map((row, index) => (
                <li key={index}>{row}</li>
              ))}
            </ul>
            <Alert className="border-border bg-muted/30">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {t('nutrition.nutritionFacts.label.alert')}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('nutrition.costOverview.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('nutrition.costOverview.description')}
        </p>
        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('nutrition.costOverview.where.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('nutrition.costOverview.where.items', { returnObjects: true }) as string[]).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
              <Alert className="border-border bg-muted/30">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {t('nutrition.costOverview.where.alert')}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('nutrition.pantryPrices.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('nutrition.pantryPrices.description')}
        </p>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('nutrition.pantryPrices.fields.title')}</CardTitle>
            <CardDescription>{t('nutrition.pantryPrices.fields.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-3">
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('nutrition.pantryPrices.fields.list', { returnObjects: true }) as Array<{label: string; description: string}>).map((field, index) => (
                  <li key={index}><span className="font-medium text-foreground">{field.label}</span>: {field.description}</li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground">
                {t('nutrition.pantryPrices.fields.unitPrice')}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('nutrition.costSettings.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('nutrition.costSettings.description')}
        </p>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('nutrition.costSettings.stepsTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
              {(t('nutrition.costSettings.steps', { returnObjects: true }) as Array<{title: string; description: string}>).map((step, index) => (
                <li key={index}>
                  <span className="font-medium text-foreground">{step.title}</span>
                  <p className="ml-6 mt-1 text-sm">{step.description}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('nutrition.bestPractices.title')}</h2>
        <Card className="border-border">
          <CardContent className="pt-6">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-2">
              {(t('nutrition.bestPractices.items', { returnObjects: true }) as string[]).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}