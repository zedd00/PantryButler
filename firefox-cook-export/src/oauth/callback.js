'use strict';

const browser = (typeof globalThis.browser !== 'undefined') ? globalThis.browser : globalThis.chrome;

(function () {
  const titleEl = document.getElementById('title');
  const statusEl = document.getElementById('status');

  function fail(message) {
    statusEl.textContent = message || 'Connection failed. Close this tab and try again.';
    statusEl.classList.add('err');
    titleEl.textContent = 'Pantry Butler';
  }

  function done(message) {
    statusEl.textContent = message || 'Connected! You can close this tab.';
    statusEl.classList.add('ok');
    titleEl.textContent = 'Pantry Butler';
  }

  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const state = params.get('state');

  if (!code || !state) {
    const err = params.get('error');
    fail(err ? ('Authorization failed: ' + err) : 'Missing authorization code. Close this tab and try connecting again.');
    return;
  }

  browser.runtime.sendMessage({ type: 'oauth-callback', code: code, state: state }).then(function (res) {
    if (res && res.ok) {
      done(res.message || 'Connected! You can close this tab.');
      setTimeout(function () { window.close(); }, 1500);
    } else {
      fail((res && res.error) || 'Connection failed. Close this tab and try again.');
    }
  }).catch(function (err) {
    fail('Connection failed: ' + ((err && err.message) || err) + ' Close this tab and try again.');
  });
})();
