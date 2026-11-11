# Rael Frango

> **Versão de teste.** Em breve nas lojas Android e iOS. © Lucas de Souza, todos os direitos reservados (ver LICENSE). Não copie nem redistribua.

### Encerrar esta versão quando sair na loja
Edite `app-status.json` para `{"estado":"migrado","mensagem":"Agora está na loja!","loja":"https://link-da-loja"}`. Em até 5 minutos (ou ao reabrir) o app mostra a tela de encerramento e bloqueia o uso. Para reverter, volte `"estado":"teste"`. Nada é apagado.

App de alimentação e treino (calorias, macros, déficit, rotinas, séries e cargas) feito de presente para o Rael.

Abra no celular: https://lucasdisouza15-collab.github.io/rael-fit/

Os dados ficam salvos só no navegador de cada aparelho. Faça backup em Perfil.
A chave de IA nunca fica neste repositório: cada pessoa cola a sua no Perfil (ou usa o link de ativação).

## Backup (regra permanente)

Exportar, importar, "Copiar tudo", "Colar backup" e sincronizar com o Painel são **genéricos**: chave nova no perfil ou no dia (`dia-*`), tipo de documento novo e preferências `frango:*` entram sozinhos. Só estruturas com regra de mescla própria ficam listadas em `SYNC_PERFIL_ESP`, `SYNC_DIA_ESP` e `SYNC_LISTAS` (index.html). Sempre que a estrutura mudar:

1. Se for campo simples ou objeto, nada a fazer (já entra). Se for lista por id, mapa por data ou união (como humor `checkins`, `sono`), acrescente a regra em `syncMergeDia`/`syncMergePerfil`.
2. Rode o ciclo de teste: semear dados com a estrutura nova, `syncPacote()`, limpar, `syncPrepara()` + `syncAplica()`, comparar. Nada pode faltar nem duplicar, e uma segunda importação deve dar 0 mudanças.
3. Atualize a cópia do Painel (aba Frangômetro) e `supabase/sync_painel.py` junto.
