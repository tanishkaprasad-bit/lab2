
const CACHE_NAME = "birthday-rewind-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        APP_SHELL.map(async (url) => {
          try {
            const response = await fetch(url, { cache: "reload" });

            if (response.ok) {
              await cache.put(url, response);
            }
          } catch (error) {
            // A failed initial fetch should not prevent installation.
          }
        })
      );

      await self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("birthday-rewind-") &&
                             key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle GET requests to this site's own origin.
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Do not intercept browser navigation outside the app's directory.
  const appDirectory = new URL("./", self.registration.scope);

  if (!url.pathname.startsWith(appDirectory.pathname)) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      try {
        // Network first: ask the server for the latest version.
        const response = await fetch(request);

        if (response.ok) {
          await cache.put(request, response.clone());
        }

        return response;
      } catch (error) {
        // Offline fallback: use the cached version if available.
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
          return cachedResponse;
        }

        // If a page navigation is offline, fall back to the app shell.
        if (request.mode === "navigate") {
          const cachedIndex = await cache.match("./index.html");

          if (cachedIndex) {
            return cachedIndex;
          }
        }

        return new Response("You are offline. Please reconnect and try again.", {
          status: 503,
          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          }
        });
      }
    })()
  );
});
