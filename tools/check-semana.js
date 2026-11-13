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
// v73 (13/11/2026): uma LEGS entre cada push e pull: PUSH A, LEGS, PULL A, LEGS, PUSH B, LEGS, PULL B, LEGS.
// quarta 11/11, último treino feito: PUSH A (terça). Esperado: Qua LEGS, Qui PULL A, Sex LEGS, Sáb UPPER BÔNUS.
let s = nomes(out.semanaRot({ rotinas: R }, [{ nome: 'PUSH A', data: '2026-11-10' }], false, '2026-11-11'));
ok('quarta: LEGS, PULL A, LEGS, bônus no sábado', s[3] === 'LEGS' && s[4] === 'PULL A' && s[5] === 'LEGS' && s[6] === 'UPPER BÔNUS', JSON.stringify(s));
ok('segunda/terça (passado) e domingo ficam sem rotina', !s[1] && !s[2] && !s[0], JSON.stringify(s));
// depois de PUSH A, LEGS: próxima PULL A (a LEGS é achada pelo treino anterior que não foi perna)
s = nomes(out.semanaRot({ rotinas: R }, [{ nome: 'LEGS', data: '2026-11-11' }, { nome: 'PUSH A', data: '2026-11-10' }], true, '2026-11-11'));
ok('hoje LEGS feita depois de PUSH A: quinta PULL A, sexta LEGS', !s[3] && s[4] === 'PULL A' && s[5] === 'LEGS', JSON.stringify(s));
// LEGS depois de PULL A (ordem antiga ainda no histórico): segue PUSH B
s = nomes(out.semanaRot({ rotinas: R }, [{ nome: 'LEGS', data: '2026-11-11' }, { nome: 'PULL A', data: '2026-11-10' }], true, '2026-11-11'));
ok('LEGS depois de PULL A: quinta PUSH B', s[4] === 'PUSH B' && s[5] === 'LEGS', JSON.stringify(s));
// a sequência dá a volta (depois de PULL B, LEGS volta para PUSH A)
s = nomes(out.semanaRot({ rotinas: R }, [{ nome: 'LEGS', data: '2026-11-10' }, { nome: 'PULL B', data: '2026-11-09' }], true, '2026-11-10'));
ok('depois de PULL B + LEGS volta para PUSH A', s[3] === 'PUSH A' && s[4] === 'LEGS', JSON.stringify(s));
// sem treino nenhum: começa na primeira rotina
s = nomes(out.semanaRot({ rotinas: R }, [], false, '2026-11-09'));
ok('sem histórico começa em PUSH A, LEGS, PULL A, LEGS, PUSH B', s[1] === 'PUSH A' && s[2] === 'LEGS' && s[3] === 'PULL A' && s[4] === 'LEGS' && s[5] === 'PUSH B', JSON.stringify(s));
// semana que vem (seg 16/11) a partir de PUSH A em 10/11 e hoje 13/11 sexta com nada feito: nunca 2 treinos seguidos sem perna
{ const seqs = []; for (const ult of ['PUSH A', 'PULL A', 'PUSH B', 'PULL B', 'LEGS']) { const ws = ult === 'LEGS' ? [{ nome: 'LEGS', data: '2026-11-08' }, { nome: 'PUSH A', data: '2026-11-07' }] : [{ nome: ult, data: '2026-11-08' }]; const m = nomes(out.semanaRot({ rotinas: R }, ws, false, '2026-11-09')); const dias = [1, 2, 3, 4, 5].map(d => m[d]); let g = 0, mx = 0; for (const n of dias) { if (n === 'LEGS') g = 0; else mx = Math.max(mx, ++g); } seqs.push(mx); }
  ok('em nenhum ponto de partida há 2 treinos seguidos sem perna', Math.max(...seqs) <= 1, JSON.stringify(seqs)); }
// treino casado pelo id da rotina (r2 = LEGS depois de PUSH A)
s = nomes(out.semanaRot({ rotinas: R }, [{ rotinaId: 'r2', nome: 'qualquer', data: '2026-11-10' }, { nome: 'PUSH A', data: '2026-11-09' }], false, '2026-11-11'));
ok('casa o último treino pelo id', s[3] === 'PULL A', JSON.stringify(s));
// sem rotina de perna: segue a lista como veio
s = out.semanaRot({ rotinas: R.filter(r => r.nome !== 'LEGS') }, [], false, '2026-11-09');
ok('sem LEGS cadastrada segue a lista', Object.keys(s).length === 6);
// sem rotinas: nada inventado
ok('sem rotinas não inventa plano', Object.keys(out.semanaRot({ rotinas: [] }, [], false, '2026-11-11')).length === 0);
// o app usa semanaEf (mão do usuário manda) nas telas Semana, Hoje e Perfil
ok('p.semana escolhido à mão continua mandando', /function semanaEf\(p = P\(\)\) \{\s*const s = p\.semana \|\| \{\};\s*if \(Object\.values\(s\)\.some\(Boolean\)\) return s;/.test(src));
ok('telas leem semanaEf (nenhuma leitura solta de p.semana nas telas)', (src.match(/\(p\.semana \|\| \{\}\)\[/g) || []).length === 0);
console.log(total + ' verificações da semana pela rotação, ' + falhas + ' com falha'); process.exit(falhas ? 1 : 0);
