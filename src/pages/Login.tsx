import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { MailCheck } from 'lucide-react';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import { resendVerification } from '@/api';

// Only allow same-origin redirects (or the API origin in dev) to prevent open
// redirect abuse via /login?redirect=...
function safeRedirect(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const target = new URL(raw, window.location.origin);
    const apiOrigin = import.meta.env.VITE_API_URL
      ? new URL(import.meta.env.VITE_API_URL).origin
      : null;
    const allowed = [window.location.origin, apiOrigin].filter(Boolean) as string[];
    if (!allowed.includes(target.origin)) return null;
    if (!target.pathname.startsWith('/oauth/authorize') && !target.pathname.startsWith('/oauth/consent')) return null;
    return target.toString();
  } catch {
    return null;
  }
}

export default function Login() {
  const { t } = useTranslation(['auth', 'common']);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const { signInWithUsername } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const redirect = safeRedirect(searchParams.get('redirect'));
  const from = redirect ?? '/recipes';

  const handleResend = async () => {
    if (!emailNotVerified) return;
    setResending(true);
    try {
      await resendVerification(emailNotVerified);
      toast.success(t('auth:registerInstance.resendSent'));
    } catch (error: any) {
      toast.error(error.message || t('auth:registerInstance.resendFailed'));
    } finally {
      setResending(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signInWithUsername(username, password, rememberMe);

    if (error) {
      const code = (error as any)?.body?.error;
      if (code === 'email_not_verified') {
        const email = username.includes('@')
          ? username.trim().toLowerCase()
          : `${username.trim()}@pantrybutler.local`;
        setEmailNotVerified(email);
        setIsLoading(false);
        return;
      }
      toast.error(t('auth:loginForm.failed', { error: error.message }));
      setIsLoading(false);
      return;
    }

    toast.success(t('auth:loginForm.success'));
    if (redirect) {
      window.location.href = redirect;
    } else {
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4 relative">
      {/* Language Switcher - Top Right */}
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="flex justify-center">
            <img src="/images/PantryButlerLogo_v2.png" alt="PantryButler" className="h-16 w-auto" />
          </CardTitle>
          <CardDescription>{t('auth:tagline')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-6" aria-label={t('auth:loginForm.ariaLabel')}>
            <div className="space-y-2">
              <Label htmlFor="login-username">{t('auth:username')}</Label>
              <Input
                id="login-username"
                type="text"
                placeholder={t('auth:enterUsername')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                aria-required="true"
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password">{t('auth:password')}</Label>
              <Input
                id="login-password"
                type="password"
                placeholder={t('auth:enterPassword')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-required="true"
                autoComplete="current-password"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                aria-label={t('auth:rememberMe')}
              />
              <Label htmlFor="remember" className="text-sm cursor-pointer">
                {t('auth:rememberMe')}
              </Label>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading} aria-busy={isLoading}>
              {isLoading ? t('auth:loggingIn') : t('common:login')}
            </Button>
          </form>

          {emailNotVerified && (
            <Alert className="mt-6">
              <MailCheck className="h-4 w-4" />
              <AlertTitle>{t('auth:emailNotVerifiedTitle')}</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>{t('auth:emailNotVerifiedDesc', { email: emailNotVerified })}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResend}
                  disabled={resending}
                >
                  {resending ? t('auth:registerInstance.resending') : t('auth:registerInstance.resendEmail')}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="mt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                {t('auth:wantOwnKitchen')}
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/register-instance')}
              >
                {t('auth:setupKitchen')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
