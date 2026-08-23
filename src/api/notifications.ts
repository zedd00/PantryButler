import { api } from '@/lib/api-client';
import type { Notification } from '@/types/types';

function getInstanceId(): string {
  const id = localStorage.getItem('currentInstanceId');
  if (!id) throw new Error('No instance selected');
  return id;
}

export async function getNotifications(_userId: string): Promise<Notification[]> {
  const instanceId = getInstanceId();
  return api.get<Notification[]>(`/api/notifications?instance_id=${instanceId}`);
}

export async function getUnreadNotificationCount(_userId: string): Promise<number> {
  const instanceId = getInstanceId();
  const result = await api.get<{ count: number }>(`/api/notifications/unread-count?instance_id=${instanceId}`);
  return result.count;
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  await api.put(`/api/notifications/${notificationId}/read`);
}

export async function markAllNotificationsAsRead(_userId: string): Promise<void> {
  const instanceId = getInstanceId();
  await api.put(`/api/notifications/read-all?instance_id=${instanceId}`);
}
