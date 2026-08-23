import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { getSettings } from '@/api';

/**
 * ThemeSync component
 * Syncs theme settings (dark mode, vibrant mode) with instance-specific settings
 * This ensures that when users switch instances, they get the correct theme for that instance
 */
export function ThemeSync() {
  const { profile, currentInstance } = useAuth();
  const { setTheme } = useTheme();

  useEffect(() => {
    const syncTheme = async () => {
      if (!profile || !currentInstance) return;

      try {
        const settings = await getSettings();
        
        if (settings) {
          // Apply dark mode
          setTheme(settings.dark_mode ? 'dark' : 'light');
          
          // Apply vibrant mode
          if (settings.vibrant_mode) {
            document.documentElement.classList.add('vibrant-mode');
          } else {
            document.documentElement.classList.remove('vibrant-mode');
          }
        }
      } catch (error) {
        console.error('Failed to sync theme:', error);
      }
    };

    syncTheme();
  }, [profile, currentInstance, setTheme]);

  return null; // This component doesn't render anything
}
