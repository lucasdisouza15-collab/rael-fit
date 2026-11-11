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
### Acessibilidade, offline e lembretes do dono (11/11/2026)
- Problema: (1) campos em 15px fazem o iPhone dar zoom; fontes de 10 a 11,5px; foco quase invisível em campos; tokens good/warn/bad abaixo de 4,5:1 como texto; buscas sem rótulo; barras de macro sem contorno. (2) O app não abre offline: o sw.js só tratava push e o manifest era mínimo. (3) O Worker consultava a nuvem com o login do dono para QUALQUER aparelho, então o lembrete de outra pessoa era calado/disparado pelos dados do Lucas.
- Comportamento esperado: campos 16px; nenhuma fonte < 12px em CSS/inline (SVG decorativo do Rael fora); foco visível 3px em campos; contraste >= 4,5:1 de ink/ink-2/muted/accent/good/warn/bad sobre bg e surface; todo campo com rótulo; barras de macro com contorno (nome e valor já em texto). PWA: página rede-primeiro com cópia offline (4 s), arquivos fixos em cache, configs .json rede-primeiro, nada de POST/dados/teste de versão em cache; manifest com id, scope, lang, ícones 192/512/maskable. Worker: só usa a nuvem se o aparelho mandar o uid do MESMO usuário do login do Worker e filtra por perfil; senão cai na regra do resumo do aparelho.
- Dados afetados: nenhum dado do usuário muda. O app passa a enviar `uid` e `perfil` no /config.
- Aceite: `node tools/check.js` verde (39 verificações de UI/PWA + 3 testes novos do Worker); prova em navegador: SW ativo, cópia offline abre o app, campo com 16px e foco visível. Falta teste em celular real: instalar na Tela de Início, modo avião, notificação com tela bloqueada, zoom no iPhone, lembrete de um 2º aparelho.
- Risco: cache velho. Mitigação: página rede-primeiro, `CACHE` versionado, botão "Atualizar app" limpa tudo.
- Paridade: aba do Painel (artefato) recebe o CSS de acessibilidade; offline/PWA e Worker não se aplicam ao artefato.

### Animações originais de exercício (07/11/2026)
- Problema: ~122 exercícios usam fotos livres (free-exercise-db); Lucas quer animações originais no estilo do boneco do mapa do corpo, sem desenho de código nem redesenho do Rael.
- Fluxo (espalhado, 4 exercícios por lote, 2 quadros cada): pedido ao Gemini (Caixa Gemini) > recebe quadros > `tools/frames.py` audita chão/altura/cabeça > normaliza para ex/ > registra em EX_SEQ > PR no site e igual no Painel > marca `publicado` em `tools/animacoes.json`.
- Fonte única do progresso: `tools/animacoes.json`. Fallback: as fotos antigas ficam até o exercício estar `publicado` e conferido.
- Aceite de um lote: auditoria 0 fora do padrão; todo `publicado` tem EX_SEQ e arquivos em ex/; `node tools/check.js` verde; prova após publicar (print do site e do Painel). Nada testado em celular.
- Risco aberto: canal de volta das imagens do Gemini (Drive/Gmail) NÃO CONFIRMADO; o lote 1 testa isso.

## Regras do método
- Antes de abrir PR: `node tools/check.js` (sintaxe dos scripts + testes das contas de kcal/macros e da nota Pintinho/Frango/Galo Alfa). Se mudar uma regra de conta, ajustar o teste na mesma entrega.
- Paridade: tudo que entra no site (index.html) vai também para a aba Frangômetro do Painel, exceto o que for exclusivo de um dos dois.
