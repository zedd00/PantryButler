import { api } from '@/lib/api-client';

export interface InstanceWithDetails {
  id: string;
  name: string;
  created_at: string;
  creator_email: string;
  last_login: string | null;
}

export async function isSuperAdmin(): Promise<boolean> {
  try {
    await api.get('/api/admin/instances');
    return true;
  } catch {
    return false;
  }
}

export async function getAllInstancesWithDetails(): Promise<InstanceWithDetails[]> {
  return api.get<InstanceWithDetails[]>('/api/admin/instances');
}

export async function deleteInstanceCompletely(instanceId: string): Promise<void> {
  await api.delete(`/api/admin/instances/${instanceId}`);
}

export interface AdminSmtpConfig {
  host: string | null;
  port: number;
  username: string | null;
  from: string | null;
  secure: boolean;
  passwordSet: boolean;
}

export interface AdminSmtpOverride {
  host: string | null;
  port: number | null;
  username: string | null;
  passwordSet: boolean;
  from: string | null;
  secure: boolean | null;
}

export interface AdminConfig {
  require_email_verification: boolean;
  require_email_verification_override: boolean | null;
  smtp: AdminSmtpConfig;
  smtp_override: AdminSmtpOverride;
}

export interface UpdateAdminConfigInput {
  require_email_verification?: boolean;
  smtp?: {
    host?: string | null;
    port?: number | null;
    username?: string | null;
    password?: string | null;
    from?: string | null;
    secure?: boolean | null;
  };
  reset_smtp?: boolean;
}

export async function getAdminConfig(): Promise<AdminConfig> {
  return api.get<AdminConfig>('/api/admin/config');
}

export async function updateAdminConfig(input: UpdateAdminConfigInput): Promise<{ success: boolean }> {
  return api.put<{ success: boolean }>('/api/admin/config', input);
}

export interface SetupFile {
  name: string;
  sizeBytes: number;
}

export async function importNutritionBatch(batchData: any[]): Promise<{ success: boolean; imported: number }> {
  return api.post<{ success: boolean; imported: number }>('/api/nutrition/import-batch', { batch_data: batchData });
}

export async function getSetupFiles(): Promise<SetupFile[]> {
  return api.get<SetupFile[]>('/api/setup/files');
}

export async function getSetupFileContent(filename: string): Promise<{ data: any[] }> {
  return api.get<{ data: any[] }>(`/api/setup/files/${encodeURIComponent(filename)}`);
}

export async function getNutritionCount(): Promise<number> {
  try {
    const result = await api.get<{ validation: { nutritionCount: number } }>('/api/setup/status');
    return result.validation.nutritionCount;
  } catch {
    return 0;
  }
}
