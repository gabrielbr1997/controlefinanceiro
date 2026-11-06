# Fluxo Pessoal: login, publicação na Vercel e instalação como app

O app é um site estático (sem compilação) com login de e-mail e senha e dados salvos na nuvem pelo **Supabase**. A hospedagem é na **Vercel**.

## O que tem aqui

| Arquivo | Para que serve |
|---|---|
| `index.html`, `styles.css`, `app.js` | O app |
| `config.js` | **Os dois dados públicos do seu projeto Supabase (você preenche)** |
| `supabase/schema.sql` | Cria a tabela de dados e as regras de acesso por usuário |
| `manifest.webmanifest`, `sw.js`, `icons/`, `favicon.svg` | Instalação como app e funcionamento offline |
| `vercel.json` | Cabeçalhos de segurança e cache |

## Como o login funciona

- Cada pessoa cria a própria conta com e-mail e senha. Quem testa o app cria uma conta própria.
- Os lançamentos ficam numa tabela do Supabase protegida por regras de acesso: cada conta lê e altera **somente os próprios dados**.
- As senhas ficam com o Supabase (guardadas de forma segura). O app nunca vê nem guarda a senha.
- Quem administra o projeto no Supabase (você) tem acesso técnico ao banco, então consegue ver os dados armazenados. Avise quem for testar.
- O app começa **zerado**: no primeiro acesso ele pede nome, saldo atual da conta e, se quiser, o limite mensal de gastos.
- Os dados também ficam em cópia no aparelho, então o app abre e aceita lançamentos mesmo sem internet. As alterações são enviadas quando a conexão volta.
- Se a mesma conta for usada em dois aparelhos, vale a última alteração enviada. Evite lançar nos dois ao mesmo tempo.

## Relatórios, agendadas, recorrentes e backup

- **Relatórios** (aba do meio): escolha o período (mês, 30 ou 90 dias, ano, tudo ou datas personalizadas) e, se quiser, uma categoria. O painel mostra recebido, gasto, resultado, comparação com o período anterior, gráfico de entradas e saídas, gastos por categoria, maiores lançamentos e o andamento das metas.
- **Agendada**: ao lançar, escolha "Agendada" para contas a pagar ou a receber. Elas não entram no saldo até você tocar em "Marcar como paga" ou "Marcar como recebida".
- **Repetir todo mês**: marque ao criar um lançamento. O app cria os próximos como agendados; para parar, use "Encerrar" na aba Relatórios.
- **Backup completo (JSON)** e **Restaurar backup**: no Perfil. O arquivo contém todos os seus dados, então guarde-o em local seguro. Restaurar substitui os dados atuais da conta.

## Bot do Telegram (opcional)

Com o bot, você lança e consulta conversando: "gastei 45 no mercado", "recebi 3000 salário", "conta de luz 150 vence 10/11", `/saldo`, `/semana`, `/mes`, `/desfazer`. Todo dia às 8h (horário de Brasília) ele avisa o que vence hoje, amanhã ou já está atrasado. Ele entende só texto, não áudio.

1. **Criar o bot.** No Telegram, abra o **@BotFather**, envie `/newbot`, escolha um nome e um usuário que termine em `bot`. Ele devolve um **token**: é uma senha, não mostre a ninguém.
2. **Atualizar o banco.** No Supabase, cole de novo o `supabase/schema.sql` atualizado no SQL Editor e rode (pode repetir sem problema).
3. **Chave de serviço.** Em **Project Settings > API Keys**, copie a chave secreta (**service_role** ou **secret**, começa com `sb_secret_`). Ela dá acesso total ao banco: guarde só na Vercel, nunca no GitHub, no `config.js` ou numa conversa.
4. **Variáveis na Vercel.** No projeto, vá em **Settings > Environment Variables** e crie estas cinco (marque Production):

   | Nome | Valor |
   |---|---|
   | `SUPABASE_URL` | O Project URL, como `https://xxxx.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | A chave secreta do passo 3 |
   | `TELEGRAM_BOT_TOKEN` | O token do BotFather |
   | `TELEGRAM_WEBHOOK_SECRET` | Uma sequência longa inventada por você (letras, números, `_` ou `-`) |
   | `CRON_SECRET` | Outra sequência longa inventada |

   Depois, em **Deployments**, abra o menu do último deploy e escolha **Redeploy**.
5. **Usuário do bot no app.** No `config.js`, preencha `telegramBot` com o usuário do bot, sem o @, e faça o commit.
6. **Ligar o bot ao site.** Abra no navegador este endereço, trocando `SEU_TOKEN` e `SEU_SEGREDO` pelos valores do passo 1 e do `TELEGRAM_WEBHOOK_SECRET`:
   `https://api.telegram.org/botSEU_TOKEN/setWebhook?url=https://controlefinanceiro-red-two.vercel.app/api/telegram&secret_token=SEU_SEGREDO`
   A resposta deve conter `"ok":true`.
7. **Conectar a sua conta.** No app, abra **Perfil > Telegram**, toque em **Gerar código** e depois em **Abrir o Telegram**. O código vale 15 minutos e funciona uma vez.

Cuidados: as mensagens passam pelos servidores do Telegram, que não protege conversas com bots de ponta a ponta. Se o token ou a chave secreta vazarem, gere outros (no BotFather, `/revoke`; no Supabase, crie uma nova chave) e atualize a Vercel. Se o app estiver aberto quando o bot gravar algo, o lançamento novo aparece no app na próxima sincronização.

## Parte 1: criar o projeto no Supabase (uns 10 minutos)

Os nomes dos menus podem variar um pouco, porque o Supabase atualiza o painel de tempos em tempos.

1. Acesse **supabase.com**, entre com o GitHub e clique em **New project**. Dê o nome `fluxo`, crie uma senha do banco (guarde num lugar seguro) e, em **Region**, escolha uma região do Brasil (South America) se estiver disponível. Aguarde uns 2 minutos.
2. Abra **SQL Editor**, clique em **New query**, cole o conteúdo do arquivo `supabase/schema.sql` e clique em **Run**. Deve aparecer "Success". Isso cria a tabela e as regras que impedem uma conta de ver os dados de outra.
3. Vá em **Authentication > URL Configuration**. Em **Site URL**, coloque o endereço do seu app na Vercel (por exemplo, `https://controlefinanceiro-red-two.vercel.app`). Em **Redirect URLs**, adicione o mesmo endereço seguido de `/**`.
4. Vá em **Authentication > Sign In / Providers > Email** e defina o tamanho mínimo da senha como **8**. Deixe a confirmação de e-mail ligada, que é o recomendado. Para testes rápidos você pode desligá-la, mas lembre de ligar de novo antes de convidar mais pessoas.
5. Abra **Project Settings > API** (ou **API Keys**) e copie dois valores: o **Project URL** e a chave **anon** (também chamada de **publishable**).

**Atenção:** use só a chave pública (anon ou publishable). Nunca use a `service_role` nem a chave secreta (`sb_secret_...`). O app recusa uma chave secreta, mas ela jamais deve ir para o GitHub.

## Parte 2: colocar as chaves no app

1. No GitHub, abra o arquivo `config.js` do repositório e clique no ícone de lápis.
2. Preencha `supabaseUrl` com o Project URL e `supabaseAnonKey` com a chave pública. Clique em **Commit changes**.
3. A Vercel publica de novo sozinha em cerca de um minuto. Ao abrir o endereço, deve aparecer a tela de login.

Enquanto o `config.js` estiver vazio, o app **não tem login** e guarda os dados só no próprio aparelho (o Perfil mostra "Login desativado").

## Parte 3: publicar na Vercel (se ainda não fez)

1. Entre em **vercel.com** com o GitHub, clique em **Add New > Project** e importe o repositório.
2. Deixe **Framework Preset: Other**, sem comando de build, e clique em **Deploy**.

Qualquer alteração enviada ao GitHub é publicada automaticamente.

## Parte 4: instalar no celular

- **Android (Chrome):** menu (três pontos) e **Instalar app**.
- **iPhone (Safari):** **Compartilhar** e **Adicionar à Tela de Início**.

No iPhone, o app instalado usa um armazenamento separado do Safari. Entre na sua conta no app instalado: seus dados vêm da nuvem.

## Limites e cuidados

- **E-mails de confirmação:** o serviço de e-mail padrão do Supabase tem um limite baixo de envios por hora. Se vários testadores se cadastrarem ao mesmo tempo, alguns e-mails podem demorar. Para uso mais amplo, configure um provedor de e-mail próprio no Supabase.
- **Projeto gratuito:** projetos do plano gratuito podem ser pausados depois de um período sem uso. Confira as regras atuais do plano no Supabase.
- **Apagar dados:** o botão "Apagar meus dados" no Perfil remove os lançamentos da nuvem, mas a conta de acesso continua existindo. Para excluir uma conta por completo, use o painel do Supabase (Authentication > Users).
- **Repositório público:** o `config.js` contém a URL e a chave pública do Supabase. Isso é esperado, porque a segurança vem das regras de acesso do `schema.sql`. Não coloque nenhuma outra chave no repositório.
- **Assistente simulado:** as respostas são calculadas no próprio aparelho, sem inteligência artificial externa.

## Atualizações e cache

O app busca a versão mais nova sempre que há internet. Se uma mudança não aparecer, feche o app e abra de novo. Para forçar a limpeza do cache em todos os aparelhos, aumente o número de `VERSION` no começo do `sw.js` (de `fluxo-v2` para `fluxo-v3`, por exemplo).

## Se algo não funcionar

- **A tela de login não aparece:** confira se `supabaseUrl` e `supabaseAnonKey` estão preenchidos e entre aspas, e se o deploy da Vercel terminou.
- **"Não foi possível carregar" depois de entrar:** confira se o `schema.sql` foi executado sem erro no SQL Editor.
- **O link do e-mail abre uma página errada:** confira o **Site URL** e as **Redirect URLs** no passo 3 da Parte 1.
- **Não chega e-mail de confirmação:** veja a pasta de spam e o limite de envios descrito acima.
