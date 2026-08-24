'use strict';

const browser = (typeof globalThis.browser !== 'undefined') ? globalThis.browser : globalThis.chrome;

(function () {
  const $ = (id) => document.getElementById(id);

  const statusEl = $('status');
  const formEl = $('recipe-form');
  const actionsEl = $('actions');
  const manualEl = $('manual');
  const previewEl = $('preview');
  const connectionStatusEl = $('connection-status');
  const connectionFormEl = $('connection-form');
  const originEl = $('origin');
  const connectBtn = $('btn-connect');
  const disconnectBtn = $('btn-disconnect');

  let recipe = null;
  let connection = null;

  function setStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.classList.toggle('error', !!isError);
    statusEl.hidden = false;
  }

  function setConnectionStatus(msg, cls) {
    connectionStatusEl.textContent = msg;
    connectionStatusEl.className = cls || '';
    connectionStatusEl.hidden = !msg;
  }

  function showConnection(conn) {
    connection = conn && conn.accessToken ? conn : null;
    if (connection) {
      const warn = connection.instanceId ? '' : '  ⚠ no instance_id';
      setConnectionStatus('Connected to ' + connection.origin + (connection.scope ? ' (' + connection.scope + ')' : '') + warn);
      originEl.value = connection.origin;
      originEl.disabled = true;
      connectBtn.hidden = true;
      disconnectBtn.hidden = false;
    } else {
      setConnectionStatus('');
      originEl.disabled = false;
      connectBtn.hidden = false;
      disconnectBtn.hidden = true;
    }
  }

  async function refreshConnection() {
    try {
      const res = await browser.runtime.sendMessage({ type: 'oauth-status' });
      showConnection(res && res.connection);
    } catch {
      showConnection(null);
    }
  }

  // Mirrors the background's normalizeOrigin so both sides agree on the exact
  // origin string used for the host-permission pattern and OAuth URLs.
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

  connectionFormEl.addEventListener('submit', async (event) => {
    event.preventDefault();
    const origin = normalizeOrigin(originEl.value);
    if (!origin) {
      setConnectionStatus('Enter your Pantry Butler server URL.', 'error');
      return;
    }

    // Ensure we can reach the server before starting the flow. Order matters:
    // 1. permissions.contains() — if access is already granted (e.g. the user
    //    enabled it in about:addons, or a previous prompt succeeded) we must
    //    NOT touch permissions.request(); the API store and the about:addons
    //    site-access store can disagree, and request() may fail even though
    //    access exists.
    // 2. permissions.request() — only for origins not yet granted. Must run in
    //    this click handler: Firefox requires a direct user gesture.
    // 3. If the API throws outright, do not block: proceed and let the actual
    //    network calls surface any real restriction.
    const patterns = [PBOAuth.permissionPattern(origin)];
    try {
      const alreadyGranted = browser.permissions && browser.permissions.contains
        ? await browser.permissions.contains({ origins: patterns })
        : false;
      if (!alreadyGranted && browser.permissions && browser.permissions.request) {
        const granted = await browser.permissions.request({ origins: patterns });
        if (!granted) {
          setConnectionStatus('Permission to reach ' + origin + ' was denied by the browser prompt.', 'error');
          return;
        }
      }
    } catch (err) {
      console.warn('[CookExport] host-permission API failed, proceeding anyway:', err);
    }

    setConnectionStatus('Connecting to ' + origin + '…', 'connecting');

    setConnectionStatus('Connecting to ' + origin + '…', 'connecting');
    try {
      const res = await browser.runtime.sendMessage({ type: 'oauth-start', origin: origin });
      if (res && res.ok) {
        setConnectionStatus('Sign-in opened in a new tab. Complete it there, then return here.', 'connecting');
        // The popup only loads the connection once at startup; poll until the
        // sign-in tab finishes (or we time out), so the UI reflects "connected"
        // without forcing the user to close and reopen the popup.
        let tries = 0;
        const poll = setInterval(async function () {
          tries += 1;
          await refreshConnection();
          if (connection || tries > 90) clearInterval(poll);
        }, 1000);
      } else {
        let msg = (res && res.error) || 'Could not start sign-in.';
        if (res && res.debug) {
          msg += '\n[debug] ' + JSON.stringify(res.debug);
        }
        setConnectionStatus(msg, 'error');
      }
    } catch (err) {
      setConnectionStatus('Could not start sign-in: ' + ((err && err.message) || err), 'error');
    }
  });

  disconnectBtn.addEventListener('click', async () => {
    setConnectionStatus('Disconnecting…', 'connecting');
    await browser.runtime.sendMessage({ type: 'oauth-disconnect' }).catch(() => {});
    showConnection(null);
    setConnectionStatus('Disconnected.', 'error');
  });

  $('btn-push').addEventListener('click', () => {
    try {
      setStatus('Push clicked — handler running.');
      console.log('[CookExport] push click', {
        hasConnection: !!connection,
        instanceId: connection && connection.instanceId,
        origin: connection && connection.origin,
        scope: connection && connection.scope,
        hasPBRecipe: typeof window.PBRecipe,
        hasBuildPayload: !!(window.PBRecipe && window.PBRecipe.buildPayload),
      });
      if (!connection || !connection.instanceId) {
        const detail = !connection ? 'no stored connection' : 'connection present but instance_id is missing';
        setStatus('Cannot push: ' + detail + '. Try disconnecting, then Connect again and complete sign-in.', true);
        return;
      }
      const payload = window.PBRecipe.buildPayload(read(), connection);
      if (!payload.title) {
        setStatus('Add a title before pushing.', true);
        return;
      }
      setStatus('Pushing to Pantry Butler…');
      browser.runtime
        .sendMessage({ type: 'push-recipe', payload: payload })
        .then((res) => {
          console.log('[CookExport] push response', res);
          if (res && res.ok) {
            setStatus('Pushed to Pantry Butler' + (res.recipeId ? ' (#' + res.recipeId + ')' : '') + '.');
          } else {
            setStatus((res && res.error) || 'Push failed.', true);
            if (res && (res.status === 401 || res.status === 403)) refreshConnection();
          }
        })
        .catch((err) => setStatus('Push failed: ' + err.message, true));
    } catch (err) {
      console.error('[CookExport] push handler threw', err);
      setStatus('Push error: ' + ((err && err.message) || err), true);
    }
  });

  function fill(data) {
    $('title').value = data.title || '';
    $('servings').value = data.servings || '';
    $('prep').value = data.prep_time_minutes || '';
    $('cook').value = data.cook_time_minutes || '';
    $('total').value = data.total_time_minutes || '';
    $('description').value = data.description || '';
    $('ingredients').value = (data.ingredient_groups && data.ingredient_groups.length
      ? data.ingredient_groups.map((g) => (g.title ? g.title + ':' : '') + (g.ingredients || []).join('\n')).join('\n')
      : (data.ingredients || []).join('\n'));
    $('steps').value = (data.instructions || []).join('\n');
    $('source').value = data.source_url || '';
    $('notes').value = '';
    $('tags').value = '';
  }

  function read() {
    return {
      title: $('title').value.trim(),
      description: $('description').value.trim(),
      servings: $('servings').value === '' ? null : Number($('servings').value),
      prep: $('prep').value === '' ? null : Number($('prep').value),
      cook: $('cook').value === '' ? null : Number($('cook').value),
      total: $('total').value === '' ? null : Number($('total').value),
      source: $('source').value.trim(),
      notes: $('notes').value.trim(),
      tags: $('tags').value.trim(),
      ingredients: $('ingredients').value.split('\n').map((s) => s.trim()).filter(Boolean),
      instructions: $('steps').value.split('\n').map((s) => s.trim()).filter(Boolean)
    };
  }

  function build() {
    const form = read();
    const overrides = {
      title: form.title,
      description: form.description,
      servings: form.servings,
      prep: form.prep,
      cook: form.cook,
      total: form.total,
      source: form.source,
      notes: form.notes,
      tags: form.tags,
      ingredients: form.ingredients,
      instructions: form.instructions
    };
    const base = recipe || {
      title: overrides.title,
      description: overrides.description,
      servings: overrides.servings,
      prep: overrides.prep,
      cook: overrides.cook,
      total: overrides.total,
      ingredients: overrides.ingredients,
      instructions: overrides.instructions
    };
    return window.CookExport.buildCooklang(base, overrides);
  }

  async function extract() {
    setStatus('Extracting recipe…');
    let tab = null;
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      tab = tabs[0];
      if (!tab || !/^(https?|file)?:/.test(tab.url || '')) {
        throw new Error('Unsupported page type: ' + (tab && tab.url));
      }
    } catch (err) {
      showManual('Could not read the page automatically — manual template ready. Paste the recipe below.');
      return;
    }

    let lastError = '';
    let recipe = null;
    try {
      const results = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'ISOLATED',
        func: extractRecipeFromDocument
      });
      recipe = results && results[0] ? results[0].result : null;
    } catch (err) {
      lastError = String((err && err.message) || err);
    }

    if (recipe) {
      fill(recipe);
      formEl.hidden = false;
      actionsEl.hidden = false;
      manualEl.hidden = true;
      previewEl.hidden = true;
      setStatus('Extracted "' + recipe.title + '". Edit then export.');
      return;
    }

    if (!lastError) {
      recipe = null;
      manualEl.hidden = false;
      setStatus('No recipe structure found on this page.');
      return;
    }

    showManual('Could not read the page automatically — manual template ready. Paste the recipe below. (' + lastError + ')');
  }

  function showManual(message) {
    recipe = null;
    formEl.hidden = false;
    actionsEl.hidden = false;
    manualEl.hidden = false;
    setStatus(message, true);
    fill({
      title: '', servings: '', prep_time_minutes: '', cook_time_minutes: '',
      total_time_minutes: '', description: '', ingredients: [], instructions: [],
      source_url: 'about:blank'
    });
  }

  $('btn-extract').addEventListener('click', extract);

  $('btn-preview').addEventListener('click', () => {
    previewEl.textContent = build();
    previewEl.hidden = false;
  });

  $('btn-download').addEventListener('click', () => {
    const text = build();
    const title = read().title || 'recipe';
    const name = window.CookExport.slugify(title) + '.cook';
    browser.runtime
      .sendMessage({ type: 'download-cook', text: text, filename: name })
      .then((res) => {
        if (res && res.ok) {
          setStatus('Download started.');
        } else {
          setStatus('Download failed: ' + ((res && res.error) || 'unknown error'), true);
        }
      })
      .catch((err) => setStatus('Download failed: ' + err.message, true));
  });

  $('btn-copy').addEventListener('click', () => {
    navigator.clipboard.writeText(build()).then(
      () => setStatus('Copied to clipboard.'),
      () => setStatus('Copy failed.', true)
    );
  });

  // Pre-fill the default Pantry Butler server so users/reviewers can connect in one click.
  if (!originEl.value) originEl.value = 'https://pantrybutler.mythologic.al';

  extract();
  refreshConnection();
  // Re-check the stored connection whenever the popup becomes visible again
  // (e.g. closed during sign-in and reopened).
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', function () { refreshConnection(); });
  }
})();