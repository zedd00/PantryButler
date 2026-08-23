import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Wrench, LayoutGrid } from 'lucide-react';

export default function Pantry() {
  const { t } = useTranslation(['pantry', 'common']);
  const navigate = useNavigate();

  const sections = [
    {
      title: t('pantry:pantryHome.cards.ingredientsTitle'),
      description: t('pantry:pantryHome.cards.ingredientsDescription'),
      icon: Package,
      href: '/pantry/ingredients',
      color: 'text-primary',
    },
    {
      title: t('pantry:pantryHome.cards.equipmentTitle'),
      description: t('pantry:pantryHome.cards.equipmentDescription'),
      icon: Wrench,
      href: '/pantry/equipment',
      color: 'text-secondary',
    },
    {
      title: t('pantry:pantryHome.cards.layoutTitle'),
      description: t('pantry:pantryHome.cards.layoutDescription'),
      icon: LayoutGrid,
      href: '/pantry/layout',
      color: 'text-accent',
    },
  ];

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">{t('pantry:pantryHome.title')}</h1>
          <p className="text-muted-foreground">
            {t('pantry:pantryHome.subtitle')}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Card
                key={section.href}
                className="h-full flex flex-col cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(section.href)}
              >
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className={`h-6 w-6 ${section.color}`} />
                    <CardTitle>{section.title}</CardTitle>
                  </div>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex items-end">
                  <Button variant="outline" className="w-full" onClick={(e) => { e.stopPropagation(); navigate(section.href); }}>
                    {t('pantry:pantryHome.openTitle', { title: section.title })}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
}
