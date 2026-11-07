// Loop de verificação: extrai os <script> inline do index.html e checa a sintaxe.
// Uso: node tools/check.js  (saída 0 = ok; erro volta para a IA corrigir em loop)
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m, n = 0, bad = 0;
while ((m = re.exec(html))) {
  n++;
  try { new vm.Script(m[1], { filename: 'index.html#script' + n }); }
  catch (e) { bad++; console.error('ERRO script ' + n + ': ' + e.message); }
}
console.log(n + ' scripts checados, ' + bad + ' com erro');

// ---- Testes das contas (kcal/macros e nota do Pintinho/Frango/Galo Alfa) ----
// Extrai as funções reais do index.html e roda num sandbox, então o teste acompanha o app.
const scripts = []; re.lastIndex = 0;
while ((m = re.exec(html))) scripts.push(m[1]);
const src = scripts.join('\n');
function pega(nome) {
  let i = src.search(new RegExp('^function ' + nome + '\\(', 'm'));
  if (i >= 0) { let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
  i = src.search(new RegExp('^const ' + nome + '\\b', 'm'));
  if (i < 0) throw new Error('não achei ' + nome);
  let d = 0, k = i;
  for (; k < src.length; k++) { const c = src[k]; if ('{[('.includes(c)) d++; else if ('}])'.includes(c)) d--; else if (c === ';' && d === 0) break; }
  return src.slice(i, k + 1);
}
const nomes = ['r0','num','clamp','factor','entryT','sumT','tmb','gastoBase','pesoAtual','metasCalc','FR_NOTA','frNotaCalc'];
const sb = { P: () => sb.perfil, allDays: () => [], getDoc: () => null, perfil: null, out: {} };
vm.createContext(sb);
vm.runInContext(nomes.map(pega).join('\n') + '\nout.f={factor,entryT,sumT,tmb,metasCalc,frNotaCalc};', sb);
const F = sb.out.f;
let falhas = 0, total = 0;
const eq = (nome, a, b, tol = 0.01) => { total++; if (!(Math.abs(a - b) <= tol)) { falhas++; console.error('FALHOU ' + nome + ': obteve ' + a + ', esperado ' + b); } };
const ok = (nome, c) => { total++; if (!c) { falhas++; console.error('FALHOU ' + nome); } };

// porção por gramas, por unidade e por porção
let t = F.entryT({ modo: 'g', qtd: 150, base: { kcal: 128, p: 2.5, c: 28, g: 0.2, f: 1.6 } });
eq('150 g kcal', t.kcal, 192); eq('150 g prot', t.p, 3.75); eq('150 g carb', t.c, 42);
t = F.entryT({ modo: 'un', qtd: 2, unG: 50, base: { kcal: 100, p: 10, c: 0, g: 5, f: 0 } });
eq('2 un de 50 g kcal', t.kcal, 100); eq('2 un prot', t.p, 10);
t = F.entryT({ modo: 'porcao', qtd: 1.5, base: { kcal: 200, p: 20, c: 10, g: 8, f: 1 } });
eq('1,5 porção kcal', t.kcal, 300);
t = F.sumT([{ kcal: 100, p: 1 }, { kcal: 50, p: 2, c: 3 }]);
eq('soma kcal', t.kcal, 150); eq('soma prot', t.p, 3); eq('soma carb', t.c, 3);

// metas: homem 80 kg, 180 cm, 30 anos, atividade 1,55, perder com ajuste 500
sb.perfil = { sexo: 'M', altura: 180, idade: 30, peso: 80, atividade: 1.55, objetivo: 'perder', ajuste: 500 };
eq('TMB', F.tmb(sb.perfil, 80), 1780, 0.5);
let mt = F.metasCalc(sb.perfil);
eq('meta kcal perder', mt.kcal, 2259); eq('meta prot (2 g/kg)', mt.p, 160); eq('meta gord (0,8 g/kg)', mt.g, 64);
eq('macros fecham kcal', mt.p * 4 + mt.c * 4 + mt.g * 9, mt.kcal, 8);
eq('água 35 ml/kg', mt.agua, 2800);
sb.perfil = { sexo: 'F', altura: 150, idade: 60, peso: 45, atividade: 1.2, objetivo: 'perder', ajuste: 800 };
mt = F.metasCalc(sb.perfil);
eq('piso feminino 1200', mt.kcal, 1200); ok('aviso baixo', mt.baixo === true);

// nota do dia: Pintinho < 40, Frango 40-79, Galo Alfa >= 80
const base = { kcal: 2000, meta: 2000, p: 150, mp: 150, agua: 2800, ma: 2800, refeicoes: 3, exp: 1, treino: { feito: true, tipos: 1 } };
let nt = F.frNotaCalc(base);
eq('dia perfeito = 100', nt.score, 100); ok('perfeito é Galo Alfa', nt.nv.n === 'Galo Alfa');
nt = F.frNotaCalc({ ...base, kcal: 0, p: 0, agua: 0, refeicoes: 0, treino: { feito: false, folga: false, tipos: 0 } });
eq('dia vazio = 0', nt.score, 0); ok('vazio é Pintinho', nt.nv.n === 'Pintinho');
nt = F.frNotaCalc({ ...base, treino: { feito: false, folga: false, tipos: 0 } });
eq('sem treino = 75', nt.score, 75); ok('sem treino é Frango', nt.nv.n === 'Frango');
nt = F.frNotaCalc({ ...base, kcal: 2250 }); // 12,5% acima da meta
ok('estourou 10% nunca é Galo', nt.nv.n !== 'Galo Alfa');
nt = F.frNotaCalc({ ...base, treino: { feito: true, tipos: 2 } });
eq('bônus 2 tipos não passa de 100', nt.score, 100);
nt = F.frNotaCalc({ ...base, kcal: 1000, p: 75, agua: 1400, refeicoes: 1, treino: { feito: false, folga: false, tipos: 0 } });
ok('metade do dia é Pintinho (< 40)', nt.score < 40 && nt.nv.n === 'Pintinho');

console.log((total - falhas) + '/' + total + ' testes das contas passaram');
// ---- Auditoria dos quadros de animação (chão, altura e cabeça iguais entre os quadros) ----
const cp = require('child_process');
const fr = cp.spawnSync('python3', [__dirname + '/frames.py', 'check'], { encoding: 'utf8' });
if (fr.error || /No module named/.test(fr.stderr || '')) console.warn('AVISO: auditoria de quadros não rodou (precisa de python3 + Pillow + scipy)');
else { process.stdout.write(fr.stdout); if (fr.status !== 0) { console.error('FALHOU auditoria dos quadros de animação'); falhas++; } }
process.exit(falhas || bad ? 1 : 0);
