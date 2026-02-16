# Guia de Implantação (Deployment)

Este projeto está configurado e pronto para ser implantado no Cloudflare Pages através do GitHub.

## 1. Configuração Inicial (Já realizada)

O projeto foi inicializado com Git localmente. Todos os arquivos necessários para o build (`vite.config.ts`, `package.json`) estão configurados.

## 2. Subir para o GitHub

Para publicar, você precisa criar um repositório no GitHub e enviar este código.

1.  Crie um novo repositório no [GitHub](https://github.com/new) (pode ser público ou privado).
2.  Copie a URL do repositório (ex: `https://github.com/SEU_USUARIO/financiamento-app.git`).
3.  No terminal do seu projeto, execute:

```bash
git remote add origin https://github.com/SEU_USUARIO/financiamento-app.git
git branch -M main
git push -u origin main
```

## 3. Publicar no Cloudflare Pages

O Cloudflare Pages se integra diretamente com o GitHub e detecta automaticamente projetos Vite/React.

1.  Acesse o painel do [Cloudflare Pages](https://dash.cloudflare.com/?to=/:account/pages).
2.  Clique em **"Connect to Git"**.
3.  Selecione o repositório `financiamento-app` que você acabou de criar.
4.  Nas configurações de build (Build settings):
    *   **Framework preset:** Selecione `Vite` (ou React, mas Vite é mais preciso).
    *   **Build command:** `npm run build` (ou `npm run build` se usar npm, mas o Cloudflare detecta).
    *   **Build output directory:** `dist`.
5.  Clique em **"Save and Deploy"**.

Em poucos segundos, seu site estará no ar com uma URL segura (`.pages.dev`).

## Executando Localmente

Para testar em sua máquina:

```bash
npm install
npm run dev
```

Acesse `http://localhost:5173`.
