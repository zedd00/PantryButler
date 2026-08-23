import { describe, it, expect } from 'vitest';
import { normalizeScopes, scopeSubset, hasScope, ALL_SCOPES, WEB_SCOPES } from '../src/utils/scopes';

describe('normalizeScopes', () => {
  it('defaults to ["all"] when omitted', () => {
    expect(normalizeScopes(undefined)).toEqual(['all']);
    expect(normalizeScopes([])).toEqual(['all']);
  });

  it('passes through known scopes, preserving order', () => {
    expect(normalizeScopes(['recipes:read', 'recipes:write'])).toEqual(['recipes:read', 'recipes:write']);
  });

  it('rejects an unknown scope entirely (returns [])', () => {
    expect(normalizeScopes(['recipes:read', 'bogus:scope'])).toEqual([]);
    expect(normalizeScopes(['recipes:read'])).not.toEqual([]);
  });

  it('deduplicates', () => {
    expect(normalizeScopes(['recipes:read', 'recipes:read'])).toEqual(['recipes:read']);
  });

  it('covers every resource scope plus "all"', () => {
    expect(WEB_SCOPES).toContain('recipes:read');
    expect(WEB_SCOPES).toContain('pantry:write');
    expect(WEB_SCOPES).toContain('grocery:read');
    expect(WEB_SCOPES).toContain('calendar:write');
    expect(WEB_SCOPES).toContain('nutrition:read');
    expect(WEB_SCOPES).toContain('kitchen:write');
    expect(WEB_SCOPES).toContain('profile:read');
    expect(WEB_SCOPES).toContain('settings:write');
    expect(ALL_SCOPES).toContain('all');
  });
});

describe('scopeSubset (down-scoping, never up-scoping)', () => {
  it('grants anything when the holder has "all"', () => {
    expect(scopeSubset(['recipes:read'], ['all'])).toBe(true);
    expect(scopeSubset(['pantry:write', 'nutrition:read'], ['all'])).toBe(true);
  });

  it('allows a true subset', () => {
    expect(scopeSubset(['recipes:read'], ['recipes:read', 'recipes:write'])).toBe(true);
  });

  it('rejects requested scopes not in the granted set (up-scoping)', () => {
    expect(scopeSubset(['recipes:read', 'pantry:write'], ['recipes:read'])).toBe(false);
    expect(scopeSubset(['pantry:read'], ['recipes:read'])).toBe(false);
  });
});

describe('hasScope', () => {
  it('honours "all" as a wildcard', () => {
    expect(hasScope(['all'], 'kitchen:write')).toBe(true);
  });

  it('matches an exact scope', () => {
    expect(hasScope(['recipes:read'], 'recipes:read')).toBe(true);
  });

  it('rejects a scope not held', () => {
    expect(hasScope(['recipes:read'], 'pantry:read')).toBe(false);
  });
});
