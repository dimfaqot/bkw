// Service Worker untuk PWA Web Push Notification BKW mPOS Pro
self.addEventListener('push', function(event) {
  let data = { title: 'BKW mPOS Pro', body: 'Ada pembaruan status perizinan shift terbaru.' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'BKW mPOS Pro', body: event.data.text() };
    }
  }

  // Format tautan agar mengarah ke sub-menu dashboard yang benar (?menu=nama_menu)
  let linkUrl = '/dashboard';
  if (data.link) {
    linkUrl = `/dashboard?menu=${data.link}`;
  }

  const options = {
    body: data.body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '2',
      link: linkUrl
    },
    actions: [
      { action: 'buka', title: 'Buka Aplikasi' },
      { action: 'tutup', title: 'Tutup' }
    ]
  };

  // 1. Broadcast pesan ke semua tab React yang terbuka agar meng-update lonceng tanpa reload
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      clientList.forEach(function(client) {
        client.postMessage({
          type: 'PUSH_RECEIVED',
          title: data.title,
          body: data.body
        });
      });
    })
  );

  // 2. Tampilkan notifikasi push di OS/browser
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'tutup') {
    return;
  }

  const linkToOpen = event.notification.data?.link || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Jika tab dashboard sudah terbuka, arahkan ke tautan target (mengandung query parameter) dan fokuskan
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if ('focus' in client) {
          // Kirim pesan agar tab yang aktif berpindah menu dan fokus
          client.postMessage({
            type: 'NAVIGATE_MENU',
            url: linkToOpen
          });
          return client.focus();
        }
      }
      // Jika tidak ada tab terbuka, buka tab baru
      if (self.clients.openWindow) {
        return self.clients.openWindow(linkToOpen);
      }
    })
  );
});
