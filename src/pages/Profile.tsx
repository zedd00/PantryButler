import { useEffect, useState } from 'react';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { api, setToken } from '@/lib/api-client';
import { Upload, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Profile() {
  const { t } = useTranslation(['settings', 'common']);
  const { profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [uploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setAvatarUrl(profile.avatar_url || null);
    }
  }, [profile]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile) return;

    toast.info(t('settings:profile.avatarUploadFuture'));
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    try {
      await api.put(`/api/profiles/${profile.id}`, {
        display_name: displayName || null,
      });

      toast.success(t('settings:profileUpdated'));
      refreshProfile();
    } catch (error: any) {
      toast.error(t('settings:profile.profileUpdateFailed', { error: error.message }));
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error(t('settings:profile.allPasswordFieldsRequired'));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t('settings:profile.newPasswordsMismatch'));
      return;
    }

    if (newPassword.length < 8) {
      toast.error(t('settings:profile.passwordMinLength'));
      return;
    }

    try {
      const response = await api.post<{ token: string }>('/api/auth/change-password', { currentPassword, password: newPassword });
      setToken(response.token);

      toast.success(t('settings:passwordChanged'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(t('settings:profile.passwordChangeFailed', { error: error.message }));
    }
  };

  const getInitials = () => {
    if (displayName) {
      return displayName.substring(0, 2).toUpperCase();
    }
    if (profile?.username) {
      return profile.username.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">{t('settings:profile.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('settings:profile.description')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('settings:profile.information')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar Upload Section */}
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatarUrl || undefined} alt={displayName || t('settings:profile.user')} />
                <AvatarFallback className="text-2xl">{getInitials()}</AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <Label htmlFor="avatar-upload">{t('settings:profilePicture')}</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={uploading}
                    onClick={() => document.getElementById('avatar-upload')?.click()}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('settings:profile.uploading')}
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        {t('settings:uploadPicture')}
                      </>
                    )}
                  </Button>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('settings:profile.maxSizeInfo')}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('settings:profile.usernameEmail')}</Label>
              <Input value={profile?.username || ''} disabled />
              <p className="text-xs text-muted-foreground">{t('settings:profile.usernameImmutable')}</p>
            </div>

            <div className="space-y-2">
              <Label>{t('settings:displayName')}</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('settings:profile.displayNamePlaceholder')}
              />
            </div>

            <Button onClick={handleSaveProfile}>{t('settings:profile.saveProfile')}</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('settings:changePassword')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('settings:currentPassword')}</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('settings:newPassword')}</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('settings:profile.confirmNewPassword')}</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <Button onClick={handleChangePassword}>{t('settings:changePassword')}</Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
