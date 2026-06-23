self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "QRIP", {
      body: data.body ?? "",
      icon: "/icon-192.png",
      badge: "/badge-72.png",
      tag: "qrip-signal",
      renotify: true,
      data: { url: data.url ?? "/signal" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((list) => {
      const target = event.notification.data?.url ?? "/signal";
      for (const c of list) {
        if (c.url === target && "focus" in c) return c.focus();
      }
      return clients.openWindow(target);
    })
  );
});
