import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Save, RotateCcw, MailCheck, KeyRound } from 'lucide-react';
import { getAdminConfig, updateAdminConfig, isSuperAdmin, type AdminConfig } from '@/api';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export default function AdminConfigPage() {
  const navigate = useNavigate();
  const { t } = useTranslation(['admin', 'common']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const [requireEmailVerification, setRequireEmailVerification] = useState(false);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [passwordSet, setPasswordSet] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const isSuperAdminUser = await isSuperAdmin();
      if (!isSuperAdminUser) {
        toast.error(t('admin:config.toasts.accessDenied'));
        navigate('/recipes');
        return;
      }
      loadConfig();
    } catch (error: any) {
      toast.error(t('admin:config.toasts.verifyFailed'));
      navigate('/recipes');
    }
  };

  const loadConfig = async () => {
    try {
      const data: AdminConfig = await getAdminConfig();
      setRequireEmailVerification(data.require_email_verification);
      setSmtpHost(data.smtp.host ?? '');
      setSmtpPort(String(data.smtp.port || 587));
      setSmtpUsername(data.smtp.username ?? '');
      setSmtpFrom(data.smtp.from ?? '');
      setSmtpSecure(data.smtp.secure);
      setPasswordSet(data.smtp.passwordSet);
      setSmtpPassword('');
    } catch (error: any) {
      toast.error(t('admin:config.toasts.loadFailed', { error: error.message }));
      if (error.message.includes('Forbidden') || error.message.includes('Unauthorized')) {
        navigate('/recipes');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const port = parseInt(smtpPort, 10);
      await updateAdminConfig({
        require_email_verification: requireEmailVerification,
        smtp: {
          host: smtpHost.trim() || null,
          port: Number.isFinite(port) && port > 0 ? port : null,
          username: smtpUsername.trim() || null,
          from: smtpFrom.trim() || null,
          secure: smtpSecure,
          ...(smtpPassword ? { password: smtpPassword } : {}),
        },
      });
      toast.success(t('admin:config.toasts.saved'));
      setPasswordSet(Boolean(smtpPassword));
      setSmtpPassword('');
      loadConfig();
    } catch (error: any) {
      toast.error(t('admin:config.toasts.saveFailed', { error: error.message }));
    } finally {
      setSaving(false);
    }
  };

  const handleResetSmtp = async () => {
    setResetDialogOpen(false);
    setSaving(true);
    try {
      await updateAdminConfig({ reset_smtp: true });
      toast.success(t('admin:config.toasts.resetDone'));
      setSmtpPassword('');
      loadConfig();
    } catch (error: any) {
      toast.error(t('admin:config.toasts.resetFailed', { error: error.message }));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8 max-w-2xl">
        <div>
          <h1 className="text-3xl font-semibold">{t('admin:config.headings.management')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('admin:config.text.description')}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MailCheck className="h-5 w-5" />
              {t('admin:config.headings.emailVerification')}
            </CardTitle>
            <CardDescription>
              {t('admin:config.text.emailVerificationDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Switch
                id="require-email-verification"
                checked={requireEmailVerification}
                onCheckedChange={setRequireEmailVerification}
              />
              <Label htmlFor="require-email-verification">
                {t('admin:config.labels.requireEmailVerification')}
              </Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              {t('admin:config.headings.smtp')}
            </CardTitle>
            <CardDescription>
              {t('admin:config.text.smtpDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="smtp-host">{t('admin:config.labels.smtpHost')}</Label>
              <Input
                id="smtp-host"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.example.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp-port">{t('admin:config.labels.smtpPort')}</Label>
                <Input
                  id="smtp-port"
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  placeholder="587"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-from">{t('admin:config.labels.smtpFrom')}</Label>
                <Input
                  id="smtp-from"
                  value={smtpFrom}
                  onChange={(e) => setSmtpFrom(e.target.value)}
                  placeholder="pantrybutler@example.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-username">{t('admin:config.labels.smtpUsername')}</Label>
              <Input
                id="smtp-username"
                value={smtpUsername}
                onChange={(e) => setSmtpUsername(e.target.value)}
                placeholder="apikey"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-password">{t('admin:config.labels.smtpPassword')}</Label>
              <Input
                id="smtp-password"
                type="password"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                placeholder={passwordSet ? t('admin:config.placeholders.passwordSaved') : t('admin:config.placeholders.password')}
                autoComplete="new-password"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="smtp-secure"
                checked={smtpSecure}
                onCheckedChange={setSmtpSecure}
              />
              <Label htmlFor="smtp-secure">
                {t('admin:config.labels.smtpSecure')}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('admin:config.text.smtpEnvFallback')}
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? t('common:saving') : t('admin:config.buttons.save')}
          </Button>
          <Button variant="outline" onClick={() => setResetDialogOpen(true)} disabled={saving}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {t('admin:config.buttons.resetSmtp')}
          </Button>
        </div>
      </div>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin:config.dialogs.resetSmtpTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin:config.dialogs.resetSmtpDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetSmtp}>{t('common:confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}