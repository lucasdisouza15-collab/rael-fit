import test from "node:test"; import assert from "node:assert/strict";
import { resumoNuvem, aplicaNuvem, limpaCfg, local, proximo, motivoPular, monta, FRASES, hm, limpaEstado } from "../src/logica.js";
const TZ = 180; // Bahia: getTimezoneOffset() = +180
const ms = (d, h, m = 0) => Date.UTC(2026, 10, d, h, m); // novembro/2026; dia 4 = quarta
test("local converte com o offset do aparelho", () => {
  const L = local(ms(4, 12), TZ); assert.deepEqual([L.dia, L.min, L.dow], ["2026-11-04", 540, 3]);
  assert.equal(local(ms(5, 1), TZ).dia, "2026-11-04"); // 22:00 na Bahia ainda é dia 4
});
test("proximo: horário futuro de hoje", () => assert.equal(proximo(ms(4, 12), TZ, "treino", "17:30"), ms(4, 20, 30)));
test("proximo: passou há menos de 90 min ainda vale hoje (instante no passado)", () => assert.equal(proximo(ms(4, 12), TZ, "manha", "08:00"), ms(4, 11)));
test("proximo: passou há mais de 90 min vai para amanhã", () => assert.equal(proximo(ms(4, 15), TZ, "manha", "08:00"), ms(5, 11)));
test("proximo: já enviado hoje vai para amanhã", () => assert.equal(proximo(ms(4, 12), TZ, "treino", "17:30", "2026-11-04"), ms(5, 20, 30)));
test("proximo: semana só no domingo (08/11)", () => assert.equal(proximo(ms(4, 12), TZ, "semana", "19:00"), ms(8, 22)));
test("proximo: fuso diferente (UTC+0 -> tz 0)", () => assert.equal(proximo(ms(4, 12), 0, "treino", "17:30"), ms(4, 17, 30)));
test("limpaCfg: horário inválido volta ao padrão e fora da janela é limitado", () => {
  const c = limpaCfg({ manha: { h: "xx" }, treino: { on: false, h: "03:00" }, agua: { on: true, h: "23:50" }, lixo: 1 });
  assert.equal(c.manha.h, "08:00"); assert.equal(c.treino.h, "07:00"); assert.equal(c.treino.on, false); assert.equal(c.agua.h, "22:30"); assert.equal(c.lixo, undefined);
});
const e = (o = {}) => ({ dia: "2026-11-04", refs: 0, almoco: false, agua: 0, treinou: false, mexeu: false, seq: 0, temPlano: true, plano: [null, "PUSH", null, "PULL", null, "LEGS", null], ...o });
test("manhã: pula se já abriu o app hoje", () => { assert.equal(motivoPular("manha", e(), "2026-11-04", "2026-11-03", 3), "ja-abriu-hoje"); assert.equal(motivoPular("manha", e({ dia: "2026-11-03" }), "2026-11-04", "2026-11-03", 3), null); });
test("treino: pula folga, já treinou ou mexeu; envia no dia de treino", () => {
  assert.equal(motivoPular("treino", e(), "2026-11-04", "2026-11-03", 2), "folga");
  assert.equal(motivoPular("treino", e({ treinou: true }), "2026-11-04", "2026-11-03", 3), "ja-treinou");
  assert.equal(motivoPular("treino", e({ mexeu: true }), "2026-11-04", "2026-11-03", 3), "ja-treinou");
  assert.equal(motivoPular("treino", e(), "2026-11-04", "2026-11-03", 3), null);
  assert.equal(motivoPular("treino", null, "2026-11-04", "2026-11-03", 3), null);
});
test("sequência: só com 3+ dias e sem registro hoje", () => {
  assert.equal(motivoPular("sequencia", e({ seq: 2 }), "2026-11-04", "2026-11-03", 3), "sem-sequencia");
  assert.equal(motivoPular("sequencia", e({ seq: 5, refs: 1 }), "2026-11-04", "2026-11-03", 3), "ja-registrou");
  assert.equal(motivoPular("sequencia", e({ seq: 5 }), "2026-11-04", "2026-11-03", 3), null);
  assert.equal(motivoPular("sequencia", e({ seq: 5, dia: "2026-11-01" }), "2026-11-04", "2026-11-03", 3), "sem-sequencia");
  assert.equal(motivoPular("sequencia", e({ seq: 5, dia: "2026-11-03" }), "2026-11-04", "2026-11-03", 3), "sem-dados-de-hoje");
});
test("almoço, água, noite, semana", () => {
  assert.equal(motivoPular("almoco", e({ almoco: true }), "2026-11-04", "2026-11-03", 3), "almoco-feito");
  assert.equal(motivoPular("agua", e({ agua: 0.7 }), "2026-11-04", "2026-11-03", 3), "agua-ok");
  assert.equal(motivoPular("agua", e({ agua: 0.2 }), "2026-11-04", "2026-11-03", 3), null);
  assert.equal(motivoPular("noite", e({ refs: 3 }), "2026-11-04", "2026-11-03", 3), "dia-completo");
  assert.equal(motivoPular("semana", e(), "2026-11-04", "2026-11-03", 3), "nao-e-domingo");
  assert.equal(motivoPular("semana", e(), "2026-11-08", "2026-11-07", 0), null);
});
test("monta: troca {n} e {t}, não repete o último e nunca cita nome", () => {
  const m = monta("sequencia", e({ seq: 7 }), 3, () => 0.1, -1); assert.ok(m.corpo.includes("7") && !m.corpo.includes("{"));
  const a = monta("manha", e(), 3, () => 0, 0); assert.notEqual(a.idx, 0);
  const t = monta("treino", e(), 3, () => 0.1, -1); assert.ok(t.corpo.includes("PULL") && !t.corpo.includes("{"));
});
test("tom: nenhuma frase tem termos vetados nem gênero fixo", () => {
  const todas = Object.values(FRASES).flat().join(" ").toLowerCase();
  for (const x of ["shape", "guerra", "vergonha", "monstro", "capa de revista", "pronto ", "cansado de você", "gordo", "lucas", "vai doer", "ferro"]) assert.ok(!todas.includes(x), x);
});

const it = k => ({ base: { kcal: k } });
test("nuvem: Painel gravou refeição/água/treino hoje -> sequência não dispara", () => {
  const velho = e({ seq: 4, dia: "2026-11-03", refs: 3 }); // resumo de ontem, aparelho não abriu hoje
  assert.equal(motivoPular("sequencia", velho, "2026-11-04", "2026-11-03", 3), "sem-dados-de-hoje");
  for (const rows of [
    [{ k: "dia-2026-11-04", data: { ref: { cafe: [it(300)] } } }],
    [{ k: "dia-2026-11-04", data: { agua: 1250, ref: {} } }],
    [{ k: "treino-pn20261104", data: {} }]]) {
    const n = aplicaNuvem(velho, "2026-11-04", rows);
    assert.equal(motivoPular("sequencia", n, "2026-11-04", "2026-11-03", 3), "ja-registrou");
    assert.equal(n.seq, 4);
  }
});
test("nuvem: dia realmente vazio na nuvem -> sequência dispara", () => {
  const n = aplicaNuvem(e({ seq: 4, dia: "2026-11-03", refs: 3 }), "2026-11-04", [{ k: "dia-2026-11-03", data: { ref: { cafe: [it(300)] } } }]);
  assert.equal(motivoPular("sequencia", n, "2026-11-04", "2026-11-03", 3), null);
  assert.deepEqual(resumoNuvem([], "2026-11-04"), { refs: 0, itens: 0, aguaMl: 0, treinou: false });
});
test("nuvem: treino de hoje na nuvem evita lembrete de treino", () => {
  const n = aplicaNuvem(e({ dia: "2026-11-03" }), "2026-11-04", [{ k: "treino-pn20261104", data: {} }]);
  assert.equal(motivoPular("treino", n, "2026-11-04", "2026-11-03", 3), "ja-treinou");
});

test("resumo semanal: o texto vem do app e é limpo", () => {
  const e = limpaEstado({ dia: "2026-11-08", resumo: "5 de 7 dias <b>registrados</b>\n3 treinos" });
  assert.ok(!/[<>\n]/.test(e.resumo));
  const m = monta("semana", e, 0, () => 0.1, -1, "2026-11-08"); assert.ok(m.corpo.startsWith("Sua semana: 5 de 7"));
});
test("resumo semanal: resumo velho (app não aberto há dias) cai na frase genérica", () => {
  const e = limpaEstado({ dia: "2026-11-01", resumo: "5 de 7 dias" });
  const m = monta("semana", e, 0, () => 0.1, -1, "2026-11-08"); assert.ok(!m.corpo.startsWith("Sua semana:"));
});
