// Verificador das ideias 1 a 7 (docs/SPEC.md, "Ideias 1 a 7"). Extrai a lógica pura do index.html e testa.
// Uso: node tools/check-ideias.js (também roda dentro de tools/check.js). Saída 0 = ok.
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
let falhas = 0, total = 0;
const ok = (n, c) => { total++; if (!c) { falhas++; console.error('FALHOU ' + n); } };
const eq = (n, a, b) => ok(n + ' (obteve ' + JSON.stringify(a) + ', esperado ' + JSON.stringify(b) + ')', JSON.stringify(a) === JSON.stringify(b));

const m = html.match(/\/\*IX-PURO-INI\*\/([\s\S]*?)\/\*IX-PURO-FIM\*\//);
if (!m) { console.error('FALHOU: bloco IX-PURO não encontrado no index.html'); process.exit(1); }
const sb = { out: {} };
vm.createContext(sb);
const pre = `
const num = v => { const x = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(x) ? x : 0; };
const r1 = n => Math.round((+n || 0) * 10) / 10;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
function iso(d) { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); }
function addDays(s, n) { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); }
const dowOf = s => new Date(s + "T12:00:00").getDay();
`;
vm.runInContext(pre + m[1] + '\nout.f={ixHa,ixDadosEstado,ixEstagnacaoCarga,ixEstagnacaoPeso,ixCargasTop,ixResumoSemana,ixSemanaRef,ixOrigem,ixParecidos,ixTopPorRefeicao,ixMetaPrazo};', sb);
const F = sb.out.f;

// ---------- 1. Meus dados ----------
let e = F.ixDadosEstado({ temDados: false, nuvem: {}, ultBackup: '', hoje: '2026-11-11' });
eq('sem dados = ok', e.nivel, 'ok');
e = F.ixDadosEstado({ temDados: true, nuvem: { user: true, err: 'rede' }, ultBackup: '', hoje: '2026-11-11' });
eq('nuvem com erro = ruim', e.nivel, 'ruim');
e = F.ixDadosEstado({ temDados: true, nuvem: { user: true, err: null, ultOk: Date.now() - 3 * 3600e3 }, ultBackup: '', hoje: '2026-11-11' });
eq('nuvem ok = ok', e.nivel, 'ok'); ok('mostra "há 3 h"', /há 3 h/.test(e.msg));
e = F.ixDadosEstado({ temDados: true, nuvem: {}, ultBackup: '', hoje: '2026-11-11' });
eq('sem nuvem e sem cópia = aviso', e.nivel, 'aviso');
e = F.ixDadosEstado({ temDados: true, nuvem: {}, ultBackup: '2026-11-01', hoje: '2026-11-11' });
eq('cópia de 10 dias = aviso', e.nivel, 'aviso');
e = F.ixDadosEstado({ temDados: true, nuvem: {}, ultBackup: '2026-11-08', hoje: '2026-11-11' });
eq('cópia de 3 dias = ok', e.nivel, 'ok');
eq('ixHa minutos', F.ixHa(1000, 1000 + 5 * 60e3), 'há 5 min');
eq('ixHa dias', F.ixHa(1000, 1000 + 2 * 86400e3), 'há 2 dias');
eq('ixHa agora', F.ixHa(1000, 1000 + 20e3), 'agora há pouco');

// ---------- 2. Estagnação ----------
const W = (id, data, ini, kgs, eid = 'supino', tipo = 'carga') => ({ id, data, inicio: ini, fim: ini + 3600e3, ex: [{ eid, nome: 'Supino', tipo, series: kgs.map(([kg, reps]) => ({ kg, reps, ok: true, tipo: '' })) }] });
const d = s => new Date(s + 'T10:00:00').getTime();
let ws = [W('c', '2026-11-09', d('2026-11-09'), [[60, 8], [60, 8]]), W('b', '2026-11-05', d('2026-11-05'), [[60, 8]]), W('a', '2026-11-02', d('2026-11-02'), [[60, 8]])];
let r = F.ixEstagnacaoCarga(ws, 'supino');
ok('3 treinos na mesma carga = estagnado', r && r.eid === 'supino' && r.kg === 60 && r.n === 3);
ws = [W('c', '2026-11-09', d('2026-11-09'), [[62.5, 8]]), W('b', '2026-11-05', d('2026-11-05'), [[60, 8]]), W('a', '2026-11-02', d('2026-11-02'), [[60, 8]])];
eq('carga subiu = null', F.ixEstagnacaoCarga(ws, 'supino'), null);
ws = [W('c', '2026-11-09', d('2026-11-09'), [[60, 10]]), W('b', '2026-11-05', d('2026-11-05'), [[60, 8]]), W('a', '2026-11-02', d('2026-11-02'), [[60, 8]])];
eq('mais repetições na mesma carga = null (e1RM subiu)', F.ixEstagnacaoCarga(ws, 'supino'), null);
eq('só 2 treinos = null', F.ixEstagnacaoCarga(ws.slice(1), 'supino'), null);
ws = [W('c', '2026-11-09', d('2026-11-09'), [[60, 8]], 'esteira', 'cardio'), W('b', '2026-11-05', d('2026-11-05'), [[60, 8]], 'esteira', 'cardio'), W('a', '2026-11-02', d('2026-11-02'), [[60, 8]], 'esteira', 'cardio')];
eq('cardio nunca estagna por carga', F.ixEstagnacaoCarga(ws, 'esteira'), null);
ws = [W('c', '2026-11-09', d('2026-11-09'), [[60, 8]]), W('b', '2026-11-05', d('2026-11-05'), [[60, 8]]), Object.assign(W('a', '2026-11-02', d('2026-11-02'), [[60, 8]]), { ignorar: true })];
eq('treino ignorado não conta', F.ixEstagnacaoCarga(ws, 'supino'), null);

const P = (...a) => a.map(([data, kg]) => ({ data, kg }));
r = F.ixEstagnacaoPeso(P(['2026-10-22', 80], ['2026-10-30', 80.1], ['2026-11-10', 79.9]), '2026-11-11', 'perder', null);
ok('peso parado 20 dias = estagnado', r && r.dias === 19);
eq('peso mexendo = null', F.ixEstagnacaoPeso(P(['2026-10-22', 82], ['2026-11-10', 80.5]), '2026-11-11', 'perder', null), null);
eq('só uma pesagem = null', F.ixEstagnacaoPeso(P(['2026-11-10', 80]), '2026-11-11', 'perder', null), null);
eq('pesagens muito próximas = null', F.ixEstagnacaoPeso(P(['2026-11-05', 80], ['2026-11-10', 80]), '2026-11-11', 'perder', null), null);
eq('objetivo manter = null', F.ixEstagnacaoPeso(P(['2026-10-22', 80], ['2026-11-10', 80]), '2026-11-11', 'manter', null), null);
eq('meta atingida = null', F.ixEstagnacaoPeso(P(['2026-10-22', 80], ['2026-11-10', 80]), '2026-11-11', 'perder', 80.3), null);

// ---------- 3. Resumo semanal ----------
const dias = (kc) => kc.map((k, i) => ({ dt: '2026-11-0' + (i + 1), kcal: k }));
let rs = F.ixResumoSemana({ dias: dias([2000, 2100, 1900, 2000, 2200, 0, 0]), metaKcal: 2000, treinos: 3, pesoIni: 80, pesoFim: 79.4, seq: 5, objetivo: 'perder' });
eq('dias registrados', rs.diasReg, 5); eq('média só dos dias registrados', rs.kcalMedia, 2040); eq('variação de peso', rs.dPeso, -0.6);
ok('conquista de treinos', /3 treinos/.test(rs.conquista)); ok('tem ajuste', rs.ajuste.length > 10); ok('texto curto cabe no push', rs.curto.length <= 140);
rs = F.ixResumoSemana({ dias: dias([2000, 0, 0, 0, 0, 0, 0]), metaKcal: 2000, treinos: 0, pesoIni: null, pesoFim: null, seq: 0, objetivo: 'perder' });
eq('poucos registros: ajuste de registro', /registrar/.test(rs.ajuste), true); eq('sem peso = null', rs.dPeso, null);
rs = F.ixResumoSemana({ dias: dias([2800, 2800, 2800, 2800, 2800, 2800, 2800]), metaKcal: 2000, treinos: 4, pesoIni: 80, pesoFim: 80, seq: 7, objetivo: 'perder' });
ok('acima da meta: ajuste fala da média', /acima/.test(rs.ajuste)); ok('sequência de 7 vira conquista', /7 dias/.test(rs.conquista));
eq('domingo: semana de seg a hoje', F.ixSemanaRef('2026-11-08'), { ini: '2026-11-02', fim: '2026-11-08', passada: false });
eq('terça: semana passada', F.ixSemanaRef('2026-11-10'), { ini: '2026-11-02', fim: '2026-11-08', passada: true });
eq('quarta: sem card', F.ixSemanaRef('2026-11-11'), null);

// ---------- 4. Origem e duplicidade ----------
eq('hevy', F.ixOrigem({ id: 'hv123', hevy: true }), 'hevy');
eq('painel', F.ixOrigem({ id: 'pn20261110' }), 'painel');
eq('app', F.ixOrigem({ id: 'abc123' }), 'app');
eq('origem gravada', F.ixOrigem({ id: 'x', origem: 'strava' }), 'strava');
const T = (id, ini, mins, extra) => Object.assign({ id, data: '2026-11-10', inicio: d('2026-11-10') + ini * 60e3, fim: d('2026-11-10') + (ini + mins) * 60e3, ex: [{ eid: 'supino', series: [{ kg: 60, reps: 8, ok: true }] }] }, extra || {});
ok('Hevy + Painel no mesmo horário = parecidos', F.ixParecidos(T('hv1', 0, 60, { hevy: true }), T('pn20261110', 20, 55)));
ok('mesma origem nunca é duplicado', !F.ixParecidos(T('a1', 0, 60), T('a2', 10, 60)));
ok('dias diferentes não são parecidos', !F.ixParecidos(T('hv1', 0, 60, { hevy: true }), Object.assign(T('pn2', 10, 60), { data: '2026-11-11' })));
ok('manhã e noite não são parecidos', !F.ixParecidos(T('hv1', 0, 60, { hevy: true }), T('pn20261110', 600, 60)));
ok('mesmos exercícios e volume (horários distantes) = parecidos', F.ixParecidos(T('hv1', 0, 60, { hevy: true }), T('pn20261110', 240, 30)));
ok('ignorado nunca aparece como par', !F.ixParecidos(T('hv1', 0, 60, { hevy: true, ignorar: true }), T('pn20261110', 10, 60)));

// ---------- 5. Favoritos ----------
const en = (key, nome, qtd, modo = 'g') => ({ id: Math.random().toString(36), key, nome, qtd, modo, base: { kcal: 100 } });
const dd = [
  { dt: '2026-11-10', ref: { cafe: [en('pao', 'Pão', 50), en('ovo', 'Ovo', 2, 'un')], almoco: [en('arroz', 'Arroz', 150)] } },
  { dt: '2026-11-09', ref: { cafe: [en('pao', 'Pão', 60), en('cafe', 'Café', 100)], almoco: [en('arroz', 'Arroz', 200)] } },
  { dt: '2026-11-08', ref: { cafe: [en('pao', 'Pão', 50), en('ovo', 'Ovo', 3, 'un')] } },
  { dt: '2026-11-11', ref: { cafe: [en('pao', 'Pão', 999), en('hoje', 'Só hoje', 1)] } },
  { dt: '2026-08-01', ref: { cafe: [en('velho', 'Velho', 1), en('velho', 'Velho', 1), en('velho', 'Velho', 1)] } }
];
let top = F.ixTopPorRefeicao(dd, 'cafe', 5, '2026-11-11');
eq('ordem por uso no café', top.map(x => x.key), ['pao', 'ovo']);
eq('última quantidade do pão (de ontem)', top[0].qtd, 50);
eq('hoje e dados velhos não entram', top.some(x => x.key === 'hoje' || x.key === 'velho'), false);
eq('almoço', F.ixTopPorRefeicao(dd, 'almoco', 5, '2026-11-11').map(x => x.key), ['arroz']);
eq('limite n', F.ixTopPorRefeicao(dd, 'cafe', 1, '2026-11-11').length, 1);

// ---------- 7. Metas com prazo ----------
const base = { pesoAtual: 85, pesoIni: 90, alvo: 80, dataAlvo: '2027-01-20', hoje: '2026-11-11', pesos: P(['2026-10-14', 87], ['2026-11-11', 85]), objetivo: 'perder' };
let mp = F.ixMetaPrazo(base);
eq('falta', mp.falta, -5); eq('dias', mp.dias, 70); eq('ritmo necessário kg/sem', Math.round(mp.needKgSem * 100) / 100, -0.5);
eq('ritmo real kg/sem', Math.round(mp.realKgSem * 100) / 100, -0.5); eq('no ritmo', mp.status, 'no-ritmo'); eq('progresso %', mp.pct, 50);
mp = F.ixMetaPrazo(Object.assign({}, base, { pesos: P(['2026-10-14', 88], ['2026-11-11', 85]) })); eq('adiantado', mp.status, 'adiantado');
mp = F.ixMetaPrazo(Object.assign({}, base, { pesos: P(['2026-10-14', 85.2], ['2026-11-11', 85]) })); eq('atrasado', mp.status, 'atrasado');
mp = F.ixMetaPrazo(Object.assign({}, base, { pesos: P(['2026-10-14', 84], ['2026-11-11', 85]) })); eq('indo para o lado errado = atrasado', mp.status, 'atrasado');
mp = F.ixMetaPrazo(Object.assign({}, base, { pesos: P(['2026-11-10', 85]) })); eq('sem histórico = sem-ritmo', mp.status, 'sem-ritmo');
mp = F.ixMetaPrazo(Object.assign({}, base, { dataAlvo: '2026-11-25' })); ok('prazo curto é agressivo', mp.agressivo === true);
mp = F.ixMetaPrazo(Object.assign({}, base, { dataAlvo: '2026-11-01' })); eq('prazo vencido', mp.status, 'vencido');
mp = F.ixMetaPrazo(Object.assign({}, base, { pesoAtual: 80.1 })); eq('atingida', mp.status, 'atingida');
eq('sem data = null', F.ixMetaPrazo(Object.assign({}, base, { dataAlvo: '' })), null);
mp = F.ixMetaPrazo(Object.assign({}, base, { alvo: 90, pesoIni: 80, pesoAtual: 85, pesos: P(['2026-10-14', 83], ['2026-11-11', 85]), objetivo: 'ganhar' })); ok('ganhar massa também funciona', mp.status === 'no-ritmo' || mp.status === 'adiantado');


// ---------- 2b. Cargas travadas: cartão compacto ----------
{
  const gera = n => Array.from({ length: n }, (_, i) => ({ k: 'c:e' + i, nome: 'Ex ' + i, kg: 20 + (i % 50) }));
  for (const n of [1, 5, 1000]) {
    const r = F.ixCargasTop(gera(n), 3);
    eq('cargas ' + n + ': total', r.total, n); eq('cargas ' + n + ': mostra no máx. 3', r.top.length, Math.min(3, n)); eq('cargas ' + n + ': resto', r.resto, Math.max(0, n - 3));
    ok('cargas ' + n + ': ordem por carga desc', r.top.every((c, i) => i === 0 || r.top[i - 1].kg >= c.kg));
  }
  eq('cargas vazio', F.ixCargasTop([], 3), { total: 0, top: [], resto: 0 });
  // HTML: extrai ixCargasEvo/ixCargasHoje e confere tamanho (1 cartão, 3 linhas recolhido)
  const fm = html.match(/const ixCargas = [\s\S]*?function ixCargasHoje\(\) \{[\s\S]*?\n\}\n/);
  ok('funções do cartão compacto existem no index.html', !!fm);
  if (fm) {
    for (const n of [1, 5, 1000]) {
      for (const aberto of [false, true]) {
        const sb2 = { out: {}, UIc: { ixCg: aberto }, P: () => ({ incremento: 2 }), esc: x => String(x), fmt1: x => String(x), num: x => +x || 0 };
        vm.createContext(sb2);
        vm.runInContext(pre + m[1] + '\nconst ixAlertas = () => Array.from({length:' + n + '},(_,i)=>({k:"c:e"+i,t:"Carga travada",carga:{nome:"Ex "+i,kg:20+i%50},txt:"x"}));\n' + fm[0] + '\nout.e = ixCargasEvo(); out.h = ixCargasHoje();', sb2);
        const linhas = (sb2.out.e.match(/class="li"/g) || []).length;
        eq('cartão ' + n + ' ' + (aberto ? 'aberto' : 'recolhido') + ': linhas', linhas, aberto ? n : Math.min(3, n));
        ok('cartão ' + n + ': título com contagem', sb2.out.e.includes('Cargas travadas (' + n + ')'));
        eq('cartão ' + n + ': dica aparece 1 vez', (sb2.out.e.match(/Dica:/g) || []).length, 1);
        eq('cartão ' + n + ': 1 só cartão', (sb2.out.e.match(/class="card flat"/g) || []).length, 1);
        ok('cartão ' + n + ': silenciar todos', sb2.out.e.includes('ixSonecaTodos'));
        ok('cartão ' + n + ': ver todos só se > 3', n > 3 ? sb2.out.e.includes('ixCgTog') : !sb2.out.e.includes('ixCgTog'));
        ok('Hoje ' + n + ': uma linha de resumo', sb2.out.h.includes('ixCgVer') && !sb2.out.h.includes('Dica') && sb2.out.h.includes(n + (n === 1 ? ' carga travada' : ' cargas travadas')));
      }
    }
  }
}

console.log((total - falhas) + '/' + total + ' testes das ideias 1 a 7 passaram');
process.exit(falhas ? 1 : 0);
