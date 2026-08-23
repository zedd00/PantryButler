import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  ChefHat,
  ShoppingCart,
  Calendar,
  Package,
  Settings,
  Users,
  Menu,
  LogOut,
  User,
  Bell,
  ChevronRight,
  Home,
  Megaphone,
  Coffee,
  Heart,
  Settings2,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { 
  getUnreadNotificationCount, 
  getNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  getCurrentUserRole, 
  isSuperAdmin,
  getAppConfig,
  getUnreadAnnouncementsCount,
  getActiveAnnouncements,
  markAnnouncementViewed
} from '@/api';
import type { Notification, UserRole } from '@/types/types';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { SkipLink } from '@/components/common/SkipLink';
import { useTranslation } from 'react-i18next';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { t } = useTranslation('common');
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, currentInstance, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [userRole, setUserRole] = useState<UserRole>('user');
  const [isSuperAdminUser, setIsSuperAdminUser] = useState(false);
  const [adminFeaturesEnabled, setAdminFeaturesEnabled] = useState(false);

  const navigation = [
    { name: t('nav.myRecipes'), href: '/recipes', icon: ChefHat },
    { name: t('nav.groceryList'), href: '/grocery-list-creation', icon: ShoppingCart },
    { name: t('nav.calendar'), href: '/calendar', icon: Calendar },
    { name: t('nav.pantry'), href: '/pantry', icon: Package },
    { name: t('nav.settings'), href: '/settings', icon: Settings },
  ];

  // Helper function to generate breadcrumbs from path
  function getBreadcrumbs(pathname: string) {
    const breadcrumbs = [{ name: t('breadcrumbs.home'), href: '/recipes' }];
    
    // Special case for grocery list - show full hierarchy
    if (pathname === '/grocery-list') {
      breadcrumbs.push({ name: t('breadcrumbs.groceryListCreation'), href: '/grocery-list-creation' });
      breadcrumbs.push({ name: t('breadcrumbs.groceryList'), href: '/grocery-list' });
      return breadcrumbs;
    }
    
    // Special case for pantry hierarchy: home -> Pantry -> Ingredients/Equipment/Layout
    if (pathname.startsWith('/pantry/')) {
      breadcrumbs.push({ name: t('breadcrumbs.pantry'), href: '/pantry' });
      if (pathname === '/pantry/ingredients') {
        breadcrumbs.push({ name: t('mainLayout.ingredients'), href: '/pantry/ingredients' });
      } else if (pathname === '/pantry/equipment') {
        breadcrumbs.push({ name: t('breadcrumbs.equipment'), href: '/pantry/equipment' });
      } else if (pathname === '/pantry/layout') {
        breadcrumbs.push({ name: t('mainLayout.pantryLayout'), href: '/pantry/layout' });
      }
      return breadcrumbs;
    }
    
    // Map of paths to readable names
    const pathNames: Record<string, string> = {
      '/recipes': t('breadcrumbs.myRecipes'),
      '/grocery-list-creation': t('breadcrumbs.groceryListCreation'),
      '/grocery-list': t('breadcrumbs.groceryList'),
      '/calendar': t('breadcrumbs.calendar'),
      '/pantry': t('breadcrumbs.pantry'),
      '/settings': t('breadcrumbs.settings'),
      '/profile': t('breadcrumbs.profile'),
      '/users': t('nav.userManagement'),
      '/admin/instances': t('nav.adminInstances'),
      '/admin/announcements': t('nav.announcements'),
      '/edit': t('edit'),
      '/create': t('create'),
      '/new': t('mainLayout.new'),
    };

  const segments = pathname.split('/').filter(Boolean);
  let currentPath = '';

  segments.forEach((segment) => {
    currentPath += `/${segment}`;
    
    // Skip 'admin' segment as it's not a real page
    if (segment === 'admin') {
      return;
    }
    
    // Check if it's a known path
    if (pathNames[currentPath]) {
      breadcrumbs.push({ name: pathNames[currentPath], href: currentPath });
    } else if (pathNames[`/${segment}`]) {
      breadcrumbs.push({ name: pathNames[`/${segment}`], href: currentPath });
    } else if (segment.length === 36 && segment.includes('-')) {
      // Skip UUIDs
      return;
    } else {
      // Capitalize first letter for unknown segments
      const name = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
      breadcrumbs.push({ name, href: currentPath });
    }
  });

  return breadcrumbs;
  }

  useEffect(() => {
    if (user) {
      loadNotificationCount();
      loadUserRole();
      checkSuperAdmin();
      loadAppConfig();
      
      const refreshCounts = () => loadNotificationCount();
      window.addEventListener('notifications-refreshed', refreshCounts);
      
      const interval = setInterval(loadNotificationCount, 30000); // Refresh every 30s
      return () => {
        clearInterval(interval);
        window.removeEventListener('notifications-refreshed', refreshCounts);
      };
    }
  }, [user, currentInstance?.id]);

  const loadAppConfig = async () => {
    try {
      const appConfig = await getAppConfig();
      setAdminFeaturesEnabled(appConfig.enableAdminFeatures);
    } catch (error) {
      console.error('Failed to load app config:', error);
      setAdminFeaturesEnabled(false);
    }
  };

  const checkSuperAdmin = async () => {
    try {
      const result = await isSuperAdmin();
      setIsSuperAdminUser(result);
    } catch (error) {
      console.error('Failed to check superadmin status:', error);
    }
  };

  const loadUserRole = async () => {
    try {
      const role = await getCurrentUserRole();
      if (role) {
        setUserRole(role);
      }
    } catch (error) {
      console.error('Failed to load user role:', error);
    }
  };

  const loadNotificationCount = async () => {
    if (!user || !currentInstance) return;
    try {
      const [count, unreadAnnouncementCount] = await Promise.all([
        getUnreadNotificationCount(user.id),
        getUnreadAnnouncementsCount(user.id, currentInstance.id)
      ]);
      
      setNotificationCount(count + unreadAnnouncementCount);
    } catch (error) {
      console.error('Failed to load notification count:', error);
    }
  };

  const loadNotifications = async () => {
    if (!user || !currentInstance) return;
    try {
      const [data, activeAnnouncements] = await Promise.all([
        getNotifications(user.id),
        getActiveAnnouncements(currentInstance.id)
      ]);
      setNotifications(data);
      
      if (activeAnnouncements && activeAnnouncements.length > 0) {
        const viewedAnnouncements = await api.get<any[]>(`/api/announcements/viewed?user_id=${user.id}&instance_id=${currentInstance.id}`);
        
        const viewedIds = new Set(viewedAnnouncements?.map((v: any) => v.announcement_id) || []);
        const unread = activeAnnouncements.filter(a => !viewedIds.has(a.id));
        setAnnouncements(unread);
      } else {
        setAnnouncements([]);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markNotificationAsRead(notification.id);
      loadNotificationCount();
    }
    if (notification.link) {
      navigate(notification.link);
    }
    setNotificationsOpen(false);
  };

  const handleAnnouncementClick = async (announcement: any) => {
    if (!user || !currentInstance) return;
    
    try {
      await markAnnouncementViewed(user.id, announcement.id, currentInstance.id);
      loadNotificationCount();
      loadNotifications();
    } catch (error) {
      console.error('Failed to mark announcement as viewed:', error);
    }
    
    navigate('/announcements');
    setNotificationsOpen(false);
  };

  const handleMarkAllRead = async () => {
    if (!user || !currentInstance) return;
    
    try {
      // Mark all notifications as read
      await markAllNotificationsAsRead(user.id);
      
      // Mark all visible unread announcements as viewed
      await Promise.allSettled(
        announcements.map(announcement => 
          markAnnouncementViewed(user.id, announcement.id, currentInstance.id)
        )
      );
      
      loadNotificationCount();
      loadNotifications();
      toast.success(t('mainLayout.allMarkedAsRead'));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error(t('mainLayout.markAllReadFailed'));
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const displayName = profile?.display_name || profile?.username || t('mainLayout.user');
  const userInitials = displayName.substring(0, 2).toUpperCase();

  const NavLinks = () => (
    <>
      {navigation.map((item) => {
        const Icon = item.icon;
        const isRecipesLink = item.href === '/recipes';
        const isGroceryLink = item.href === '/grocery-list-creation';
        const isCalendarLink = item.href === '/calendar';
        const isPantryLink = item.href === '/pantry';
        
        return (
          <Link
            key={item.name}
            to={item.href}
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 text-sm transition-minimal ${
              isActive(item.href)
                ? 'bg-accent text-accent-foreground border-l-2 border-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
            data-tutorial={
              isRecipesLink ? 'nav-recipes' :
              isGroceryLink ? 'nav-grocery' :
              isCalendarLink ? 'nav-calendar' :
              isPantryLink ? 'nav-pantry' :
              undefined
            }
          >
            <Icon className="h-5 w-5" />
            {item.name}
          </Link>
        );
      })}
      {userRole === 'admin' && (
        <Link
          to="/users"
          onClick={() => setMobileMenuOpen(false)}
          className={`flex items-center gap-3 px-4 py-3 text-sm transition-minimal ${
            isActive('/users')
              ? 'bg-accent text-accent-foreground border-l-2 border-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          }`}
        >
          <Users className="h-5 w-5" />
          {t('nav.userManagement')}
        </Link>
      )}
      {adminFeaturesEnabled && isSuperAdminUser && (
        <Link
          to="/admin/announcements"
          onClick={() => setMobileMenuOpen(false)}
          className={`flex items-center gap-3 px-4 py-3 text-sm transition-minimal ${
            isActive('/admin/announcements')
              ? 'bg-accent text-accent-foreground border-l-2 border-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          }`}
        >
          <Megaphone className="h-5 w-5" />
          {t('nav.announcements')}
        </Link>
      )}
      {adminFeaturesEnabled && isSuperAdminUser && (
        <Link
          to="/admin/instances"
          onClick={() => setMobileMenuOpen(false)}
          className={`flex items-center gap-3 px-4 py-3 text-sm transition-minimal ${
            isActive('/admin/instances')
              ? 'bg-accent text-accent-foreground border-l-2 border-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          }`}
        >
          <Settings className="h-5 w-5" />
          {t('nav.adminInstances')}
        </Link>
      )}
      {adminFeaturesEnabled && isSuperAdminUser && (
        <Link
          to="/admin/config"
          onClick={() => setMobileMenuOpen(false)}
          className={`flex items-center gap-3 px-4 py-3 text-sm transition-minimal ${
            isActive('/admin/config')
              ? 'bg-accent text-accent-foreground border-l-2 border-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          }`}
        >
          <Settings2 className="h-5 w-5" />
          {t('nav.adminConfig')}
        </Link>
      )}
      <Link
        to="/announcements"
        onClick={() => setMobileMenuOpen(false)}
        className={`flex items-center gap-3 px-4 py-3 text-sm transition-minimal ${
          isActive('/announcements')
            ? 'bg-accent text-accent-foreground border-l-2 border-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`}
      >
        <Megaphone className="h-5 w-5" />
        {t('nav.announcements')}
      </Link>
    </>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Skip to main content link for keyboard navigation */}
      <SkipLink />

      {/* Desktop Sidebar */}
      <aside 
        className="hidden lg:block w-64 border-r border-border bg-card shrink-0"
        aria-label={t('mainLayout.aria.mainNavigation')}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-border">
            <Link to="/recipes" className="flex items-center gap-2">
              <img src="/images/PantryButlerLogo_v2.png" alt="PantryButler" className="h-8 w-auto" />
            </Link>
          </div>
          <nav className="flex-1 py-4" aria-label={t('mainLayout.aria.primaryNavigation')}>
            <NavLinks />
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="flex items-center justify-between px-4 py-4 lg:px-8">
            <div className="flex items-center gap-4">
              {/* Mobile Menu */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="lg:hidden"
                    aria-label={t('mainLayout.aria.openNavigationMenu')}
                  >
                    <Menu className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0" aria-label={t('mainLayout.aria.mobileNavigation')}>
                  <div className="p-6 border-b border-border">
                    <Link to="/recipes" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                      <img src="/images/PantryButlerLogo_v2.png" alt="PantryButler" className="h-8 w-auto" />
                    </Link>
                  </div>
                  <nav className="flex-1 py-4" aria-label={t('mainLayout.aria.primaryNavigation')}>
                    <NavLinks />
                  </nav>
                </SheetContent>
              </Sheet>

              <img src="/images/PantryButlerLogo_v2.png" alt="PantryButler" className="h-8 w-auto lg:hidden" />
            </div>

            {/* User Menu and Notifications */}
            <div className="flex items-center gap-2">
              {/* Notifications */}
              <DropdownMenu open={notificationsOpen} onOpenChange={(open) => {
                setNotificationsOpen(open);
                if (open) loadNotifications();
              }}>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="relative"
                    aria-label={notificationCount > 0
                      ? t('mainLayout.aria.notificationsWithCount', { count: notificationCount })
                      : t('mainLayout.aria.notifications')}
                    data-tutorial="notifications"
                  >
                    <Bell className="h-5 w-5" aria-hidden="true" />
                    {notificationCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                        aria-label={t('mainLayout.aria.unreadNotifications', { count: notificationCount })}
                      >
                        {notificationCount}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80" aria-label={t('mainLayout.aria.notificationsMenu')}>
                  <div className="flex items-center justify-between px-2 py-2 border-b">
                    <p className="text-sm font-medium">{t('nav.notifications')}</p>
                    {notificationCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                        {t('nav.markAllRead')}
                      </Button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 && announcements.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                        {t('nav.noNotifications')}
                      </div>
                    ) : (
                      <>
                        {/* Announcements first */}
                        {announcements.map((announcement) => (
                          <DropdownMenuItem
                            key={`announcement-${announcement.id}`}
                            className="flex flex-col items-start gap-1 p-3 cursor-pointer border-l-2 border-l-primary"
                            onClick={() => handleAnnouncementClick(announcement)}
                          >
                            <div className="flex items-center gap-2 w-full">
                              <Megaphone className="h-4 w-4 text-primary shrink-0" />
                              <p className="text-sm font-medium flex-1">{announcement.title}</p>
                              <div className="h-2 w-2 rounded-full bg-primary" />
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 ml-6">
                              {announcement.message}
                            </p>
                          </DropdownMenuItem>
                        ))}
                        
                        {/* Regular notifications */}
                        {notifications.map((notification) => (
                          <DropdownMenuItem
                            key={notification.id}
                            className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <div className="flex items-center gap-2 w-full">
                              <p className="text-sm font-medium flex-1">{notification.title}</p>
                              {!notification.is_read && (
                                <div className="h-2 w-2 rounded-full bg-primary" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{notification.message}</p>
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Donation Links */}
              <a 
                href="https://buymeacoffee.com/PantryButler" 
                target="_blank" 
                rel="noopener noreferrer"
                aria-label={t('mainLayout.aria.buyMeACoffee')}
              >
                <Button variant="ghost" size="icon">
                  <Coffee className="h-5 w-5" aria-hidden="true" />
                </Button>
              </a>
              <a 
                href="https://www.patreon.com/c/zedd00" 
                target="_blank" 
                rel="noopener noreferrer"
                aria-label={t('mainLayout.aria.patreon')}
              >
                <Button variant="ghost" size="icon">
                  <Heart className="h-5 w-5" aria-hidden="true" />
                </Button>
              </a>

              {/* Language Switcher */}
              <LanguageSwitcher />

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="flex items-center gap-2"
                    aria-label={t('mainLayout.aria.userMenuFor', { name: displayName })}
                    data-tutorial="user-menu"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline text-sm">{displayName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-2">
                    <p className="text-sm font-medium">{displayName}</p>
                    <p className="text-xs text-muted-foreground">{profile?.username}</p>
                    <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
                  </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  {t('profile')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Breadcrumb Navigation */}
        <div className="border-b border-border bg-card px-4 py-2 lg:px-8">
          <nav className="flex items-center space-x-1 text-sm text-muted-foreground">
            {getBreadcrumbs(location.pathname).map((crumb, index, array) => (
              <div key={crumb.href} className="flex items-center">
                {index === 0 ? (
                  <Link
                    to={crumb.href}
                    className="flex items-center hover:text-foreground transition-colors"
                  >
                    <Home className="h-4 w-4" />
                  </Link>
                ) : (
                  <>
                    <ChevronRight className="h-4 w-4 mx-1" />
                    {index === array.length - 1 ? (
                      <span className="text-foreground font-medium">{crumb.name}</span>
                    ) : (
                      <Link
                        to={crumb.href}
                        className="hover:text-foreground transition-colors"
                      >
                        {crumb.name}
                      </Link>
                    )}
                  </>
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* Page Content */}
        <main id="main-content" className="flex-1 p-4 lg:p-8" tabIndex={-1}>
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t bg-card px-4 py-6 lg:px-8" role="contentinfo">
          <div className="flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
            <p>{t('mainLayout.copyright')}</p>
            <nav aria-label={t('mainLayout.aria.footerNavigation')}>
              <div className="flex gap-4">
                <Link to="/privacy" className="hover:text-foreground transition-minimal">
                  {t('mainLayout.privacyPolicy')}
                </Link>
                <Link to="/attribution" className="hover:text-foreground transition-minimal">
                  {t('mainLayout.attribution')}
                </Link>
              </div>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}
