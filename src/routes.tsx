import type { ReactNode } from 'react';
import Home from './pages/Home';
import Login from './pages/Login';
import OAuthConsent from './pages/OAuthConsent';
import RegisterInstance from './pages/RegisterInstance';
import VerifyEmail from './pages/VerifyEmail';
import Setup from './pages/Setup';
import Docs from './pages/Docs';
import GettingStarted from './pages/docs/GettingStarted';
import InstanceManagement from './pages/docs/InstanceManagement';
import RecipeManagement from './pages/docs/RecipeManagement';
import MealPlanning from './pages/docs/MealPlanning';
import GroceryLists from './pages/docs/GroceryLists';
import PantryEquipment from './pages/docs/PantryEquipment';
import Sharing from './pages/docs/Sharing';
import Nutrition from './pages/docs/Nutrition';
import AccountSettings from './pages/docs/AccountSettings';
import ApiGuidelines from './pages/docs/ApiGuidelines';
import AdminFeatures from './pages/docs/AdminFeatures';
import Recipes from './pages/Recipes';
import RecipeDetail from './pages/RecipeDetail';
import RecipeEditor from './pages/RecipeEditor';
import ImportReviewPage from './pages/ImportReviewPage';
import PublicRecipePage from './pages/PublicRecipePage';
import GroceryListCreation from './pages/GroceryListCreation';
import GroceryList from './pages/GroceryList';
import Calendar from './pages/Calendar';
import Pantry from './pages/Pantry';
import Ingredients from './pages/Ingredients';
import Equipment from './pages/Equipment';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import UserManagement from './pages/UserManagement';
import AdminInstances from './pages/AdminInstances';
import AdminAnnouncements from './pages/AdminAnnouncements';
import AdminConfig from './pages/AdminConfig';
import AnnouncementsLanding from './pages/AnnouncementsLanding';
import KitchenLayoutEditor from './pages/KitchenLayoutEditor';
import KitchenPantry from './pages/KitchenPantry';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Attribution from './pages/Attribution';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  /** Accessible without login. Routes without this flag require authentication. Has no effect when RouteGuard is not in use. */
  public?: boolean;
  children?: RouteConfig[];
}

const routes: RouteConfig[] = [
  {
    name: 'Home',
    path: '/',
    element: <Home />,
    public: true,
  },
  {
    name: 'Setup',
    path: '/setup',
    element: <Setup />,
    public: true,
  },
  {
    name: 'Public Recipe',
    path: '/r/:slug',
    element: <PublicRecipePage />,
    public: true,
  },
  {
    name: 'Login',
    path: '/login',
    element: <Login />,
    public: true,
  },
  {
    name: 'OAuth Consent',
    path: '/oauth/consent',
    element: <OAuthConsent />,
    public: true,
  },
  {
    name: 'Register Instance',
    path: '/register-instance',
    element: <RegisterInstance />,
    public: true,
  },
  {
    name: 'Verify Email',
    path: '/verify-email',
    element: <VerifyEmail />,
    public: true,
  },
  {
    name: 'Docs',
    path: '/docs',
    element: <Docs />,
    public: true,
    children: [
      {
        name: 'Getting Started',
        path: '/docs',
        element: <GettingStarted />,
        public: true,
      },
      {
        name: 'Instance Management',
        path: '/docs/instances',
        element: <InstanceManagement />,
        public: true,
      },
      {
        name: 'Recipe Management',
        path: '/docs/recipes',
        element: <RecipeManagement />,
        public: true,
      },
      {
        name: 'Meal Planning',
        path: '/docs/meal-planning',
        element: <MealPlanning />,
        public: true,
      },
      {
        name: 'Grocery Lists',
        path: '/docs/grocery-lists',
        element: <GroceryLists />,
        public: true,
      },
      {
        name: 'Pantry & Equipment',
        path: '/docs/pantry-equipment',
        element: <PantryEquipment />,
        public: true,
      },
      {
        name: 'Sharing',
        path: '/docs/sharing',
        element: <Sharing />,
        public: true,
      },
      {
        name: 'Nutrition & Cost Tracking',
        path: '/docs/nutrition',
        element: <Nutrition />,
        public: true,
      },
      {
        name: 'Account, Settings & Announcements',
        path: '/docs/account-settings',
        element: <AccountSettings />,
        public: true,
      },
      {
        name: 'API Guidelines',
        path: '/docs/api-guidelines',
        element: <ApiGuidelines />,
        public: true,
      },
      {
        name: 'Admin Features',
        path: '/docs/admin-features',
        element: <AdminFeatures />,
        public: true,
      },
    ],
  },
  {
    name: 'Recipes',
    path: '/recipes',
    element: <Recipes />,
  },
  {
    name: 'Announcements',
    path: '/announcements',
    element: <AnnouncementsLanding />,
    visible: false, // Not shown in nav, accessed via redirect
  },
  {
    name: 'Recipe Detail',
    path: '/recipes/:id',
    element: <RecipeDetail />,
  },
  {
    name: 'New Recipe',
    path: '/recipes/new',
    element: <RecipeEditor />,
  },
  {
    name: 'Edit Recipe',
    path: '/recipes/:id/edit',
    element: <RecipeEditor />,
  },
  {
    name: 'Import Review',
    path: '/import-review',
    element: <ImportReviewPage />,
  },
  {
    name: 'Grocery List Creation',
    path: '/grocery-list-creation',
    element: <GroceryListCreation />,
  },
  {
    name: 'Grocery List',
    path: '/grocery-list',
    element: <GroceryList />,
  },
  {
    name: 'Calendar',
    path: '/calendar',
    element: <Calendar />,
  },
  {
    name: 'Pantry',
    path: '/pantry',
    element: <Pantry />,
  },
  {
    name: 'Ingredients',
    path: '/pantry/ingredients',
    element: <Ingredients />,
    visible: false,
  },
  {
    name: 'Equipment',
    path: '/pantry/equipment',
    element: <Equipment />,
    visible: false,
  },
  {
    name: 'Pantry Layout',
    path: '/pantry/layout',
    element: <KitchenPantry />,
    visible: false,
  },
  {
    name: 'Kitchen Layout Editor',
    path: '/kitchen-layout-editor',
    element: <KitchenLayoutEditor />,
    visible: false,
  },
  {
    name: 'Profile',
    path: '/profile',
    element: <Profile />,
  },
  {
    name: 'Settings',
    path: '/settings',
    element: <Settings />,
  },
  {
    name: 'User Management',
    path: '/users',
    element: <UserManagement />,
  },
  {
    name: 'Admin Instances',
    path: '/admin/instances',
    element: <AdminInstances />,
    visible: false, // Hidden from navigation, only accessible directly
  },
  {
    name: 'Announcements',
    path: '/admin/announcements',
    element: <AdminAnnouncements />,
    visible: false,
  },
  {
    name: 'Admin Config',
    path: '/admin/config',
    element: <AdminConfig />,
    visible: false,
  },
  {
    name: 'Privacy Policy',
    path: '/privacy',
    element: <PrivacyPolicy />,
    visible: false,
    public: true,
  },
  {
    name: 'Attribution',
    path: '/attribution',
    element: <Attribution />,
    visible: false,
    public: true,
  },
];

export default routes;
