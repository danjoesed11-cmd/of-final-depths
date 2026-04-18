/*
 * coi-serviceworker — self-registering edition
 * Works as BOTH a page registration script (<script src="...">) AND the actual service worker.
 * On GitHub Pages (no COOP/COEP headers), this injects them via the service worker so
 * Godot 4's WASM can use SharedArrayBuffer / crossOriginIsolated features.
 */

if (typeof window !== 'undefined') {
  /* ── PAGE CONTEXT: register this file as a service worker ── */
  (function () {
    if (window.crossOriginIsolated) return; // already isolated — nothing to do

    if (!('serviceWorker' in navigator)) {
      console.warn('[coi-sw] Service workers not supported — game may not load.');
      return;
    }

    var src = document.currentScript && document.currentScript.src;
    if (!src) return;

    function reloadOnce() {
      if (sessionStorage.getItem('coi-reload')) {
        sessionStorage.removeItem('coi-reload');
        return; // already reloaded once this session — don't loop
      }
      sessionStorage.setItem('coi-reload', '1');
      window.location.reload();
    }

    navigator.serviceWorker.register(src).then(function (reg) {
      console.log('[coi-sw] Registered.');

      // If the SW just installed (first time), wait for it to activate then reload
      if (reg.installing) {
        reg.installing.addEventListener('statechange', function () {
          if (this.state === 'activated') reloadOnce();
        });
        return;
      }

      // SW was already waiting or active; reload so it takes control
      if (!navigator.serviceWorker.controller) {
        reloadOnce();
      }
    }).catch(function (err) {
      console.error('[coi-sw] Registration failed:', err);
    });

    // Also reload when the SW takes control of this page
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!window.crossOriginIsolated) reloadOnce();
    });
  }());

} else {
  /* ── SERVICE WORKER CONTEXT: intercept fetches, inject headers ── */

  self.addEventListener('install', function () {
    self.skipWaiting();
  });

  self.addEventListener('activate', function (e) {
    e.waitUntil(self.clients.claim());
  });

  self.addEventListener('fetch', function (e) {
    var req = e.request;
    // Don't intercept no-cors requests to cross-origin URLs (causes opaque response issues)
    if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;

    e.respondWith(
      fetch(req).then(function (resp) {
        if (resp.status === 0) return resp; // opaque — leave alone

        var headers = new Headers(resp.headers);
        headers.set('Cross-Origin-Opener-Policy',   'same-origin');
        headers.set('Cross-Origin-Embedder-Policy', 'require-corp');

        return new Response(resp.body, {
          status:     resp.status,
          statusText: resp.statusText,
          headers:    headers,
        });
      }).catch(function () {
        return fetch(req); // fallback — try without header injection
      })
    );
  });
}
