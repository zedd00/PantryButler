export const WEB_SCOPES = [
  'recipes:read',
  'recipes:write',
  'pantry:read',
  'pantry:write',
  'grocery:read',
  'grocery:write',
  'calendar:read',
  'calendar:write',
  'nutrition:read',
  'nutrition:write',
  'kitchen:read',
  'kitchen:write',
  'profile:read',
  'profile:write',
  'settings:read',
  'settings:write',
] as const;

export const ALL_SCOPES: readonly string[] = [...WEB_SCOPES, 'all'];

export function normalizeScopes(scopes: string[] | undefined): string[] {
  if (!scopes || scopes.length === 0) return ['all'];
  const out = new Set<string>();
  for (const s of scopes) {
    if (!ALL_SCOPES.includes(s)) return [];
    out.add(s);
  }
  return Array.from(out);
}

// Down-scoping: requested ∩ granted. `all` grants everything.
export function scopeSubset(requested: string[], granted: string[]): boolean {
  if (granted.includes('all')) return true;
  return requested.every((s) => granted.includes(s));
}

// A token grants access to `scope` if it has `all` or the exact scope.
export function hasScope(scopes: string[], scope: string): boolean {
  if (scopes.includes('all')) return true;
  return scopes.includes(scope);
}

// Reject duplicate scope text and normalise into a stable unique list.
export function dedupeScopes(scopes: string[]): string[] {
  return Array.from(new Set(scopes));
}
