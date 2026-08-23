import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Info, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function InstanceManagement() {
  const { t } = useTranslation('docs');
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-4">{t('instanceManagement.title')}</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          {t('instanceManagement.subtitle')}
        </p>
      </div>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('instanceManagement.creating.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('instanceManagement.creating.description')}
        </p>
        
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('instanceManagement.creating.stepsTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-3 text-muted-foreground ml-2">
              {(t('instanceManagement.creating.steps', { returnObjects: true }) as Array<{title: string; description: string}>).map((step, index) => (
                <li key={index}>
                  <span className="font-medium text-foreground">{step.title}</span>
                  <p className="ml-6 mt-1 text-sm">{step.description}</p>
                </li>
              ))}
            </ol>
            <Alert className="border-border bg-muted/30">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {t('instanceManagement.creating.alert')}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('instanceManagement.userManagement.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('instanceManagement.userManagement.description')}
        </p>

        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('instanceManagement.userManagement.adding.title')}</CardTitle>
              <CardDescription>{t('instanceManagement.userManagement.adding.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-2">
                {(t('instanceManagement.userManagement.adding.steps', { returnObjects: true }) as string[]).map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
              <Alert className="border-border bg-muted/30">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {t('instanceManagement.userManagement.adding.alert')}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('instanceManagement.userManagement.roles.title')}</CardTitle>
              <CardDescription>{t('instanceManagement.userManagement.roles.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium text-foreground">{t('instanceManagement.userManagement.roles.administrator.title')}</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                    {(t('instanceManagement.userManagement.roles.administrator.permissions', { returnObjects: true }) as string[]).map((permission, index) => (
                      <li key={index}>{permission}</li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-foreground">{t('instanceManagement.userManagement.roles.member.title')}</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                    {(t('instanceManagement.userManagement.roles.member.permissions', { returnObjects: true }) as string[]).map((permission, index) => (
                      <li key={index}>{permission}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('instanceManagement.userManagement.editing.title')}</CardTitle>
              <CardDescription>{t('instanceManagement.userManagement.editing.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-2">
                {(t('instanceManagement.userManagement.editing.steps', { returnObjects: true }) as string[]).map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('instanceManagement.userManagement.deleting.title')}</CardTitle>
              <CardDescription>{t('instanceManagement.userManagement.deleting.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('instanceManagement.userManagement.deleting.content')}
              </p>
              <Alert className="border-destructive/50 bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-sm text-destructive">
                  {t('instanceManagement.userManagement.deleting.alert')}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('instanceManagement.settings.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('instanceManagement.settings.description')}
        </p>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('instanceManagement.settings.optionsTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-2">
              {(t('instanceManagement.settings.options', { returnObjects: true }) as string[]).map((option, index) => (
                <li key={index}>{option}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('instanceManagement.bestPractices.title')}</h2>
        <div className="space-y-3">
          <Card className="border-border">
            <CardContent className="pt-6">
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-2">
                {(t('instanceManagement.bestPractices.items', { returnObjects: true }) as string[]).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
