export * from './profiles';
export * from './auth';
export * from './folders';
export * from './tags';
export * from './recipes';
export * from './pantry';
export * from './conversions';
export * from './equipment';
export * from './grocery';
export * from './calendar';
export * from './settings';
export * from './locations';
export * from './notifications';
export * from './kitchen';
export * from './admin';
export * from './announcements';
export * from './config';
export * from './nutrition';
export * from './custom-nutrition';
export * from './tokens';

export function getCurrentInstanceId(): string | null {
  return localStorage.getItem('currentInstanceId');
}
