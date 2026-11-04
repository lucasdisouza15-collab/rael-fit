// Service worker do Frangômetro: recebe os avisos (Web Push: descanso, lembretes do dia, novidades) e mostra a notificação.
const FRASES = [
  "O intervalo acabou. Eu tinha acabado de me acomodar.",
  "Descanso encerrado. Minha cadeira imaginária protesta em silêncio.",
  "Hora da próxima série. Eu nem terminei minha análise do teto.",
  "O cronômetro tocou. Incrível como ele nunca respeita meu intervalo.",
  "Acabou a pausa. Foi breve, mas deu tempo de sentir saudade.",
  "Próxima série na área. Eu estava começando a gostar deste intervalo.",
  "O descanso terminou. Vou guardar minha pose de quem não estava cansado.",
  "Tempo esgotado. Meu plano era descansar até segunda instrução.",
  "O relógio chamou. Eu não gostei do tom, mas reconheço a autoridade.",
  "Pausa concluída. Minhas desculpas ainda estavam carregando.",
  "Já pode voltar. Eu estava no meio de uma reclamação muito bem estruturada.",
  "Intervalo encerrado. Minha vontade pediu cinco minutos para recorrer.",
  "O cronômetro apitou. Até o aparelho tem mais iniciativa que eu.",
  "Acabou o descanso. Vou fingir que não estava negociando com o banco.",
  "Próxima série. Eu estava prestes a chamar isso de treino de contemplação.",
  "O intervalo acabou. O Rael tinha acabado de se acomodar e já vão te tirar do conforto.",
  "Descanso encerrado. A cadeira imaginária protesta e eu a apoio.",
  "Hora da próxima série. Sim, ela existe e sim, ela vem com juros.",
  "O cronômetro apitou. Eu sei, eu também odeio quando o tempo passa.",
  "Série seguinte. Respira, pega o peso e finge que é fácil.",
  "Acabou a pausa. Entre as séries, o tempo é sempre curto e o sofá, longo."
];
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
/* O push chega sem conteúdo: o Worker diz o que mostrar (descanso, lembrete do dia ou novidade).
   Se a consulta falhar, cai no aviso de descanso (comportamento antigo). */
async function proximoAviso() {
  try {
    const cfg = await fetch("push-config.json", { cache: "no-store" }).then(r => r.json());
    const sub = await self.registration.pushManager.getSubscription();
    if (!cfg || !cfg.url || !sub) return { tipo: "descanso" };
    const r = await fetch(cfg.url.replace(/\/$/, "") + "/proximo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sub: sub.toJSON() }) });
    return r.ok ? await r.json() : { tipo: "descanso" };
  } catch (e) { return { tipo: "descanso" }; }
}
self.addEventListener("push", e => {
  e.waitUntil(proximoAviso().then(m => {
    if (!m || !m.tipo || m.tipo === "descanso") {
      return self.registration.showNotification("Descanso acabou", {
        body: FRASES[Math.floor(Math.random() * FRASES.length)], tag: "descanso", renotify: true, icon: "icon.png", badge: "icon.png",
        vibrate: [300, 120, 300, 120, 300], requireInteraction: true
      });
    }
    return self.registration.showNotification(m.titulo || "Rael", { body: m.corpo || "", tag: m.tag || "rael", icon: "icon.png", badge: "icon.png" });
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(l => l.length ? l[0].focus() : self.clients.openWindow("./")));
});
