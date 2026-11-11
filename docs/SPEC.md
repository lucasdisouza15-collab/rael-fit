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

## Regras do método
- Antes de abrir PR: `node tools/check.js` (sintaxe dos scripts + testes das contas de kcal/macros e da nota Pintinho/Frango/Galo Alfa). Se mudar uma regra de conta, ajustar o teste na mesma entrega.
- Paridade: tudo que entra no site (index.html) vai também para a aba Frangômetro do Painel, exceto o que for exclusivo de um dos dois.
