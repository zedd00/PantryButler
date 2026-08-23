'use strict';

// Firefox runs the background as an event page (it ignores `service_worker`
// and uses the `scripts` array), so `oauth.js` is loaded via that array and
// `PBOAuth` is already on the global scope. importScripts is a worker-only API
// kept only as a fallback for service-worker contexts (e.g. Chrome).
if (typeof importScripts === 'function') {
  importScripts('../common/oauth.js');
}

const browser = (typeof globalThis.browser !== 'undefined') ? globalThis.browser : globalThis.chrome;

const isServiceWorker = typeof URL.createObjectURL !== 'function';

const activeDownloads = new Map();

browser.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case 'download-cook':
      handleDownload(msg).then(function (res) { sendResponse(res); });
      return true;

    case 'oauth-start':
      handleOAuthStart(msg).then(function (res) { sendResponse(res); });
      return true;

    case 'oauth-callback':
      handleOAuthCallback(msg, sender).then(function (res) { sendResponse(res); });
      return true;

    case 'oauth-status':
      PBOAuth.getConnection().then(function (conn) {
        sendResponse({ ok: true, connection: conn });
      });
      return true;

    case 'oauth-disconnect':
      handleOAuthDisconnect(msg).then(function (res) { sendResponse(res); });
      return true;

    case 'push-recipe':
      handlePushRecipe(msg).then(function (res) { sendResponse(res); });
      return true;

    default:
      return false;
  }
});

function handleDownload(msg) {
  return new Promise(function (resolve) {
    let url;
    if (isServiceWorker) {
      url = 'data:text/plain;charset=utf-8,' + encodeURIComponent(msg.text);
    } else {
      url = URL.createObjectURL(new Blob([msg.text], { type: 'text/plain' }));
    }

    browser.downloads
      .download({ url: url, filename: msg.filename || 'recipe.cook', saveAs: true })
      .then(function (id) {
        if (!isServiceWorker) {
          activeDownloads.set(id, url);
          setTimeout(function () {
            if (!activeDownloads.has(id)) URL.revokeObjectURL(url);
          }, 60000);
        }
        resolve({ ok: true });
      })
      .catch(function (err) {
        if (!isServiceWorker) setTimeout(function () { URL.revokeObjectURL(url); }, 0);
        resolve({ ok: false, error: String((err && err.message) || err) });
      });
  });
}

async function handleOAuthStart(msg) {
  try {
    const origin = normalizeOrigin(msg.origin);
    if (!origin) return { ok: false, error: 'Enter your Pantry Butler server URL (e.g. https://pantry.example.com).' };

    // Host-permission gating lives entirely in the popup: it runs inside the
    // click handler (the only place Firefox honours permissions.request()),
    // checks permissions.contains() first, and never hard-blocks on API
    // errors. Re-requesting here from the event page would fail outside a
    // user gesture and could veto an already-granted connection.
    const authorizeUrl = await PBOAuth.startFlow(origin);
    await browser.tabs.create({ url: authorizeUrl });
    return { ok: true, authorizeUrl: authorizeUrl };
  } catch (err) {
    return { ok: false, error: 'Could not start sign-in: ' + ((err && err.message) || err) };
  }
}

async function handleOAuthCallback(msg, sender) {
  try {
    const connection = await PBOAuth.completeFlow(msg.code, msg.state);
    console.log('[CookExport] oauth-callback complete', {
      origin: connection.origin,
      hasToken: !!connection.accessToken,
      instanceId: connection.instanceId,
      tokenId: connection.tokenId,
    });
    // Only auto-close on success; on failure leave the tab open so the user
    // (and the callback page) can surface the error instead of a silent close.
    if (sender && sender.tab && sender.tab.id != null) {
      setTimeout(function () { browser.tabs.remove(sender.tab.id).catch(function () {}); }, 1500);
    }
    return { ok: true, connection: connection, message: 'Connected to ' + connection.origin + '.' };
  } catch (err) {
    console.error('[CookExport] oauth-callback failed', err);
    return { ok: false, error: ((err && err.message) || err) + ' Close this tab and try again.' };
  }
}

async function handleOAuthDisconnect() {
  try {
    const conn = await PBOAuth.getConnection();
    if (conn && conn.tokenId && conn.origin) {
      await fetch(conn.origin + '/api/tokens/' + conn.tokenId, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + conn.accessToken },
      }).catch(function () {});
    }
  } catch (err) {
    // Best-effort revoke; always clear local state below.
  }
  await PBOAuth.clearConnection();
  return { ok: true };
}

async function handlePushRecipe(msg) {
  try {
    const conn = await PBOAuth.getConnection();
    if (!conn || !conn.accessToken || !conn.origin) {
      return { ok: false, error: 'Not connected. Sign in to your Pantry Butler instance first.' };
    }
    if (!msg.payload || !msg.payload.instance_id) {
      return { ok: false, error: 'Missing instance id. Reconnect to your instance and try again.' };
    }

    let res = await sendRecipe(conn, msg.payload);

    // 401 → the token was revoked/expired: silently re-auth (session reuse) and retry once.
    if (res.status === 401) {
      await PBOAuth.clearConnection();
      const reauth = await handleOAuthStart({ origin: conn.origin });
      if (!reauth.ok) return { ok: false, error: 'Session expired. Sign-in could not be restored automatically: ' + reauth.error };

      // Wait for the OAuth flow to complete. The callback page messages the
      // background (oauth-callback) and completes the flow; we poll for the
      // stored connection so the push retries once reconnected.
      const reconnected = await waitForReconnect(conn.origin, 120000);
      if (!reconnected) return { ok: false, error: 'Re-authentication did not complete in time. Try again after signing in.' };

      const fresh = await PBOAuth.getConnection();
      if (!fresh || !fresh.accessToken) return { ok: false, error: 'Re-authentication did not complete. Try again.' };
      msg.payload.instance_id = fresh.instanceId || msg.payload.instance_id;
      res = await sendRecipe(fresh, msg.payload);
    }

    if (res.ok) {
      const data = await res.json().catch(function () { return null; });
      return { ok: true, recipeId: data && data.id ? data.id : null };
    }

    const body = await res.json().catch(function () { return null; });
    return {
      ok: false,
      status: res.status,
      error: (body && body.error) || ('Push failed (' + res.status + ').'),
    };
  } catch (err) {
    return { ok: false, error: 'Push failed: ' + ((err && err.message) || err) };
  }
}

async function sendRecipe(conn, payload) {
  const url = conn.origin + '/api/recipes';
  console.log('[CookExport] sendRecipe', { url: url, hasToken: !!conn.accessToken, instanceId: payload && payload.instance_id });
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + conn.accessToken,
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text().catch(function () { return ''; });
    console.log('[CookExport] sendRecipe response', { status: res.status, body: text.slice(0, 500) });
    // Re-wrap so handlePushRecipe can read .ok / .status / .json()
    return new Response(text, { status: res.status, headers: res.headers });
  } catch (err) {
    console.error('[CookExport] sendRecipe fetch error', err);
    throw err;
  }
}

function waitForReconnect(origin, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise(function (resolve) {
    (function poll() {
      PBOAuth.getConnection().then(function (conn) {
        if (conn && conn.origin.replace(/\/+$/, '') === origin.replace(/\/+$/, '') && conn.accessToken) {
          resolve(true);
          return;
        }
        if (Date.now() > deadline) {
          resolve(false);
          return;
        }
        setTimeout(poll, 1000);
      });
    })();
  });
}

function normalizeOrigin(raw) {
  if (!raw) return null;
  let origin = String(raw).trim();
  if (!/^https?:\/\//i.test(origin)) origin = 'https://' + origin;
  try {
    const u = new URL(origin);
    if (!/^https?:$/.test(u.protocol)) return null;
    return u.origin;
  } catch {
    return null;
  }
}

if (!isServiceWorker) {
  browser.downloads.onChanged.addListener(function (delta) {
    if (!delta || typeof delta.id !== 'number') return;
    if (delta.state && (delta.state.current === 'complete' || delta.state.current === 'interrupted')) {
      const url = activeDownloads.get(delta.id);
      if (url) {
        activeDownloads.delete(delta.id);
        URL.revokeObjectURL(url);
      }
    }
  });
}
