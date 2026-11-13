// Verificador da semana pela rotação (spec em docs/SPEC.md, 11/11/2026). Uso: node tools/check-semana.js
// Dados congelados do perfil real do Lucas (nomes das 6 rotinas do Painel/Hevy, sem p.semana) em 11/11/2026 (quarta).
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const src = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).join('\n');
function pega(nome) {
  const i = src.search(new RegExp('^function ' + nome + '\\(', 'm')); if (i < 0) throw new Error('não achei ' + nome);
  let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
}
const sb = {}; vm.createContext(sb);
vm.runInContext('const dowOf = s => new Date(s + "T12:00:00").getDay();\n' + pega('semanaRot') + '\nout={semanaRot};', sb);
let falhas = 0, total = 0;
const ok = (n, c, d) => { total++; if (!c) { falhas++; console.error('FALHOU ' + n + (d ? ': ' + d : '')); } };
const R = ['PUSH A', 'PULL A', 'LEGS', 'PUSH B', 'PULL B', 'UPPER BÔNUS'].map((nome, i) => ({ id: 'r' + i, nome }));
const nomes = m => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, R.find(r => r.id === v).nome]));
const out = sb.out;
// v74 (13/11/2026, Lucas): uma LEGS a cada par push+pull: PUSH A, PULL A, LEGS, PUSH B, PULL B, LEGS.
const seqDe = (ws, hoje, feitos) => { const m = nomes(out.semanaRot({ rotinas: R }, ws, !!feitos, hoje)); return m; };
// quarta 11/11, último treino feito: PUSH A (terça). Esperado: Qua PULL A, Qui LEGS, Sex PUSH B, Sáb UPPER BÔNUS.
let s = seqDe([{ nome: 'PUSH A', data: '2026-11-10' }], '2026-11-11');
ok('quarta: PULL A, LEGS, PUSH B, bônus no sábado', s[3] === 'PULL A' && s[4] === 'LEGS' && s[5] === 'PUSH B' && s[6] === 'UPPER BÔNUS', JSON.stringify(s));
ok('segunda/terça (passado) e domingo ficam sem rotina', !s[1] && !s[2] && !s[0], JSON.stringify(s));
// LEGS depois de PULL A: segue PUSH B, PULL B, LEGS
s = seqDe([{ nome: 'LEGS', data: '2026-11-11' }, { nome: 'PULL A', data: '2026-11-10' }], '2026-11-11', true);
ok('LEGS depois de PULL A: quinta PUSH B, sexta PULL B', !s[3] && s[4] === 'PUSH B' && s[5] === 'PULL B', JSON.stringify(s));
// LEGS depois de PULL B: volta para PUSH A
s = seqDe([{ nome: 'LEGS', data: '2026-11-10' }, { nome: 'PULL B', data: '2026-11-09' }], '2026-11-10', true);
ok('LEGS depois de PULL B volta para PUSH A, PULL A', s[3] === 'PUSH A' && s[4] === 'PULL A' && s[5] === 'LEGS', JSON.stringify(s));
// LEGS fora do lugar (depois de PUSH A, ordem antiga): continua em PULL A
s = seqDe([{ nome: 'LEGS', data: '2026-11-11' }, { nome: 'PUSH A', data: '2026-11-10' }], '2026-11-11', true);
ok('LEGS depois de PUSH A: quinta PULL A, sexta LEGS', s[4] === 'PULL A' && s[5] === 'LEGS', JSON.stringify(s));
// depois de PULL B (ainda sem a perna): LEGS
s = seqDe([{ nome: 'PULL B', data: '2026-11-09' }], '2026-11-10');
ok('depois de PULL B vem LEGS e PUSH A', s[2] === 'LEGS' && s[3] === 'PUSH A', JSON.stringify(s));
// sem treino nenhum: começa em PUSH A
s = seqDe([], '2026-11-09');
ok('sem histórico: PUSH A, PULL A, LEGS, PUSH B, PULL B', s[1] === 'PUSH A' && s[2] === 'PULL A' && s[3] === 'LEGS' && s[4] === 'PUSH B' && s[5] === 'PULL B', JSON.stringify(s));
// em qualquer ponto de partida, no máximo 2 treinos seguidos sem perna (nunca 4)
{ const mx = []; for (const ult of ['PUSH A', 'PULL A', 'PUSH B', 'PULL B', 'LEGS']) { const ws = ult === 'LEGS' ? [{ nome: 'LEGS', data: '2026-11-08' }, { nome: 'PULL A', data: '2026-11-07' }] : [{ nome: ult, data: '2026-11-08' }]; const m = seqDe(ws, '2026-11-09'); let g = 0, x = 0; for (const n of [1, 2, 3, 4, 5].map(d => m[d])) { if (n === 'LEGS') g = 0; else x = Math.max(x, ++g); } mx.push(x); }
  ok('nenhum ponto de partida passa de 2 treinos seguidos sem perna', Math.max(...mx) <= 2, JSON.stringify(mx)); }
// treino casado pelo id da rotina (r2 = LEGS depois de PULL A)
s = seqDe([{ rotinaId: 'r2', nome: 'qualquer', data: '2026-11-10' }, { nome: 'PULL A', data: '2026-11-09' }], '2026-11-11');
ok('casa o último treino pelo id', s[3] === 'PUSH B', JSON.stringify(s));
const nomes0 = m => [3,4,5,6].map(k => (R.find(r => r.id === m[k]) || {}).nome).join();
// rotinas TAF (flag taf) NUNCA entram na rotação push/pull/perna
const TAFR = ['TAF Corrida', 'TAF Finalizador PUSH', 'TAF Finalizador PULL', 'TESTE TAF'].map((nome, i) => ({ id: 'taf' + i, nome, taf: true }));
s = out.semanaRot({ rotinas: R.concat(TAFR) }, [{ nome: 'PUSH A', data: '2026-11-10' }], false, '2026-11-11');
ok('com 4 rotinas TAF na lista a rotação continua PULL A, LEGS, PUSH B, bônus', nomes0(s) === 'PULL A,LEGS,PUSH B,UPPER BÔNUS', JSON.stringify(s));
ok('nenhum dia recebe rotina TAF', !Object.values(s).some(v => /^taf/.test(v)));
// sem rotina de perna: segue a lista como veio
s = out.semanaRot({ rotinas: R.filter(r => r.nome !== 'LEGS') }, [], false, '2026-11-09');
ok('sem LEGS cadastrada segue a lista', Object.keys(s).length === 6);
// sem rotinas: nada inventado
ok('sem rotinas não inventa plano', Object.keys(out.semanaRot({ rotinas: [] }, [], false, '2026-11-11')).length === 0);
// o app usa semanaEf (mão do usuário manda) nas telas Semana, Hoje e Perfil
ok('p.semana escolhido à mão continua mandando', /function semanaEf\(p = P\(\)\) \{\s*const s = p\.semana \|\| \{\};\s*if \(Object\.values\(s\)\.some\(Boolean\)\) return s;/.test(src));
ok('telas leem semanaEf (nenhuma leitura solta de p.semana nas telas)', (src.match(/\(p\.semana \|\| \{\}\)\[/g) || []).length === 0);
console.log(total + ' verificações da semana pela rotação, ' + falhas + ' com falha'); process.exit(falhas ? 1 : 0);
