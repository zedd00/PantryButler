import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Sharing() {
  const { t } = useTranslation('docs');
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-4">{t('sharing.title')}</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          {t('sharing.subtitle')}
        </p>
      </div>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('sharing.kitchenCollaboration.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('sharing.kitchenCollaboration.description')}
        </p>

        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('sharing.kitchenCollaboration.sharingScope.title')}</CardTitle>
              <CardDescription>{t('sharing.kitchenCollaboration.sharingScope.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground mb-3">
                {t('sharing.kitchenCollaboration.sharingScope.intro')}
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('sharing.kitchenCollaboration.sharingScope.items', { returnObjects: true }) as Array<{label: string; description: string}>).map((item, index) => (
                  <li key={index}><span className="font-medium text-foreground">{item.label}</span>: {item.description}</li>
                ))}
              </ul>
              <Alert className="border-border bg-muted/30 mt-4">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {t('sharing.kitchenCollaboration.sharingScope.alert')}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('sharing.kitchenCollaboration.scenarios.title')}</CardTitle>
              <CardDescription>{t('sharing.kitchenCollaboration.scenarios.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-foreground mb-2">{t('sharing.kitchenCollaboration.scenarios.family.title')}</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                    {(t('sharing.kitchenCollaboration.scenarios.family.items', { returnObjects: true }) as string[]).map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">{t('sharing.kitchenCollaboration.scenarios.roommate.title')}</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                    {(t('sharing.kitchenCollaboration.scenarios.roommate.items', { returnObjects: true }) as string[]).map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">{t('sharing.kitchenCollaboration.scenarios.team.title')}</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                    {(t('sharing.kitchenCollaboration.scenarios.team.items', { returnObjects: true }) as string[]).map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('sharing.kitchenCollaboration.permissions.title')}</CardTitle>
              <CardDescription>{t('sharing.kitchenCollaboration.permissions.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-foreground mb-2">{t('sharing.kitchenCollaboration.permissions.admin.title')}</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                    {(t('sharing.kitchenCollaboration.permissions.admin.items', { returnObjects: true }) as string[]).map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">{t('sharing.kitchenCollaboration.permissions.member.title')}</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                    {(t('sharing.kitchenCollaboration.permissions.member.items', { returnObjects: true }) as string[]).map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('sharing.shareRecipes.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('sharing.shareRecipes.description')}
        </p>

        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('sharing.shareRecipes.generateLink.title')}</CardTitle>
              <CardDescription>{t('sharing.shareRecipes.generateLink.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground mb-3">
                {t('sharing.shareRecipes.generateLink.intro')}
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('sharing.shareRecipes.generateLink.features', { returnObjects: true }) as string[]).slice(0, 1).map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
                <li><span className="font-medium text-foreground">{(t('sharing.shareRecipes.generateLink.features', { returnObjects: true }) as string[])[1]}</span></li>
              </ul>
              <Alert className="border-border bg-muted/30 mt-4">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {t('sharing.shareRecipes.generateLink.alert')}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('sharing.shareRecipes.publicSharing.title')}</CardTitle>
              <CardDescription>{t('sharing.shareRecipes.publicSharing.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground mb-3">
                {t('sharing.shareRecipes.publicSharing.intro')}
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('sharing.shareRecipes.publicSharing.steps', { returnObjects: true }) as string[]).map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
              <p className="text-sm text-muted-foreground mt-3">
                {t('sharing.shareRecipes.publicSharing.note')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('sharing.shareRecipes.visibility.title')}</CardTitle>
              <CardDescription>{t('sharing.shareRecipes.visibility.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground mb-3">
                {t('sharing.shareRecipes.visibility.intro')}
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                {(t('sharing.shareRecipes.visibility.options', { returnObjects: true }) as Array<{label: string; description: string}>).map((option, index) => (
                  <li key={index}><span className="font-medium text-foreground">{option.label}</span>: {option.description}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('sharing.notifications.title')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('sharing.notifications.description')}
        </p>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('sharing.notifications.types.title')}</CardTitle>
            <CardDescription>{t('sharing.notifications.types.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
              {(t('sharing.notifications.types.items', { returnObjects: true }) as string[]).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{t('sharing.bestPractices.title')}</h2>
        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-foreground mb-2">{t('sharing.bestPractices.kitchenCollaboration.title')}</h4>
                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                  {(t('sharing.bestPractices.kitchenCollaboration.items', { returnObjects: true }) as string[]).map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">{t('sharing.bestPractices.privacy.title')}</h4>
                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                  {(t('sharing.bestPractices.privacy.items', { returnObjects: true }) as string[]).map((item, index) => (
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
