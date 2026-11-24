/* Service worker de l'app Viatge — guarda l'app al telèfon per funcionar offline.
   IMPORTANT: quan publiquis una versió nova de l'app, canvia "v39" aquí
   per un número nou (v40, v41...) perquè la caché es regeneri. */
const CACHE = "viatge-pwa-v40";
const PRECACHE = [
  "./",
  "index.html",
  "estils.css",
  "manifest.json",
  "icon.png",
  "gos.png",
  "cartell.png",
  "cabdells.png",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
];
self.addEventListener("install", e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate", e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch", e=>{
  if(e.request.method!=="GET") return;
  const url = new URL(e.request.url);
  const propi = url.origin===self.location.origin;
  const tile  = url.hostname.endsWith("tile.openstreetmap.org");
  const cdn   = url.hostname==="unpkg.com";
  if(!propi && !tile && !cdn) return;   /* Sheet i altres serveis: sempre xarxa */
  e.respondWith(
    caches.match(e.request).then(hit=>{
      if(hit) return hit;
      return fetch(e.request).then(res=>{
        if(res.ok && (propi||tile||cdn)){
          const copia = res.clone();
          caches.open(CACHE).then(c=>c.put(e.request, copia));
        }
        return res;
      }).catch(()=>hit);   /* offline i no en caché: res */
    })
  );
});
