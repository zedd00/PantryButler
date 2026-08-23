import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from './AuthContext';
import { safeConsole } from '@/utils/sanitization';

interface TutorialContextType {
  isTutorialCompleted: (tutorialId: string) => boolean;
  markTutorialCompleted: (tutorialId: string) => Promise<void>;
  resetTutorial: (tutorialId: string) => Promise<void>;
  resetAllTutorials: () => Promise<void>;
  completedTutorials: Set<string>;
  loading: boolean;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export function TutorialProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [completedTutorials, setCompletedTutorials] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Load completed tutorials when user logs in
  useEffect(() => {
    if (user) {
      loadCompletedTutorials();
    } else {
      setCompletedTutorials(new Set());
      setLoading(false);
    }
  }, [user]);

  const loadCompletedTutorials = async () => {
    if (!user) return;

    try {
      console.log('Loading completed tutorials for user:', user.id);
      const data = await api.get<{ tutorial_id: string }[]>(`/api/user-tutorials?user_id=${user.id}`);

      const completed = new Set(data?.map(t => t.tutorial_id) || []);
      console.log('Loaded completed tutorials:', Array.from(completed));
      setCompletedTutorials(completed);
    } catch (error) {
      safeConsole.error('Failed to load completed tutorials:', error);
    } finally {
      setLoading(false);
    }
  };

  const isTutorialCompleted = useCallback((tutorialId: string): boolean => {
    return completedTutorials.has(tutorialId);
  }, [completedTutorials]);

  const markTutorialCompleted = useCallback(async (tutorialId: string) => {
    if (!user) {
      console.warn('Cannot mark tutorial completed: no user');
      return;
    }

    try {
      console.log('Marking tutorial as completed:', tutorialId, 'for user:', user.id);
      await api.post('/api/user-tutorials', {
        user_id: user.id,
        tutorial_id: tutorialId,
      });

      console.log('Tutorial marked as completed successfully');
      setCompletedTutorials(prev => new Set([...prev, tutorialId]));
    } catch (error) {
      safeConsole.error('Failed to mark tutorial as completed:', error);
    }
  }, [user]);

  const resetTutorial = useCallback(async (tutorialId: string) => {
    if (!user) return;

    try {
      await api.delete(`/api/user-tutorials?user_id=${user.id}&tutorial_id=${tutorialId}`);

      setCompletedTutorials(prev => {
        const newSet = new Set(prev);
        newSet.delete(tutorialId);
        return newSet;
      });
    } catch (error) {
      safeConsole.error('Failed to reset tutorial:', error);
    }
  }, [user]);

  const resetAllTutorials = useCallback(async () => {
    if (!user) return;

    try {
      await api.delete(`/api/user-tutorials?user_id=${user.id}`);

      setCompletedTutorials(new Set());
    } catch (error) {
      safeConsole.error('Failed to reset all tutorials:', error);
    }
  }, [user]);

  return (
    <TutorialContext.Provider
      value={{
        isTutorialCompleted,
        markTutorialCompleted,
        resetTutorial,
        resetAllTutorials,
        completedTutorials,
        loading,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
}
