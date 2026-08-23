import { Link, Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChefHat, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { useTranslation } from 'react-i18next';

export default function Docs() {
  const location = useLocation();
  const { t } = useTranslation(['docs', 'common']);

  const docSections = [
    {
      title: t('navigation.gettingStarted'),
      items: [
        { title: t('navigation.quickStart'), path: '/docs' },
        { title: t('navigation.kitchenManagement'), path: '/docs/instances' },
      ],
    },
    {
      title: t('navigation.coreFeatures'),
      items: [
        { title: t('navigation.recipeManagement'), path: '/docs/recipes' },
        { title: t('navigation.mealPlanning'), path: '/docs/meal-planning' },
        { title: t('navigation.shoppingLists'), path: '/docs/grocery-lists' },
        { title: t('navigation.pantryEquipment'), path: '/docs/pantry-equipment' },
        { title: t('navigation.nutritionCostTracking'), path: '/docs/nutrition' },
      ],
    },
    {
      title: t('navigation.collaboration'),
      items: [
        { title: t('navigation.sharingCollaboration'), path: '/docs/sharing' },
      ],
    },
    {
      title: t('navigation.accountSection'),
      items: [
        { title: t('navigation.accountSettingsPage'), path: '/docs/account-settings' },
      ],
    },
    {
      title: t('navigation.developersSection'),
      items: [
        { title: t('navigation.apiGuidelines'), path: '/docs/api-guidelines' },
      ],
    },
    {
      title: t('navigation.administrationSection'),
      items: [
        { title: t('navigation.adminFeatures'), path: '/docs/admin-features' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-3">
              <ChefHat className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold text-foreground">{t('common:docs.brand')}</span>
            </Link>
            <span className="text-muted-foreground">{t('common:docs.pathSeparator')}</span>
            <span className="text-foreground">{t('common:docs.title')}</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link to="/">
              <Button variant="ghost" size="sm">
                <Home className="h-4 w-4 mr-2" />
                {t('common:docs.backToHome')}
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="sm">{t('common:docs.login')}</Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-64 shrink-0">
            <Card className="border-border p-4 sticky top-24">
              <ScrollArea className="h-[calc(100vh-12rem)]">
                <nav className="space-y-6">
                  {docSections.map((section) => (
                    <div key={section.title}>
                      <h4 className="text-sm font-semibold text-foreground mb-3">
                        {section.title}
                      </h4>
                      <ul className="space-y-2">
                        {section.items.map((item) => (
                          <li key={item.path}>
                            <Link
                              to={item.path}
                              className={cn(
                                'block text-sm py-1.5 px-3 rounded-md transition-colors',
                                location.pathname === item.path
                                  ? 'bg-primary/10 text-primary font-medium'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                              )}
                            >
                              {item.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </nav>
              </ScrollArea>
            </Card>
          </aside>

          {/* Main Content */}
          <main className="flex-1 max-w-4xl">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
