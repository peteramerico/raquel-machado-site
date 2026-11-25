# SEO técnico: metadados por rota, JSON-LD e pré-renderização — design

Data: 2026-11-25 · Projeto: raquel-machado-site (frontend) · Status: aguardando revisão do Peter

## Problema

O site é uma SPA (Vite + React 19 + React Router 7). Todas as rotas devolvem o mesmo `index.html` vazio
(`<div id="root">`), com um `<title>` e uma `description` únicos. Consequências:

- Não há `canonical`, Open Graph nem JSON-LD. A prévia de link (WhatsApp/Instagram) não tem título nem descrição por página.
- Rastreadores que não executam JavaScript (a maioria dos de IA: ChatGPT, Perplexity etc.) veem a página vazia.
- O Google executa JS, mas indexa com atraso e sem dados estruturados de médico/clínica.

## Objetivo

Cada página pública sai do build como HTML estático completo (corpo real + `<head>` com título, descrição,
canonical, Open Graph e JSON-LD), e o React assume esse HTML no navegador (hidratação).

## Fora do escopo

- Imagem Open Graph (`og:image`): decisão do Peter em 25/11, "não mexer agora". O mapa de rotas deixa o campo opcional.
- JSON-LD de `Event` (a palestra é de 25/11/2026; vira ruído depois da data).
- Otimização das fotos de 5 a 18 MB em `public/images` (item separado, recomendado depois).
- Search Console e Perfil da Empresa no Google (exigem login da Raquel).
- Áreas com login (`/familia`, `/painel`, `/admin`, `/conta/senha`): continuam SPA pura, já têm `noindex`.

## Critérios de aceite (a palestra continua funcionando como hoje)

Baseline gravado ANTES de qualquer mudança e repetido DEPOIS (na VPS em porta de teste e em produção):

1. `GET /apresentacoes/sala-de-parto/` = 200 com os 6 cabeçalhos atuais (SAMEORIGIN, CSP com `frame-ancestors 'self'`, noindex etc.);
   `GET /apresentacoes/sala-de-parto` = 301 para a versão com barra; um arquivo de fonte da apresentação = 200.
2. `GET /palestras` e `GET /palestras/sala-de-parto` = 200, `title` correto, link "Palestras" no menu.
3. No Chrome, em `/palestras/sala-de-parto`: o iframe aponta para `/apresentacoes/sala-de-parto/`, carrega `.reveal` com 15 slides e a fonte Jost.
4. Console do navegador sem erro de hidratação nas páginas pré-renderizadas.
5. Rotas com login continuam como hoje: `/familia` sem sessão vai para `/familia/entrar`; `/admin` idem.
6. Rota desconhecida (ex.: `/xyz`) continua no comportamento atual (redirecionamento para `/` feito pelo React); `/blog` continua com 301 do Nginx.
7. Qualquer divergência na página da palestra: ela sai da lista de pré-renderização e volta a ser SPA (a home concentra o ganho).

## Design

### 1. Mapa único de metadados (`src/seo/rotas.ts`)

Fonte única, usada pelo build, pelo sitemap e pelos testes. Para cada rota pública:
`caminho`, `titulo`, `descricao`, `canonical` (sempre `https://raquelmachadoped.com.br` sem `www`; o `www` já redireciona 301 para o apex),
`og` (`title`, `description`, `url`, `type`, `locale: pt_BR`, `site_name`; `image` opcional, ausente por ora) e `jsonLd` (lista de objetos).

Rotas: `/`, `/palestras`, `/palestras/sala-de-parto`, `/links`, `/privacidade`.
A página da palestra deriva título/descrição de `content/palestras.ts` (não duplicar texto).
`/links` e `/privacidade` entram no mapa com canonical, mas sem JSON-LD.

### 2. JSON-LD

- Home: `Physician` (nome "Dra. Raquel Machado", `medicalSpecialty` Pediatric e Neonatal, `identifier` CRM-RN 9383,
  `alumniOf` UFRN e Unicamp, `sameAs` Instagram, `url`, `areaServed` Natal/RN) e duas `MedicalClinic`
  (Clínica Cativa: "Tyrol Business Center, Sala 514, Natal, RN"; Fábrica do Amanhã: "Rua Dr. Horácio, 595, Lagoa Nova, Natal, RN"),
  com `telephone` dos dois WhatsApps (+55 84 99677-0404 e +55 84 99221-5656). Dados já públicos no site (`content/contatos.ts`, `Home.tsx`).
  Não inventar CEP, horário nem preço.
- `/palestras` e `/palestras/sala-de-parto`: `BreadcrumbList`.
- Sem `Review`/`aggregateRating`: o Google não aceita avaliações escritas pelo próprio site.

### 3. Pré-renderização (Node, sem navegador)

Após `vite build`, um passo de build gera o HTML de cada rota pública:

- Build SSR do entry do servidor (`vite build --ssr`) que exporta uma função `renderizar(caminho)` usando
  `createStaticHandler` + `createStaticRouter` + `renderToString` do `react-dom/server` com as mesmas `routes` de `src/routes.tsx`.
- Um script (`scripts/prerender.mjs`) lê o `dist/index.html` (shell limpa), troca o `<title>`/`description`, injeta canonical, Open Graph e JSON-LD
  no `<head>` e o HTML renderizado dentro de `<div id="root">`, e grava os arquivos.
- O cliente passa a usar `hydrateRoot` nas rotas pré-renderizadas e continua com `createRoot` quando o `#root` está vazio (shell das áreas com login).
- Só Node: roda igual no GitHub Actions (`npm run build`) e no cron da VPS. Sem Chromium.

Arquivos gerados em `dist/`:

| Rota | Arquivo |
|---|---|
| `/` | `inicio.html` |
| `/palestras` | `palestras.html` |
| `/palestras/sala-de-parto` | `palestras/sala-de-parto.html` |
| `/links` | `links.html` |
| `/privacidade` | `privacidade.html` |
| fallback (áreas com login e rotas desconhecidas) | `index.html` (shell limpa, **não é sobrescrita**) |

### 4. Hidratação: pontos de atenção conhecidos

- `useRevelar` hoje inicia `visivel` com `matchMedia`/`IntersectionObserver`, que no servidor e no cliente dão valores diferentes
  (divergência de hidratação e risco de mudar a animação da home). Passa a iniciar igual nos dois lados e ligar a animação só no efeito. O visual final da home precisa ficar idêntico (conferir no navegador).
- `ScrollToHash`, `SiteHeader` e demais usos de `window`/`document` já estão dentro de `useEffect` (não executam no servidor). Conferir por teste de renderização no servidor.
- `useTitulo` continua no cliente; no servidor o título vem do mapa. `useNoIndex` não é afetado (rotas restritas não são pré-renderizadas).
- O iframe da palestra renderiza igual nos dois lados (`src` e `title` fixos, vêm de `palestras.ts`).

### 5. Nginx (aplicado à mão na VPS, com backup, `nginx -t` e reload)

Compatível com qualquer ordem de deploy (Nginx novo + site antigo se comporta como hoje; site novo + Nginx antigo também):

```
location = / {
    root /var/www/raquel-frontend;
    try_files /inicio.html /index.html;
}
location / {
    root /var/www/raquel-frontend;
    index index.html;
    try_files $uri $uri.html /index.html;
}
```

- `$uri/` sai do `try_files` de `location /`: com a pasta `palestras/` existindo, `/palestras/` daria 403 (diretório sem índice).
  Com a mudança, `/palestras/` cai na shell e o React resolve a rota. O canonical aponta para a versão sem barra.
- Os blocos `/apresentacoes/`, `/api/` e `/blog` não mudam.
- Cabeçalhos do `server` continuam herdados (os novos `location` não declaram `add_header`).
- Teste prévio na VPS: servidor temporário em `127.0.0.1:8081` com a config nova e o build novo num diretório separado
  (`/var/www/raquel-frontend-next`), rodando as mesmas checagens do baseline. Só então aplicar no Nginx real. Remover o temporário no fim.

### 6. Sitemap

Gerado pelo mesmo mapa de rotas no build (`lastmod` = data do build para as páginas pré-renderizadas; `priority` como hoje). Substitui `public/sitemap.xml` escrito à mão.
`robots.txt` não muda (o bloco gerenciado da Cloudflare fica como está; a política de IA é decisão à parte do Peter).

## Verificação

- Unitários: mapa (todas as rotas têm título ≤ 70 e descrição ≤ 160 caracteres, canonical absoluto sem `www`), JSON-LD (JSON válido, `@context`, campos obrigatórios, sem `aggregateRating`), sitemap (uma URL por rota do mapa).
- Prerender: um HTML por rota, com `<title>` e `canonical` certos, `<h1>` no corpo, JSON-LD parseável e `index.html` intacto (sem `<h1>`).
- Servidor de teste local (`vite preview` sobre `dist`) + Chrome: console limpo, iframe e 15 slides na palestra, home com a mesma aparência.
- VPS (porta 8081), depois produção: baseline do item "Critérios de aceite" + `curl` das cinco rotas mostrando `<title>`, `canonical`, `og:title` e `ld+json` no código-fonte.
- Limpar o cache da Cloudflare após o deploy e reconferir.

## Deploy e reversão

Ordem: (1) aplicar Nginx na VPS com backup (compatível com o site atual); (2) merge no master e push (Actions + cron);
(3) verificar produção; (4) limpar cache da Cloudflare.
Reversão: restaurar o backup do Nginx (`/root/backups/raquel-site/nginx.<data>.bak`) e reverter o merge. Minutos.

## Riscos

| Risco | Mitigação |
|---|---|
| Divergência de hidratação (`useRevelar`) | Estado inicial igual nos dois lados; teste e console limpo; palestra sai da lista se houver dúvida |
| 403/404 em rotas com barra final | `$uri/` removido; checado na porta de teste |
| Ordem do deploy | Nginx compatível com site antigo e novo |
| HTML em cache na Cloudflare | HTML sem extensão na URL não é cacheado por padrão; limpar cache e reconferir |
| Layout mobile não visto | Continua pendente com o Peter (limitação do navegador usado), igual a hoje |
