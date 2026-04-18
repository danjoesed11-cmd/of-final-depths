/*
 * coi-serviceworker — self-registering edition
 * Works as BOTH a page registration script (<script src="...">) AND the actual service worker.
 * On GitHub Pages (no COOP/COEP headers), this injects them via the service worker so
 * Godot 4's WASM can use SharedArrayBuffer / crossOriginIsolated features.
 */

if (typeof window !== 'undefined') {
  /* ── PAGE CONTEXT: register this file as a service worker ── */
  (function () {
    if (window.crossOriginIsolated) {
      console.log('[coi-sw] Already cross-origin isolated.');
      return;
    }

    if (!('serviceWorker' in navigator)) {
      console.warn('[coi-sw] Service workers not supported — game may not load.');
      return;
    }

    var src = document.currentScript && document.currentScript.src;
    if (!src) {
      console.warn('[coi-sw] Could not determine script src.');
      return;
    }

    function reloadOnce() {
      if (sessionStorage.getItem('coi-reload')) {
        sessionStorage.removeItem('coi-reload');
        console.warn('[coi-sw] Already reloaded once — not looping.');
        return;
      }
      sessionStorage.setItem('coi-reload', '1');
      console.log('[coi-sw] Reloading to apply service worker headers...');
      window.location.reload();
    }

    navigator.serviceWorker.register(src).then(function (reg) {
      console.log('[coi-sw] Registered:', reg.scope);

      if (reg.installing) {
        console.log('[coi-sw] Installing...');
        reg.installing.addEventListener('statechange', function () {
          console.log('[coi-sw] SW state:', this.state);
          if (this.state === 'activated') {
            reloadOnce();
          }
        });
        return;
      }

      if (reg.waiting) {
        console.log('[coi-sw] SW waiting — skipping wait...');
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      if (!navigator.serviceWorker.controller) {
        console.log('[coi-sw] No controller yet, reloading...');
        reloadOnce();
      } else {
        console.log('[coi-sw] SW already controlling — but not isolated? Trying reload...');
        reloadOnce();
      }
    }).catch(function (err) {
      console.error('[coi-sw] Registration failed:', err);
    });

    navigator.serviceWorker.addEventListener('controllerchange', function () {
      console.log('[coi-sw] Controller changed, crossOriginIsolated:', window.crossOriginIsolated);
      if (!window.crossOriginIsolated) {
        reloadOnce();
      }
    });
  }());

} else {
  /* ── SERVICE WORKER CONTEXT: intercept fetches, inject headers ── */

  self.addEventListener('install', function (e) {
    console.log('[coi-sw] Install');
    self.skipWaiting();
  });

  self.addEventListener('activate', function (e) {
    console.log('[coi-sw] Activate');
    e.waitUntil(self.clients.claim());
  });

  self.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
  });

  self.addEventListener('fetch', function (e) {
    var req = e.request;

    // Skip non-GET requests
    if (req.method !== 'GET') return;

    // Skip cross-origin no-cors requests (opaque responses — can't add headers)
    if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;

    e.respondWith(
      fetch(req).then(function (resp) {
        // Opaque response — leave alone
        if (resp.status === 0) return resp;

        var headers = new Headers(resp.headers);
        headers.set('Cross-Origin-Opener-Policy',   'same-origin');
        headers.set('Cross-Origin-Embedder-Policy', 'require-corp');

        return new Response(resp.body, {
          status:     resp.status,
          statusText: resp.statusText,
          headers:    headers,
        });
      }).catch(function (err) {
        console.warn('[coi-sw] Fetch failed, falling back:', err);
        return fetch(req);
      })
    );
  });
}
