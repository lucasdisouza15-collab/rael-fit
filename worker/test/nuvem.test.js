import test from "node:test"; import assert from "node:assert/strict";
import { nuvemHoje } from "../src/index.js";
const env = { SUPABASE_EMAIL: "dono@x", SUPABASE_PASSWORD: "s" };
function mock(userId) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    if (String(url).includes("/auth/v1/token")) return new Response(JSON.stringify({ access_token: "t", user: { id: userId } }), { status: 200 });
    return new Response(JSON.stringify([{ k: "dia-2026-11-11", data: {}, del: false }]), { status: 200 });
  };
  return calls;
}
test("aparelho de OUTRA pessoa não recebe os dados do dono (regressão B1)", async () => {
  const calls = mock("uid-dono");
  assert.equal(await nuvemHoje(env, "2026-11-11", "uid-convidado", "main"), null);
  assert.ok(!calls.some(u => u.includes("/rest/v1/docs")), "não pode nem consultar a tabela");
});
test("aparelho sem login na nuvem não usa a nuvem", async () => {
  const calls = mock("uid-dono");
  assert.equal(await nuvemHoje(env, "2026-11-11", "", "main"), null);
  assert.equal(calls.length, 0);
});
test("aparelho do dono usa a nuvem e filtra pelo perfil", async () => {
  const calls = mock("uid-dono");
  const r = await nuvemHoje(env, "2026-11-11", "uid-dono", "yago");
  assert.equal(r.length, 1);
  assert.ok(calls.find(u => u.includes("/rest/v1/docs")).includes("perfil=eq.yago"));
});
