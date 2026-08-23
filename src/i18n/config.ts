import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import commonEN from '@/locales/en/common.json';
import recipesEN from '@/locales/en/recipes.json';
import pantryEN from '@/locales/en/pantry.json';
import calendarEN from '@/locales/en/calendar.json';
import groceryEN from '@/locales/en/grocery.json';
import settingsEN from '@/locales/en/settings.json';
import authEN from '@/locales/en/auth.json';
import homeEN from '@/locales/en/home.json';
import docsEN from '@/locales/en/docs.json';
import tutorialEN from '@/locales/en/tutorial.json';
import kitchenEN from '@/locales/en/kitchen.json';
import adminEN from '@/locales/en/admin.json';
import legalEN from '@/locales/en/legal.json';

import commonSQ from '@/locales/sq/common.json';
import recipesSQ from '@/locales/sq/recipes.json';
import pantrySQ from '@/locales/sq/pantry.json';
import calendarSQ from '@/locales/sq/calendar.json';
import grocerySQ from '@/locales/sq/grocery.json';
import settingsSQ from '@/locales/sq/settings.json';
import authSQ from '@/locales/sq/auth.json';
import homeSQ from '@/locales/sq/home.json';
import docsSQ from '@/locales/sq/docs.json';
import tutorialSQ from '@/locales/sq/tutorial.json';
import kitchenSQ from '@/locales/sq/kitchen.json';
import adminSQ from '@/locales/sq/admin.json';
import legalSQ from '@/locales/sq/legal.json';

import commonIT from '@/locales/it/common.json';
import recipesIT from '@/locales/it/recipes.json';
import pantryIT from '@/locales/it/pantry.json';
import calendarIT from '@/locales/it/calendar.json';
import groceryIT from '@/locales/it/grocery.json';
import settingsIT from '@/locales/it/settings.json';
import authIT from '@/locales/it/auth.json';
import homeIT from '@/locales/it/home.json';
import docsIT from '@/locales/it/docs.json';
import tutorialIT from '@/locales/it/tutorial.json';
import kitchenIT from '@/locales/it/kitchen.json';
import adminIT from '@/locales/it/admin.json';
import legalIT from '@/locales/it/legal.json';

import commonES from '@/locales/es/common.json';
import recipesES from '@/locales/es/recipes.json';
import pantryES from '@/locales/es/pantry.json';
import calendarES from '@/locales/es/calendar.json';
import groceryES from '@/locales/es/grocery.json';
import settingsES from '@/locales/es/settings.json';
import authES from '@/locales/es/auth.json';
import homeES from '@/locales/es/home.json';
import docsES from '@/locales/es/docs.json';
import tutorialES from '@/locales/es/tutorial.json';
import kitchenES from '@/locales/es/kitchen.json';
import adminES from '@/locales/es/admin.json';
import legalES from '@/locales/es/legal.json';

import commonFR from '@/locales/fr/common.json';
import recipesFR from '@/locales/fr/recipes.json';
import pantryFR from '@/locales/fr/pantry.json';
import calendarFR from '@/locales/fr/calendar.json';
import groceryFR from '@/locales/fr/grocery.json';
import settingsFR from '@/locales/fr/settings.json';
import authFR from '@/locales/fr/auth.json';
import homeFR from '@/locales/fr/home.json';
import docsFR from '@/locales/fr/docs.json';
import tutorialFR from '@/locales/fr/tutorial.json';
import kitchenFR from '@/locales/fr/kitchen.json';
import adminFR from '@/locales/fr/admin.json';
import legalFR from '@/locales/fr/legal.json';

import commonZH from '@/locales/zh/common.json';
import recipesZH from '@/locales/zh/recipes.json';
import pantryZH from '@/locales/zh/pantry.json';
import calendarZH from '@/locales/zh/calendar.json';
import groceryZH from '@/locales/zh/grocery.json';
import settingsZH from '@/locales/zh/settings.json';
import authZH from '@/locales/zh/auth.json';
import homeZH from '@/locales/zh/home.json';
import docsZH from '@/locales/zh/docs.json';
import tutorialZH from '@/locales/zh/tutorial.json';
import kitchenZH from '@/locales/zh/kitchen.json';
import adminZH from '@/locales/zh/admin.json';
import legalZH from '@/locales/zh/legal.json';

import commonHI from '@/locales/hi/common.json';
import recipesHI from '@/locales/hi/recipes.json';
import pantryHI from '@/locales/hi/pantry.json';
import calendarHI from '@/locales/hi/calendar.json';
import groceryHI from '@/locales/hi/grocery.json';
import settingsHI from '@/locales/hi/settings.json';
import authHI from '@/locales/hi/auth.json';
import homeHI from '@/locales/hi/home.json';
import docsHI from '@/locales/hi/docs.json';
import tutorialHI from '@/locales/hi/tutorial.json';
import kitchenHI from '@/locales/hi/kitchen.json';
import adminHI from '@/locales/hi/admin.json';
import legalHI from '@/locales/hi/legal.json';

const resources = {
  en: {
    common: commonEN,
    recipes: recipesEN,
    pantry: pantryEN,
    calendar: calendarEN,
    grocery: groceryEN,
    settings: settingsEN,
    auth: authEN,
    home: homeEN,
    docs: docsEN,
    tutorial: tutorialEN,
    kitchen: kitchenEN,
    admin: adminEN,
    legal: legalEN,
  },
  sq: {
    common: commonSQ,
    recipes: recipesSQ,
    pantry: pantrySQ,
    calendar: calendarSQ,
    grocery: grocerySQ,
    settings: settingsSQ,
    auth: authSQ,
    home: homeSQ,
    docs: docsSQ,
    tutorial: tutorialSQ,
    kitchen: kitchenSQ,
    admin: adminSQ,
    legal: legalSQ,
  },
  it: {
    common: commonIT,
    recipes: recipesIT,
    pantry: pantryIT,
    calendar: calendarIT,
    grocery: groceryIT,
    settings: settingsIT,
    auth: authIT,
    home: homeIT,
    docs: docsIT,
    tutorial: tutorialIT,
    kitchen: kitchenIT,
    admin: adminIT,
    legal: legalIT,
  },
  es: {
    common: commonES,
    recipes: recipesES,
    pantry: pantryES,
    calendar: calendarES,
    grocery: groceryES,
    settings: settingsES,
    auth: authES,
    home: homeES,
    docs: docsES,
    tutorial: tutorialES,
    kitchen: kitchenES,
    admin: adminES,
    legal: legalES,
  },
  fr: {
    common: commonFR,
    recipes: recipesFR,
    pantry: pantryFR,
    calendar: calendarFR,
    grocery: groceryFR,
    settings: settingsFR,
    auth: authFR,
    home: homeFR,
    docs: docsFR,
    tutorial: tutorialFR,
    kitchen: kitchenFR,
    admin: adminFR,
    legal: legalFR,
  },
  zh: {
    common: commonZH,
    recipes: recipesZH,
    pantry: pantryZH,
    calendar: calendarZH,
    grocery: groceryZH,
    settings: settingsZH,
    auth: authZH,
    home: homeZH,
    docs: docsZH,
    tutorial: tutorialZH,
    kitchen: kitchenZH,
    admin: adminZH,
    legal: legalZH,
  },
  hi: {
    common: commonHI,
    recipes: recipesHI,
    pantry: pantryHI,
    calendar: calendarHI,
    grocery: groceryHI,
    settings: settingsHI,
    auth: authHI,
    home: homeHI,
    docs: docsHI,
    tutorial: tutorialHI,
    kitchen: kitchenHI,
    admin: adminHI,
    legal: legalHI,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'recipes', 'pantry', 'calendar', 'grocery', 'settings', 'auth', 'home', 'docs', 'tutorial', 'kitchen', 'admin', 'legal'],
    
    interpolation: {
      escapeValue: false, // React already escapes values
    },

    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },

    react: {
      useSuspense: true,
    },
  });

const applyDocumentLanguage = () => {
  const lang = i18n.resolvedLanguage || i18n.language || 'en';
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
  }
};

applyDocumentLanguage();
i18n.on('languageChanged', applyDocumentLanguage);

export default i18n;
