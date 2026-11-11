// Verificador de acessibilidade e PWA (spec em docs/SPEC.md, entrada 11/11/2026). Uso: node tools/check-ui.js
const fs = require('fs'), path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const html = R('index.html'), sw = R('sw.js'), man = JSON.parse(R('manifest.json'));
let falhas = 0, total = 0;
const ok = (nome, c, det) => { total++; if (!c) { falhas++; console.error('FALHOU ' + nome + (det ? ': ' + det : '')); } };

// 1) idioma
ok('<html lang="pt-BR">', /<html[^>]*\blang="pt-BR"/.test(html));

// 2) piso de fonte 12px em CSS e estilos inline (SVG decorativo do Rael e rótulos de gráfico em unidades do desenho ficam de fora)
const pequenas = [...html.matchAll(/font-size:\s*([0-9.]+)px/g)].filter(m => parseFloat(m[1]) < 12).map(m => m[0]);
ok('nenhuma fonte abaixo de 12px', pequenas.length === 0, pequenas.slice(0, 5).join(' | '));

// 3) campos de formulário com 16px (iPhone não dá zoom ao tocar)
ok('regra input,select,textarea { font-size:16px }', /(^|\n)input,select,textarea\{font-size:16px\}/.test(html));

// 4) foco visível: todo "outline:none" em campo precisa ter substituto
ok('foco visível geral (:focus-visible)', /(^|\n):focus-visible\{outline:2px solid/.test(html));
ok('foco visível em campos', /input:focus-visible,select:focus-visible,textarea:focus-visible\{outline:[^}]+\}/.test(html));
ok('foco visível no campo grande do cadastro', /\.onb-big:focus-visible\{[^}]*(border-bottom-color|box-shadow)/.test(html));

// 5) campos com rótulo: todo <input> numérico/texto precisa de label que o envolve, id com label for, ou aria-label
const semRotulo = [];
const reIn = /<input\b[^>]*>/g; let m;
while ((m = reIn.exec(html))) {
  const tag = m[0]; if (/type="(hidden|checkbox|radio|file|range)"/.test(tag) || /\$\{/.test(tag) && !/type="(number|text|search|date)"/.test(tag)) continue;
  const antes = html.slice(Math.max(0, m.index - 240), m.index);
  const dentroLabel = antes.lastIndexOf('<label') > antes.lastIndexOf('</label>');
  if (/aria-label=|aria-labelledby=/.test(tag) || dentroLabel) continue;
  const id = (tag.match(/\bid="([^"$]+)"/) || [])[1];
  if (id && new RegExp('for="' + id + '"').test(html)) continue;
  if (/placeholder=/.test(tag) && /aria-label/.test(tag)) continue;
  semRotulo.push(tag.slice(0, 80));
}
ok('campos de texto/número com rótulo', semRotulo.length === 0, semRotulo.slice(0, 3).join(' | '));

// 6) contraste dos tokens usados como TEXTO no tema ativo (último :root): 4,5:1
const roots = [...html.matchAll(/:root\{([^}]*)\}/g)]; const tema = {};
roots.forEach(r => [...r[1].matchAll(/--([a-z0-9-]+):(#[0-9A-Fa-f]{6})/g)].forEach(t => { tema[t[1]] = t[2]; }));
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
for (const t of ['ink', 'ink-2', 'muted', 'accent', 'good', 'warn', 'bad']) for (const fundo of ['bg', 'surface']) {
  ok('contraste ' + t + ' sobre ' + fundo + ' >= 4,5', tema[t] && tema[fundo] && cr(tema[t], tema[fundo]) >= 4.5, tema[t] && cr(tema[t], tema[fundo]).toFixed(2));
}
ok('texto sobre botão primário >= 4,5', cr(tema['accent-ink'] || '#ffffff', tema.accent) >= 4.5);

// 7) macros: barra com contorno e rótulo + valor em texto (não depende só de cor)
ok('barras de macro com contorno', /\.bar>i\{box-shadow:inset 0 0 0 1px/.test(html));
ok('macros mostram nome e valor', /\["Proteína", t\.p, m\.p, "--prot"\], \["Carboidrato"/.test(html));

// 8) PWA: manifest completo
ok('manifest: id, scope, lang, descrição', man.id && man.scope && man.lang === 'pt-BR' && man.description);
const tam = (man.icons || []).map(i => i.sizes + ':' + i.purpose);
ok('manifest: ícone 192 e 512 "any"', tam.includes('192x192:any') && tam.includes('512x512:any'));
ok('manifest: ícone "maskable" separado', tam.includes('512x512:maskable'));
(man.icons || []).forEach(i => ok('arquivo do ícone existe: ' + i.src, fs.existsSync(path.join(__dirname, '..', i.src))));
ok('manifest start_url e display', man.start_url && man.display === 'standalone');

// 9) PWA: service worker com cache offline
ok('sw: tem handler fetch', /addEventListener\("fetch"/.test(sw));
ok('sw: usa Cache Storage', /caches\.open\(CACHE\)/.test(sw));
ok('sw: não guarda POST/dados', /req\.method !== "GET"\) return/.test(sw));
ok('sw: teste de versão (?_=) sempre na rede', /searchParams\.has\("_"\)\) return/.test(sw));
ok('sw: limpa caches antigos', /caches\.delete\(k\)/.test(sw));
ok('sw: continua tratando push', /addEventListener\("push"/.test(sw) && /notificationclick/.test(sw));
ok('app registra o sw sempre', /navigator\.serviceWorker\.register\("sw\.js"\)\.catch/.test(html));

// 10) lembretes só com dados do dono (regressão B1): o app manda uid e perfil ao Worker
ok('app manda uid e perfil no /config', /pushPost\("\/config", 0, \{[^}]*uid, perfil/.test(html));

// 11) cadastro (onboarding): visual novo, sem texto cortado e sem desalinho (spec 11/11/2026)
const onb = html.slice(html.indexOf('function onbBody()'), html.indexOf('function onbFoot()'));
ok('cadastro: seta de voltar sempre reserva o espaço (barra não pula)', /<span class="iconbtn" aria-hidden="true"><\/span>/.test(onb));
ok('cadastro: % dentro do topo, sem contador solto', /class="onb-pct"/.test(onb) && !/onb-cnt/.test(onb));
ok('cadastro: barra de progresso com role=progressbar', /role="progressbar"/.test(onb));
ok('cadastro: atividade com nome curto + dica (sem texto cortado)', /ativSel\("oAtv"/.test(onb) && /ativSel\("pfAtv"/.test(html) && /const ativSplit/.test(html));
ok('cadastro: Idade e Altura lado a lado, Sexo em linha própria', /<\/select><\/label><div class="grid2"><label class="f">Idade/.test(onb) && /<label class="f">Altura/.test(onb));
ok('cadastro: peso e meta com "kg" ao lado do número', (onb.match(/class="onb-peso"/g) || []).length === 2);
ok('app: estilo Macio (cartões/botões/campos arredondados, sem chanfro)', /\.card,\.ex-card\{clip-path:none;border-radius:var\(--rad\)/.test(html) && /\.btn\{clip-path:none;border-radius:var\(--rad-m\)\}/.test(html) && /input\[type=text\][^{]*\{border-radius:var\(--rad-m\)/.test(html));
ok('app: bloco Macio vem antes do bloco do cadastro (que pode sobrescrever)', html.indexOf('/*MACIO') > 0 && html.indexOf('/*MACIO') < html.indexOf('/*ONBV'));
ok('cadastro: opção selecionada com marca visível', /\.onb-opt\.on \.ck\{[^}]*border-radius:999px/.test(html));
ok('cadastro: animação do mascote respeita prefers-reduced-motion', /prefers-reduced-motion:reduce\)\{\.onb \.rfala\.big svg\{animation:none\}/.test(html));
{ const aSoft = tema['accent-soft'], ink = tema.ink; ok('cadastro: texto sobre opção selecionada (ink/accent-soft) >= 4,5', cr(ink, aSoft) >= 4.5, cr(ink, aSoft).toFixed(2)); ok('cadastro: tinta sobre dourado do botão (B) >= 4,5', cr(ink, '#F2C14E') >= 4.5, cr(ink, '#F2C14E').toFixed(2)); }

console.log(total + ' verificações de UI/PWA, ' + falhas + ' com falha');
process.exit(falhas ? 1 : 0);
