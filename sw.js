// Service Worker - المواعيد واللقاءات 2026
// عند تعديل أي ملف في البرنامج غيّر رقم الإصدار حتى يتحدّث التطبيق عند المستخدمين
const CACHE_VERSION = 'mawaeed-2026-v3';
const STATIC_CACHE = CACHE_VERSION + '-static';
const RUNTIME_CACHE = CACHE_VERSION + '-runtime';

// الملفات المحلية التي تُحفظ عند التثبيت
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json'
];

// المكتبات الخارجية (خطوط، أيقونات، الرسوم البيانية، PDF) لتعمل بدون إنترنت
const CDN_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(APP_SHELL);
    // المكتبات الخارجية: لا نُفشل التثبيت إن تعذّر تحميل إحداها
    await Promise.all(CDN_ASSETS.map(url =>
      fetch(url, { mode: 'no-cors' }).then(res => cache.put(url, res)).catch(() => {})
    ));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !k.startsWith(CACHE_VERSION)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // صفحة البرنامج: الشبكة أولاً (لأخذ آخر نسخة) ثم النسخة المحفوظة عند انقطاع الإنترنت
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(STATIC_CACHE);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (e) {
        return (await caches.match('./index.html')) || (await caches.match('./'));
      }
    })());
    return;
  }

  // باقي الملفات (أيقونات، مكتبات، خطوط): من الذاكرة أولاً ثم الشبكة مع الحفظ
  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: url.origin === location.origin });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch (e) {
      return cached || Response.error();
    }
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
