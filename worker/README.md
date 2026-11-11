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

## Conferir a nuvem antes de avisar (opcional, recomendado)

Os lembretes "Sequência em risco" e "Hora do treino" só se calam se souberem que você já registrou. O resumo do dia vem do app aberto no celular, então o que você registra só no Painel não chegava aqui. Se você cadastrar dois segredos no próprio Worker (Cloudflare > Workers > frangometro-avisos > Settings > Variables and Secrets, tipo Secret), ele passa a ler o Supabase antes de avisar:

- `SUPABASE_EMAIL` e `SUPABASE_PASSWORD`: o mesmo login do Frangômetro.

Sem eles, a "Sequência em risco" só dispara se o resumo do aparelho for de hoje; resumo velho (app não aberto hoje) agora silencia o aviso em vez de arriscar um alarme falso.

## IA do app (modo convidado)

O Worker **não** faz chamadas de IA e **não** guarda nenhuma chave de IA. Quem quer a IA liga a sua própria chave grátis do Gemini em Perfil > Inteligência artificial (3 passos: abrir o Google AI Studio, criar a chave, colar e salvar). A chave fica só no aparelho da pessoa, é enviada direto ao Google num cabeçalho (nunca na URL) e não entra no backup. Sem chave, o app segue no modo copiar e colar. Não existe mais o segredo `ANTHROPIC_API_KEY`; se ele foi cadastrado no Worker, pode ser removido.

## Resumo da semana por aviso

O tipo "Resumo da semana" (domingo 19:00) agora vem ligado por padrão e usa o texto que o app manda junto do estado do dia (dias registrados, média, treinos). Se o app não foi aberto nos últimos 2 dias, cai na frase genérica.
