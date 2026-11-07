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
process.exit(bad ? 1 : 0);
