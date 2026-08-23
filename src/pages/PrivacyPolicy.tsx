import MainLayout from '@/components/layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';

interface StrongListItem {
  strong: string;
  text: string;
}

export default function PrivacyPolicy() {
  const { t } = useTranslation(['legal', 'common']);

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">{t('legal:privacyPolicy.title')}</h1>
        <p className="text-muted-foreground mb-8">{t('legal:privacyPolicy.lastUpdated')}</p>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('legal:privacyPolicy.introduction.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                {t('legal:privacyPolicy.introduction.text')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('legal:privacyPolicy.sections.collectInfo.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">{t('legal:privacyPolicy.sections.collectInfo.accountInfo.title')}</h3>
                <p>{t('legal:privacyPolicy.sections.collectInfo.accountInfo.intro')}</p>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  {(t('legal:privacyPolicy.sections.collectInfo.accountInfo.items', { returnObjects: true }) as string[]).map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">{t('legal:privacyPolicy.sections.collectInfo.appData.title')}</h3>
                <p>{t('legal:privacyPolicy.sections.collectInfo.appData.intro')}</p>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  {(t('legal:privacyPolicy.sections.collectInfo.appData.items', { returnObjects: true }) as string[]).map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">{t('legal:privacyPolicy.sections.collectInfo.usageInfo.title')}</h3>
                <p>{t('legal:privacyPolicy.sections.collectInfo.usageInfo.intro')}</p>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  {(t('legal:privacyPolicy.sections.collectInfo.usageInfo.items', { returnObjects: true }) as string[]).map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('legal:privacyPolicy.sections.howWeUse.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>{t('legal:privacyPolicy.sections.howWeUse.intro')}</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                {(t('legal:privacyPolicy.sections.howWeUse.items', { returnObjects: true }) as string[]).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('legal:privacyPolicy.sections.storageSecurity.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                {t('legal:privacyPolicy.sections.storageSecurity.intro')}
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                {(t('legal:privacyPolicy.sections.storageSecurity.items', { returnObjects: true }) as string[]).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
              <p className="mt-4">
                {t('legal:privacyPolicy.sections.storageSecurity.note')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('legal:privacyPolicy.sections.sharing.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>{t('legal:privacyPolicy.sections.sharing.intro')}</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                {(t('legal:privacyPolicy.sections.sharing.items', { returnObjects: true }) as StrongListItem[]).map((item, index) => (
                  <li key={index}><strong>{item.strong}</strong>{item.text}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('legal:privacyPolicy.sections.rights.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>{t('legal:privacyPolicy.sections.rights.intro')}</p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                {(t('legal:privacyPolicy.sections.rights.items', { returnObjects: true }) as StrongListItem[]).map((item, index) => (
                  <li key={index}><strong>{item.strong}</strong>{item.text}</li>
                ))}
              </ul>
              <p className="mt-4">
                {t('legal:privacyPolicy.sections.rights.note')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('legal:privacyPolicy.sections.cookies.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                {t('legal:privacyPolicy.sections.cookies.text')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('legal:privacyPolicy.sections.children.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                {t('legal:privacyPolicy.sections.children.text')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('legal:privacyPolicy.sections.retention.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                {t('legal:privacyPolicy.sections.retention.text')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('legal:privacyPolicy.sections.international.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                {t('legal:privacyPolicy.sections.international.text')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('legal:privacyPolicy.sections.changes.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                {t('legal:privacyPolicy.sections.changes.text')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('legal:privacyPolicy.sections.contact.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                {t('legal:privacyPolicy.sections.contact.intro')}
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                {(t('legal:privacyPolicy.sections.contact.items', { returnObjects: true }) as string[]).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
