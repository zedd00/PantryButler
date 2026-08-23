import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ApiGuidelines() {
  const { t } = useTranslation('docs');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-4">{t('api.title')}</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          {t('api.subtitle')}
        </p>
      </div>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('api.overview.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('api.overview.description')}
        </p>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('api.overview.authentication.title')}</CardTitle>
            <CardDescription>{t('api.overview.authentication.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
              {(t('api.overview.authentication.options', { returnObjects: true }) as Array<{label: string; description: string}>).map((option, index) => (
                <li key={index}><span className="font-medium text-foreground">{option.label}</span>: {option.description}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('api.apiTokens.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('api.apiTokens.description')}
        </p>
        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('api.apiTokens.properties.title')}</CardTitle>
              <CardDescription>{t('api.apiTokens.properties.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('api.apiTokens.properties.items', { returnObjects: true }) as Array<{label: string; description: string}>).map((item, index) => (
                  <li key={index}><span className="font-medium text-foreground">{item.label}</span>: {item.description}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('api.apiTokens.create.title')}</CardTitle>
              <CardDescription>{t('api.apiTokens.create.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('api.apiTokens.create.steps', { returnObjects: true }) as Array<{title: string; description: string}>).map((step, index) => (
                  <li key={index}>
                    <span className="font-medium text-foreground">{step.title}</span>
                    <p className="ml-6 mt-1 text-sm">{step.description}</p>
                  </li>
                ))}
              </ol>
              <Alert className="border-border bg-muted/30">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {t('api.apiTokens.create.alert')}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('api.apiTokens.scopes.title')}</CardTitle>
              <CardDescription>{t('api.apiTokens.scopes.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t('api.apiTokens.scopes.intro')}
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                  {(t('api.apiTokens.scopes.resources', { returnObjects: true }) as string[]).map((resource, index) => (
                    <li key={index}>{resource}</li>
                  ))}
                </ul>
                <p className="text-sm text-muted-foreground">
                  {t('api.apiTokens.scopes.readWrite')}
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                  {(t('api.apiTokens.scopes.all', { returnObjects: true }) as string[]).map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('api.apiTokens.revoke.title')}</CardTitle>
              <CardDescription>{t('api.apiTokens.revoke.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('api.apiTokens.revoke.items', { returnObjects: true }) as string[]).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('api.oauth.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('api.oauth.description')}
        </p>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('api.oauth.flow.title')}</CardTitle>
            <CardDescription>{t('api.oauth.flow.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
              {(t('api.oauth.flow.items', { returnObjects: true }) as string[]).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
            <Alert className="border-border bg-muted/30">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {t('api.oauth.flow.alert')}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('api.bestPractices.title')}</h2>
        <Card className="border-border">
          <CardContent className="pt-6">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-2">
              {(t('api.bestPractices.items', { returnObjects: true }) as string[]).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}