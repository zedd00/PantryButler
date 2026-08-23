import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setToken, clearToken, getStoredToken } from '@/lib/api-client';
import { verifyEmail, type RegisterResponse, type AuthResponse } from '@/api';
import type { Profile, Instance } from '@/types/types';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { safeConsole } from '@/utils/sanitization';

interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: Profile | null;
  currentInstance: Instance | null;
  instances: Instance[];
  loading: boolean;
  signInWithUsername: (username: string, password: string, rememberMe?: boolean) => Promise<{ error: Error | null }>;
  signUpWithUsername: (username: string, password: string, instanceName?: string) => Promise<{ error: Error | null; requiresEmailVerification?: boolean }>;
  completeEmailVerification: (token: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  switchInstance: (instanceId: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthMeResponse {
  profile: Profile;
  instances: Instance[];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation(['auth', 'common']);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentInstance, setCurrentInstance] = useState<Instance | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (_userId: string, _token: string) => {
    try {
      const data = await api.get<AuthMeResponse>('/api/auth/me');

      const userInstances = data.instances || [];
      setInstances(userInstances);

      const storedInstanceId = localStorage.getItem('currentInstanceId');
      const instanceId = storedInstanceId && userInstances.find((i: Instance) => i.id === storedInstanceId)
        ? storedInstanceId
        : userInstances.length > 0
          ? userInstances[0]!.id
          : (data.profile as any)?.instance_id || null;

      if (instanceId) {
        const matchedInstance = userInstances.find((i: Instance) => i.id === instanceId)
          || { id: instanceId, name: (data.profile as any)?.instance_name || 'Default', created_at: '', created_by: null, updated_at: '' };
        setProfile(data.profile);
        setCurrentInstance(matchedInstance);
        localStorage.setItem('currentInstanceId', instanceId);
      } else {
        setProfile(data.profile);
        setCurrentInstance(null);
      }
    } catch (error: any) {
      safeConsole.error('Error loading user data:', error);

      if (error.message?.includes('network') || error.message?.includes('fetch')) {
        toast.error(t('auth:errors.networkError'));
      } else {
        toast.error(t('auth:errors.loadUserDataFailed', { error: error.message }));
      }

      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    try {
      const data = await api.get<AuthMeResponse>('/api/auth/me');
      setProfile(data.profile);
      setInstances(data.instances);
    } catch (err) {
      safeConsole.error('Failed to refresh profile:', err);
    }
  };

  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userInfo: AuthUser = { id: payload.userId, email: payload.email };
        setUser(userInfo);
        loadUserData(userInfo.id, token);
      } catch {
        clearToken();
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const signInWithUsername = async (username: string, password: string, rememberMe?: boolean) => {
    try {
      let email = username;
      if (!username.includes('@')) {
        email = `${username}@pantrybutler.local`;
      }

      const data = await api.post<{ token: string; user: AuthUser }>('/api/auth/login', {
        email,
        password,
        remember_me: rememberMe,
      });
      setToken(data.token);
      setUser(data.user);
      setLoading(true);
      await loadUserData(data.user.id, data.token);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUpWithUsername = async (username: string, password: string, instanceName?: string) => {
    try {
      const email = username.includes('@')
        ? username
        : `${username}@pantrybutler.local`;

      const data = await api.post<RegisterResponse>('/api/auth/register', {
        email,
        password,
        instance_name: instanceName,
      });

      // When email verification is required the account is created but no
      // session is issued yet — the user must confirm their email first.
      if (data.requiresEmailVerification) {
        return { error: null, requiresEmailVerification: true };
      }

      const authData = data as AuthResponse;
      setToken(authData.token);
      setUser(authData.user);
      setLoading(true);
      await loadUserData(authData.user.id, authData.token);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const completeEmailVerification = async (token: string) => {
    try {
      const data = await verifyEmail(token);
      setToken(data.token);
      setUser(data.user);
      setLoading(true);
      await loadUserData(data.user.id, data.token);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    localStorage.removeItem('currentInstanceId');
    clearToken();
    setUser(null);
    setProfile(null);
    setCurrentInstance(null);
    setInstances([]);
  };

  const switchInstance = async (instanceId: string) => {
    if (!user) return;

    const instance = instances.find(i => i.id === instanceId);
    if (!instance) return;

    try {
      const data = await api.put<{ profile: Profile }>('/api/auth/instance', { instance_id: instanceId });
      setProfile(data.profile);
      setCurrentInstance(instance);
      localStorage.setItem('currentInstanceId', instanceId);

      window.location.href = '/recipes';
    } catch (err: any) {
      toast.error(t('auth:errors.switchInstanceFailed', { error: err.message }));
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      currentInstance,
      instances,
      loading,
      signInWithUsername,
      signUpWithUsername,
      completeEmailVerification,
      signOut,
      switchInstance,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
