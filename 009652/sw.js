const CACHE_NAME = 'captain-cache-v1';
const urlsToCache = [
  'index.html',
  'icon.png'
  // يمكنك إضافة ملفات CSS أو JS إذا كانت موجودة في مشروعك
];

// تثبيت الـ Service Worker وحفظ الملفات
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('تم فتح الكاش وحفظ الملفات الأساسية');
        return cache.addAll(urlsToCache);
      })
  );
});

// اعتراض طلبات الشبكة وتقديم الملفات من الكاش إذا لم يوجد إنترنت
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // إذا كان الملف موجود في الكاش، أعطه للمستخدم، غير ذلك اذهب للشبكة
        return response || fetch(event.request);
      })
  );
});
