// Verificador do "Rumo ao TAF": mínimos da Portaria PCBA 198/2026, calendário e status. Roda dentro de tools/check.js.
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const a = html.indexOf('/*TAF-PURO-INI*/'), b = html.indexOf('/*TAF-PURO-FIM*/');
if (a < 0 || b < 0) { console.error('FALHOU: bloco TAF-PURO não encontrado'); process.exit(1); }
const sb = { out: {} }; vm.createContext(sb);
vm.runInContext(html.slice(a, b) + '\nout.f={TAF_MIN,TAF_TESTES,TAF_ALVOS,tafPlano,tafUltimo,tafStatus,TAF_ROTINAS,tafGarantirAquec,tafAddRotinas};', sb);
const F = sb.out.f; let falhas = 0, total = 0;
const ok = (n, c) => { total++; if (!c) { falhas++; console.error('FALHOU ' + n); } };
const eq = (n, x, y) => ok(n + ' (obteve ' + JSON.stringify(x) + ')', JSON.stringify(x) === JSON.stringify(y));
eq('mínimos da Portaria (art. 10)', F.TAF_MIN, { barra: 3, abd: 36, corrida: 2400 });
ok('8 testes de referência em sábados, 28 dias entre si', F.TAF_TESTES.length === 8 && F.TAF_TESTES.every((d, i) => new Date(d + 'T12:00:00').getDay() === 6 && (i === 0 || (new Date(d) - new Date(F.TAF_TESTES[i - 1])) / 864e5 === 28)));
ok('meta final acima do mínimo nos 3 testes', F.TAF_ALVOS.at(-1).corrida > 2400 && F.TAF_ALVOS.at(-1).abd > 36 && F.TAF_ALVOS.at(-1).barra > 3);
ok('metas só crescem', F.TAF_ALVOS.every((x, i) => i === 0 || (x.corrida > F.TAF_ALVOS[i - 1].corrida && x.barra >= (F.TAF_ALVOS[i - 1].barra || 0))));
let p = F.tafPlano('2026-11-13'); ok('13/11: antes das corridas, próximo teste 14/11 em 1 dia', p.antes && p.seg === null && p.proximoTeste === '2026-11-14' && p.dias === 1);
p = F.tafPlano('2026-11-17'); ok('17/11: 8 x (1\' trota + 2\' caminhada) nas 3 manhãs', p.seg === "8 x (1' trota + 2' caminhada)" && p.ter === p.seg && p.qui === p.seg && !p.antes);
p = F.tafPlano('2026-12-02'); ok('semana da prova não sobe carga', /semana da prova/.test(p.seg));
p = F.tafPlano('2027-01-19'); ok('19/01: 20 min contínuo', p.seg === "20' contínuo");
p = F.tafPlano('2027-03-10'); ok('10/03: A/B/C diferentes', p.seg === "30' contínuo" && /6'/.test(p.ter) && p.qui === "25' leve");
ok('barra muda por fase', F.tafPlano('2026-11-20').barra.includes('negativas de 5 s') && F.tafPlano('2027-01-10').barra.includes('isometria') && F.tafPlano('2027-03-01').barra.includes('elástico') && F.tafPlano('2027-05-01').barra.includes('limpas'));
ok('alvo do ciclo: 13/11 -> 1400 m; 10/01 -> 1900 m; 29/05 -> 2600 m', F.tafPlano('2026-11-13').alvo.corrida === 1400 && F.tafPlano('2027-01-10').alvo.corrida === 1900 && F.tafPlano('2027-05-29').alvo.corrida === 2600);
ok('fim do plano: ativo falso após 30/05/2027', F.tafPlano('2027-05-31').ativo === false && F.tafPlano('2027-05-31').proximoTeste === null);
eq('último teste', F.tafUltimo({ '2026-11-14': { corrida: 1100 }, '2026-12-12': { corrida: 1400, abd: 30 } }), { data: '2026-12-12', corrida: 1400, abd: 30 });
eq('sem testes', F.tafUltimo({}), null);
eq('status vs mínimo', F.tafStatus({ barra: 3, abd: 35, corrida: 2400 }), { barra: 'ok', abd: 'falta', corrida: 'ok' });
eq('status sem dado', F.tafStatus(null), { barra: 'sem', abd: 'sem', corrida: 'sem' });
ok('cartão entra na aba Semana e botão salva sem apagar nada', /h \+= tafCard\(\);/.test(html) && /ACT\.tafSalvar/.test(html) && !/delete p\.taf|p\.taf = \{\}\s*;?\s*\}\)/.test(html));

// ---- rotinas TAF e aquecimento ----
ok('4 rotinas TAF com id fixo e flag taf', F.TAF_ROTINAS.map(r => r.id).join() === 'taf-corrida,taf-fin-push,taf-fin-pull,taf-teste' && F.TAF_ROTINAS.every(r => r.taf === true));
const tipo = id => ({ 'supino': 'carga', 'barra-fixa': 'corpo', 'esteira': 'cardio' }[id] || 'carga');
ok('toda rotina TAF abre com aquecimento (caminhada, série W ou os dois)', F.TAF_ROTINAS.every(r => r.itens[0].eid === 'caminhada' || r.itens.some(i => i.aq > 0)));
ok('TESTE TAF na ordem do TAF real: aquecimento, barra, abdominal, corrida', F.TAF_ROTINAS[3].itens.map(i => i.eid).join() === 'caminhada,polichinelo,barra-fixa,abdominal-supra,corrida-rua');
let rs = [{ id: 'a', nome: 'PUSH A', itens: [{ eid: 'supino', aq: 1 }, { eid: 'x' }] }, { id: 'b', nome: 'LEGS', itens: [{ eid: 'esteira' }, { eid: 'agach' }] }, { id: 'c', nome: 'PULL B', itens: [{ eid: 'barra-fixa', aq: 0 }] }];
let n = F.tafGarantirAquec(rs, tipo);
eq('aquecimento só onde faltava (LEGS e PULL B), PUSH A intocada', [n, rs[0].itens[0].aq, rs[0].itens[1].aq || 0, rs[1].itens[1].aq, rs[1].itens[0].aq || 0, rs[2].itens[0].aq], [2, 1, 0, 1, 0, 1]);
eq('segunda passada não muda nada (idempotente)', F.tafGarantirAquec(rs, tipo), 0);
eq('adiciona as 4 TAF uma vez', [F.tafAddRotinas(rs), F.tafAddRotinas(rs), rs.length], [4, 0, 7]);
ok('aquecimento não altera as rotinas TAF', F.tafGarantirAquec([{ id: 't', taf: true, itens: [{ eid: 'supino' }] }], tipo) === 0);
ok('TAF é opt-in: cartão e rotinas só com tafAtivo (link #taf)', /!tafAtivo\(p\)\) return ""/.test(html) && /if \(!tafAtivo\(p\) \|\| p\.tafRotV === 1\) return;/.test(html) && /location\.hash \|\| ""\) !== "#taf"/.test(html));
ok('init das rotinas TAF espera o perfil carregar quando o app tem esse guarda (Painel)', /typeof tafPodeInit === "function" && !tafPodeInit\(\)/.test(html));
console.log((total - falhas) + '/' + total + ' verificações do TAF passaram');
process.exit(falhas ? 1 : 0);
