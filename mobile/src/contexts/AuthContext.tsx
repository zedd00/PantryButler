import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  ApiClient,
  ApiClientError,
  fetchMe,
  listPantry,
  login as apiLogin,
  mintApiToken,
  verifyEmail,
} from '../api/client';
import type { Instance, PantryItem, Profile } from '../api/types';

const KEY_SERVER_URL = 'pantrybutler.serverUrl';
const KEY_SERVER_CONFIGURED = 'pantrybutler.serverConfigured';
const KEY_JWT = 'pantrybutler.jwt';
const KEY_API_TOKEN = 'pantrybutler.apiToken';
const KEY_INSTANCE_ID = 'pantrybutler.instanceId';
const KEY_INSTANCE_NAME = 'pantrybutler.instanceName';

export const DEFAULT_SERVER_URL = 'https://pantrybutler.mythologic.al';

interface Session {
  serverUrl: string;
  apiToken: string;
  instanceId: string;
  instanceName: string;
}

interface AuthContextValue {
  session: Session | null;
  serverUrl: string | null;
  serverConfigured: boolean;
  restoring: boolean;
  authenticating: boolean;
  error: string | null;
  instances: Instance[];
  profile: Profile | null;
  pantry: PantryItem[];
  pantryLoading: boolean;
  jwt: string | null;
  login: (serverUrl: string, email: string, password: string) => Promise<Instance[]>;
  configureServer: (url: string) => void;
  selectInstance: (instanceId: string) => Promise<void>;
  completeEmailVerification: (token: string) => Promise<'done' | 'select_instance'>;
  updateSessionJwt: (newJwt: string) => void;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
  refreshPantry: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [serverConfigured, setServerConfigured] = useState(false);
  const [jwt, setJwt] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [instances, setInstances] = useState<Instance[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [pantryLoading, setPantryLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const sUrl = await SecureStore.getItemAsync(KEY_SERVER_URL);
      const configured = await SecureStore.getItemAsync(KEY_SERVER_CONFIGURED);
      const jwtVal = await SecureStore.getItemAsync(KEY_JWT);
      const apiToken = await SecureStore.getItemAsync(KEY_API_TOKEN);
      const instanceId = await SecureStore.getItemAsync(KEY_INSTANCE_ID);
      const instanceName = await SecureStore.getItemAsync(KEY_INSTANCE_NAME);
      if (configured === '1') setServerConfigured(true);
      if (sUrl) setServerUrl(sUrl);
      if (jwtVal) setJwt(jwtVal);
      if (sUrl && apiToken && instanceId) {
        setSession({ serverUrl: sUrl, apiToken, instanceId, instanceName: instanceName ?? '' });
      }
      setRestoring(false);
    })();
  }, []);

  const configureServer = useCallback((url: string) => {
    setServerUrl(url);
    setServerConfigured(true);
    void SecureStore.setItemAsync(KEY_SERVER_URL, url);
    void SecureStore.setItemAsync(KEY_SERVER_CONFIGURED, '1');
  }, []);

  const refreshPantry = useCallback(async () => {
    if (!session) return;
    const c = new ApiClient(session.serverUrl);
    setPantryLoading(true);
    try {
      const items = await listPantry(c, session.apiToken, session.instanceId);
      setPantry(items);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load pantry.');
    } finally {
      setPantryLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) refreshPantry();
  }, [session, refreshPantry]);

  const refreshProfile = useCallback(async () => {
    if (!serverUrl || !jwt) return;
    try {
      const c = new ApiClient(serverUrl);
      const me = await fetchMe(c, jwt);
      setProfile(me.profile);
      setInstances(me.instances);
    } catch {
      // Non-fatal; keep the existing profile if the refresh fails.
    }
  }, [serverUrl, jwt]);

  const updateSessionJwt = useCallback(async (newJwt: string) => {
    setJwt(newJwt);
    await SecureStore.setItemAsync(KEY_JWT, newJwt);
  }, []);

  const login = useCallback(async (inputUrl: string, email: string, password: string) => {
    setAuthenticating(true);
    setError(null);
    try {
      const c = new ApiClient(inputUrl);
      const res = await apiLogin(c, email, password);
      const me = await fetchMe(c, res.token);
      setJwt(res.token);
      setServerUrl(c.baseUrl);
      setServerConfigured(true);
      setProfile(me.profile);
      setInstances(me.instances);
      await SecureStore.setItemAsync(KEY_SERVER_URL, c.baseUrl);
      await SecureStore.setItemAsync(KEY_SERVER_CONFIGURED, '1');
      await SecureStore.setItemAsync(KEY_JWT, res.token);
      setAuthenticating(false);
      return me.instances;
    } catch (err) {
      setAuthenticating(false);
      setError(err instanceof ApiClientError ? err.message : 'Login failed.');
      return [];
    }
  }, []);

  const connectInstance = useCallback(
    async (sUrl: string, jwtToken: string, instanceId: string, instanceName: string) => {
      const c = new ApiClient(sUrl);
      const minted = await mintApiToken(c, jwtToken, instanceId);
      const next: Session = {
        serverUrl: sUrl,
        apiToken: minted.token,
        instanceId,
        instanceName: instanceName || '',
      };
      setSession(next);
      await SecureStore.setItemAsync(KEY_API_TOKEN, next.apiToken);
      await SecureStore.setItemAsync(KEY_INSTANCE_ID, next.instanceId);
      await SecureStore.setItemAsync(KEY_INSTANCE_NAME, next.instanceName);
    },
    [],
  );

  const selectInstance = useCallback(
    async (instanceId: string) => {
      if (!jwt || !serverUrl) return;
      setAuthenticating(true);
      setError(null);
      try {
        const instanceName = instances.find((i) => i.id === instanceId)?.name ?? '';
        await connectInstance(serverUrl, jwt, instanceId, instanceName);
        setAuthenticating(false);
      } catch (err) {
        setAuthenticating(false);
        setError(
          err instanceof ApiClientError ? err.message : 'Could not set up the kitchen connection.',
        );
      }
    },
    [jwt, serverUrl, instances, connectInstance],
  );

  const completeEmailVerification = useCallback(
    async (token: string): Promise<'done' | 'select_instance'> => {
      if (!serverUrl) throw new ApiClientError('No server configured.', 0);
      const c = new ApiClient(serverUrl);
      const res = await verifyEmail(c, token);
      setJwt(res.token);
      await SecureStore.setItemAsync(KEY_JWT, res.token);
      setServerConfigured(true);
      await SecureStore.setItemAsync(KEY_SERVER_CONFIGURED, '1');
      await SecureStore.setItemAsync(KEY_SERVER_URL, serverUrl);
      const me = await fetchMe(c, res.token);
      setProfile(me.profile);
      setInstances(me.instances);
      if (me.instances.length === 1) {
        await connectInstance(serverUrl, res.token, me.instances[0].id, me.instances[0].name);
        return 'done';
      }
      return 'select_instance';
    },
    [serverUrl, connectInstance],
  );

  const logout = useCallback(async () => {
    await Promise.allSettled([
      SecureStore.deleteItemAsync(KEY_SERVER_URL),
      SecureStore.deleteItemAsync(KEY_JWT),
      SecureStore.deleteItemAsync(KEY_API_TOKEN),
      SecureStore.deleteItemAsync(KEY_INSTANCE_ID),
      SecureStore.deleteItemAsync(KEY_INSTANCE_NAME),
    ]);
    setSession(null);
    setJwt(null);
    setServerUrl(null);
    setInstances([]);
    setProfile(null);
    setPantry([]);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      serverUrl,
      serverConfigured,
      restoring,
      authenticating,
      error,
      instances,
      profile,
      pantry,
      pantryLoading,
      jwt,
      login,
      configureServer,
      selectInstance,
      completeEmailVerification,
      updateSessionJwt,
      refreshProfile,
      logout,
      refreshPantry,
      clearError,
    }),
    [
      session,
      serverUrl,
      serverConfigured,
      restoring,
      authenticating,
      error,
      instances,
      profile,
      pantry,
      pantryLoading,
      jwt,
      login,
      configureServer,
      selectInstance,
      completeEmailVerification,
      updateSessionJwt,
      refreshProfile,
      logout,
      refreshPantry,
      clearError,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
