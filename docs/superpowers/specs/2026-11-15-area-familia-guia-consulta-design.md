# Área da família — "Guia da consulta" (sem login) — Design

Data: 2026-11-15 · Repo: `raquel-machado-site` · Branch: `feat/area-familia-guia`

## Objetivo

Publicar em `raquelmachadoped.com.br/familia` a primeira página da "Área da família": o guia de orientações da consulta com a Dra. Raquel. **Sem login por enquanto.** Depois da remodelagem do site (padrão Primeiro Colo), esse mesmo material passa a ser servido pela API, atrás de login (família / médico / administrador).

## Fora de escopo (fases seguintes, já decididas)

1. Remodelagem no padrão Primeiro Colo (Docker + seed/migrar, `createBrowserRouter`, testes) e **remoção do blog**.
2. Login com três papéis; conteúdo servido pela API.
3. Itens "Área médica" e "Administrador" no menu (só entram quando existirem; nada de link morto).

## Fonte do conteúdo

Texto colado pelo Peter em 2026-11-15 (fonte de verdade). O PDF `Consulta da dra. Raquel ORIENTAÇÕES` é só referência: tem texto mais antigo (página do WhatsApp duplicada, sem pré-natal/prematuro/"o que trazer"/valor, calendário de 5 faixas). **Identidade visual: a do site, não a do PDF.**

## Identidade visual (do site, não inventar outra)

- Fontes self-hosted (`/fonts/fonts.css`): **Fraunces** (títulos; 400–600, itálico só 400) e **Manrope** (texto; 400–700). Nada de peso fora dessas faixas.
- Tokens do `Home.module.css`: `--rose-50…700`, `--plum-900`, `--cream #fff8f3`, `--ink`, `--ink-soft`, `--ink-mute`, `--gold`. Hoje estão escopados em `.page` dentro de `Home.module.css`; passam a existir também em `src/styles/tokens.css` (`:root`) para o header/footer/página nova. O `.page` da Home não é mexido.
- Linguagem: creme como "papel", rosa como acento, ameixa no texto forte, cantos arredondados, botão em gradiente rosa, glow sutil, mesmas animações curtas (`cubic-bezier(0.2,0.8,0.2,1)`). Respeitar `prefers-reduced-motion`.
- Direção editorial de "guia/caderneta": capítulos numerados em Fraunces, fotos dela em moldura redonda (motivo do folheto, na paleta do site), sem textura nova nem cores novas.

## Estrutura da página `/familia`

Mobile-first (a família abre pelo celular, via WhatsApp). Capítulos em ordem:

0. **Abertura** — eyebrow "Área da família", H1 "Guia da consulta com a Dra. Raquel", subtítulo "Pediatra e neonatologista", texto "Que bom ter vocês aqui!…", foto redonda, chips de atalho para os capítulos.
1. **Como funciona a consulta de puericultura** — ~1 h; examina, avalia crescimento e desenvolvimento; conversa sobre alimentação, sono, vacinas e dúvidas; combina próximos passos. Cada visita do calendário é uma nova consulta com avaliação global.
2. **Quando eu indico um retorno** — dois cartões lado a lado (empilham no mobile): *Consulta de puericultura* (intervalos planejados, olha a criança como um todo) × *Retorno* (reavaliação focada no motivo; combinado com a família; em geral até 15 dias; sem nova cobrança quando dá continuidade à consulta anterior).
3. **Calendário de acompanhamento** — linha do tempo vertical com as 6 faixas (RN 7–10 dias; até 6 m mensal; 6 m–1 a a cada 2 m; 1 a–1 a e meio a cada 3 m; 1 a e meio–5 a a cada 6 m; 5–18 a anual). Referência SBP citada. Nota destacada do **bebê prematuro**.
4. **Consulta pré-natal pediátrica** — a partir da 28ª semana; tema (amamentação, primeiros dias, triagens); trazer caderneta da gestante e exames do pré-natal.
5. **O que trazer** — checklist de 5 itens: Caderneta da Criança (vacinas); exames e relatórios recentes; lista de medicamentos e suplementos; resumo da maternidade/internação (1ª consulta pós-alta); dúvidas anotadas.
6. **WhatsApp entre as consultas** — cortesia para famílias em acompanhamento regular; dúvidas pontuais sobre o combinado; leitura no fim da tarde em dias úteis; fim de semana respondido na segunda. **Urgência → pronto atendimento** em faixa de destaque (cor de alerta dentro da paleta rosa).
7. **Valor** — "R$ 400,00 por consulta" (constante única).
8. **Assinatura** — "Dra. Raquel Machado · Pediatra e neonatologista". Sem botão de agendar (guia é para quem já está em acompanhamento).

Texto: usar o do Peter **sem reescrever**; só dividir em parágrafos/listas. Qualquer alteração de redação passa por ele.

## Arquitetura

```
frontend/src/
  content/guiaConsulta.ts      # TODO o texto/dados, tipado (capítulos, calendário, checklist, valor)
  pages/Familia.tsx            # só layout: lê guiaConsulta e renderiza
  pages/Familia.module.css
  components/SiteHeader.tsx    # header compartilhado (+ .module.css)
  components/SiteFooter.tsx    # rodapé compartilhado (+ .module.css)
  styles/tokens.css            # :root com os tokens do site
```

- **Conteúdo separado do layout** é o ponto-chave: na fase do login, `guiaConsulta` sai do bundle e vem de `GET /api/familia/guia` (o bundle estático é público; esconder rota no React não protege conteúdo). A página passa a receber o objeto por fetch em vez de import — mesma estrutura de dados.
- **SiteHeader** (substitui o `<nav>` embutido da Home): marca "Dra. Raquel Machado / Pediatra · Neonatologista"; links *Sobre, Especialidades, Depoimentos, Contato* (na Home são âncoras; nas outras páginas viram `/#sobre` etc.); **Área da família** (`NavLink` com estado ativo); CTA "Agendar Consulta" com o dropdown das duas clínicas (movido da Home sem mudar). Abaixo de 900 px: botão hambúrguer (hoje o menu simplesmente some no mobile) com painel contendo os links e as duas clínicas. Fecha ao navegar e ao clicar fora/Esc; `aria-expanded`.
- **SiteFooter** (substitui o `<footer>` embutido da Home): mesmo conteúdo; acrescenta "Área da família" aos links.
- **Home**: troca nav/footer inline pelos componentes; **visual idêntico** (verificado por captura antes/depois). Estados de scroll/dropdown saem da Home e vão para o header. CSS morto da Home só é removido se comprovadamente sem uso.
- **Rota**: `<Route path="/familia" element={<Familia />} />` em `App.tsx`.
- **Não indexar**: `<meta name="robots" content="noindex">` na página (React 19 eleva a tag para o `<head>`); fora do `sitemap.xml`. **Sem `Disallow` no robots.txt** (bloquearia a leitura do `noindex` e anunciaria a URL).
- **Analytics**: Umami já roda no `index.html`; a página é rastreada como as demais (sem dado pessoal).
- **Privacidade**: página não coleta dados; a política atual continua verdadeira.
- **Sem backend, sem nginx, sem CSP novo**: só estático, fotos do próprio site (`img-src 'self'`).

## Valor da consulta — fonte única (decisão do Peter, 2026-11-16)

Quando existir a área médica, o valor da consulta será **alterado lá e refletido no site inteiro**. Por isso o preço nunca fica escrito em texto de página:

- `src/lib/valorConsulta.ts` é o único lugar que conhece o número: `VALOR_CONSULTA_PADRAO = 400`, `formatarBRL()` e o hook `useValorConsulta()`. Toda tela que mostra preço chama o hook (hoje só `/familia`).
- Hoje o hook devolve a constante. Na fase do login/área médica ele passa a buscar `GET /api/config/publica` (valor guardado numa tabela `configuracoes`, chave `valor_consulta`, editável na área médica — mesmo padrão do Primeiro Colo), caindo na constante se a API falhar. **Nenhuma página muda** nessa troca.
- Um teste-guarda varre `src/` e falha se aparecer `R$ 400` / `400,00` escrito fora de `valorConsulta.ts`, para ninguém reintroduzir o preço fixo.

## Direção de design (frontend-design)

Conceito: **caderneta de acompanhamento** — um guia editorial que a família abre no celular e quer ler com calma. Tudo dentro da identidade do site; a ousadia vem de composição e detalhe, não de cor nova.

- **Abertura:** fundo do hero do site (gradientes radiais rosa/ouro sobre creme); H1 grande em Fraunces com "consulta" em itálico rosa; foto dela em moldura redonda com anel tracejado que gira devagar e mancha rosa deslocada atrás.
- **Capítulos numerados:** algarismos enormes em Fraunces (rosa-200) atrás do título; faixas alternadas creme / branco translúcido para dar ritmo de leitura.
- **Retorno:** cartão claro (puericultura) × cartão em gradiente rosa-600→700 com texto branco (retorno).
- **Calendário:** linha do tempo vertical com pontos; cada faixa de idade com a frequência em pílula; nota do prematuro num cartão com filete dourado.
- **Pré-natal:** "28ª" gigante em itálico como elemento gráfico.
- **O que trazer:** grade de cartões com marca de check.
- **Urgência:** faixa ameixa-900 de alto contraste, a coisa mais forte da página de propósito.
- **Valor:** cartão em formato de "ticket" com entalhes laterais e o preço em Fraunces grande.
- **Movimento:** entrada escalonada do hero (CSS) e revelação ao rolar (IntersectionObserver) nos blocos; `prefers-reduced-motion` desliga tudo.

## Acessibilidade e qualidade

- Um único `<h1>`; capítulos como `<section aria-labelledby>`; calendário como lista ordenada (ou tabela semântica), não `div` solta.
- Foco visível, alvos ≥ 44 px, contraste AA do texto sobre creme/rosa, `prefers-reduced-motion`.
- Âncoras dos chips com `scroll-margin-top` para não ficarem sob o header fixo.
- Sem overflow horizontal em 360 px.

## Testes

Adicionar Vitest + Testing Library + jsdom no frontend (mesma config do Primeiro Colo; o repo da Raquel hoje não tem testes).

- `guiaConsulta`: calendário com 6 faixas na ordem certa; valor 400; todos os capítulos presentes.
- `Familia`: um `h1`; todos os capítulos renderizam; urgência e valor aparecem; `noindex` presente.
- `SiteHeader`: link "Área da família" aponta para `/familia`; hambúrguer abre/fecha, fecha ao navegar e com Esc; dropdown das clínicas mantém os dois links de WhatsApp.
- Verificação visual no Chrome (desktop + 360 px) de `/familia` e comparação antes/depois da Home.

## Entrega

Branch `feat/area-familia-guia` → revisão → merge no `master` → deploy automático (GitHub Actions) → confirmar com `gh run view` e abrir `/familia` em produção. Apagar a branch. Registrar no vault (`project_raquel_site`, daily, decisions).

## Riscos e decisões em aberto

- **Valor (R$ 400) público** até existir login — aceito pelo Peter ao seguir; página `noindex` e fora do sitemap mitiga indexação, não acesso por link. O valor vem da fonte única acima.
- **Cartões de "Retorno":** condensam, em frases literais do texto original, o parágrafo sobre retorno (nenhuma informação nova; o parágrafo introdutório é mantido na íntegra).
- A refatoração Header/Footer toca a Home (única parte com risco de regressão visual) — mitigada pela comparação de capturas.
- Ordem dos capítulos 4 e 5 (pré-natal antes de "o que trazer") segue o texto original; se o Peter preferir "o que trazer" mais perto do topo, é troca de posição no array de dados.
