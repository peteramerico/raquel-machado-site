# Palestras (sala de parto) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Servir a apresentação "sala de parto" como estático e criar a seção pública Palestras (`/palestras` e `/palestras/:slug`) com a apresentação embutida.

**Architecture:** Arquivos do zip copiados sem edição para `frontend/public/apresentacoes/sala-de-parto/`. Dados em `src/content/palestras.ts`; duas páginas da SPA (lista e detalhe genérico por slug) dentro do `RootLayout`; item "Palestras" no header e no rodapé. Nginx (referência no repo, aplicado à mão na VPS) ganha `frame-src 'self'` e um `location ^~ /apresentacoes/` com cabeçalhos próprios.

**Tech Stack:** React 19, React Router 7, Vite, TypeScript, Vitest + Testing Library, CSS Modules, Nginx.

Spec: `docs/superpowers/specs/2026-11-24-palestras-design.md`. Todos os comandos rodam em `C:\Users\peter\projects\raquel-machado-site\frontend` (bash), salvo indicação.

---

### Task 1: Arquivos estáticos da apresentação

**Files:**
- Create: `frontend/public/apresentacoes/sala-de-parto/**` (cópia intacta de `sala-de-parto/` do zip)

- [ ] **Step 1: Copiar a pasta**

```bash
SRC="C:/Users/peter/AppData/Local/Temp/claude/eca67b16c9cbc19c/e4fa9dc9-bbe9-4997-a3cd-e98e740f51ac/scratchpad/zip-sala/sala-de-parto"
mkdir -p public/apresentacoes && cp -r "$SRC" public/apresentacoes/sala-de-parto
ls public/apresentacoes/sala-de-parto
```
Expected: `assets  deck.css  fonts  index.html  init.js  reveal`

- [ ] **Step 2: Conferir que as licenças vieram**

```bash
ls public/apresentacoes/sala-de-parto/reveal/LICENSE public/apresentacoes/sala-de-parto/fonts/LICENSE-*.txt
```
Expected: 3 arquivos listados.

- [ ] **Step 3: Commit**

```bash
git add public/apresentacoes && git commit -m "feat(frontend): arquivos estaticos da apresentacao sala de parto (reveal.js, sem edicao)"
```

### Task 2: Dados e hook de título

**Files:**
- Create: `frontend/src/content/palestras.ts`
- Create: `frontend/src/lib/useTitulo.ts`
- Test: `frontend/src/lib/useTitulo.test.tsx`

- [ ] **Step 1: Teste do hook (falha)**

`src/lib/useTitulo.test.tsx`:
```tsx
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useTitulo } from './useTitulo'

describe('useTitulo', () => {
  it('define o título da aba e restaura o anterior ao sair', () => {
    document.title = 'Original'
    const { unmount } = renderHook(() => useTitulo('Palestras · Dra. Raquel Machado'))
    expect(document.title).toBe('Palestras · Dra. Raquel Machado')
    unmount()
    expect(document.title).toBe('Original')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/useTitulo.test.tsx`
Expected: FAIL (módulo `./useTitulo` não existe).

- [ ] **Step 3: Implementar o hook**

`src/lib/useTitulo.ts`:
```ts
import { useEffect } from 'react'

// Título da aba para páginas públicas indexáveis (a useNoIndex faz o mesmo, mas também põe `noindex`).
export function useTitulo(titulo: string) {
  useEffect(() => {
    const anterior = document.title
    document.title = titulo
    return () => {
      document.title = anterior
    }
  }, [titulo])
}
```

- [ ] **Step 4: Dados das palestras**

`src/content/palestras.ts`:
```ts
export type Palestra = {
  slug: string
  titulo: string
  subtitulo: string
  resumo: string
  temas: readonly string[]
  /** URL do arquivo estático da apresentação (fora da SPA). */
  caminho: string
  /** Título acessível do iframe. */
  tituloIframe: string
}

export const PALESTRAS: readonly Palestra[] = [
  {
    slug: 'sala-de-parto',
    titulo: 'Aspectos da sala de parto no follow-up do recém-nascido prematuro',
    subtitulo: 'Novembro Roxo · Dra. Raquel Machado, pediatra e neonatologista',
    resumo:
      'Palestra para profissionais de saúde. Percorre aspectos da reanimação do recém-nascido prematuro na sala de parto e o que cada um pode significar no seguimento no consultório. Baseada nas diretrizes PRN-SBP 2026 (Sociedade Brasileira de Pediatria). É material educativo: não substitui a avaliação individual de cada criança.',
    temas: [
      'Clampeamento do cordão',
      'Normotermia',
      'CPAP precoce e intubação',
      'Aspiração de vias aéreas',
      'Oxigênio: a dose e o alvo',
      'Um caso, dois relatos de reanimação',
    ],
    caminho: '/apresentacoes/sala-de-parto/',
    tituloIframe: 'Apresentação: aspectos da sala de parto no follow-up do RNPT',
  },
]

export function buscarPalestra(slug: string | undefined): Palestra | undefined {
  return PALESTRAS.find((p) => p.slug === slug)
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/useTitulo.test.tsx`
Expected: PASS (1 teste).

- [ ] **Step 6: Commit**

```bash
git add src/lib/useTitulo.ts src/lib/useTitulo.test.tsx src/content/palestras.ts
git commit -m "feat(frontend): dados das palestras e hook useTitulo"
```

### Task 3: Páginas e rotas

**Files:**
- Create: `frontend/src/pages/Palestras.tsx`, `Palestras.module.css`, `Palestra.tsx`, `Palestra.module.css`
- Modify: `frontend/src/routes.tsx`
- Test: `frontend/src/routes.test.tsx` (novo `describe('palestras')` antes de `describe('áreas restritas')`)

- [ ] **Step 1: Testes das rotas (falham)**

Em `src/routes.test.tsx`, inserir antes de `describe('áreas restritas', ...)`:
```tsx
describe('palestras', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('/palestras lista a palestra, com header e footer, sem consultar a sessão', () => {
    const { fn } = mockFetch({})
    abrir('/palestras')
    expect(temHeader()).toBe(true)
    expect(temFooter()).toBe(true)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Palestras')
    expect(screen.getByRole('link', { name: /sala de parto/i })).toHaveAttribute('href', '/palestras/sala-de-parto')
    expect(document.title).toBe('Palestras · Dra. Raquel Machado')
    expect(fn).not.toHaveBeenCalled()
  })

  it('/palestras/sala-de-parto embute a apresentação e oferece tela cheia em nova aba', () => {
    const { fn } = mockFetch({})
    abrir('/palestras/sala-de-parto')
    expect(temHeader()).toBe(true)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/sala de parto no follow-up/)
    expect(screen.getByTitle('Apresentação: aspectos da sala de parto no follow-up do RNPT')).toHaveAttribute(
      'src',
      '/apresentacoes/sala-de-parto/',
    )
    const botao = screen.getByRole('link', { name: 'Abrir em tela cheia' })
    expect(botao).toHaveAttribute('href', '/apresentacoes/sala-de-parto/')
    expect(botao).toHaveAttribute('target', '_blank')
    expect(botao.getAttribute('rel')).toContain('noopener')
    expect(screen.getByText(/Tecla F: tela cheia/)).toBeInTheDocument()
    expect(document.title).toMatch(/sala de parto/i)
    expect(fn).not.toHaveBeenCalled()
  })

  it('palestra desconhecida redireciona para /palestras', () => {
    mockFetch({})
    const router = abrir('/palestras/nao-existe')
    expect(router.state.location.pathname).toBe('/palestras')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/routes.test.tsx -t palestras`
Expected: FAIL (`/palestras` cai no curinga e vai para `/`).

- [ ] **Step 3: Página da lista**

`src/pages/Palestras.tsx`:
```tsx
import { Link } from 'react-router-dom'
import { PALESTRAS } from '../content/palestras'
import { useTitulo } from '../lib/useTitulo'
import styles from './Palestras.module.css'

export default function Palestras() {
  useTitulo('Palestras · Dra. Raquel Machado')
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Conteúdo</p>
        <h1 className={styles.titulo}>Palestras</h1>
        <p className={styles.intro}>Apresentações da Dra. Raquel Machado para profissionais de saúde.</p>
        <ul className={styles.lista}>
          {PALESTRAS.map((p) => (
            <li key={p.slug}>
              <Link to={`/palestras/${p.slug}`} className={styles.cartao}>
                <span className={styles.cartaoSub}>{p.subtitulo}</span>
                <span className={styles.cartaoTitulo}>{p.titulo}</span>
                <span className={styles.cartaoLink}>Ver palestra →</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
```

`src/pages/Palestras.module.css`:
```css
/* Lista de palestras. Identidade do site (rosa · creme · ameixa, Fraunces + Manrope). */

.page {
  font-family: 'Manrope', system-ui, -apple-system, sans-serif;
  color: var(--ink);
  background: var(--cream);
  min-height: 100vh;
}

.page a:focus-visible {
  outline: 2px solid var(--rose-500);
  outline-offset: 3px;
  border-radius: 6px;
}

.inner {
  max-width: 880px;
  margin: 0 auto;
  padding: 140px 24px 96px;
}

.eyebrow {
  margin: 0 0 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--rose-600);
}

.titulo {
  margin: 0 0 12px;
  font-family: 'Fraunces', serif;
  font-size: clamp(36px, 6vw, 56px);
  font-weight: 500;
  letter-spacing: -0.02em;
  line-height: 1.05;
}

.intro {
  margin: 0 0 40px;
  font-size: 17px;
  line-height: 1.6;
  color: var(--ink-soft);
}

.lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 20px;
}

.cartao {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 28px 28px 24px;
  border-radius: 20px;
  background: #fff;
  border: 1px solid var(--rose-200);
  color: inherit;
  text-decoration: none;
  transition: transform 0.3s var(--ease-site), box-shadow 0.3s var(--ease-site);
}

.cartao:hover {
  transform: translateY(-3px);
  box-shadow: 0 14px 34px rgba(43, 20, 36, 0.1);
}

.cartaoSub {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-mute);
}

.cartaoTitulo {
  font-family: 'Fraunces', serif;
  font-size: clamp(22px, 3.4vw, 28px);
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: -0.01em;
}

.cartaoLink {
  margin-top: 4px;
  font-size: 14px;
  font-weight: 700;
  color: var(--rose-600);
}

@media (prefers-reduced-motion: reduce) {
  .cartao { transition: none; }
  .cartao:hover { transform: none; }
}
```

- [ ] **Step 4: Página da palestra**

`src/pages/Palestra.tsx`:
```tsx
import { Link, Navigate, useParams } from 'react-router-dom'
import { buscarPalestra, type Palestra as DadosPalestra } from '../content/palestras'
import { useTitulo } from '../lib/useTitulo'
import styles from './Palestra.module.css'

function Conteudo({ palestra }: { palestra: DadosPalestra }) {
  useTitulo(`${palestra.titulo} · Dra. Raquel Machado`)
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <Link to="/palestras" className={styles.voltar}>← Todas as palestras</Link>
        <p className={styles.eyebrow}>Palestra</p>
        <h1 className={styles.titulo}>{palestra.titulo}</h1>
        <p className={styles.subtitulo}>{palestra.subtitulo}</p>

        <div className={styles.palco}>
          <iframe
            src={palestra.caminho}
            title={palestra.tituloIframe}
            allow="fullscreen"
            allowFullScreen
            loading="lazy"
            style={{ width: '100%', height: '100%', border: 0 }}
          />
        </div>

        <div className={styles.acoes}>
          {/* <a> comum, não <Link>: o destino fica fora da SPA */}
          <a href={palestra.caminho} target="_blank" rel="noopener" className={styles.botao}>
            Abrir em tela cheia
          </a>
          <p className={styles.ajuda}>
            Use as setas do teclado, a barra de espaço ou toque para avançar. Tecla F: tela cheia. Esc: visão geral.
          </p>
        </div>

        <section className={styles.sobre} aria-labelledby="sobre-palestra">
          <h2 id="sobre-palestra" className={styles.sobreTitulo}>Sobre a palestra</h2>
          <p className={styles.resumo}>{palestra.resumo}</p>
          <h3 className={styles.temasTitulo}>Temas</h3>
          <ul className={styles.temas}>
            {palestra.temas.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}

export default function Palestra() {
  const { slug } = useParams()
  const palestra = buscarPalestra(slug)
  if (!palestra) return <Navigate to="/palestras" replace />
  return <Conteudo palestra={palestra} />
}
```

`src/pages/Palestra.module.css`:
```css
/* Página de uma palestra: apresentação embutida (iframe 16:9) + contexto. */

.page {
  font-family: 'Manrope', system-ui, -apple-system, sans-serif;
  color: var(--ink);
  background: var(--cream);
  min-height: 100vh;
}

.page a:focus-visible {
  outline: 2px solid var(--rose-500);
  outline-offset: 3px;
  border-radius: 6px;
}

.inner {
  max-width: 1040px;
  margin: 0 auto;
  padding: 130px 24px 96px;
}

.voltar {
  display: inline-block;
  margin-bottom: 28px;
  font-size: 14px;
  font-weight: 600;
  color: var(--rose-600);
  text-decoration: none;
}

.voltar:hover { text-decoration: underline; }

.eyebrow {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--rose-600);
}

.titulo {
  margin: 0 0 12px;
  font-family: 'Fraunces', serif;
  font-size: clamp(30px, 5vw, 46px);
  font-weight: 500;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.subtitulo {
  margin: 0 0 32px;
  font-size: 17px;
  color: var(--ink-soft);
}

.palco {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: var(--plum-900);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 18px 48px rgba(43, 20, 36, 0.18);
}

.acoes {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 20px;
}

.botao {
  flex: none;
  padding: 14px 26px;
  border-radius: 999px;
  background: var(--rose-600);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  text-decoration: none;
  transition: background 0.25s var(--ease-site);
}

.botao:hover { background: var(--rose-700); }

.ajuda {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ink-mute);
}

.sobre {
  margin-top: 56px;
  max-width: 720px;
}

.sobreTitulo {
  margin: 0 0 14px;
  font-family: 'Fraunces', serif;
  font-size: 28px;
  font-weight: 500;
}

.resumo {
  margin: 0 0 24px;
  font-size: 17px;
  line-height: 1.7;
  color: var(--ink-soft);
}

.temasTitulo {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--rose-600);
}

.temas {
  margin: 0;
  padding-left: 20px;
  display: grid;
  gap: 6px;
  font-size: 16px;
  line-height: 1.5;
}

/* Celular: o slide de 1920 px fica pequeno demais para ler; o botão de tela cheia vira a ação principal. */
@media (max-width: 700px) {
  .inner { padding: 112px 16px 72px; }
  .acoes { flex-direction: column; align-items: stretch; gap: 14px; }
  .botao { text-align: center; padding: 16px 24px; font-size: 16px; }
  .palco { border-radius: 12px; }
}

@media (prefers-reduced-motion: reduce) {
  .botao { transition: none; }
}
```

- [ ] **Step 5: Registrar as rotas**

Em `src/routes.tsx`: acrescentar os imports (em ordem alfabética, junto aos de `pages/`)
```tsx
import Palestra from './pages/Palestra'
import Palestras from './pages/Palestras'
```
e, dentro de `RootLayout` → `children`, logo depois de `{ path: '/', element: <Home /> },`:
```tsx
          { path: '/palestras', element: <Palestras /> },
          { path: '/palestras/:slug', element: <Palestra /> },
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/routes.test.tsx`
Expected: PASS (todos, incluindo os 3 novos).

- [ ] **Step 7: Commit**

```bash
git add src/pages/Palestras.tsx src/pages/Palestras.module.css src/pages/Palestra.tsx src/pages/Palestra.module.css src/routes.tsx src/routes.test.tsx
git commit -m "feat(frontend): paginas /palestras e /palestras/:slug com a apresentacao embutida"
```

### Task 4: Menu e rodapé

**Files:**
- Modify: `frontend/src/components/SiteHeader.tsx`, `SiteFooter.tsx`
- Test: `frontend/src/components/SiteHeader.test.tsx`

- [ ] **Step 1: Teste (falha)**

Em `SiteHeader.test.tsx`, junto dos outros `it` de links:
```tsx
  it('tem o link Palestras apontando para /palestras', () => {
    montar()
    expect(screen.getByRole('link', { name: 'Palestras' })).toHaveAttribute('href', '/palestras')
  })
```
Run: `npx vitest run src/components/SiteHeader.test.tsx` → FAIL.

- [ ] **Step 2: Header**

Em `SiteHeader.tsx`, entre o `{SECOES.map(...)}` e o `<li>` da "Área da família", inserir:
```tsx
          <li>
            <NavLink
              to="/palestras"
              className={({ isActive }) => `${styles.link} ${isActive ? styles.linkAtivo : ''}`}
              onClick={fechar}
            >
              Palestras
            </NavLink>
          </li>
```

- [ ] **Step 3: Rodapé**

Em `SiteFooter.tsx`, antes de `<Link to="/familia" ...>`:
```tsx
          <Link to="/palestras" className={styles.link}>Palestras</Link>
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/components/SiteHeader.test.tsx src/routes.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SiteHeader.tsx src/components/SiteFooter.tsx src/components/SiteHeader.test.tsx
git commit -m "feat(frontend): item Palestras no menu e no rodape"
```

### Task 5: Sitemap e Nginx (referência)

**Files:**
- Modify: `frontend/public/sitemap.xml`, `nginx.conf`

- [ ] **Step 1: Sitemap**

Acrescentar antes de `</urlset>`:
```xml
  <url>
    <loc>https://raquelmachadoped.com.br/palestras</loc>
    <lastmod>2026-11-24</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://raquelmachadoped.com.br/palestras/sala-de-parto</loc>
    <lastmod>2026-11-24</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.5</priority>
  </url>
```

- [ ] **Step 2: `nginx.conf` — CSP do site**

Em `add_header Content-Security-Policy`, trocar `frame-src https://www.youtube.com https://www.instagram.com;` por `frame-src 'self' https://www.youtube.com https://www.instagram.com;`.

- [ ] **Step 3: `nginx.conf` — bloco das apresentações**

Inserir antes de `# API (container raquel-backend...)`:
```nginx
    # Apresentações estáticas (reveal.js), embutidas em /palestras/* por iframe da mesma origem.
    # add_header em location aninhado apaga os herdados do server: por isso repete todos aqui.
    # noindex: a página indexável é a da SPA (/palestras/...), não o arquivo estático.
    location = /apresentacoes/sala-de-parto { return 301 /apresentacoes/sala-de-parto/; }
    location ^~ /apresentacoes/ {
        root /var/www/raquel-frontend;
        index index.html;
        try_files $uri $uri/ =404;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none';" always;
        add_header X-Robots-Tag "noindex" always;
    }

```

- [ ] **Step 4: Commit**

```bash
git add public/sitemap.xml ../nginx.conf
git commit -m "feat: sitemap das palestras e nginx (frame-src self + location /apresentacoes/) — aplicar na VPS antes do push"
```

### Task 6: Verificação completa

- [ ] **Step 1: Lint, tipos, testes, build**

```bash
npm run lint && npx tsc -b && npm test && npm run build
ls dist/apresentacoes/sala-de-parto/index.html
```
Expected: tudo sem erro; o `ls` lista o arquivo.

- [ ] **Step 2: Servir o build e conferir**

```bash
npx vite preview --port 4173 &
sleep 3
curl -sI http://localhost:4173/apresentacoes/sala-de-parto/ | head -3
curl -s http://localhost:4173/palestras/sala-de-parto | grep -o '<title>[^<]*'
```
Expected: `200` para a apresentação; a SPA responde em `/palestras/sala-de-parto`.

- [ ] **Step 3: Conferir no navegador** (Chrome): `/apresentacoes/sala-de-parto/` (15 slides avançam, relógio do slide 5 gira, pergunta do slide 3 aparece no clique) e `/palestras/sala-de-parto` (iframe carrega no `vite preview`, que não aplica os cabeçalhos do Nginx).

- [ ] **Step 4: Encerrar o preview e relatar** — sem push e sem deploy; listar arquivos alterados, mudanças de Nginx e passos de deploy.
