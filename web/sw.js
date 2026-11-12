/* Caches the app shell only. Data under d/ is always fetched from the network (never cached). */
var C = "desk-shell-v2", SHELL = ["./", "index.html", "app.css", "app.js", "chart.js", "manifest.json", "icons/apple-touch-icon.png"];
self.addEventListener("install", function (e) { e.waitUntil(caches.open(C).then(function (c) { return c.addAll(SHELL); })); self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== C; }).map(function (k) { return caches.delete(k); })); })); self.clients.claim(); });
self.addEventListener("fetch", function (e) {
  var u = new URL(e.request.url);
  if (u.pathname.indexOf("/d/") !== -1 || e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then(function (r) { var cp = r.clone(); caches.open(C).then(function (c) { c.put(e.request, cp); }); return r; })
    .catch(function () { return caches.match(e.request); }));
});
