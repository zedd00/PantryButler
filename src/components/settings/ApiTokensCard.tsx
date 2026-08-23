import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { KeyRound, Loader2, Plus, Copy, Check, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { getApiTokens, createApiToken, revokeApiToken, revokeAllApiTokens, type CreateApiTokenResult } from '@/api/tokens';
import type { ApiToken } from '@/types/types';

const SCOPE_GROUPS: { key: string; scopes: { id: string; read: string; write: string }[] }[] = [
  {
    key: 'recipes',
    scopes: [
      { id: 'recipes', read: 'recipes:read', write: 'recipes:write' },
    ],
  },
  {
    key: 'pantry',
    scopes: [
      { id: 'pantry', read: 'pantry:read', write: 'pantry:write' },
    ],
  },
  {
    key: 'grocery',
    scopes: [
      { id: 'grocery', read: 'grocery:read', write: 'grocery:write' },
    ],
  },
  {
    key: 'calendar',
    scopes: [
      { id: 'calendar', read: 'calendar:read', write: 'calendar:write' },
    ],
  },
  {
    key: 'nutrition',
    scopes: [
      { id: 'nutrition', read: 'nutrition:read', write: 'nutrition:write' },
    ],
  },
  {
    key: 'kitchen',
    scopes: [
      { id: 'kitchen', read: 'kitchen:read', write: 'kitchen:write' },
    ],
  },
  {
    key: 'profile',
    scopes: [
      { id: 'profile', read: 'profile:read', write: 'profile:write' },
    ],
  },
  {
    key: 'settings',
    scopes: [
      { id: 'settings', read: 'settings:read', write: 'settings:write' },
    ],
  },
];

const EXPIRY_PRESETS = [
  { value: 'never', labelKey: 'settings:apiTokens.expiryNever' },
  { value: '7d', labelKey: 'settings:apiTokens.expiry7d' },
  { value: '30d', labelKey: 'settings:apiTokens.expiry30d' },
  { value: '90d', labelKey: 'settings:apiTokens.expiry90d' },
  { value: '1y', labelKey: 'settings:apiTokens.expiry1y' },
] as const;

function expiryMs(preset: string): number | null {
  switch (preset) {
    case '7d': return 7 * 24 * 60 * 60 * 1000;
    case '30d': return 30 * 24 * 60 * 60 * 1000;
    case '90d': return 90 * 24 * 60 * 60 * 1000;
    case '1y': return 365 * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function scopeLabel(scope: string): string {
  if (scope === 'all') return 'All';
  return scope;
}

export function ApiTokensCard() {
  const { t } = useTranslation(['settings', 'common']);
  const { instances, currentInstance } = useAuth();

  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [instanceId, setInstanceId] = useState<string>(currentInstance?.id || instances[0]?.id || '');
  const [useAllScopes, setUseAllScopes] = useState(true);
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set(SCOPE_GROUPS.flatMap((g) => g.scopes.map((s) => s.read))));
  const [expiryPreset, setExpiryPreset] = useState<string>('never');
  const [minting, setMinting] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [minted, setMinted] = useState<CreateApiTokenResult | null>(null);
  const [copied, setCopied] = useState(false);

  const loadTokens = useCallback(async () => {
    try {
      const data = await getApiTokens();
      setTokens(data || []);
    } catch (error: any) {
      toast.error(t('settings:apiTokens.listFailed', { error: error.message }));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  // Keep the instance selector in sync when context settles (e.g. after login).
  useEffect(() => {
    if (instanceId) return;
    setInstanceId(currentInstance?.id || instances[0]?.id || '');
  }, [instanceId, currentInstance, instances]);

  const allScopeIds = useMemo(() => SCOPE_GROUPS.flatMap((g) => g.scopes.map((s) => [s.read, s.write])).flat(), []);
  const resourceScope = useMemo(
    () => SCOPE_GROUPS.map((g) => ({ ...g, scopes: g.scopes[0]! })),
    []
  );

  const toggleResource = (read: string, write: string, checked: boolean) => {
    setSelectedScopes((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(read);
        next.add(write);
      } else {
        next.delete(read);
        next.delete(write);
      }
      return next;
    });
  };

  const resourceState = (read: string, write: string): 'checked' | 'partial' | 'unchecked' => {
    const hasRead = selectedScopes.has(read);
    const hasWrite = selectedScopes.has(write);
    if (hasRead && hasWrite) return 'checked';
    if (hasRead || hasWrite) return 'partial';
    return 'unchecked';
  };

  const handleMint = async () => {
    if (!name.trim()) {
      toast.error(t('settings:apiTokens.nameRequired'));
      return;
    }
    if (!instanceId) {
      toast.error(t('settings:apiTokens.instanceRequired'));
      return;
    }
    setMinting(true);
    setMinted(null);
    setCopied(false);
    try {
      const scopes = useAllScopes ? ['all'] : Array.from(selectedScopes);
      const expires_at = expiryPreset && expiryPreset !== 'never'
        ? new Date(Date.now() + (expiryMs(expiryPreset) ?? 0)).toISOString()
        : undefined;
      const result = await createApiToken({
        instance_id: instanceId,
        name: name.trim(),
        scopes,
        ...(expires_at ? { expires_at } : {}),
      });
      setMinted(result);
      setName('');
      setMinting(false);
      await loadTokens();
      toast.success(t('settings:apiTokens.mintSuccess'));
    } catch (error: any) {
      setMinting(false);
      toast.error(t('settings:apiTokens.mintFailed', { error: error.message }));
    }
  };

  const handleRevoke = async (id: string) => {
    setRevoking(id);
    try {
      await revokeApiToken(id);
      await loadTokens();
      toast.success(t('settings:apiTokens.revokeSuccess'));
    } catch (error: any) {
      toast.error(t('settings:apiTokens.revokeFailed', { error: error.message }));
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    try {
      await revokeAllApiTokens();
      await loadTokens();
      toast.success(t('settings:apiTokens.revokeAllSuccess'));
    } catch (error: any) {
      toast.error(t('settings:apiTokens.revokeAllFailed', { error: error.message }));
    } finally {
      setRevokingAll(false);
    }
  };

  const copyToken = async () => {
    if (!minted) return;
    try {
      await navigator.clipboard.writeText(minted.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('settings:apiTokens.copyFailed'));
    }
  };

  const activeTokens = tokens.filter((tk) => !tk.revoked_at);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          {t('settings:apiTokens.title')}
        </CardTitle>
        <CardDescription>{t('settings:apiTokens.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mint form */}
        <div className="space-y-4 rounded-lg border p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="token-name">{t('settings:apiTokens.name')}</Label>
              <Input
                id="token-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('settings:apiTokens.namePlaceholder')}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token-instance">{t('settings:apiTokens.instance')}</Label>
              <Select value={instanceId} onValueChange={setInstanceId}>
                <SelectTrigger id="token-instance">
                  <SelectValue placeholder={t('settings:apiTokens.selectInstance')} />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="token-expiry">{t('settings:apiTokens.expiry')}</Label>
              <Select value={expiryPreset} onValueChange={setExpiryPreset}>
                <SelectTrigger id="token-expiry">
                  <SelectValue placeholder={t('settings:apiTokens.selectExpiry')} />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {t(p.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Scope selection */}
          <div className="space-y-2">
            <Label>{t('settings:apiTokens.scopes')}</Label>
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <Checkbox
                id="scope-all"
                checked={useAllScopes}
                onCheckedChange={(v) => setUseAllScopes(v === true)}
              />
              <label htmlFor="scope-all" className="text-sm cursor-pointer">
                {t('settings:apiTokens.allScopes')}
              </label>
            </div>
            {!useAllScopes && (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {resourceScope.map((group) => {
                  const state = resourceState(group.scopes.read, group.scopes.write);
                  return (
                    <div key={group.key} className="flex items-center gap-2 rounded-md border px-3 py-2">
                      <Checkbox
                        id={`scope-${group.scopes.id}`}
                        checked={state === 'checked' ? true : state === 'partial' ? 'indeterminate' : false}
                        onCheckedChange={(v) => toggleResource(group.scopes.read, group.scopes.write, v === true)}
                      />
                      <label htmlFor={`scope-${group.scopes.id}`} className="text-sm flex-1 cursor-pointer">
                        {t(`settings:apiTokens.resources.${group.key}`)}
                      </label>
                      <span className="text-xs text-muted-foreground">
                        {t('settings:apiTokens.read')} / {t('settings:apiTokens.write')}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {!useAllScopes && (
              <p className="text-xs text-muted-foreground">
                {t('settings:apiTokens.scopeHelp', { selected: selectedScopes.size, total: allScopeIds.length })}
              </p>
            )}
          </div>

          <Button onClick={handleMint} disabled={minting}>
            {minting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            {t('settings:apiTokens.mint')}
          </Button>
        </div>

        {/* Show the plaintext secret exactly once */}
        {minted && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-sm font-medium">{t('settings:apiTokens.secretOnce')}</p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-md bg-background border border-border px-3 py-2 text-xs">
                {minted.token}
              </code>
              <Button size="sm" variant="outline" onClick={copyToken}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? t('common:copied') : t('common:copy')}
              </Button>
            </div>
          </div>
        )}

        {/* Token list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">{t('settings:apiTokens.listTitle', { count: activeTokens.length })}</h3>
            {tokens.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={revokingAll}>
                    {revokingAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                    {t('settings:apiTokens.revokeAll')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('settings:apiTokens.revokeAllConfirmTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('settings:apiTokens.revokeAllConfirmDescription')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRevokeAll}>
                      {t('settings:apiTokens.revokeAll')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t('settings:apiTokens.empty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('settings:apiTokens.name')}</TableHead>
                  <TableHead>{t('settings:apiTokens.scopes')}</TableHead>
                  <TableHead>{t('settings:apiTokens.expires')}</TableHead>
                  <TableHead>{t('settings:apiTokens.lastUsed')}</TableHead>
                  <TableHead>{t('settings:apiTokens.status')}</TableHead>
                  <TableHead className="text-right">{t('common:actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((tk) => {
                  const revoked = !!tk.revoked_at;
                  const expired = !revoked && tk.expires_at && new Date(tk.expires_at) <= new Date();
                  return (
                    <TableRow key={tk.id}>
                      <TableCell className="font-medium">{tk.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {tk.scopes.map((s) => (
                            <Badge key={s} variant="secondary">{scopeLabel(s)}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(tk.expires_at)}</TableCell>
                      <TableCell>{formatDate(tk.last_used_at)}</TableCell>
                      <TableCell>
                        {revoked ? (
                          <Badge variant="destructive">{t('settings:apiTokens.revoked')}</Badge>
                        ) : expired ? (
                          <Badge variant="outline">{t('settings:apiTokens.expired')}</Badge>
                        ) : (
                          <Badge className="bg-green-600 text-white">{t('settings:apiTokens.active')}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!revoked && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={revoking === tk.id}
                                className="text-destructive hover:text-destructive"
                              >
                                {revoking === tk.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('settings:apiTokens.revokeConfirmTitle', { name: tk.name })}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('settings:apiTokens.revokeConfirmDescription', { name: tk.name })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleRevoke(tk.id)}>
                                  {t('settings:apiTokens.revoke')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
