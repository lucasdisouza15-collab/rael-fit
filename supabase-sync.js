/* Frangômetro: sincronização com Supabase (cliente). Offline-first.
 * Fonte da verdade no aparelho continua sendo ST.docs/localStorage; a nuvem só espelha.
 * Config pública em supabase-config.json: {"url":"https://XXXX.supabase.co","key":"sb_publishable_..."}
 * (a chave publishable é pública por desenho; quem protege os dados é o RLS. NUNCA usar secret/service_role aqui.)
 * Carregar ANTES do app: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
 */
const SB = { msg: "", cli: null, user: null, on: false, fila: new Set(), timer: null, err: null };

async function sbInit() {
  try {
    const cfg = await (await fetch("supabase-config.json", { cache: "no-store" })).json();
    if (!cfg.url || !cfg.key || !window.supabase) return;          // sem config: app segue 100% local
    SB.cli = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true } });
    const { data } = await SB.cli.auth.getSession();
    SB.user = data.session && data.session.user || null;
    SB.cli.auth.onAuthStateChange((_e, s) => { SB.user = s && s.user || null; if (SB.user) sbPull(); });
    if (SB.user) await sbPull();
  } catch (e) { SB.err = String(e); }
}

// Login por E-MAIL + SENHA (o plano gratuito não deixa editar o modelo de e-mail sem SMTP próprio, então sem código por e-mail)
// No painel do Supabase: Authentication > Sign In / Providers > Email: desligar "Confirm email".
async function sbCriarConta(email, senha) {
  const { error } = await SB.cli.auth.signUp({ email, password: senha });
  return error ? error.message : null;
}
async function sbEntrar(email, senha) {
  const { error } = await SB.cli.auth.signInWithPassword({ email, password: senha });
  return error ? error.message : null;
}
async function sbSair() { await SB.cli.auth.signOut(); SB.user = null; }

// Baixa tudo do perfil atual e mescla (mesma regra do mergeRemote: o _t maior vence)
async function sbPull() {
  if (!SB.cli || !SB.user) return;
  try {
    const perfil = PID();
    const { data, error } = await SB.cli.from("docs").select("k,data,t,del").eq("perfil", perfil).limit(5000);
    if (error) throw error;
    const rem = {};
    data.forEach(r => { rem[r.k] = r.del ? { _del: true, _t: r.t } : Object.assign({}, r.data, { _t: r.t }); });
    for (const k in rem) if (!ST.docs[k] || (rem[k]._t || 0) > (ST.docs[k]._t || 0)) ST.docs[k] = rem[k];
    for (const k in ST.docs) if (!rem[k] || (ST.docs[k]._t || 0) > (rem[k]._t || 0)) sbQueue(k);
    lsWrite(); render(); SB.on = true; SB.err = null;
  } catch (e) { SB.err = e.message || "erro"; SB.on = false; }
}

// Chamar de dentro de queueRemote(k) e delDoc: sbQueue(k)
function sbQueue(k) {
  if (!SB.cli || !SB.user) return;
  SB.fila.add(k); clearTimeout(SB.timer);
  SB.timer = setTimeout(sbFlush, 1500);
}
async function sbFlush() {
  if (!SB.user || !SB.fila.size) return;
  if (!navigator.onLine) return;                                  // offline: a fila é refeita no próximo sbPull/online
  const perfil = PID(), ks = [...SB.fila];
  const rows = ks.map(k => {
    const d = ST.docs[k] || {}, { _t, _del, ...resto } = d;
    return { user_id: SB.user.id, perfil, k, data: resto, t: _t || Date.now(), del: !!_del };
  });
  const { error } = await SB.cli.from("docs").upsert(rows, { onConflict: "user_id,perfil,k" });
  if (error) { SB.err = error.message; setTimeout(sbFlush, 30000); return; }
  ks.forEach(k => SB.fila.delete(k)); SB.err = null;
}
addEventListener("online", () => { sbPull(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) sbPull(); });
