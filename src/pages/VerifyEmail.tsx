import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getStoredToken } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { useTranslation } from 'react-i18next';

type VerifyStatus = 'verifying' | 'success' | 'error';

export default function VerifyEmail() {
  const { t } = useTranslation(['auth', 'common']);
  const { completeEmailVerification } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<VerifyStatus>('verifying');
  const [errorCode, setErrorCode] = useState('');
  const ranRef = useRef<string | false>(false);

  useEffect(() => {
    const token = searchParams.get('token');

    // Guard against running twice for the same token (React StrictMode
    // double-invokes effects in dev, and a link can be followed more than once).
    // Verifying again with the same token would fail because the first call
    // consumes it. A brand-new token still runs.
    if (ranRef.current === token) return;

    if (!token) {
      setErrorCode('missing');
      setStatus('error');
      return;
    }
    ranRef.current = token;

    completeEmailVerification(token).then(({ error }) => {
      if (error) {
        const body = (error as any)?.body;
        const code = typeof body?.error === 'string' ? body.error : 'generic';

        // If the email is already verified (or this token was already used by a
        // prior successful verification) and we now hold a session, treat it as
        // success rather than showing a scary error.
        if ((code === 'already_verified' || code === 'invalid_or_used') && getStoredToken()) {
          setStatus('success');
          setTimeout(() => navigate('/recipes'), 1500);
          return;
        }

        setErrorCode(code);
        setStatus('error');
      } else {
        setStatus('success');
        setTimeout(() => navigate('/recipes'), 2000);
      }
    });
  }, [searchParams]);

  const errorMessage = () => {
    switch (errorCode) {
      case 'invalid_or_used':
        return t('auth:verifyEmail.invalidOrUsed');
      case 'expired':
        return t('auth:verifyEmail.expired');
      case 'already_verified':
        return t('auth:verifyEmail.alreadyVerified');
      case 'missing':
        return t('auth:verifyEmail.missingToken');
      default:
        return t('auth:verifyEmail.genericError');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          {status === 'verifying' && (
            <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
          )}
          {status === 'success' && (
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
          )}
          {status === 'error' && (
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
          )}
          <CardTitle className="text-2xl font-bold">
            {status === 'verifying' && t('auth:verifyEmail.verifyingTitle')}
            {status === 'success' && t('auth:verifyEmail.successTitle')}
            {status === 'error' && t('auth:verifyEmail.errorTitle')}
          </CardTitle>
          <CardDescription>
            {status === 'verifying' && t('auth:verifyEmail.verifyingDesc')}
            {status === 'success' && t('auth:verifyEmail.successDesc')}
            {status === 'error' && errorMessage()}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {status === 'success' && (
            <Button className="w-full" onClick={() => navigate('/recipes')}>
              {t('auth:verifyEmail.goToRecipes')}
            </Button>
          )}
          {status === 'error' && (
            <>
              <Button className="w-full" onClick={() => navigate('/login')}>
                {t('auth:verifyEmail.goLogin')}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/register-instance')}
              >
                {t('auth:verifyEmail.backToRegister')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}