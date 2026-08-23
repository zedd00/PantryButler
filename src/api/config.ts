import { api } from '@/lib/api-client';

export interface AppConfig {
  enableAdminFeatures: boolean;
  requiresEmailVerification: boolean;
}

export async function getAppConfig(): Promise<AppConfig> {
  try {
    return await api.get<AppConfig>('/api/config');
  } catch {
    return { enableAdminFeatures: false, requiresEmailVerification: false };
  }
}
