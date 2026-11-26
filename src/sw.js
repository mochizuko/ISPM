var CACHE_NAME = "dentsync-local-v2";
var APP_FILES = [
    "index.html",
    "style.css",
    "script.js",
    "images/dentsync-mark.png",
    "images/dentsync-text.png"
];

self.addEventListener("install", function (event) {
    event.waitUntil(caches.open(CACHE_NAME).then(function (cache) {
        return cache.addAll(APP_FILES);
    }).then(function () {
        return self.skipWaiting();
    }));
});

self.addEventListener("activate", function (event) {
    event.waitUntil(caches.keys().then(function (names) {
        return Promise.all(names.filter(function (name) {
            return name.indexOf("dentsync-local-") === 0 && name !== CACHE_NAME;
        }).map(function (name) {
            return caches.delete(name);
        }));
    }).then(function () {
        return self.clients.claim();
    }));
});

self.addEventListener("fetch", function (event) {
    if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
    event.respondWith(fetch(event.request).then(function (response) {
        if (!response.ok) return response;
        var copy = response.clone();
        return caches.open(CACHE_NAME).then(function (cache) {
            return cache.put(event.request, copy).then(function () { return response; });
        });
    }).catch(function () {
        return caches.match(event.request).then(function (cached) {
            if (cached) return cached;
            if (event.request.mode === "navigate") {
                return caches.match(new URL("index.html", self.registration.scope).href);
            }
            throw new Error("Offline resource is not available in the app cache.");
        });
    }));
});
