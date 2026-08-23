import { query } from '../db/pool';

const WRITE_ROLES = new Set(['admin', 'user']);

export async function getMemberships(userId: string): Promise<Map<string, string>> {
  const result = await query(
    'SELECT instance_id, role FROM instance_members WHERE user_id = $1',
    [userId]
  );
  const map = new Map<string, string>();
  for (const row of result.rows) {
    map.set(row.instance_id as string, row.role as string);
  }
  return map;
}

export async function getInstanceRole(userId: string, instanceId: string): Promise<string | null> {
  const result = await query(
    'SELECT role FROM instance_members WHERE user_id = $1 AND instance_id = $2',
    [userId, instanceId]
  );
  return result.rows.length > 0 ? (result.rows[0].role as string) : null;
}

export async function getCanEditCalendar(userId: string, instanceId: string): Promise<boolean> {
  const result = await query(
    'SELECT can_edit_calendar FROM instance_members WHERE user_id = $1 AND instance_id = $2',
    [userId, instanceId]
  );
  return result.rows.length > 0 ? (result.rows[0].can_edit_calendar as boolean) : false;
}

export async function isMember(userId: string, instanceId: string): Promise<boolean> {
  if (!instanceId) return false;
  const memberships = await getMemberships(userId);
  return memberships.has(instanceId);
}

export async function isSuperAdmin(userId: string): Promise<boolean> {
  const result = await query('SELECT role FROM profiles WHERE id = $1', [userId]);
  return result.rows.length > 0 && result.rows[0].role === 'superadmin';
}

export async function canAccessInstance(userId: string, instanceId: string): Promise<boolean> {
  if (!instanceId) return false;
  if (await isMember(userId, instanceId)) return true;
  return isSuperAdmin(userId);
}

export async function canEditInstance(userId: string, instanceId: string): Promise<boolean> {
  if (!instanceId) return false;
  if (await isSuperAdmin(userId)) return true;
  const role = await getInstanceRole(userId, instanceId);
  return role !== null && WRITE_ROLES.has(role);
}

export async function canEditCalendar(userId: string, instanceId: string): Promise<boolean> {
  if (!instanceId) return false;
  if (await isSuperAdmin(userId)) return true;
  if (!(await canEditInstance(userId, instanceId))) return false;
  return getCanEditCalendar(userId, instanceId);
}
