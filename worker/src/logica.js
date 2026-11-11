// Regras puras dos avisos do Rael (sem Cloudflare): horários, quando pular, textos.
// Testável com `node --test worker/test`.
export const MAX_DIA = 4;        // no máximo 4 lembretes por dia (descanso, novidade e teste não contam)
export const JANELA_MIN = 90;    // se o horário passou há mais que isso, o lembrete de hoje é descartado
export const CEDO = 7 * 60, TARDE = 22 * 60 + 30; // nunca avisa fora de 07:00–22:30 (horário do aparelho)

export const PADRAO = {
  manha: { on: true, h: "08:00" }, treino: { on: true, h: "17:30" }, sequencia: { on: true, h: "20:30" },
  almoco: { on: false, h: "12:30" }, agua: { on: false, h: "15:30" }, noite: { on: false, h: "21:00" }, semana: { on: false, h: "19:00" }
};
export const TIPOS = Object.keys(PADRAO);

export function hm(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "")); if (!m) return null;
  const h = +m[1], mi = +m[2]; return h > 23 || mi > 59 ? null : h * 60 + mi;
}
export const hmTxt = min => String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0");

/** Aceita só tipos conhecidos, horário válido dentro da janela permitida. */
export function limpaCfg(cfg) {
  const out = {};
  for (const t of TIPOS) {
    const c = cfg && cfg[t] || {}, base = PADRAO[t];
    let min = hm(c.h); if (min == null) min = hm(base.h);
    min = Math.min(TARDE, Math.max(CEDO, min));
    out[t] = { on: typeof c.on === "boolean" ? c.on : base.on, h: hmTxt(min) };
  }
  return out;
}
export function limpaEstado(e) {
  if (!e || typeof e !== "object") return null;
  const n = (v, d = 0) => Number.isFinite(+v) ? +v : d;
  return {
    dia: typeof e.dia === "string" ? e.dia.slice(0, 10) : "", refs: n(e.refs), almoco: !!e.almoco, agua: n(e.agua, 1),
    treinou: !!e.treinou, mexeu: !!e.mexeu, seq: n(e.seq), temPlano: !!e.temPlano,
    plano: Array.isArray(e.plano) ? e.plano.slice(0, 7).map(x => typeof x === "string" ? x.slice(0, 30) : null) : [],
    resumo: typeof e.resumo === "string" ? e.resumo.replace(/[\u0000-\u001f<>]/g, " ").slice(0, 140) : ""
  };
}

/** Data e minuto locais a partir do instante UTC e do getTimezoneOffset() do aparelho (minutos). */
export function local(ms, tz) {
  const d = new Date(ms - tz * 60000);
  return { dia: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes(), dow: d.getUTCDay() };
}
function utcDe(dia, deslocDias, min, tz) {
  const [y, m, d] = dia.split("-").map(Number);
  return Date.UTC(y, m - 1, d + deslocDias) + min * 60000 + tz * 60000;
}

/** Próximo instante (ms UTC) em que o lembrete `tipo` deve ser avaliado. */
export function proximo(agora, tz, tipo, h, enviadoDia) {
  const alvo = hm(h), L = local(agora, tz);
  for (let off = 0; off <= 7; off++) {
    if (tipo === "semana" && (L.dow + off) % 7 !== 0) continue;
    if (off === 0 && (enviadoDia === L.dia || L.min >= alvo + JANELA_MIN)) continue;
    return utcDe(L.dia, off, alvo, tz);
  }
  return Infinity;
}

/** Devolve o motivo de NÃO enviar (string) ou null para enviar. */
export function motivoPular(tipo, e, hoje, ontem, dow) {
  if (tipo === "semana" && dow !== 0) return "nao-e-domingo";
  const deHoje = !!e && e.dia === hoje;
  if (tipo === "manha") return deHoje ? "ja-abriu-hoje" : null;
  if (tipo === "treino") {
    if (e && e.temPlano && e.plano[dow] == null) return "folga";
    if (deHoje && (e.treinou || e.mexeu)) return "ja-treinou";
    return null;
  }
  if (tipo === "sequencia") {
    if (!e || (e.dia !== hoje && e.dia !== ontem) || e.seq < 3) return "sem-sequencia";
    if (!deHoje) return "sem-dados-de-hoje"; // resumo velho (ontem): não dá para afirmar que hoje está vazio
    if (e.refs > 0 || e.registrouNuvem) return "ja-registrou";
    return null;
  }
  if (!deHoje) return null;
  if (tipo === "almoco") return e.almoco ? "almoco-feito" : null;
  if (tipo === "agua") return e.agua >= 0.6 ? "agua-ok" : null;
  if (tipo === "noite") return e.refs >= 3 ? "dia-completo" : null;
  return null;
}

// Voz do Rael: sarcasmo contra o sofá e contra ele mesmo; sem corpo/peso/vergonha; neutro de gênero com a pessoa.
export const FRASES = {
  manha: ["Bom dia. O dia ainda está limpinho e o sofá ainda está dormindo. Dá para aproveitar.",
    "Amanhecemos. Eu abri o olho primeiro e já estou cansado de ser o responsável.",
    "Bom dia! Café, água e um registro rápido. Nessa ordem ou em outra, eu só fiscalizo.",
    "Dia novo, calendário em branco. O Rael sugere começar pela água.",
    "Acordou? Eu também, mas só porque a crista pesa.",
    "Bom dia. O plano de hoje é simples: comer bem e fingir que o sofá não existe."],
  almoco: ["Meio-dia e pouco e o almoço ainda não foi registrado. O Rael não julga, só anota.",
    "Almoçou? Se sim, registra. Se não, o estômago já registrou uma reclamação.",
    "Prato feito, prato registrado. Leva uns 20 segundos, eu cronometrei.",
    "O almoço some da memória mais rápido que do prato. Anota antes de esquecer.",
    "Passando para lembrar do almoço. Pode comer em paz, eu espero."],
  agua: ["Um copo d'água? Meu bico está seco e eu nem bebo. Imagina você.",
    "Alerta de hidratação: a garrafa está te olhando daí.",
    "Quando foi o último gole? Se a resposta foi \"não lembro\", é agora.",
    "Água não tem caloria, mas rende pontos. Um golinho já ajuda.",
    "O Rael lembra: beber água é a única tarefa que dá para fazer sentado no sofá."],
  treino: ["O treino de hoje está esperando. O sofá também, mas ele tem menos currículo.",
    "Fim de tarde e o treino está no plano. Bora começar, nem que seja pelo aquecimento.",
    "Treino de hoje: você aparece, o Rael finge que ajuda. Combinado?",
    "Meia horinha já vale. O resto a gente negocia no meio do treino.",
    "Se for treinar, é agora. O Rael estará aqui, olhando de longe com muito respeito."],
  treinoNome: ["Hoje tem {t} no plano. O sofá já foi avisado de que perdeu a disputa.",
    "{t} no cardápio de hoje. Bora, antes que o dia invente compromisso.",
    "O plano de hoje é {t}. O Rael aprova e delega a execução para você."],
  sequencia: ["Sua sequência de {n} dias está pendurada por um fio. Um registro rápido salva tudo.",
    "{n} dias seguidos e hoje ainda sem registro. Não deixa o calendário vencer.",
    "Faltam poucas horas para a sequência de {n} dias acabar. Anota qualquer coisa que você comeu.",
    "O Rael não quer ser dramático, mas {n} dias de sequência merecem um registro hoje."],
  noite: ["Fim de dia. Dá uma olhada no que ficou sem registro, que eu fecho a nota.",
    "Hoje já deu. Registra o que faltou e o Rael encerra o expediente.",
    "Antes de dormir: três toques e o dia fica fechado. Depois eu deixo em paz.",
    "O dia está acabando e a nota ainda está aberta. Bora fechar?"],
  semana: ["Domingo à noite é bom para olhar a semana: o que funcionou e o que o sofá levou.",
    "Fim de semana quase no fim. Dá uma olhada na Evolução, o Rael deixou tudo organizado.",
    "Domingo: bom dia para planejar a semana e fingir que a segunda não existe."]
};
export const TITULOS = {
  manha: "Bom dia do Rael", almoco: "Hora do almoço", agua: "Água", treino: "Hora do treino",
  sequencia: "Sequência em risco", noite: "Fechar o dia", semana: "Semana do Rael", novidade: "Novidade no Frangômetro"
};

const diaMais = (dia, n) => new Date(Date.UTC(+dia.slice(0, 4), +dia.slice(5, 7) - 1, +dia.slice(8, 10) + n)).toISOString().slice(0, 10);

/** Monta a notificação. `rnd` é uma função 0..1; `ult` é o último índice usado (para não repetir). */
export function monta(tipo, e, dow, rnd = Math.random, ult = -1, hoje = "") {
  const nomeHoje = e && e.plano && e.plano[dow];
  if (tipo === "semana" && e && e.resumo && (!hoje || e.dia >= diaMais(hoje, -1))) return { tipo, titulo: TITULOS.semana, corpo: "Sua semana: " + e.resumo, tag: "rael-semana", idx: -1 };
  let banco = FRASES[tipo] || [];
  if (tipo === "treino" && nomeHoje && rnd() < 0.5) banco = FRASES.treinoNome;
  if (!banco.length) return null;
  let i = Math.floor(rnd() * banco.length); if (banco.length > 1 && i === ult) i = (i + 1) % banco.length;
  const corpo = banco[i].replace("{t}", nomeHoje || "").replace("{n}", String(e && e.seq || ""));
  return { tipo, titulo: TITULOS[tipo], corpo, tag: "rael-" + tipo, idx: banco === FRASES.treinoNome ? -1 : i };
}

/** Resume o que a nuvem (Supabase) já tem de HOJE. `rows` = linhas da tabela docs: [{k, data}]. */
export function resumoNuvem(rows, hoje) {
  // vale qualquer perfil do dono (o celular usa um perfil extra, o Painel sincroniza em outro): pega o maior de cada medida
  const tr = (rows || []).some(r => r.k === "treino-pn" + hoje.replace(/-/g, "") && !r.del);
  let itens = 0, slots = 0, aguaMl = 0;
  for (const d of (rows || []).filter(r => r.k === "dia-" + hoje && !r.del)) {
    const dia = d.data || {}, ref = Object.values(dia.ref || {});
    itens = Math.max(itens, ref.flat().filter(i => i && i.base && +i.base.kcal > 0).length);
    slots = Math.max(slots, ref.filter(v => Array.isArray(v) && v.some(i => i && i.base && +i.base.kcal > 0)).length);
    aguaMl = Math.max(aguaMl, +dia.agua || 0);
  }
  return { refs: slots, itens, aguaMl, treinou: tr };
}
/** Atualiza o resumo vindo do aparelho com o que a nuvem sabe de hoje (só acrescenta, nunca apaga registro). */
export function aplicaNuvem(e, hoje, rows) {
  const r = resumoNuvem(rows, hoje), base = e || { dia: "", refs: 0, almoco: false, agua: 1, treinou: false, mexeu: false, seq: 0, temPlano: false, plano: [] };
  const deHoje = base.dia === hoje, alg = r.itens > 0 || r.aguaMl > 0 || r.treinou;
  return Object.assign({}, base, {
    dia: hoje, refs: Math.max(deHoje ? base.refs : 0, r.refs), treinou: (deHoje && base.treinou) || r.treinou,
    mexeu: deHoje && base.mexeu, almoco: deHoje && base.almoco,
    agua: deHoje ? base.agua : 0, registrouNuvem: alg
  });
}
