// Verifica interruptor de versão de teste (app-status.json), faixa de teste e licença.
const fs = require('fs'), vm = require('vm');
const raiz = __dirname + '/../';
const html = fs.readFileSync(raiz + 'index.html', 'utf8');
let falhas = 0, total = 0;
const ok = (n, c) => { total++; if (!c) { falhas++; console.error('FALHOU ' + n); } };
const a = html.indexOf('/*ST-INI*/'), b = html.indexOf('/*ST-FIM*/');
ok('marcadores ST', a > 0 && b > a);
const sb = { out: {} }; vm.createContext(sb);
vm.runInContext(html.slice(a, b) + '\nout.d=stDecide;out.a=stAplica;', sb);
const D = sb.out.d, A = sb.out.a;
// documento falso mínimo
function doc() { const els = []; const mk = t => ({ tag: t, style: {}, children: [], setAttribute() {}, appendChild(c) { this.children.push(c); } });
  const d = { body: mk('body'), createElement: mk, getElementById: id => d.body.children.find(c => c.id === id) || null }; return d; }
ok('arquivo ausente/inválido = teste', D(null).modo === 'teste' && D('x').modo === 'teste' && D({}).modo === 'teste');
ok('estado teste = não bloqueia', D({ estado: 'teste' }).modo === 'teste');
let d = D({ estado: 'migrado', mensagem: 'Está na loja', loja: 'https://play.google.com/x' });
ok('migrado bloqueia', d.modo === 'migrado' && d.msg === 'Está na loja' && d.loja.startsWith('https://'));
ok('link não-https é descartado', D({ estado: 'migrado', loja: 'javascript:alert(1)' }).loja === '');
ok('mensagem padrão', D({ estado: 'migrado' }).msg.length > 10);
let dc = doc();
ok('teste não cria tela', A(D({ estado: 'teste' }), dc) === false && dc.body.children.length === 0);
ok('migrado cria tela', A(d, dc) === true && dc.body.children.length === 1);
ok('migrado não duplica', A(d, dc) === false && dc.body.children.length === 1);
ok('tela usa textContent (sem innerHTML)', !/innerHTML/.test(html.slice(a, b)));
// arquivo de status real
const st = JSON.parse(fs.readFileSync(raiz + 'app-status.json', 'utf8'));
ok('app-status.json em teste hoje', st.estado === 'teste');
ok('faixa de teste no topo do body', /<body><div id="faixa-teste"[^>]*>Versão de teste\. Em breve nas lojas Android e iOS\./.test(html));
ok('aviso de copyright', /Todos os direitos reservados/.test(html) && /Todos os direitos reservados/.test(fs.readFileSync(raiz + 'LICENSE', 'utf8')));
ok('LICENSE não é open source', !/MIT|Apache|GPL/.test(fs.readFileSync(raiz + 'LICENSE', 'utf8')));
const sw = fs.readFileSync(raiz + 'sw.js', 'utf8');
ok('sw trata .json rede-primeiro (status nunca fica velho)', /\.json\$/.test(sw) && /jsonRedePrimeiro/.test(sw));
console.log(total + ' verificações de status/licença, ' + falhas + ' falhas');
if (falhas) process.exit(1);
