import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';

// Only allow resuming an /oauth/authorize flow on an origin we trust — blocks
// the consent page from being used as an open redirect.
function safeOauthRedirect(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const target = new URL(raw, window.location.origin);
    const apiOrigin = import.meta.env.VITE_API_URL
      ? new URL(import.meta.env.VITE_API_URL).origin
      : null;
    const allowed = [window.location.origin, apiOrigin].filter(Boolean) as string[];
    if (!allowed.includes(target.origin)) return null;
    if (!target.pathname.startsWith('/oauth/authorize')) return null;
    return target.toString();
  } catch {
    return null;
  }
}

export default function OAuthConsent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [saving, setSaving] = useState(false);

  const clientId = searchParams.get('client_id') || '';
  const clientName = searchParams.get('client_name') || clientId;
  const redirect = safeOauthRedirect(searchParams.get('redirect'));

  if (!clientId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Invalid request</CardTitle>
            <CardDescription className="text-center">
              This authorization request is missing required parameters.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={() => navigate('/')}>
              Go home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // The OAuth session runs on the pb_session cookie; the SPA login is what
  // proves the browser user. Send them to the login page and return here.
  if (!user) {
    const current = new URL(window.location.href);
    const loginUrl = `/login?redirect=${encodeURIComponent(current.toString())}`;
    window.location.href = loginUrl;
    return null;
  }

  const handleAllow = async () => {
    setSaving(true);
    try {
      await api.post('/oauth/consent', { client_id: clientId });
      if (redirect) {
        window.location.href = redirect;
      } else {
        toast.success('Authorization recorded');
        navigate('/');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to record authorization');
      setSaving(false);
    }
  };

  const handleDeny = () => {
    navigate('/');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="flex justify-center">
            <img src="/images/PantryButlerLogo_v2.png" alt="PantryButler" className="h-16 w-auto" />
          </CardTitle>
          <CardDescription className="text-center">
            Authorization request
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-center text-foreground">
            &quot;<strong>{clientName}</strong>&quot; is requesting access to your
            PantryButler account.
          </p>
          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={handleDeny}>
              Deny
            </Button>
            <Button onClick={handleAllow} disabled={saving}>
              {saving ? 'Authorizing…' : 'Allow'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
