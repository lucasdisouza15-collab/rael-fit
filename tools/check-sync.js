// Verificador do sync (spec: itens B4/B6 de docs/analise-app-definitivo). Roda sbPull/sbPullLeve REAIS num sandbox com Supabase simulado.
// Uso: node tools/check-sync.js
const fs = require('fs'), vm = require('vm'); let f = 0;
const ok = (c, m) => { if (!c) f++; console.log((c ? '✓ ' : '✗ FALHOU: ') + m); };
const src = fs.readFileSync(__dirname + '/../supabase-sync.js', 'utf8');
function mundo(linhas, local) {
  const chamadas = []; const listeners = {};
  const cli = { from() { const q = { _o: null, select() { return q; }, eq() { return q; }, order() { return q; }, limit(n) { q._lim = n; return q; },
    range(a, b) { q._r = [a, b]; return q; }, then(res) { chamadas.push(q._r ? q._r.join('-') : 'limit' + q._lim);
      let rows = linhas.slice().sort((x, y) => x.k < y.k ? -1 : 1); const a = q._r ? q._r[0] : 0, b = q._r ? q._r[1] : Math.min(q._lim || 1e9, 1000) - 1; /* servidor corta em 1000 */
      rows = rows.slice(a, Math.min(b, a + 999) + 1); res({ data: rows, error: null }); } }; return q; } };
  const sb = { window: {}, navigator: { onLine: true }, PID: () => 'p1', ST: { docs: Object.assign({}, local) }, lsWrite() {}, render() {}, console, Date, Promise, setTimeout, clearTimeout,
    addEventListener(e, fn) { (listeners[e] = listeners[e] || []).push(fn); }, document: { hidden: false, addEventListener(e, fn) { (listeners[e] = listeners[e] || []).push(fn); } } };
  vm.createContext(sb); vm.runInContext(src.replace(/^const SB =/m, 'var SB ='), sb);
  vm.runInContext('SB.cli = null', sb); sb.SB.cli = cli; sb.SB.user = { id: 'u1' }; return { sb, chamadas, listeners };
}
(async () => {
  const N = 2500, linhas = Array.from({ length: N }, (_, i) => ({ k: 'd' + String(i).padStart(5, '0'), data: { v: i }, t: 1000 + i, del: false }));
  let m = mundo(linhas, {}); await m.sb.sbPull();
  ok(Object.keys(m.sb.ST.docs).length === N, 'B4 baixa as 2.500 linhas mesmo com o servidor cortando em 1.000 (' + Object.keys(m.sb.ST.docs).length + ')');
  ok(m.chamadas.join() === '0-999,1000-1999,2000-2999', 'B4 pagina em 3 consultas: ' + m.chamadas.join());
  ok(m.sb.ST.docs['d02499'].v === 2499 && m.sb.ST.docs['d00000'].v === 0, 'B4 primeiro e último documento íntegros, sem repetir nem pular');
  m = mundo(linhas.slice(0, 1000), {}); await m.sb.sbPull(); ok(m.chamadas.length === 2, 'B4 exatamente 1.000 linhas: 2ª consulta vazia encerra (' + m.chamadas.length + ' consultas)');
  m = mundo(linhas.slice(0, 5), {}); await m.sb.sbPull(); ok(m.chamadas.length === 1, 'B4 poucas linhas: 1 consulta');
  // dois aparelhos: remoto mais novo vence; local mais novo vai para a fila
  m = mundo([{ k: 'a', data: { v: 'remoto' }, t: 500, del: false }, { k: 'b', data: { v: 'remoto' }, t: 100, del: false }, { k: 'c', data: {}, t: 300, del: true }], { a: { v: 'local', _t: 400 }, b: { v: 'local', _t: 200 }, c: { v: 'x', _t: 100 } });
  await m.sb.sbPull(); const d = m.sb.ST.docs;
  ok(d.a.v === 'remoto' && d.b.v === 'local' && d.c._del === true, 'Merge 2 aparelhos: remoto novo vence (a), local novo fica (b), exclusão nova vence (c)');
  ok(m.sb.SB.fila.has('b') && !m.sb.SB.fila.has('a'), 'Merge: só o local mais novo entra na fila de envio');
  // B6: intervalo mínimo
  m = mundo(linhas.slice(0, 5), {}); await m.sb.sbPull(); const n0 = m.chamadas.length;
  m.listeners.visibilitychange.forEach(fn => fn()); await new Promise(r => setTimeout(r, 20)); ok(m.chamadas.length === n0, 'B6 voltar à tela logo depois do pull NÃO baixa de novo');
  m.listeners.online.forEach(fn => fn()); await new Promise(r => setTimeout(r, 20)); ok(m.chamadas.length === n0, 'B6 evento online logo depois também não');
  m.sb.SB.ultPull = Date.now() - 61000; m.listeners.visibilitychange.forEach(fn => fn()); await new Promise(r => setTimeout(r, 20)); ok(m.chamadas.length === n0 + 1, 'B6 passado 1 minuto, baixa de novo');
  console.log('NÃO TESTADO aqui (precisa do Supabase real): RLS entre dois logins; mescla por campo.');
  console.log(f ? f + ' falha(s)' : 'sync VERDE'); process.exit(f ? 1 : 0);
})();
