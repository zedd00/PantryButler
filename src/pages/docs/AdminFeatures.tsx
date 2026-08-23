import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function AdminFeatures() {
  const { t } = useTranslation('docs');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-4">{t('admin.access.title')}</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          {t('admin.access.subtitle')}
        </p>
      </div>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('admin.roles.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('admin.roles.description')}
        </p>
        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('admin.roles.superadmin.title')}</CardTitle>
              <CardDescription>{t('admin.roles.superadmin.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('admin.roles.superadmin.permissions', { returnObjects: true }) as string[]).map((permission, index) => (
                  <li key={index}>{permission}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('admin.roles.instanceAdmin.title')}</CardTitle>
              <CardDescription>{t('admin.roles.instanceAdmin.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('admin.roles.instanceAdmin.permissions', { returnObjects: true }) as string[]).map((permission, index) => (
                  <li key={index}>{permission}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('admin.roles.member.title')}</CardTitle>
              <CardDescription>{t('admin.roles.member.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('admin.roles.member.permissions', { returnObjects: true }) as string[]).map((permission, index) => (
                  <li key={index}>{permission}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('admin.access.enable.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('admin.access.enable.description')}
        </p>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('admin.access.enable.env.title')}</CardTitle>
            <CardDescription>{t('admin.access.enable.env.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('admin.access.enable.env.content')}
            </p>
            <Alert className="border-border bg-muted/30">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {t('admin.access.enable.env.alert')}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('admin.emailVerification.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('admin.emailVerification.description')}
        </p>
        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('admin.emailVerification.behavior.title')}</CardTitle>
              <CardDescription>{t('admin.emailVerification.behavior.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('admin.emailVerification.behavior.items', { returnObjects: true }) as string[]).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('admin.emailVerification.smtp.title')}</CardTitle>
              <CardDescription>{t('admin.emailVerification.smtp.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{t('admin.emailVerification.smtp.env')}</p>
              <Alert className="border-border bg-muted/30">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {t('admin.emailVerification.smtp.alert')}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('admin.instances.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('admin.instances.description')}
        </p>
        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('admin.instances.view.title')}</CardTitle>
              <CardDescription>{t('admin.instances.view.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('admin.instances.view.info', { returnObjects: true }) as string[]).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('admin.instances.delete.title')}</CardTitle>
              <CardDescription>{t('admin.instances.delete.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('admin.instances.delete.intro')}
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('admin.instances.delete.data', { returnObjects: true }) as string[]).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
              <Alert className="border-border bg-muted/30">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {t('admin.instances.delete.alert')}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('admin.announcements.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('admin.announcements.description')}
        </p>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('admin.announcements.manage.title')}</CardTitle>
            <CardDescription>{t('admin.announcements.manage.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
              {(t('admin.announcements.manage.features', { returnObjects: true }) as string[]).map((feature, index) => (
                <li key={index}>{feature}</li>
              ))}
            </ul>
            <Alert className="border-border bg-muted/30">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {t('admin.announcements.manage.alert')}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('admin.bestPractices.title')}</h2>
        <Card className="border-border">
          <CardContent className="pt-6">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-2">
              {(t('admin.bestPractices.items', { returnObjects: true }) as string[]).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}