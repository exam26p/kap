const CACHE_NAME = 'captain-pwa-v1';
const urlsToCache = [
  './',
  'index.html',
  'icon.png'
];

// تثبيت الـ Service Worker وحفظ الملفات الأساسية
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Captain PWA: تم فتح الكاش وحفظ الملفات');
        return cache.addAll(urlsToCache).catch(error => {
            console.error('Captain PWA: فشل حفظ أحد الملفات:', error);
        });
      })
  );
  self.skipWaiting(); // إجبار التفعيل الفوري
});

// تفعيل الـ Service Worker وحذف الكاش القديم عند التحديث
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      );
    })
  );
  self.clients.claim(); // السيطرة على الصفحة فوراً
});

// اعتراض طلبات الشبكة: يعرض الكاش أولاً، وإذا لم يجده يذهب للإنترنت
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // الملف موجود في الكاش، اعرضه فوراً
        }
        return fetch(event.request).catch(() => caches.match('./')); // إذا لا يوجد إنترنت، اعرض الصفحة الرئيسية
      })
  );
});
