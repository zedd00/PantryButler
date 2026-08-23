import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ChefHat, MailCheck } from 'lucide-react';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import { PasswordStrengthIndicator } from '@/components/common/PasswordStrengthIndicator';
import { validatePassword } from '@/utils/passwordValidation';
import { sanitizeText } from '@/utils/sanitization';
import { resendVerification } from '@/api';

export default function RegisterInstance() {
  const { t } = useTranslation(['auth', 'common']);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [instanceName, setInstanceName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [verificationPending, setVerificationPending] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const { signUpWithUsername } = useAuth();
  const navigate = useNavigate();

  const handleResend = async () => {
    if (!verificationPending) return;
    setResending(true);
    try {
      await resendVerification(verificationPending);
      toast.success(t('auth:registerInstance.resendSent'));
    } catch (error: any) {
      toast.error(error.message || t('auth:registerInstance.resendFailed'));
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const sanitizedInstanceName = sanitizeText(instanceName);
    const sanitizedEmail = email.trim().toLowerCase();

    if (!sanitizedInstanceName) {
      toast.error(t('auth:registerInstance.kitchenNameRequired'));
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      toast.error(t('auth:passwordMismatch'));
      setIsLoading(false);
      return;
    }

    const passwordValidation = validatePassword(password, undefined, t);
    if (!passwordValidation.isValid) {
      toast.error(passwordValidation.errors[0] || t('auth:registerInstance.requirementsNotMet'));
      setIsLoading(false);
      return;
    }

    try {
      const result = await signUpWithUsername(sanitizedEmail, password, sanitizedInstanceName);

      if (result.error) {
        throw result.error;
      }

      // Email verification required: account created but no session yet.
      if (result.requiresEmailVerification) {
        setVerificationPending(sanitizedEmail);
        return;
      }

      toast.success(t('auth:registerInstance.created'));
      navigate('/recipes');
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || t('auth:registerInstance.createFailed', { error: '' }));
    } finally {
      setIsLoading(false);
    }
  };

  if (verificationPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4 relative">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
                <MailCheck className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">{t('auth:registerInstance.verifyEmailTitle')}</CardTitle>
            <CardDescription>
              {t('auth:registerInstance.verifyEmailDesc', { email: verificationPending })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              {t('auth:registerInstance.verifyEmailHint')}
            </p>
            <Button className="w-full" onClick={handleResend} disabled={resending}>
              {resending ? t('auth:registerInstance.resending') : t('auth:registerInstance.resendEmail')}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/login')}
              disabled={resending}
            >
              {t('auth:registerInstance.backToLogin')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4 relative">
      {/* Language Switcher - Top Right */}
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
              <ChefHat className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">{t('auth:setupKitchen')}</CardTitle>
          <CardDescription>
            {t('auth:createOwnKitchen')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="instance-name">{t('auth:kitchenName')} *</Label>
              <Input
                id="instance-name"
                type="text"
                placeholder={t('auth:myKitchen')}
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                required
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                {t('auth:kitchenNameDesc')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('auth:email')} *</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('auth:emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('auth:password')} *</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
              {password && (
                <PasswordStrengthIndicator password={password} showRequirements={true} />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t('auth:confirmPassword')} *</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-sm text-red-600">{t('auth:passwordMismatch')}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t('auth:creatingInstance') : t('auth:createInstance')}
            </Button>

            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={() => navigate('/login')}
                disabled={isLoading}
              >
                {t('auth:alreadyHaveAccount')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
