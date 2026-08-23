import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Custom hook to set the document title based on the current route.
 * Improves accessibility by providing context to screen reader users.
 *
 * WCAG 2.1 Compliance: SC 2.4.2 (Page Titled)
 */
export function useDocumentTitle(title?: string) {
  const location = useLocation();
  const { t } = useTranslation('common');

  useEffect(() => {
    if (title) {
      document.title = `${title} | PantryButler`;
    } else {
      // Default title based on route
      const path = location.pathname;
      let pageKey = 'home';

      if (path === '/') pageKey = 'home';
      else if (path === '/recipes') pageKey = 'recipes';
      else if (path === '/calendar') pageKey = 'mealCalendar';
      else if (path === '/grocery-list') pageKey = 'groceryList';
      else if (path === '/pantry') pageKey = 'pantry';
      else if (path === '/pantry/ingredients') pageKey = 'ingredients';
      else if (path === '/pantry/equipment') pageKey = 'equipment';
      else if (path === '/pantry/layout') pageKey = 'kitchenLayout';
      else if (path === '/profile') pageKey = 'profile';
      else if (path === '/settings') pageKey = 'settings';
      else if (path === '/docs') pageKey = 'docs';
      else if (path === '/privacy') pageKey = 'privacyPolicy';
      else if (path === '/login') pageKey = 'login';
      else if (path === '/register-instance') pageKey = 'setup';
      else if (path.startsWith('/recipes/')) pageKey = 'recipeDetails';
      else if (path.startsWith('/admin')) pageKey = 'admin';

      document.title = `${t(`pageTitles.${pageKey}`)} | PantryButler`;
    }
  }, [title, location.pathname, t]);
}
