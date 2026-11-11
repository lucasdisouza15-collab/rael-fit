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
/* ===== Offline (cache) =====
   - Página (index.html): rede primeiro (sempre a versão nova); sem internet ou lenta (4 s), usa a última guardada.
   - Arquivos fixos (ícones, fotos de exercício, fontes, supabase-js): guarda na 1ª vez e serve do cache.
   - Configs .json: rede primeiro, cópia se offline. Nunca guarda: chamadas de dados (Supabase, IA, Worker), pedidos que não são GET e o teste de versão (?_=).
   Para forçar renovação geral, suba CACHE (ex.: frango-v2); o botão "Atualizar app" do app também limpa tudo. */
const CACHE = "frango-v1";
const FIXOS = ["./", "icon.png", "icon-192.png", "apple-touch-icon.png", "manifest.json", "supabase-sync.js?v=1"];
const EXTERNOS_OK = [/^fonts\.googleapis\.com$/, /^fonts\.gstatic\.com$/, /^cdn\.jsdelivr\.net$/];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FIXOS.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("frango-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
const comTimeout = (p, ms) => new Promise((ok, no) => { const t = setTimeout(() => no(new Error("lento")), ms); p.then(r => { clearTimeout(t); ok(r); }, er => { clearTimeout(t); no(er); }); });
async function paginaRedePrimeiro(req) {
  const c = await caches.open(CACHE), chave = new URL("./", self.registration.scope).href;
  try {
    const r = await comTimeout(fetch(req), 4000);
    if (r && r.ok) c.put(chave, r.clone());
    return r;
  } catch (er) {
    return (await c.match(chave)) || (await c.match("./")) || Response.error();
  }
}
async function jsonRedePrimeiro(req) {
  const c = await caches.open(CACHE);
  try { const r = await fetch(req); if (r && r.ok) c.put(req.url.split("?")[0], r.clone()); return r; }
  catch (er) { return (await c.match(req.url.split("?")[0])) || Response.error(); }
}
async function arquivoCacheDepois(req) {
  const c = await caches.open(CACHE), hit = await c.match(req);
  if (hit) { fetch(req).then(r => { if (r && (r.ok || r.type === "opaque")) c.put(req, r); }).catch(() => {}); return hit; }
  const r = await fetch(req);
  if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone());
  return r;
}
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (u.searchParams.has("_")) return;                                   // teste de versão: sempre rede
  if (u.origin !== self.location.origin) { if (EXTERNOS_OK.some(r => r.test(u.hostname))) e.respondWith(arquivoCacheDepois(req)); return; }
  if (req.mode === "navigate") { e.respondWith(paginaRedePrimeiro(req)); return; }
  if (/\.json$/.test(u.pathname)) { e.respondWith(jsonRedePrimeiro(req)); return; }   // configs (push, supabase): rede primeiro, cópia se offline
  if (/\.(png|jpe?g|webp|svg|ico|woff2?|js|css)$/.test(u.pathname)) e.respondWith(arquivoCacheDepois(req).catch(() => Response.error()));
});
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
