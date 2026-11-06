# Fluxo Pessoal: publicar na Vercel e instalar como app

Esta pasta é um site estático. Não precisa de instalação nem de compilação.

## O que tem aqui

| Arquivo | Para que serve |
|---|---|
| `index.html`, `styles.css`, `app.js` | O app |
| `manifest.webmanifest` | Nome, cores e ícones para instalar como app |
| `sw.js` | Faz o app abrir mesmo sem internet |
| `icons/` e `favicon.svg` | Ícones |
| `vercel.json` | Cabeçalhos de segurança e regras de cache da Vercel |

## Parte 1: publicar na Vercel (pelo GitHub, sem usar terminal)

1. **Descompacte** o zip no seu computador.
2. Crie uma conta em **github.com** (se ainda não tiver).
3. No GitHub, clique em **New repository**. Nome: `fluxo`. Marque **Private**. Clique em **Create repository**.
4. Na página do repositório, clique em **uploading an existing file**. Arraste **todo o conteúdo da pasta** (os arquivos e a pasta `icons`) para a janela. Confira se `index.html` e `vercel.json` ficaram na raiz, e não dentro de outra pasta. Clique em **Commit changes**.
5. Crie uma conta em **vercel.com** usando **Continue with GitHub**.
6. Na Vercel, clique em **Add New… > Project**, escolha o repositório `fluxo` e clique em **Import**.
7. Na tela de configuração, deixe **Framework Preset: Other**. Deixe **Build Command** e **Output Directory** vazios. Clique em **Deploy**.
8. Em cerca de um minuto aparece o endereço do app, no formato `fluxo-algo.vercel.app`.

Para atualizar o app depois, substitua os arquivos no GitHub. A Vercel publica de novo sozinha.

**Alternativa com terminal** (se você tem o Node.js instalado): dentro da pasta, rode `npx vercel` e responda às perguntas. Para publicar a versão final, rode `npx vercel --prod`.

## Parte 2: instalar no celular

- **Android (Chrome):** abra o endereço, toque no menu (três pontos) e escolha **Instalar app** ou **Adicionar à tela inicial**.
- **iPhone (Safari):** abra o endereço no **Safari** (não funciona por outro navegador), toque em **Compartilhar** e escolha **Adicionar à Tela de Início**.

O ícone aparece na tela inicial e o app abre em tela cheia.

## O que você precisa saber

- **Os dados ficam no aparelho.** Não há servidor nem login. Cada pessoa que abrir o endereço usa o app com os próprios dados, e ninguém vê os dados de outra.
- **Aparelhos não sincronizam.** O que você registrar no celular não aparece no computador.
- **iPhone:** o app instalado na tela inicial usa um armazenamento separado do Safari. Instale primeiro e só depois comece a lançar dados no app instalado.
- **Ainda não há backup.** Se você limpar os dados do navegador ou desinstalar o app, os lançamentos se perdem. A exportação em CSV serve de cópia de segurança parcial. Um backup e uma restauração completos podem ser adicionados.
- **O endereço é público.** Quem tiver o link consegue abrir o app, mas só vê os próprios dados. Se quiser restringir o acesso, veja as opções de proteção de acesso do seu plano nas configurações do projeto na Vercel.
- **Segurança:** o `vercel.json` já bloqueia que o app seja aberto dentro de outros sites e limita de onde o código pode ser carregado. O app não pede senha nem dados bancários.
- **Assistente simulado:** as respostas são calculadas no próprio aparelho. Nada é enviado a servidores.

## Atualizações e cache

O app busca a versão mais nova sempre que há internet. Se uma mudança não aparecer, feche o app por completo e abra de novo. Para forçar a limpeza em todos os aparelhos, aumente o número de `VERSION` no começo do `sw.js` (por exemplo, de `fluxo-v1` para `fluxo-v2`) e publique.

## Se algo não funcionar

- **Não aparece a opção de instalar:** confirme que o endereço começa com `https://` e abra o app pelo menos uma vez com internet.
- **A fonte parece diferente:** na primeira abertura sem internet o app usa a fonte do sistema. Isso é normal.
- **A tela fica em branco depois de publicar:** confira se `index.html` está na raiz do repositório.
