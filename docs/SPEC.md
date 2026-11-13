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
### Proteção, versão de teste e interruptor (11/11/2026)
- Problema: Lucas teme cópia do código e quer deixar claro que é versão de teste até sair nas lojas, e poder inutilizar o site quando migrar. Hoje só amigos usam.
- Limite real: JS de front-end é sempre visível; nada aqui impede cópia técnica, só dá base legal e controle da nossa versão.
- Comportamento: (1) LICENSE "todos os direitos reservados", meta copyright e comentário no index.html, aviso no README. (2) Faixa fixa no topo do corpo: "Versão de teste. Em breve nas lojas Android e iOS." (3) `app-status.json` (`estado`: teste|migrado, `mensagem`, `loja` https). O app lê com no-store ao abrir, ao voltar para a aba e a cada 5 min; se `migrado`, cobre a tela com aviso e botão da loja. Falha de rede, arquivo ausente ou inválido = continua funcionando (nunca bloqueia por erro). Link não-https é ignorado.
- Dados afetados: nenhum; nada é apagado. Reverter = voltar `estado` para `teste`.
- Aceite: `node tools/check.js` verde (tools/check-status.js, 15 verificações) e prova em navegador com os dois estados.
- Risco baixo. Limite: quem copiou o código continua com a cópia; o Supabase pode passar a exigir versão nova no futuro. Offline: vale o último status em cache.
- Paridade: Painel não se aplica (artefato privado do Lucas). Repo privado + Cloudflare Pages fica para antes da divulgação (troca o link dos convidados).

### Ideias 1 a 7 da análise de funções (11/11/2026)
Origem: /frangometro/analise-funcoes-2026-11-11.md. Ideia 8 (código de barras) fora. Regra: nenhum dado do usuário é apagado por estas funções.
Lógica pura em `index.html` entre `/*IX-PURO-INI*/` e `/*IX-PURO-FIM*/`, testada por `tools/check-ideias.js` (roda dentro de `tools/check.js`).
1. **Meus dados**: seção única no Perfil com estado (`ixDadosEstado`: ok/aviso/ruim) e 3 botões (guardar na nuvem, baixar cópia, restaurar cópia). Backup e Nuvem antigos ficam em "Avançado" dentro dela. Aceite: nuvem com erro = ruim; sem nuvem e sem cópia há 7+ dias = aviso; sem dados = ok.
2. **Estagnação** (`ixEstagnacaoCarga`, `ixEstagnacaoPeso`): carga não passa da mais antiga nos últimos 3 treinos do exercício; peso variando menos de 0,3 kg em 21+ dias (com 2+ pesagens separadas por 14+ dias), exceto objetivo manter ou meta já atingida. Aviso gentil com sugestão, dispensável por 7 dias.
3. **Resumo semanal** (`ixResumoSemana`): kcal média, dias registrados, treinos, variação de peso, 1 conquista, 1 ajuste. Card no domingo (e seg/ter para a semana que passou) e push "semana" ligado por padrão com o texto do resumo (campo `resumo` no estado enviado ao Worker).
4. **Origem e duplicidade** (`ixOrigem`, `ixParecidos`): etiqueta Hevy / Painel-Strava / Feito no app em cada treino; aviso "parece o mesmo treino" (mesmo dia, início a menos de 90 min e duração parecida, ou mesmos exercícios com volume parecido). Ação reversível: "contar só um" marca `ignorar` no treino (não apaga); "são diferentes" memoriza o par. `workouts()` pula `ignorar`.
5. **Favoritos em 1 toque** (`ixTopPorRefeicao`): 5 alimentos mais usados na refeição do horário atual (últimos 60 dias), com a última quantidade; 1 toque lança.
6. **Modo convidado** : Worker ganha `/ia` (Haiku, chave só no Worker, limite diário por aparelho, validação de tamanho, sem imagem grande); o app usa quando não há chave própria nem conta Claude. Entrada rápida com 3 perguntas, dados só no aparelho, convite "guardar na nuvem" depois de 3 dias com registro. Sem a chave `ANTHROPIC_API_KEY` no Worker, a IA fica em copiar e colar (nada quebra).
7. **Metas com prazo** (`ixMetaPrazo`): `metaData` ao lado do peso alvo; mostra ritmo necessário (kg/sem), ritmo real das últimas 4 semanas e status adiantado/no ritmo/atrasado/prazo vencido; avisa se o ritmo necessário passa de 1% do peso por semana.
- Aceite: `node tools/check.js` verde; prova no navegador (Playwright) de cada tela; paridade na aba do Painel. Nada testado em celular real.
- Risco médio: 4 (comparação de treinos) e 6 (segurança da IA). Mitigação: ações reversíveis, sem apagar; limite e validação no Worker.

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

### Rumo ao TAF (13/11/2026)
- Problema: Lucas vai prestar Escrivão PC-BA e quer plano real, cumprível e mensurável dentro do app, sem quebrar a rotação push/pull/legs.
- Fonte dos mínimos: Portaria PCBA nº 198/2026, art. 10 §1º (homem): barra 3 reps, abdominal 36 em 1 min, corrida de 12 min 2.400 m. Cada teste é eliminatório. Data do TAF: NÃO CONFIRMADA. Metas intermediárias são do plano (/mnt/project-files/saude/plano-taf-escrivao-pcba.md), não da Portaria.
- Comportamento: cartão "Rumo ao TAF" em Treino > Semana (até 30/05/2027, `p.tafOff` esconde): corridas da semana (seg/ter/qui), abdominal e barra da fase, próximo teste de referência (sábados a cada 28 dias a partir de 14/11), tabela mínimo / último / meta do ciclo e botão "Registrar teste" (salva em `p.taf[AAAA-MM-DD] = {corrida, abd, barra}`, só soma, nunca apaga).
- Lógica pura entre `/*TAF-PURO-INI*/` e `/*TAF-PURO-FIM*/`, testada por `tools/check-taf.js` (dentro de `tools/check.js`).
- Aceite: `node tools/check.js` verde (17 verificações do TAF) e prova no navegador (cartão com data simulada 18/11 e registro salvo). Nada testado em celular real.
- Paridade: aplicar na aba Frangômetro do Painel; Hevy: rotinas prontas para colar (sem acesso direto ao Hevy).

### Rotinas TAF e aquecimento nas rotinas (13/11/2026, v77)
- Problema: (1) Lucas esperava ver como ROTINAS de treino: TAF Corrida, TAF Finalizador PUSH, TAF Finalizador PULL e TESTE TAF; só existia o cartão. (2) Ele não via o aquecimento nas rotinas: o app já tinha séries W por exercício (`item.aq`, 0 a 3), mas o editor não tinha o campo e a lista não mostrava. Não foi regressão do TAF (código igual antes).
- Comportamento: (a) editor de rotina ganha "Aquecimento: séries W (0 a 3)" por exercício; a lista mostra o aquecimento de cada rotina ou "Sem aquecimento". (b) Rotinas com flag `taf: true` (ids fixos taf-corrida, taf-fin-push, taf-fin-pull, taf-teste) NUNCA entram em `semanaRot` (rotação push/pull/perna intacta). Todas abrem com aquecimento (caminhada 5 min ou série W). TESTE TAF na ordem do TAF real: caminhada, polichinelo, barra, abdominal, corrida. (c) Rotinas do usuário sem nenhum aquecimento recebem 1 série W no primeiro exercício de carga/corpo; quem já tem fica igual.
- Opt-in (o app tem outros usuários): só com o link `#taf` (ou `p.tafOn`). Na primeira vez, guarda o estado anterior em `p.tafRotAntes`, cria as 4 rotinas, aplica aquecimento e marca `p.tafRotV = 1`. Idempotente. Cartão "Rumo ao TAF" também só aparece com opt-in (corrige o PR #65, que mostrava a todos).
- Aceite: `node tools/check.js` verde (25 verificações TAF + semana com 4 rotinas TAF); prova em navegador com recarga: 6 rotinas + 4 TAF, rotação inalterada, 6 no backup, sem duplicar. Nada testado em celular real.
- Paridade: aba Frangômetro do Painel (opt-in sempre ligado, é privado).

## Regras do método
- Antes de abrir PR: `node tools/check.js` (sintaxe dos scripts + testes das contas de kcal/macros e da nota Pintinho/Frango/Galo Alfa). Se mudar uma regra de conta, ajustar o teste na mesma entrega.
- Paridade: tudo que entra no site (index.html) vai também para a aba Frangômetro do Painel, exceto o que for exclusivo de um dos dois.

## Cargas travadas em cartão compacto (v63, 11/11/2026)
Pedido do Lucas: com muitos exercícios travados a tela ficava enorme. Regra: um único cartão "Cargas travadas (N)" na Evolução, com os 3 de maior carga (uma linha cada: exercício, kg, 3 treinos) e "Ver todos (N)" que expande a lista (rolagem própria, altura máx. 320 px) e recolhe. A dica (+1 repetição, subir X kg, semana a 60%) aparece uma vez só no topo. O ✕ da linha avisa de novo só em 7 dias para aquele exercício; "Silenciar todos por 7 dias" vale para todos. Na aba Hoje só uma linha ("N cargas travadas · ver") que leva à Evolução. Nada é apagado, só adiado. Verificador: tools/check-ideias.js testa 1, 5 e 1000 travados (recolhido e aberto): 1 cartão, no máx. 3 linhas recolhido, dica 1 vez, resumo de 1 linha no Hoje.

## IA do convidado pela chave Gemini do próprio usuário (v64, 11/11/2026)
Decisão do Lucas: não gastar a chave da Anthropic dele. Removidos a rota `/ia` do Worker, as cotas de IA e o segredo `ANTHROPIC_API_KEY`. A IA grátis usa a chave Gemini que a pessoa cadastra em Perfil > Inteligência artificial (já existia): 3 passos guiados (AI Studio, criar chave, colar e salvar), guardada só no aparelho, fora do backup, enviada direto ao Google no cabeçalho `x-goog-api-key` (nunca na URL). Sem chave: copiar e colar. No Painel nada muda (usa o Claude do app). Verificador: tools/check-ideias.js (bloco 6b).

## Cargas travadas acionáveis (v65, 11/11/2026)
O aviso sozinho não ajudava. Agora cada linha do cartão tem **Aplicar: X kg × R** (+1 repetição na mesma carga, ou +incremento se já está no topo das repetições) e **Semana leve: Y kg × R** (60% da carga, arredondada a 2,5 kg), mostrando o valor antes de tocar. Ao tocar grava `perfil.ixMeta[eid] = {kg, reps, tipo, em}`: a meta vira a sugestão do exercício (`suggest()`), aparece em Treino como "Meta de hoje: X kg × R" e preenche as séries. A meta vale até o próximo treino que traga o exercício com série feita; depois volta ao normal (se ainda travar, o aviso volta). "Desfazer" remove na hora. O ✕ só silencia 7 dias. O "ver" da aba Hoje agora abre a Evolução já com o cartão expandido e rolado até ele. Verificador: tools/check-ideias.js (blocos 2b e 2c): regras da meta, validade, 1/5/1000 travados com os dois botões e a dica.

## Cadastro (onboarding) mais bonito (11/11/2026)
Pedido do Lucas: telas feias (muito espaço vazio, atividade cortada, barra pulando, % apagado) e "cara de app atual". Mascote NÃO muda; identidade pervinca/dourado mantida.
- Estrutura (vale para as duas opções): cartão centralizado na altura (barra de progresso fixa no topo); espaço da seta de voltar sempre reservado; "%" dentro da barra; Sexo em linha própria e Idade+Altura lado a lado; atividade com nome curto e a explicação numa dica abaixo; "kg" ao lado do número; marca ✓ em círculo na opção escolhida; mascote da abertura com leve flutuação (respeita reduzir movimento); transição entre passos já existente (stepIn).
- Escolhido pelo Lucas: estilo "Macio" (cartão arredondado, sombra suave, botão em pílula). Vale também para o app inteiro (fase 1, v68): cartões, botões, campos, chips, abas, barras e janelas arredondados; sem chanfro. Só forma e sombra: cores, fontes e o Rael não mudam. A atividade (Perfil e cadastro) usa nome curto + dica (`ativSel`).
- Aceite: `node tools/check-ui.js` e `node tools/check.js` verdes, prints em 390x844 das 4 telas do cadastro e das 5 abas (Hoje, Comer, Treino, Evolução, Perfil). Nada testado em celular de verdade.

## Semana pela rotação (v69, 11/11/2026)
Bug do Lucas: no site todos os dias da Semana apareciam "Folga", mas na aba do Painel mostrava PULL B, PUSH A, PULL A, LEGS... Causa (CONFIRMADA no código): as 6 rotinas chegam ao site (a tela dizia "Dia de folga no plano", só aparece com rotinas), mas o site só lia `p.semana` (dia da semana > rotina), que o perfil espelhado do Painel não tem; o Painel usa rotação ("continuando do último treino feito"). Não foi o v68 nem o Supabase.
- Regra: se `p.semana` não tem nenhum dia, a semana sai da rotação: Seg a Sex giram as rotinas na ordem, continuando do último treino feito (casa por id ou nome); rotina "bônus/opcional" vai ao sábado; domingo folga; dias passados sem treino ficam sem rotina; dia passado com treino mostra o nome do treino feito. Quem escolheu os dias à mão (p.semana com algum dia) continua mandando; ao tocar num dia, a semana atual vira escolha manual.
- Aceite: `node tools/check-semana.js` (dados congelados do Lucas, 9 verificações) dentro de `node tools/check.js`; prova após recarregar em navegador: Seg PULL B, Ter PUSH A, Qua PULL A, Qui LEGS, Sex PUSH B, Sáb UPPER BÔNUS, Dom Folga, igual ao Painel.

## Sem cortes no iPhone (v70, 11/11/2026)
Bug do Lucas (prints do iPhone, v69): nomes da Semana viravam "PUL...", "PUS...", "UPP..."; no Perfil o campo "Até quando?" (data) vazava do cartão e ficava mais alto que os outros.
- Causa: `.wd .r` tinha `nowrap`+reticências; o Safari dá largura própria ao `input[type=date]`.
- Regra: nome da rotina quebra linha por palavra e cabe inteiro (células com 1px de folga); data com `display:block; width:100%; min-width:0; min-height:52px; appearance:none`; selects em duas colunas com 15px; rótulos curtos (Academia, Casa (halteres), Peso corporal, Músculo, Leve · 250 / Padrão · 500 / Agressivo · 750).
- Aceite: `node tools/check-ui.js` e `NODE_PATH=$(npm root -g) node tools/varre-layout.js` (375 e 390 px, todas as abas e subabas: reticências, select com texto maior que o campo, vazamento à direita, palavra cortada) verdes. A faixa de chips de Exercícios rola de propósito. Nada testado em iPhone de verdade.
