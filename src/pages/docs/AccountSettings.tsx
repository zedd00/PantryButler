import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function AccountSettings() {
  const { t } = useTranslation('docs');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-4">{t('account.title')}</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          {t('account.subtitle')}
        </p>
      </div>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('account.profile.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('account.profile.description')}
        </p>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('account.profile.info.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
              {(t('account.profile.info.fields', { returnObjects: true }) as Array<{label: string; description: string}>).map((field, index) => (
                <li key={index}><span className="font-medium text-foreground">{field.label}</span>: {field.description}</li>
              ))}
            </ul>
            <Alert className="border-border bg-muted/30">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {t('account.profile.info.alert')}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('account.password.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('account.password.description')}
        </p>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('account.password.stepsTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
              {(t('account.password.steps', { returnObjects: true }) as string[]).map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('account.kitchenSettings.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('account.kitchenSettings.description')}
        </p>
        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('account.kitchenSettings.units.title')}</CardTitle>
              <CardDescription>{t('account.kitchenSettings.units.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('account.kitchenSettings.units.options', { returnObjects: true }) as string[]).map((option, index) => (
                  <li key={index}>{option}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('account.kitchenSettings.currency.title')}</CardTitle>
              <CardDescription>{t('account.kitchenSettings.currency.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('account.kitchenSettings.currency.content')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('account.kitchenSettings.features.title')}</CardTitle>
              <CardDescription>{t('account.kitchenSettings.features.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('account.kitchenSettings.features.options', { returnObjects: true }) as Array<{label: string; description: string}>).map((option, index) => (
                  <li key={index}><span className="font-medium text-foreground">{option.label}</span>: {option.description}</li>
                ))}
              </ul>
              <Alert className="border-border bg-muted/30">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {t('account.kitchenSettings.features.alert')}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('account.language.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('account.language.description')}
        </p>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('account.language.optionsTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(t('account.language.options', { returnObjects: true }) as string[]).map((option, index) => (
              <span key={index} className="inline-block mr-2 mb-2 text-sm text-muted-foreground border border-border rounded-md px-3 py-1.5">{option}</span>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('account.rights.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('account.rights.description')}
        </p>
        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('account.rights.apiTokens.title')}</CardTitle>
              <CardDescription>{t('account.rights.apiTokens.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('account.rights.apiTokens.content')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('account.rights.data.title')}</CardTitle>
              <CardDescription>{t('account.rights.data.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('account.rights.data.items', { returnObjects: true }) as string[]).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('account.rights.tutorials.title')}</CardTitle>
              <CardDescription>{t('account.rights.tutorials.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('account.rights.tutorials.items', { returnObjects: true }) as string[]).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('account.announcements.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('account.announcements.description')}
        </p>
        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('account.announcements.viewing.title')}</CardTitle>
              <CardDescription>{t('account.announcements.viewing.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('account.announcements.viewing.items', { returnObjects: true }) as string[]).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('account.announcements.manage.title')}</CardTitle>
              <CardDescription>{t('account.announcements.manage.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('account.announcements.manage.steps', { returnObjects: true }) as Array<{title: string; description: string}>).map((step, index) => (
                  <li key={index}>
                    <span className="font-medium text-foreground">{step.title}</span>
                    <p className="ml-6 mt-1 text-sm">{step.description}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('account.bestPractices.title')}</h2>
        <Card className="border-border">
          <CardContent className="pt-6">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-2">
              {(t('account.bestPractices.items', { returnObjects: true }) as string[]).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}