const CACHE_NAME = 'captain-app-v1';
const urlsToCache = [
  '/',
  '/index2.html',  // <-- تم التعديل هنا ليتطابق مع اسم ملفك
  '/captain.js',
  '/icone.ico'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
