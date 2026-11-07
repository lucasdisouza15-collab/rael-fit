# Frangômetro — especificação (Spec Driven)
Regra: nenhuma mudança grande sem entrada aqui antes do código. Uma entrada = problema, comportamento esperado, dados afetados, critério de aceite.

## Fluxo de trabalho (AI Driven Development)
1. Spec: escrever a entrada abaixo (o que muda, onde, risco).
2. Código: implementar só o que a spec diz.
3. Loop: rodar `node tools/check.js`; se falhar, corrigir e rodar de novo até passar.
4. Paridade: aplicar o mesmo na aba Frangômetro do Painel (regra do Lucas).
5. Registrar no cérebro e abrir PR.

## Papéis (skills) separados
- Dados/regras (kcal, macros, medidor Pintinho/Frango/Galo Alfa, sync Supabase).
- Interface (mascote, textos inclusivos, abas).
- Treino (rotinas, descanso, push).
Cada papel mexe só na sua camada.

## Entradas
(vazio — adicionar aqui antes de cada recurso novo)

## Regras do método
- Antes de abrir PR: `node tools/check.js` (sintaxe dos scripts + testes das contas de kcal/macros e da nota Pintinho/Frango/Galo Alfa). Se mudar uma regra de conta, ajustar o teste na mesma entrega.
- Paridade: tudo que entra no site (index.html) vai também para a aba Frangômetro do Painel, exceto o que for exclusivo de um dos dois.
