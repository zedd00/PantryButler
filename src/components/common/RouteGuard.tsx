import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { hasUnseenAnnouncement } from '@/api';
import routes from '@/routes';

interface RouteGuardProps {
  children: React.ReactNode;
}

// System-level public routes (no need to register in routes.tsx)
const SYSTEM_PUBLIC_ROUTES = ['/login', '/403', '/404'];

// Derived from routes.tsx: all routes marked with public: true
const routePublicPaths: string[] = [];
routes.forEach(r => {
  if (r.public) {
    routePublicPaths.push(r.path);
    // Add child routes if they exist
    if (r.children) {
      r.children.forEach(child => {
        if (child.public) {
          routePublicPaths.push(child.path);
        }
      });
    }
  }
});

const PUBLIC_ROUTES = [...SYSTEM_PUBLIC_ROUTES, ...routePublicPaths];

function matchPublicRoute(path: string, patterns: string[]) {
  return patterns.some(pattern => {
    // Handle wildcard patterns
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
      return regex.test(path);
    }
    // Handle React Router style parameters (:param)
    if (pattern.includes(':')) {
      const regexPattern = pattern.replace(/:[^/]+/g, '[^/]+');
      const regex = new RegExp('^' + regexPattern + '$');
      return regex.test(path);
    }
    return path === pattern;
  });
}

export function RouteGuard({ children }: RouteGuardProps) {
  const { user, profile, currentInstance, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('common');
  const [checkedAnnouncement, setCheckedAnnouncement] = useState(false);

  useEffect(() => {
    if (loading) return;

    const isPublic = matchPublicRoute(location.pathname, PUBLIC_ROUTES);

    if (!user && !isPublic) {
      navigate('/login', { state: { from: location.pathname }, replace: true });
    }
  }, [user, loading, location.pathname, navigate]);

  // Check for unseen announcements after login
  useEffect(() => {
    const checkAnnouncement = async () => {
      // Wait for all auth data to load
      if (loading || !user) return;
      if (!profile || !currentInstance) return;
      if (checkedAnnouncement) return;
      
      // Don't redirect if already on announcements page or login page
      if (location.pathname === '/announcements' || location.pathname === '/login') {
        setCheckedAnnouncement(true);
        return;
      }

      try {
        const hasUnseen = await hasUnseenAnnouncement(profile.id, currentInstance.id);
        if (hasUnseen) {
          navigate('/announcements', { replace: true });
        }
      } catch (error) {
        console.error('Failed to check for unseen announcements:', error);
      } finally {
        setCheckedAnnouncement(true);
      }
    };

    checkAnnouncement();
  }, [user, profile, currentInstance, loading, location.pathname, checkedAnnouncement, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" role="status">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" aria-hidden="true"></div>
        <span className="sr-only">{t('loading')}</span>
      </div>
    );
  }

  return <>{children}</>;
}