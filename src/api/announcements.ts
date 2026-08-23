import { api } from '@/lib/api-client';

export async function getAllAnnouncements(instanceId: string): Promise<any[]> {
  return api.get<any[]>(`/api/announcements?instance_id=${instanceId}`);
}

export async function hasUnseenAnnouncement(_userId: string, instanceId: string): Promise<boolean> {
  try {
    const result = await api.get<{ hasUnseen: boolean }>(`/api/announcements/has-unseen?instance_id=${instanceId}`);
    return result.hasUnseen;
  } catch {
    return false;
  }
}

export async function markAnnouncementViewed(_userId: string, announcementId: string, instanceId: string): Promise<void> {
  try {
    await api.post(`/api/announcements/${announcementId}/view`, { instance_id: instanceId });
  } catch {}
}

export async function getActiveAnnouncements(instanceId: string): Promise<any[]> {
  return api.get<any[]>(`/api/announcements/active-list?instance_id=${instanceId}`);
}

export async function getUnreadAnnouncementsCount(_userId: string, instanceId: string): Promise<number> {
  try {
    const result = await api.get<{ count: number }>(`/api/announcements/unread-count?instance_id=${instanceId}`);
    return result.count;
  } catch {
    return 0;
  }
}

export async function createAnnouncement(instanceId: string, title: string, message: string): Promise<any> {
  return api.post<any>('/api/announcements', { instance_id: instanceId, title, message });
}

export async function updateAnnouncement(id: string, title: string, message: string, isActive: boolean): Promise<void> {
  await api.put(`/api/announcements/${id}`, { title, message, is_active: isActive });
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await api.delete(`/api/announcements/${id}`);
}
