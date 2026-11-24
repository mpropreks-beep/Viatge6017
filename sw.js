/* Service worker de Viatge.
   v41: HTML i fitxers propis amb estratègia network-first;
   mapes i biblioteques externes amb cache-first per mantenir el mode offline. */

const CACHE_PREFIX = "viatge-pwa-";
const CACHE = `${CACHE_PREFIX}v41`;

const APP_SHELL = [
  "./",
  "index.html",
  "estils.css",
  "manifest.json"
];

const OPTIONAL_ASSETS = [
  "icon.png",
  "gos.png",
  "cartell.png",
  "cabdells.png",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);

    // Els fitxers essencials han d'estar disponibles abans d'activar la versió.
    await cache.addAll(
      APP_SHELL.map(path => new URL(path, self.registration.scope).href)
    );

    // Una imatge o un CDN temporalment inaccessible no ha d'impedir instal·lar
    // la nova versió; es podrà descarregar quan hi torni a haver connexió.
    await Promise.allSettled(
      OPTIONAL_ASSETS.map(path =>
        cache.add(new URL(path, self.registration.scope).href)
      )
    );

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    // Esborrem només memòries cau antigues d'aquesta aplicació.
    await Promise.all(
      keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
        .map(key => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

async function desaResposta(cacheName, request, response) {
  if (response && response.ok && response.status === 200) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }
  return response;
}

// Per a pàgines i fitxers propis: primer xarxa, després memòria cau.
// Així, quan hi ha internet, no es queda servida indefinidament la versió antiga.
async function networkFirst(request, isNavigation) {
  try {
    const response = await fetch(request);
    return await desaResposta(CACHE, request, response);
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Si la navegació és offline, recuperem la pàgina principal guardada.
    if (isNavigation) {
      const home = new URL("index.html", self.registration.scope).href;
      const fallback = await caches.match(home);
      if (fallback) return fallback;
    }

    return Response.error();
  }
}

// Per a rajoles del mapa i biblioteques externes: primer memòria cau.
// Si no hi són, es descarreguen i es guarden per a usos posteriors offline.
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    return await desaResposta(CACHE, request, response);
  } catch (error) {
    return Response.error();
  }
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isTile = url.hostname.endsWith("tile.openstreetmap.org");
  const isLeafletCDN = url.hostname === "unpkg.com";

  // No interceptem serveis externs com Google Sheets: sempre van per xarxa.
  if (!isSameOrigin && !isTile && !isLeafletCDN) return;

  if (isSameOrigin) {
    const isNavigation = request.mode === "navigate";
    event.respondWith(networkFirst(request, isNavigation));
    return;
  }

  if (isTile || isLeafletCDN) {
    event.respondWith(cacheFirst(request));
  }
});
