/**
 * Pantry Butler OAuth client (PKCE S256, Authorization Code flow).
 *
 * Shared by the popup and the background worker. Everything in this module is
 * plain function scope (classic script, no module loader) and exposes a single
 * global `window.PBOAuth` / `globalThis.PBOAuth`.
 *
 * Flow:
 *   1. background starts authorize: generates verifier + state, opens the
 *      {origin}/oauth/authorize?... URL in a tab.
 *   2. the web-accessible callback page (src/oauth/callback.html) captures
 *      code + state and messages the background.
 *   3. background validates state, exchanges the code, and stores the token.
 *
 * The redirect_uri is the extension's own callback page, so it matches the
 * server's dev-client glob for the extension origin + this fixed callback path.
 */
(function (global) {
  'use strict';

  const CLIENT_ID = 'web-extension';
  const SCOPE = 'recipes:read recipes:write';
  const AUTH_CALLBACK = (typeof browser !== 'undefined' && browser.runtime)
    ? browser.runtime.getURL('src/oauth/callback.html')
    : 'moz-extension://callback-placeholder/src/oauth/callback.html';

  // Pending-flow key lives in storage.session (cleared on browser restart) so a
  // service-worker restart mid-flow cannot lose it.
  const PENDING_KEY = 'pbPendingOAuth';
  const CONNECTION_KEY = 'pbConnection';

  function storageGet(key) {
    return new Promise(function (resolve) {
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
        browser.storage.local.get(key).then(function (data) { resolve(data[key]); }, function () { resolve(undefined); });
      } else {
        resolve(undefined);
      }
    });
  }

  function storageSet(key, value) {
    return new Promise(function (resolve) {
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
        browser.storage.local.set({ [key]: value }).then(resolve, function () { resolve(); });
      } else {
        resolve();
      }
    });
  }

  function sessionGet(key) {
    return new Promise(function (resolve) {
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.session) {
        browser.storage.session.get(key).then(function (data) { resolve(data[key]); }, function () { resolve(undefined); });
      } else {
        resolve(undefined);
      }
    });
  }

  function sessionSet(key, value) {
    return new Promise(function (resolve) {
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.session) {
        browser.storage.session.set({ [key]: value }).then(resolve, function () { resolve(); });
      } else {
        resolve();
      }
    });
  }

  function sessionRemove(key) {
    return new Promise(function (resolve) {
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.session) {
        browser.storage.session.remove(key).then(resolve, function () { resolve(); });
      } else {
        resolve();
      }
    });
  }

  function randomBytes(n) {
    const buf = new Uint8Array(n);
    (global.crypto || global.msCrypto).getRandomValues(buf);
    return buf;
  }

  function toBase64Url(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function sha256Base64Url(input) {
    const data = new TextEncoder().encode(input);
    return global.crypto.subtle.digest('SHA-256', data).then(function (buf) {
      return toBase64Url(new Uint8Array(buf));
    });
  }

  function generateVerifier() {
    // 32 bytes → 43-char base64url (RFC 7636: 43–128 chars).
    return toBase64Url(randomBytes(32));
  }

  function generateState() {
    return toBase64Url(randomBytes(24));
  }

  function buildAuthorizeUrl(origin, state, codeChallenge) {
    const url = new URL('/oauth/authorize', origin);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', CLIENT_ID);
    url.searchParams.set('redirect_uri', AUTH_CALLBACK);
    url.searchParams.set('scope', SCOPE);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  // Build the host-permission match pattern for an origin.
  //
  // Firefox quirk: `<all_urls>` does NOT cover loopback addresses
  // (localhost / 127.0.0.1), so they must be requested explicitly. Worse, the
  // permissions API is strict about containment — a port-specific pattern such
  // as `http://localhost:3000/*` is NOT satisfied by a declared
  // `http://localhost/*`, and requesting it can be silently denied. For
  // loopback hosts we therefore drop the port so the requested pattern exactly
  // matches the declared optional_host_permissions.
  function permissionPattern(origin) {
    try {
      const u = new URL(origin);
      const host = u.hostname;
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.localhost')) {
        return u.protocol + '//' + host + '/*';
      }
    } catch (e) { /* fall through */ }
    return origin + '/*';
  }

  // Last diagnostic snapshot, inspectable from the console as
  // `PBOAuth.lastPermissionDebug` after a failed connect.
  let lastPermissionDebug = null;
  function setDebug(d) {
    lastPermissionDebug = d;
    try { console.log('[CookExport] permission debug:', JSON.stringify(d)); } catch (e) {}
  }

  async function requestHostPermission(origin) {
    const pattern = permissionPattern(origin);
    const debug = { origin: origin, pattern: pattern, hasBrowser: false, contains: null, request: null, lastError: null, all: null };
    try {
      if (typeof browser === 'undefined' || !browser.permissions) {
        setDebug(Object.assign(debug, { hasBrowser: false }));
        return true; // no API to check — let the real fetch surface any issue
      }
      debug.hasBrowser = true;

      debug.contains = await browser.permissions.contains({ origins: [pattern] });
      debug.lastError = browser.runtime && browser.runtime.lastError ? String(browser.runtime.lastError.message || browser.runtime.lastError) : null;
      debug.all = await browser.permissions.getAll().catch(function () { return null; });

      if (debug.contains) {
        setDebug(debug);
        return true;
      }

      if (browser.permissions.request) {
        try {
          debug.request = await browser.permissions.request({ origins: [pattern] });
        } catch (err) {
          debug.request = 'threw: ' + String((err && err.message) || err);
        }
        debug.lastError = browser.runtime && browser.runtime.lastError ? String(browser.runtime.lastError.message || browser.runtime.lastError) : null;
        debug.containsAfter = await browser.permissions.contains({ origins: [pattern] });
        const ok = debug.request === true || debug.containsAfter === true;
        setDebug(debug);
        return ok;
      }

      setDebug(debug);
      return false;
    } catch (err) {
      debug.fatal = String((err && err.message) || err);
      setDebug(debug);
      return false;
    }
  }

  /**
   * Exchange an authorization code for a pb_ API token.
   * Returns { access_token, token_type, scope } or throws with the server error.
   */
  function exchangeCode(origin, code, verifier) {
    return fetch(origin + '/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        code: code,
        code_verifier: verifier,
        redirect_uri: AUTH_CALLBACK,
      }),
    }).then(async function (res) {
      const data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        const err = new Error(data.error_description || data.error || ('OAuth token exchange failed (' + res.status + ')'));
        err.status = res.status;
        throw err;
      }
      return data;
    });
  }

  /**
   * Self-validation (Decision §10): a token can read its own row, which carries
   * the bound instance_id. The extension needs instance_id to push recipes.
   */
  async function fetchTokenMeta(origin, accessToken) {
    const res = await fetch(origin + '/api/tokens', {
      headers: { Authorization: 'Bearer ' + accessToken },
    });
    if (!res.ok) return null;
    return res.json().catch(function () { return null; });
  }

  async function startFlow(origin) {
    const verifier = generateVerifier();
    const codeChallenge = await sha256Base64Url(verifier);
    const state = generateState();
    const pending = { origin: origin, verifier: verifier, state: state, redirectUri: AUTH_CALLBACK };
    await sessionSet(PENDING_KEY, pending);
    return buildAuthorizeUrl(origin, state, codeChallenge);
  }

  async function completeFlow(code, state) {
    const pending = await sessionGet(PENDING_KEY);
    if (!pending || pending.state !== state) {
      throw new Error('OAuth state mismatch — flow expired or mismatched. Try connecting again.');
    }
    const data = await exchangeCode(pending.origin, code, pending.verifier);
    const meta = await fetchTokenMeta(pending.origin, data.access_token).catch(function () { return null; });
    const connection = {
      origin: pending.origin.replace(/\/+$/, ''),
      accessToken: data.access_token,
      scope: data.scope || SCOPE,
      tokenId: meta && meta.id ? meta.id : null,
      instanceId: meta && meta.instance_id ? meta.instance_id : null,
      connectedAt: new Date().toISOString(),
    };
    await storageSet(CONNECTION_KEY, connection);
    await sessionRemove(PENDING_KEY);
    return connection;
  }

  async function getConnection() {
    return (await storageGet(CONNECTION_KEY)) || null;
  }

  async function clearConnection() {
    await storageSet(CONNECTION_KEY, null);
    await sessionRemove(PENDING_KEY);
  }

  global.PBOAuth = {
    CLIENT_ID: CLIENT_ID,
    SCOPE: SCOPE,
    AUTH_CALLBACK: AUTH_CALLBACK,
    generateVerifier: generateVerifier,
    generateState: generateState,
    buildAuthorizeUrl: buildAuthorizeUrl,
    startFlow: startFlow,
    completeFlow: completeFlow,
    getConnection: getConnection,
    clearConnection: clearConnection,
    requestHostPermission: requestHostPermission,
    permissionPattern: permissionPattern,
    getLastPermissionDebug: function () { return lastPermissionDebug; },
  };
})(typeof self !== 'undefined' ? self : this);
