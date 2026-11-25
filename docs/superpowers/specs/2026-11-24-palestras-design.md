# Palestras: publicar a apresentação "sala de parto" no site (design)

> 2026-11-24. Aprovado pelo Peter na conversa de 24/11 (opção "lista /palestras + página"). Fonte: `INSTRUCOES-CLAUDE-CODE.md` e `apresentacao-sala-de-parto-site.zip` (reveal.js 6, 15 slides, autocontida).

## Objetivo
Servir a apresentação como arquivo estático e criar a seção pública **Palestras** do site: lista em `/palestras` e página `/palestras/sala-de-parto` com a apresentação embutida.

## Estrutura de URLs
| URL | O que é |
|---|---|
| `/apresentacoes/sala-de-parto/` | Arquivos estáticos da apresentação (`frontend/public/apresentacoes/sala-de-parto/`, cópia intacta do zip). Fora da SPA. |
| `/palestras` | Página da SPA: lista de palestras (1 cartão hoje). |
| `/palestras/:slug` | Página da SPA: título, contexto, iframe 16:9, botão "Abrir em tela cheia". Slug desconhecido redireciona para `/palestras`. |

"Palestras" é o nome para o visitante (menu, rotas, textos); "apresentacoes" é só a pasta técnica dos arquivos.

## Componentes
- `src/content/palestras.ts`: lista tipada (`slug`, `titulo`, `subtitulo`, `resumo`, `temas`, `caminho`), mesmo padrão de `content/contatos.ts`. Fonte única para a lista e para a página.
- `src/pages/Palestras.tsx` (+ `.module.css`): lista de cartões.
- `src/pages/Palestra.tsx` (+ `.module.css`): página genérica por `:slug`. Contêiner `aspect-ratio: 16 / 9`, iframe (`title`, `allow="fullscreen"`, `allowFullScreen`, `loading="lazy"`), botão `<a href target="_blank" rel="noopener">` (não `<Link>`: destino fora da SPA), linha de ajuda de teclado, contexto e temas. No celular o botão de tela cheia ganha destaque (slide de 1920 px fica ilegível em tela pequena).
- `src/lib/useTitulo.ts`: ajusta `document.title` e restaura ao sair (a `useNoIndex` faz isso mas também põe `noindex`; aqui a página deve ser indexada).
- `routes.tsx`: `/palestras` e `/palestras/:slug` dentro do `RootLayout` (header + rodapé), sem lazy (o projeto não usa).
- `SiteHeader.tsx` e `SiteFooter.tsx`: item "Palestras" (`NavLink` / `Link` para `/palestras`), antes de "Área da família".
- `public/sitemap.xml`: as duas URLs novas.
- Cores e fontes do site (Fraunces + Manrope, tokens de `styles/tokens.css`); nada da apresentação é importado nos estilos do site.

## Texto da página
- Título: "Aspectos da sala de parto no follow-up do recém-nascido prematuro".
- Subtítulo: "Novembro Roxo · Dra. Raquel Machado, pediatra e neonatologista".
- Contexto (palestra para profissionais de saúde; o site é voltado a famílias, então isso precisa estar claro): percorre aspectos da reanimação do prematuro na sala de parto (clampeamento do cordão, temperatura, suporte respiratório, aspiração, oxigênio) e o que cada um pode significar no seguimento. Baseada nas diretrizes PRN-SBP 2026. Sem promessa de desfecho e sem orientação individual.
- Ajuda: "Use as setas do teclado, a barra de espaço ou toque para avançar. Tecla F: tela cheia. Esc: visão geral."

## Servidor (Nginx na VPS, editado à mão; `nginx.conf` do repo é a referência)
Achado da exploração: o site inteiro tem `X-Frame-Options: DENY`, `frame-ancestors 'none'` e `frame-src` só com YouTube e Instagram, então o iframe da mesma origem é bloqueado nos dois lados. Mudanças:
1. **CSP do site:** acrescentar `'self'` ao `frame-src` (quem embute precisa permitir).
2. **`location ^~ /apresentacoes/`:** `X-Frame-Options: SAMEORIGIN` e `frame-ancestors 'self'`. `add_header` em `location` aninhado apaga os herdados, então o bloco repete HSTS, nosniff, Referrer-Policy, Permissions-Policy e a CSP completa (com `frame-ancestors 'self'`). Acrescenta `X-Robots-Tag: noindex` (a página da SPA é a indexada, sem conteúdo duplicado). Cache longo só em `fonts/` (o `deck.css` e o `init.js` não têm hash e serão substituídos quando a apresentação mudar).
3. **Redirecionamento:** `location = /apresentacoes/sala-de-parto { return 301 /apresentacoes/sala-de-parto/; }`.
4. **Ordem de entrada em produção:** primeiro o Nginx (aditivo, não quebra nada), depois o push (o push no master já faz o deploy do front). Se o push vier antes, a página abre com o iframe em branco.
5. **Cloudflare** fica na frente do domínio: ao substituir a pasta da apresentação no futuro, limpar o cache dos arquivos (nomes sem hash).

A CSP da apresentação precisa de `script-src 'self'`, `style-src 'unsafe-inline'`, `font-src 'self'`, `img-src 'self'`: todos já cobertos pela CSP atual do site. O Express não serve estático nem tem rota coringa, então `/apresentacoes/*` não passa por ele.

## Testes (Vitest)
- Rota `/palestras/sala-de-parto`: renderiza com header e rodapé, o `iframe` tem `src="/apresentacoes/sala-de-parto/"`, o botão tem `href` igual e `target="_blank"`, título da aba definido e restaurado.
- Rota `/palestras`: lista o cartão com link para `/palestras/sala-de-parto`.
- Slug desconhecido (`/palestras/nao-existe`) redireciona para `/palestras`.
- `SiteHeader`: link "Palestras" aponta para `/palestras`.
- Nenhuma dessas rotas chama `/api/auth/me` (páginas públicas).
- Verificação manual: `npm run build` gera `dist/apresentacoes/sala-de-parto/index.html`; os 15 slides avançam, o relógio do slide 5 gira e a pergunta do slide 3 aparece no clique.

## Fora do escopo
- Editar a apresentação (a pasta é substituída inteira quando mudar).
- Notas do apresentador (o site é público, de propósito).
- Push, deploy e edição do Nginx na VPS sem aprovação do Peter.
