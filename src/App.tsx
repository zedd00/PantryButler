import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import IntersectObserver from '@/components/common/IntersectObserver';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from 'next-themes';
import { ThemeSync } from '@/components/common/ThemeSync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '@/i18n/config';

import routes from './routes';

import { AuthProvider } from '@/contexts/AuthContext';
import { TutorialProvider } from '@/contexts/TutorialContext';
import { RouteGuard } from '@/components/common/RouteGuard';

function AppContent() {
  useDocumentTitle();
  
  // Request notification permission and initialize audio on mount
  useEffect(() => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      console.log('Requesting notification permission...');
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
      });
    }
    
    // Initialize audio context on first user interaction
    const initAudio = () => {
      console.log('User interaction detected, initializing audio...');
      
      // Create a silent audio element to unlock audio playback
      const audio = new Audio('/timer.wav');
      audio.volume = 0.01; // Very low volume for test
      audio.play()
        .then(() => {
          console.log('Audio context initialized successfully');
          audio.pause();
        })
        .catch(error => {
          console.log('Audio initialization will happen on timer start:', error.message);
        });
      
      // Remove listener after first interaction
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
    };
    
    // Listen for first user interaction
    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('keydown', initAudio, { once: true });
    
    return () => {
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
    };
  }, []);
  
  return (
    <>
      <ThemeSync />
      <RouteGuard>
        <IntersectObserver />
        <Routes>
          {routes.map((route, index) => {
            if (route.children) {
              return (
                <Route key={index} path={route.path} element={route.element}>
                  {route.children.map((child, childIndex) => (
                    <Route
                      key={childIndex}
                      path={child.path}
                      element={child.element}
                      index={child.path === route.path}
                    />
                  ))}
                </Route>
              );
            }
            return (
              <Route
                key={index}
                path={route.path}
                element={route.element}
              />
            );
          })}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </RouteGuard>
    </>
  );
}

const App: React.FC = () => {
  const { t } = useTranslation('common');
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen" role="status" aria-live="polite">
          <span className="text-lg">{t('loading')}</span>
        </div>
      }>
        <Router>
          <AuthProvider>
            <TutorialProvider>
              <AppContent />
            </TutorialProvider>
          </AuthProvider>
        </Router>
      </Suspense>
    </ThemeProvider>
  );
};

export default App;
