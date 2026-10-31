// Service worker do Frangômetro: recebe o aviso de fim de descanso (Web Push) e mostra a notificação.
const FRASES = [
  "O intervalo acabou. Eu tinha acabado de me acomodar.",
  "Descanso encerrado. Minha cadeira imaginária protesta em silêncio.",
  "Hora da próxima série. Eu nem terminei minha análise do teto.",
  "O cronômetro tocou. Incrível como ele nunca respeita meu intervalo.",
  "Acabou a pausa. Foi breve, mas deu tempo de sentir saudade.",
  "Próxima série na área. Eu estava começando a gostar deste intervalo.",
  "Tempo esgotado. Meu plano era descansar até segunda instrução.",
  "Já pode voltar. Eu estava no meio de uma reclamação muito bem estruturada.",
  "O cronômetro apitou. Até o aparelho tem mais iniciativa que eu.",
  "Série seguinte. Respira, pega o peso e finge que é fácil."
];
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("push", e => {
  e.waitUntil(self.registration.showNotification("Descanso acabou", {
    body: FRASES[Math.floor(Math.random() * FRASES.length)], tag: "descanso", renotify: true, icon: "icon.png", badge: "icon.png",
    vibrate: [300, 120, 300, 120, 300], requireInteraction: true
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(l => l.length ? l[0].focus() : self.clients.openWindow("./")));
});
