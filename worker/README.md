# Avisos de fim de descanso (Cloudflare Worker)

O site agenda o aviso neste Worker, e ele manda um Web Push no horário certo, mesmo com o celular bloqueado.
Plano gratuito da Cloudflare é suficiente.

Passo a passo (feito uma vez, pelo dono do repositório):

1. Criar conta gratuita em https://dash.cloudflare.com (e confirmar o e-mail).
2. Em "Workers & Pages", abrir a página inicial e anotar o **Account ID** (aparece na barra lateral direita) e o seu subdomínio `workers.dev` (a Cloudflare pede para escolher um na primeira vez).
3. Criar um **API Token**: Meu perfil > API Tokens > Create Token > modelo "Edit Cloudflare Workers".
4. No GitHub, repositório `rael-fit` > Settings > Secrets and variables > Actions > New repository secret, criar três segredos:
   - `CLOUDFLARE_API_TOKEN` (o token do passo 3)
   - `CLOUDFLARE_ACCOUNT_ID` (o do passo 2)
   - `VAPID_PRIVATE_JWK` (o conteúdo do arquivo da chave privada que o Claude deixou na pasta de arquivos do projeto)
5. Em Actions > "Publicar avisos (Cloudflare Worker)" > Run workflow.
6. Quando terminar, a URL do Worker será `https://frangometro-avisos.<seu-subdominio>.workers.dev`. Envie essa URL ao Claude, que coloca em `push-config.json`.

No celular: abrir o site, Ajustes > "Ligar avisos". No iPhone é preciso antes "Adicionar à Tela de Início" e abrir o app por esse ícone.
