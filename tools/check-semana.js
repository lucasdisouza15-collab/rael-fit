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
// quarta 11/11, último treino feito: PUSH A (terça). Esperado como no Painel: Qua PULL A, Qui LEGS, Sex PUSH B, Sáb UPPER BÔNUS.
let s = nomes(out.semanaRot({ rotinas: R }, [{ nome: 'PUSH A', data: '2026-11-10' }], false, '2026-11-11'));
ok('quarta: PULL A, LEGS, PUSH B, bônus no sábado', s[3] === 'PULL A' && s[4] === 'LEGS' && s[5] === 'PUSH B' && s[6] === 'UPPER BÔNUS', JSON.stringify(s));
ok('segunda/terça (passado) e domingo ficam sem rotina', !s[1] && !s[2] && !s[0], JSON.stringify(s));
// treino de hoje já feito (PULL A): hoje não recebe outro; amanhã LEGS
s = nomes(out.semanaRot({ rotinas: R }, [{ nome: 'PULL A', data: '2026-11-11' }, { nome: 'PUSH A', data: '2026-11-10' }], true, '2026-11-11'));
ok('hoje feito: quinta LEGS, sexta PUSH B', !s[3] && s[4] === 'LEGS' && s[5] === 'PUSH B', JSON.stringify(s));
// a sequência dá a volta (depois de PULL B vem PUSH A)
s = nomes(out.semanaRot({ rotinas: R }, [{ nome: 'PULL B', data: '2026-11-09' }], false, '2026-11-10'));
ok('depois de PULL B volta para PUSH A', s[2] === 'PUSH A' && s[3] === 'PULL A', JSON.stringify(s));
// sem treino nenhum: começa na primeira rotina
s = nomes(out.semanaRot({ rotinas: R }, [], false, '2026-11-09'));
ok('sem histórico começa em PUSH A', s[1] === 'PUSH A' && s[5] === 'PULL B', JSON.stringify(s));
// treino casado pelo id da rotina
s = nomes(out.semanaRot({ rotinas: R }, [{ rotinaId: 'r2', nome: 'qualquer', data: '2026-11-10' }], false, '2026-11-11'));
ok('casa o último treino pelo id', s[3] === 'PUSH B', JSON.stringify(s));
// sem rotinas: nada inventado
ok('sem rotinas não inventa plano', Object.keys(out.semanaRot({ rotinas: [] }, [], false, '2026-11-11')).length === 0);
// o app usa semanaEf (mão do usuário manda) nas telas Semana, Hoje e Perfil
ok('p.semana escolhido à mão continua mandando', /function semanaEf\(p = P\(\)\) \{\s*const s = p\.semana \|\| \{\};\s*if \(Object\.values\(s\)\.some\(Boolean\)\) return s;/.test(src));
ok('telas leem semanaEf (nenhuma leitura solta de p.semana nas telas)', (src.match(/\(p\.semana \|\| \{\}\)\[/g) || []).length === 0);
console.log(total + ' verificações da semana pela rotação, ' + falhas + ' com falha'); process.exit(falhas ? 1 : 0);
