import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChefHat, Calendar, ShoppingCart, BookOpen, Utensils, Clock, Download, Share2, Coffee, Heart, Calculator, Globe } from 'lucide-react';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { SkipLink } from '@/components/common/SkipLink';
import PageMeta from '@/components/common/PageMeta';
import { useTranslation } from 'react-i18next';

export default function Home() {
  const { t } = useTranslation(['home', 'common', 'auth']);
  
  return (
    <div className="min-h-screen bg-background">
      <PageMeta
        title={t('home:meta.title')}
        description={t('home:meta.description')}
      />
      <SkipLink />
      
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/PantryButlerLogo_v2.png" alt="PantryButler" className="h-10 w-auto" />
          </div>
          <nav aria-label={t('home:header.ariaLabel')} className="flex items-center gap-4">
            <a 
              href="https://buymeacoffee.com/PantryButler" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t('home:support.coffeeAriaLabel')}
            >
              <Coffee className="h-5 w-5" aria-hidden="true" />
            </a>
            <a 
              href="https://www.patreon.com/c/zedd00" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t('home:support.patreonAriaLabel')}
            >
              <Heart className="h-5 w-5" aria-hidden="true" />
            </a>
            <Link to="/docs">
              <Button variant="ghost">{t('home:header.documentation')}</Button>
            </Link>
            <LanguageSwitcher />
            <Link to="/login">
              <Button variant="outline">{t('common:login')}</Button>
            </Link>
            <Link to="/register-instance">
              <Button>{t('home:header.setupKitchen')}</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section id="main-content" className="container mx-auto px-4 py-24 text-center" tabIndex={-1}>
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="text-5xl font-bold text-foreground leading-tight text-balance">
            {t('home:hero.title')}
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed text-pretty">
            {t('home:hero.subtitle')}
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link to="/register-instance">
              <Button size="lg" className="text-lg px-8 py-6">
                {t('home:hero.getStarted')}
              </Button>
            </Link>
            <Link to="/docs">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                {t('home:hero.learnMore')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <h3 className="text-3xl font-semibold text-foreground mb-4 text-balance">{t('home:features.title')}</h3>
          <p className="text-lg text-muted-foreground text-pretty">
            {t('home:features.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card className="border-border h-full">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <BookOpen className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
              <CardTitle className="text-xl text-balance">{t('home:features.recipeManagement.title')}</CardTitle>
              <CardDescription className="text-base leading-relaxed text-pretty">
                {t('home:features.recipeManagement.description')}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border h-full">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Calculator className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
              <CardTitle className="text-xl text-balance">{t('home:features.nutritionTracking.title')}</CardTitle>
              <CardDescription className="text-base leading-relaxed text-pretty">
                {t('home:features.nutritionTracking.description')}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border h-full">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Download className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl text-balance">{t('home:features.importRecipes.title')}</CardTitle>
              <CardDescription className="text-base leading-relaxed text-pretty">
                {t('home:features.importRecipes.description')}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border h-full">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl text-balance">{t('home:features.stepTimers.title')}</CardTitle>
              <CardDescription className="text-base leading-relaxed text-pretty">
                {t('home:features.stepTimers.description')}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border h-full">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Calendar className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
              <CardTitle className="text-xl text-balance">{t('home:features.mealPlanning.title')}</CardTitle>
              <CardDescription className="text-base leading-relaxed text-pretty">
                {t('home:features.mealPlanning.description')}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border h-full">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <ShoppingCart className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
              <CardTitle className="text-xl text-balance">{t('home:features.smartShopping.title')}</CardTitle>
              <CardDescription className="text-base leading-relaxed text-pretty">
                {t('home:features.smartShopping.description')}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border h-full">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Utensils className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
              <CardTitle className="text-xl text-balance">{t('home:features.pantryManagement.title')}</CardTitle>
              <CardDescription className="text-base leading-relaxed text-pretty">
                {t('home:features.pantryManagement.description')}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border h-full">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Share2 className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl text-balance">{t('home:features.collaboration.title')}</CardTitle>
              <CardDescription className="text-base leading-relaxed text-pretty">
                {t('home:features.collaboration.description')}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border h-full">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <ChefHat className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
              <CardTitle className="text-xl text-balance">{t('home:features.privateKitchens.title')}</CardTitle>
              <CardDescription className="text-base leading-relaxed text-pretty">
                {t('home:features.privateKitchens.description')}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Cooklang Compatibility Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
            <span>{t('home:footer.cooklang')}</span>
          </div>
          <p className="text-lg text-muted-foreground leading-relaxed text-pretty">
            {t('home:cooklang.descriptionBefore')}{' '}
            <a 
              href="https://cooklang.org" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              Cooklang
            </a>
            {t('home:cooklang.descriptionAfter')}
          </p>
        </div>
      </section>

      {/* Languages Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium">
            <Globe className="h-5 w-5" aria-hidden="true" />
            <span>{t('home:languages.title')}</span>
          </div>
          <p className="text-lg text-muted-foreground leading-relaxed text-pretty">
            {t('home:languages.subtitle')}
          </p>
          <p className="text-base text-muted-foreground text-pretty">
            {t('home:languages.description')}
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-24">
        <Card className="max-w-4xl mx-auto border-border bg-muted/30">
          <CardContent className="p-12 text-center space-y-6">
            <h3 className="text-3xl font-semibold text-foreground text-balance">
              {t('home:cta.title')}
            </h3>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto text-pretty">
              {t('home:cta.subtitle')}
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 pt-4">
              <Link to="/register-instance" className="w-full md:w-auto">
                <Button size="lg" className="text-base md:text-lg px-6 md:px-8 py-4 md:py-6 w-full">
                  {t('home:cta.setupKitchen')}
                </Button>
              </Link>
              <Link to="/docs" className="w-full md:w-auto">
                <Button size="lg" variant="outline" className="text-base md:text-lg px-6 md:px-8 py-4 md:py-6 w-full">
                  {t('home:cta.viewDocs')}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Support Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-8 text-center">
            <h2 className="text-3xl font-bold mb-4">{t('home:support.title')}</h2>
            <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
              {t('home:support.description')}
            </p>
            <div className="flex items-center justify-center gap-4">
              <a 
                href="https://buymeacoffee.com/PantryButler" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button size="lg" variant="outline" className="gap-2">
                  <Coffee className="h-5 w-5" />
                  {t('home:support.buyMeACoffee')}
                </Button>
              </a>
              <a 
                href="https://www.patreon.com/c/zedd00" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button size="lg" className="gap-2">
                  <Heart className="h-5 w-5" />
                  {t('home:support.supportOnPatreon')}
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-24">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>{t('home:footer.copyright')}</p>
            <div className="flex items-center gap-6">
              <Link to="/privacy" className="hover:text-foreground transition-colors">
                {t('home:footer.privacyPolicy')}
              </Link>
              <Link to="/attribution" className="hover:text-foreground transition-colors">
                {t('home:footer.attribution')}
              </Link>
              <Link to="/docs" className="hover:text-foreground transition-colors">
                {t('home:footer.documentation')}
              </Link>
              <Link to="/login" className="hover:text-foreground transition-colors">
                {t('home:footer.login')}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
