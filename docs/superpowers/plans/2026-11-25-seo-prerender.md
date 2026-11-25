# SEO técnico: metadados, JSON-LD e pré-renderização — Plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: usar superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa a tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** cada página pública sai do build como HTML estático completo (corpo + `<head>` com título, descrição, canonical, Open Graph e JSON-LD), sem quebrar a palestra nem as áreas com login.

**Arquitetura:** um mapa único de rotas SEO (`src/seo/`) alimenta (a) a montagem do `<head>`, (b) o sitemap e (c) os testes. Um entry de servidor (`src/entry-server.tsx`) renderiza as rotas públicas com `createStaticHandler` + `renderToString`. Um script Node (`scripts/prerender.mjs`) injeta head + corpo na shell `dist/index.html` e grava um HTML por rota. O cliente hidrata (`hydrateRoot`) quando o `#root` vem preenchido. O Nginx serve o HTML pré-renderizado e cai na shell para o resto.

**Stack:** Vite 8, React 19, React Router 7.14 (`react-router-dom`), Vitest, Node 22. Spec: `docs/superpowers/specs/2026-11-25-seo-prerender-design.md`.

**Diretório de trabalho:** `C:\Users\peter\projects\raquel-machado-site\frontend` (comandos npm); repo na raiz. Branch: `feat/seo-prerender`.

**Ajustes feitos pelo plano em relação à spec (verificados no código):**
- `useRevelar` só é usado em `Familia.tsx` (área com login, não pré-renderizada): **não será alterado**.
- Sitemap gerado só com `<loc>` (sem `lastmod`/`changefreq`/`priority`: um `lastmod` que muda a cada build é tratado pelo Google como não confiável).
- A página da palestra ganha `tituloCurto` e `descricao` em `content/palestras.ts` (título completo tem 86 caracteres; a descrição do resumo tem 330).

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `frontend/scripts/verificar-site.mjs` | criar | Checagens HTTP de baseline/regressão (palestra, rotas, cabeçalhos). Roda contra produção, porta de teste ou local |
| `frontend/src/content/palestras.ts` | editar | Campos `tituloCurto` e `descricao` |
| `frontend/src/pages/Palestra.tsx` | editar | Título da aba usa `tituloCurto` |
| `frontend/src/seo/rotas.ts` | criar | Mapa de rotas públicas: caminho, arquivo, título, descrição, canonical, JSON-LD |
| `frontend/src/seo/jsonld.ts` | criar | Construtores de JSON-LD (Physician + clínicas, BreadcrumbList) |
| `frontend/src/seo/head.ts` | criar | `montarHead` e `injetarHtml` (puros) |
| `frontend/src/seo/sitemap.ts` | criar | `gerarSitemap` |
| `frontend/src/seo/*.test.ts` | criar | Testes unitários |
| `frontend/src/entry-server.tsx` | criar | `renderizar(caminho)` + reexports usados pelo script |
| `frontend/src/entry-server.test.tsx` | criar | Teste de renderização no servidor de cada rota do mapa |
| `frontend/src/main.tsx` | editar | `hydrateRoot` quando `#root` já vem preenchido |
| `frontend/scripts/prerender.mjs` | criar | Gera os HTMLs e o `sitemap.xml` em `dist/` |
| `frontend/package.json` | editar | `build` encadeia SSR build + prerender |
| `frontend/eslint.config.js`, `.gitignore` | editar | Ignorar `dist-server` |
| `frontend/public/sitemap.xml` | remover | Passa a ser gerado no build |
| `nginx.conf` (raiz) | editar | `location = /` e `try_files` novo (referência; aplicado à mão na VPS) |

---

### Tarefa 0: Baseline do comportamento atual (antes de qualquer mudança)

**Arquivos:** criar `frontend/scripts/verificar-site.mjs`

- [ ] **Passo 1: Criar o script de verificação**

```js
// Uso: node scripts/verificar-site.mjs <baseUrl> [--prerender]
// Checagens HTTP da palestra e das rotas do site. Sem --prerender, exige só o comportamento atual (SPA).
// Com --prerender, exige também HTML estático (canonical, og:title, ld+json, h1) nas rotas públicas.
const base = (process.argv[2] ?? '').replace(/\/$/, '')
const prerender = process.argv.includes('--prerender')
if (!base) {
  console.error('uso: node scripts/verificar-site.mjs <baseUrl> [--prerender]')
  process.exit(2)
}

let falhas = 0
const ok = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FALHA'} ${msg}`)
  if (!cond) falhas++
}
const get = (caminho, opcoes = {}) => fetch(base + caminho, { redirect: 'manual', ...opcoes })

// 1. Apresentação estática (iframe da palestra)
{
  const r = await get('/apresentacoes/sala-de-parto/')
  const html = await r.text()
  ok(r.status === 200, '/apresentacoes/sala-de-parto/ = 200')
  ok(html.includes('reveal'), 'apresentação contém reveal.js')
  ok(r.headers.get('x-frame-options') === 'SAMEORIGIN', 'apresentação: X-Frame-Options SAMEORIGIN')
  ok((r.headers.get('content-security-policy') ?? '').includes("frame-ancestors 'self'"), "apresentação: CSP frame-ancestors 'self'")
  ok(r.headers.get('x-robots-tag') === 'noindex', 'apresentação: X-Robots-Tag noindex')
  ok(!!r.headers.get('strict-transport-security'), 'apresentação: HSTS presente')
  ok(r.headers.get('x-content-type-options') === 'nosniff', 'apresentação: nosniff')
  ok(!!r.headers.get('referrer-policy'), 'apresentação: Referrer-Policy presente')
  ok(!!r.headers.get('permissions-policy'), 'apresentação: Permissions-Policy presente')
}
{
  const r = await get('/apresentacoes/sala-de-parto')
  ok(r.status === 301 && (r.headers.get('location') ?? '').endsWith('/apresentacoes/sala-de-parto/'), 'sem barra final = 301 para a versão com barra')
}
{
  const r = await get('/apresentacoes/sala-de-parto/fonts/jost-latin-400-normal.woff2')
  ok(r.status === 200, 'fonte da apresentação = 200')
}

// 2. Páginas públicas
const publicas = [
  ['/', 'Cuidado especializado'],
  ['/palestras', null],
  ['/palestras/sala-de-parto', null],
  ['/links', null],
  ['/privacidade', 'Política de Privacidade'],
]
for (const [caminho] of publicas) {
  const r = await get(caminho)
  const html = await r.text()
  ok(r.status === 200, `${caminho} = 200`)
  ok(html.includes('<div id="root">'), `${caminho} tem #root`)
  ok(/<script type="module"[^>]*src="\/assets\//.test(html), `${caminho} carrega o bundle`)
  ok(!!r.headers.get('content-security-policy'), `${caminho} tem CSP`)
  if (prerender) {
    ok(html.includes('<link rel="canonical"'), `${caminho} tem canonical`)
    ok(html.includes('property="og:title"'), `${caminho} tem og:title`)
    ok(html.includes('<h1'), `${caminho} tem <h1> no HTML estático`)
    ok(/<title>[^<]{10,}<\/title>/.test(html), `${caminho} tem <title>`)
    if (caminho === '/') ok(html.includes('application/ld+json') && html.includes('Physician'), '/ tem JSON-LD Physician')
    if (caminho === '/palestras/sala-de-parto') ok(html.includes('/apresentacoes/sala-de-parto/'), 'palestra: iframe no HTML estático')
  }
}

// 3. Rotas com login e desconhecidas: continuam a shell SPA (sem conteúdo estático)
for (const caminho of ['/familia', '/familia/entrar', '/painel', '/admin', '/xyz-inexistente']) {
  const r = await get(caminho)
  const html = await r.text()
  ok(r.status === 200, `${caminho} = 200 (shell SPA)`)
  ok(html.includes('<div id="root"></div>'), `${caminho} usa a shell vazia`)
}

// 4. Barra final não pode virar 403/404
{
  const r = await get('/palestras/')
  ok(r.status === 200, '/palestras/ = 200')
}

// 5. Redirecionamentos existentes
{
  const r = await get('/blog')
  ok(r.status === 301 && (r.headers.get('location') ?? '').endsWith('/'), '/blog = 301 para /')
}

// 6. Sitemap
{
  const r = await get('/sitemap.xml')
  const xml = await r.text()
  ok(r.status === 200 && xml.includes('/palestras/sala-de-parto'), 'sitemap.xml lista a palestra')
}

console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)
```

- [ ] **Passo 2: Rodar contra produção e guardar o resultado como baseline**

Run: `node scripts/verificar-site.mjs https://raquelmachadoped.com.br`
Expected: todas as linhas `OK`, "Tudo certo." Guardar a saída (colar no registro da sessão). Se algo falhar ANTES de qualquer mudança, ajustar a checagem para refletir o comportamento real de hoje (não o contrário) e registrar a diferença.

- [ ] **Passo 3: Commit**

```bash
git add frontend/scripts/verificar-site.mjs
git commit -m "test: script de verificacao HTTP do site (baseline da palestra e das rotas)"
```

---

### Tarefa 1: Campos SEO da palestra

**Arquivos:** editar `frontend/src/content/palestras.ts`, `frontend/src/pages/Palestra.tsx`

- [ ] **Passo 1:** em `palestras.ts`, adicionar ao tipo `Palestra` (depois de `titulo`):

```ts
  /** Versão curta do título (≤ 45 caracteres) para <title> e compartilhamento. */
  tituloCurto: string
  /** Descrição para buscadores e prévia de link (≤ 160 caracteres). */
  descricao: string
```

e na palestra `sala-de-parto`, depois da linha `titulo:`:

```ts
    tituloCurto: 'Sala de parto no follow-up do prematuro',
    descricao:
      'Palestra da Dra. Raquel Machado para profissionais de saúde: clampeamento do cordão, normotermia, CPAP, aspiração e oxigênio no recém-nascido prematuro.',
```

- [ ] **Passo 2:** em `Palestra.tsx`, trocar `useTitulo(\`${palestra.titulo} · Dra. Raquel Machado\`)` por `useTitulo(\`${palestra.tituloCurto} · Dra. Raquel Machado\`)`.

- [ ] **Passo 3:** `npx vitest run` — esperado: 123 passam (o teste da palestra só exige `/sala de parto/i` no título).

- [ ] **Passo 4:** Commit `feat(palestras): titulo curto e descricao para SEO`.

---

### Tarefa 2: Mapa de rotas + JSON-LD (TDD)

**Arquivos:** criar `frontend/src/seo/jsonld.ts`, `frontend/src/seo/rotas.ts`, `frontend/src/seo/rotas.test.ts`

- [ ] **Passo 1: Escrever o teste (vai falhar)** — `rotas.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { PALESTRAS } from '../content/palestras'
import { ROTAS_SEO, SITE_URL, arquivoDe, buscarSeo } from './rotas'

describe('mapa de rotas SEO', () => {
  it('cobre as rotas públicas e as palestras do conteúdo', () => {
    const caminhos = ROTAS_SEO.map((r) => r.caminho)
    expect(caminhos).toEqual(
      expect.arrayContaining(['/', '/palestras', '/links', '/privacidade', ...PALESTRAS.map((p) => `/palestras/${p.slug}`)]),
    )
  })

  it('nunca inclui áreas com login', () => {
    for (const r of ROTAS_SEO) expect(r.caminho).not.toMatch(/^\/(familia|painel|admin|conta)/)
  })

  it('título ≤ 70, descrição entre 50 e 160, únicos', () => {
    for (const r of ROTAS_SEO) {
      expect(r.titulo.length, r.caminho).toBeLessThanOrEqual(70)
      expect(r.descricao.length, r.caminho).toBeGreaterThanOrEqual(50)
      expect(r.descricao.length, r.caminho).toBeLessThanOrEqual(160)
    }
    expect(new Set(ROTAS_SEO.map((r) => r.titulo)).size).toBe(ROTAS_SEO.length)
    expect(new Set(ROTAS_SEO.map((r) => r.descricao)).size).toBe(ROTAS_SEO.length)
  })

  it('canonical absoluto no apex (sem www)', () => {
    for (const r of ROTAS_SEO) {
      expect(r.canonical.startsWith(`${SITE_URL}/`) || r.canonical === SITE_URL + '/').toBe(true)
      expect(r.canonical).not.toContain('www.')
    }
    expect(buscarSeo('/')?.canonical).toBe(`${SITE_URL}/`)
    expect(buscarSeo('/palestras/sala-de-parto')?.canonical).toBe(`${SITE_URL}/palestras/sala-de-parto`)
  })

  it('arquivo de saída: / vira inicio.html e os demais seguem o caminho', () => {
    expect(arquivoDe('/')).toBe('inicio.html')
    expect(arquivoDe('/palestras')).toBe('palestras.html')
    expect(arquivoDe('/palestras/sala-de-parto')).toBe('palestras/sala-de-parto.html')
    expect(new Set(ROTAS_SEO.map((r) => r.arquivo)).size).toBe(ROTAS_SEO.length)
  })
})

describe('JSON-LD', () => {
  const home = buscarSeo('/')!
  const grafo = home.jsonLd[0] as { '@context': string; '@graph': Array<Record<string, unknown>> }

  it('home: Physician com CRM-RN 9383 e duas clínicas', () => {
    expect(grafo['@context']).toBe('https://schema.org')
    const tipos = grafo['@graph'].map((n) => n['@type'])
    expect(tipos).toEqual(['Physician', 'MedicalClinic', 'MedicalClinic'])
    const medica = grafo['@graph'][0] as { identifier: { propertyID: string; value: string } }
    expect(medica.identifier).toMatchObject({ propertyID: 'CRM-RN', value: '9383' })
  })

  it('home: clínicas com endereço e telefone dos WhatsApps do site', () => {
    const clinicas = grafo['@graph'].slice(1) as Array<{ name: string; telephone: string; address: { addressLocality: string } }>
    expect(clinicas.map((c) => c.name)).toEqual(['Clínica Cativa', 'Fábrica do Amanhã'])
    expect(clinicas.map((c) => c.telephone)).toEqual(['+5584996770404', '+5584992215656'])
    for (const c of clinicas) expect(c.address.addressLocality).toBe('Natal')
  })

  it('nenhuma rota usa avaliações escritas pelo próprio site', () => {
    const tudo = JSON.stringify(ROTAS_SEO.map((r) => r.jsonLd))
    expect(tudo).not.toMatch(/aggregateRating|"Review"/)
  })

  it('palestras: BreadcrumbList com posições 1..n e URLs absolutas', () => {
    const pagina = buscarSeo('/palestras/sala-de-parto')!
    const lista = pagina.jsonLd[0] as { '@type': string; itemListElement: Array<{ position: number; item: string }> }
    expect(lista['@type']).toBe('BreadcrumbList')
    expect(lista.itemListElement.map((i) => i.position)).toEqual([1, 2, 3])
    for (const i of lista.itemListElement) expect(i.item.startsWith(SITE_URL)).toBe(true)
  })
})
```

- [ ] **Passo 2:** `npx vitest run src/seo/rotas.test.ts` — esperado: FALHA (módulo não existe).

- [ ] **Passo 3: Implementar `jsonld.ts`**

```ts
import { CLINICAS, INSTAGRAM } from '../content/contatos'

export const SITE_URL = 'https://raquelmachadoped.com.br'

// Telefone no formato E.164, tirado dos links wa.me do site (content/contatos.ts).
const telefoneDe = (wa: string) => `+${wa.replace('https://wa.me/', '')}`

const ENDERECOS = {
  'Clínica Cativa': { streetAddress: 'Tyrol Business Center, Sala 514' },
  'Fábrica do Amanhã': { streetAddress: 'Rua Dr. Horácio, 595, Lagoa Nova' },
} as const

export function jsonLdMedica(): object {
  const clinicas = CLINICAS.map((c) => ({
    '@type': 'MedicalClinic',
    '@id': `${SITE_URL}/#${c.nome === 'Clínica Cativa' ? 'clinica-cativa' : 'fabrica-do-amanha'}`,
    name: c.nome,
    url: `${SITE_URL}/`,
    telephone: telefoneDe(c.whatsapp),
    medicalSpecialty: 'Pediatric',
    address: {
      '@type': 'PostalAddress',
      ...ENDERECOS[c.nome],
      addressLocality: 'Natal',
      addressRegion: 'RN',
      addressCountry: 'BR',
    },
  }))

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Physician',
        '@id': `${SITE_URL}/#medica`,
        name: 'Raquel Machado',
        honorificPrefix: 'Dra.',
        description: 'Pediatra e neonatologista em Natal/RN.',
        url: `${SITE_URL}/`,
        medicalSpecialty: 'Pediatric',
        knowsAbout: ['Pediatria', 'Neonatologia'],
        identifier: { '@type': 'PropertyValue', propertyID: 'CRM-RN', value: '9383' },
        alumniOf: [
          { '@type': 'CollegeOrUniversity', name: 'Universidade Federal do Rio Grande do Norte (UFRN)' },
          { '@type': 'CollegeOrUniversity', name: 'Universidade Estadual de Campinas (Unicamp)' },
        ],
        areaServed: { '@type': 'City', name: 'Natal' },
        sameAs: [INSTAGRAM],
        workLocation: clinicas.map((c) => ({ '@id': c['@id'] })),
      },
      ...clinicas,
    ],
  }
}

export function jsonLdMigalhas(itens: ReadonlyArray<{ nome: string; caminho: string }>): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: itens.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.nome,
      item: `${SITE_URL}${it.caminho}`,
    })),
  }
}
```

- [ ] **Passo 4: Implementar `rotas.ts`**

```ts
import { PALESTRAS } from '../content/palestras'
import { SITE_URL, jsonLdMedica, jsonLdMigalhas } from './jsonld'

export { SITE_URL }
export const SITE_NOME = 'Dra. Raquel Machado'

export type RotaSeo = {
  caminho: string
  /** Arquivo gerado em dist/ (relativo). A home vai para inicio.html para não sobrescrever a shell (index.html). */
  arquivo: string
  titulo: string
  descricao: string
  canonical: string
  /** URL absoluta da imagem Open Graph. Ausente por decisão de 25/11/2026. */
  imagem?: string
  jsonLd: readonly object[]
}

export const arquivoDe = (caminho: string) => (caminho === '/' ? 'inicio.html' : `${caminho.slice(1)}.html`)
const canonicalDe = (caminho: string) => `${SITE_URL}${caminho}`

function rota(r: Omit<RotaSeo, 'arquivo' | 'canonical'>): RotaSeo {
  return { ...r, arquivo: arquivoDe(r.caminho), canonical: canonicalDe(r.caminho) }
}

const migalhasPalestras = [
  { nome: 'Início', caminho: '/' },
  { nome: 'Palestras', caminho: '/palestras' },
]

export const ROTAS_SEO: readonly RotaSeo[] = [
  rota({
    caminho: '/',
    titulo: 'Dra. Raquel Machado · Pediatra & Neonatologista em Natal/RN',
    descricao:
      'Pediatra e neonatologista em Natal/RN, com dupla residência pela Unicamp. Atendimento humanizado para bebês, crianças e famílias.',
    jsonLd: [jsonLdMedica()],
  }),
  rota({
    caminho: '/palestras',
    titulo: `Palestras · ${SITE_NOME}`,
    descricao: 'Apresentações da Dra. Raquel Machado, pediatra e neonatologista, para profissionais de saúde.',
    jsonLd: [jsonLdMigalhas(migalhasPalestras)],
  }),
  ...PALESTRAS.map((p) =>
    rota({
      caminho: `/palestras/${p.slug}`,
      titulo: `${p.tituloCurto} · ${SITE_NOME}`,
      descricao: p.descricao,
      jsonLd: [jsonLdMigalhas([...migalhasPalestras, { nome: p.tituloCurto, caminho: `/palestras/${p.slug}` }])],
    }),
  ),
  rota({
    caminho: '/links',
    titulo: `Links · ${SITE_NOME}`,
    descricao: 'Links da Dra. Raquel Machado: agende uma consulta pelo WhatsApp, veja os endereços das clínicas e o Instagram.',
    jsonLd: [],
  }),
  rota({
    caminho: '/privacidade',
    titulo: `Política de Privacidade · ${SITE_NOME}`,
    descricao: 'Como o site da Dra. Raquel Machado coleta e trata dados pessoais (LGPD).',
    jsonLd: [],
  }),
]

export function buscarSeo(caminho: string): RotaSeo | undefined {
  return ROTAS_SEO.find((r) => r.caminho === caminho)
}
```

- [ ] **Passo 5:** `npx vitest run src/seo/rotas.test.ts` — esperado: PASS. Se a descrição de `/privacidade` ficar abaixo de 50 caracteres, ajustar o texto (não o limite).

- [ ] **Passo 6:** Commit `feat(seo): mapa de rotas e JSON-LD (Physician, clinicas, breadcrumbs)`.

---

### Tarefa 3: Montagem do head e injeção no HTML (TDD)

**Arquivos:** criar `frontend/src/seo/head.ts`, `frontend/src/seo/head.test.ts`

- [ ] **Passo 1: Teste** — `head.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { injetarHtml, montarHead } from './head'
import { buscarSeo, type RotaSeo } from './rotas'

const SHELL = `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8" />
<meta name="description" content="velha" />
<title>velho</title>
<script defer src="https://analytics.exemplo/script.js"></script>
</head><body><div id="root"></div><script type="module" src="/assets/index-x.js"></script></body></html>`

const rota = buscarSeo('/palestras/sala-de-parto')!

describe('montarHead', () => {
  it('inclui canonical, Open Graph e JSON-LD', () => {
    const head = montarHead(rota)
    expect(head).toContain(`<link rel="canonical" href="${rota.canonical}" />`)
    expect(head).toContain('property="og:title"')
    expect(head).toContain('property="og:description"')
    expect(head).toContain(`property="og:url" content="${rota.canonical}"`)
    expect(head).toContain('property="og:locale" content="pt_BR"')
    expect(head).toContain('property="og:site_name"')
    expect(head).toContain('type="application/ld+json"')
  })

  it('não emite og:image enquanto a rota não tem imagem', () => {
    expect(montarHead(rota)).not.toContain('og:image')
  })

  it('emite og:image quando a rota tem imagem', () => {
    expect(montarHead({ ...rota, imagem: 'https://exemplo.com/a.jpg' })).toContain('property="og:image" content="https://exemplo.com/a.jpg"')
  })

  it('escapa aspas e sinais de menor em atributos e no JSON-LD', () => {
    const maliciosa: RotaSeo = { ...rota, descricao: 'a "b" <c> & d', jsonLd: [{ x: '</script><b>' }] }
    const head = montarHead(maliciosa)
    expect(head).toContain('content="a &quot;b&quot; &lt;c&gt; &amp; d"')
    expect(head).not.toContain('</script><b>')
    const blocos = [...head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    expect(JSON.parse(blocos[0][1])).toEqual({ x: '</script><b>' })
  })

  it('cada bloco JSON-LD é um JSON válido', () => {
    const home = montarHead(buscarSeo('/')!)
    const blocos = [...home.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    expect(blocos.length).toBeGreaterThan(0)
    for (const b of blocos) expect(() => JSON.parse(b[1])).not.toThrow()
  })
})

describe('injetarHtml', () => {
  const html = injetarHtml(SHELL, rota, '<main><h1>Oi</h1></main>')

  it('troca título e descrição, sem duplicar', () => {
    expect(html).toContain(`<title>${rota.titulo}</title>`)
    expect(html).not.toContain('velho')
    expect(html.match(/<title>/g)).toHaveLength(1)
    expect(html.match(/name="description"/g)).toHaveLength(1)
  })

  it('coloca o corpo no #root e preserva o restante da shell', () => {
    expect(html).toContain('<div id="root"><main><h1>Oi</h1></main></div>')
    expect(html).toContain('https://analytics.exemplo/script.js')
    expect(html).toContain('src="/assets/index-x.js"')
  })

  it('falha alto se a shell mudou e o padrão não existe mais', () => {
    expect(() => injetarHtml(SHELL.replace('<div id="root"></div>', '<div id="app"></div>'), rota, 'x')).toThrow(/#root/)
    expect(() => injetarHtml(SHELL.replace(/<title>.*<\/title>/, ''), rota, 'x')).toThrow(/title/)
    expect(() => injetarHtml(SHELL.replace(/<meta name="description"[^>]*>/, ''), rota, 'x')).toThrow(/description/)
  })

  it('recusa shell que já tem conteúdo no #root', () => {
    expect(() => injetarHtml(SHELL.replace('<div id="root"></div>', '<div id="root"><p>x</p></div>'), rota, 'y')).toThrow(/#root/)
  })
})
```

- [ ] **Passo 2:** rodar — esperado: FALHA (módulo não existe).

- [ ] **Passo 3: Implementar `head.ts`**

```ts
import { SITE_NOME, type RotaSeo } from './rotas'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// "<" vira "\u003c" no JSON: impede fechar o <script> por dentro (o JSON continua equivalente).
const jsonSeguro = (o: object) => JSON.stringify(o).replace(/</g, '\\u003c')

/** Tags de <head> específicas da rota (sem <title> e sem meta description, que a shell já tem e são substituídos). */
export function montarHead(rota: RotaSeo): string {
  const linhas = [
    `<link rel="canonical" href="${esc(rota.canonical)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="pt_BR" />`,
    `<meta property="og:site_name" content="${esc(SITE_NOME)}" />`,
    `<meta property="og:title" content="${esc(rota.titulo)}" />`,
    `<meta property="og:description" content="${esc(rota.descricao)}" />`,
    `<meta property="og:url" content="${esc(rota.canonical)}" />`,
  ]
  if (rota.imagem) linhas.push(`<meta property="og:image" content="${esc(rota.imagem)}" />`)
  for (const bloco of rota.jsonLd) linhas.push(`<script type="application/ld+json">${jsonSeguro(bloco)}</script>`)
  return linhas.join('\n    ')
}

/** Shell limpa (dist/index.html) + rota + corpo renderizado => HTML completo da página. */
export function injetarHtml(shell: string, rota: RotaSeo, corpo: string): string {
  if (!shell.includes('<div id="root"></div>')) throw new Error('A shell não tem <div id="root"></div> vazio (#root)')
  if (!/<title>[^<]*<\/title>/.test(shell)) throw new Error('A shell não tem <title>')
  if (!/<meta name="description" content="[^"]*"\s*\/?>/.test(shell)) throw new Error('A shell não tem meta description')

  return shell
    .replace(/<title>[^<]*<\/title>/, () => `<title>${esc(rota.titulo)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, () => `<meta name="description" content="${esc(rota.descricao)}" />`)
    .replace('</head>', () => `    ${montarHead(rota)}\n  </head>`)
    .replace('<div id="root"></div>', () => `<div id="root">${corpo}</div>`)
}
```

- [ ] **Passo 4:** `npx vitest run src/seo` — esperado: PASS.
- [ ] **Passo 5:** Commit `feat(seo): montagem do head (canonical, Open Graph, JSON-LD) e injecao no HTML`.

---

### Tarefa 4: Sitemap gerado (TDD)

**Arquivos:** criar `frontend/src/seo/sitemap.ts`, `frontend/src/seo/sitemap.test.ts`

- [ ] **Passo 1: Teste**

```ts
import { describe, expect, it } from 'vitest'
import { ROTAS_SEO } from './rotas'
import { gerarSitemap } from './sitemap'

describe('gerarSitemap', () => {
  const xml = gerarSitemap(ROTAS_SEO)

  it('cabeçalho XML e namespace do sitemap', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
  })

  it('uma <loc> por rota do mapa, com a URL canônica', () => {
    for (const r of ROTAS_SEO) expect(xml).toContain(`<loc>${r.canonical}</loc>`)
    expect(xml.match(/<loc>/g)).toHaveLength(ROTAS_SEO.length)
  })

  it('escapa caracteres especiais', () => {
    const x = gerarSitemap([{ ...ROTAS_SEO[0], canonical: 'https://a.com/?a=1&b=2' }])
    expect(x).toContain('<loc>https://a.com/?a=1&amp;b=2</loc>')
  })
})
```

- [ ] **Passo 2:** rodar — FALHA.
- [ ] **Passo 3: Implementar**

```ts
import type { RotaSeo } from './rotas'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Só <loc>: o Google ignora changefreq/priority e desconfia de lastmod que muda a cada build.
export function gerarSitemap(rotas: readonly RotaSeo[]): string {
  const urls = rotas.map((r) => `  <url>\n    <loc>${esc(r.canonical)}</loc>\n  </url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}
```

- [ ] **Passo 4:** PASS. **Passo 5:** Commit `feat(seo): sitemap gerado a partir do mapa de rotas`.

---

### Tarefa 5: Entry de servidor + teste de renderização (TDD)

**Arquivos:** criar `frontend/src/entry-server.tsx`, `frontend/src/entry-server.test.tsx`

- [ ] **Passo 1: Teste** — `entry-server.test.tsx`:

```tsx
// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { renderizar } from './entry-server'
import { ROTAS_SEO } from './seo/rotas'

describe('renderizar (servidor, sem window/document)', () => {
  it.each(ROTAS_SEO.map((r) => r.caminho))('%s renderiza com <h1>', async (caminho) => {
    const html = await renderizar(caminho)
    expect(html).toContain('<h1')
  })

  it('home traz o conteúdo real', async () => {
    const html = await renderizar('/')
    expect(html).toContain('Cuidado especializado')
    expect(html).toContain('CRM-RN')
  })

  it('palestra traz o iframe da apresentação e os dados do evento', async () => {
    const html = await renderizar('/palestras/sala-de-parto')
    expect(html).toContain('src="/apresentacoes/sala-de-parto/"')
    expect(html).toContain('Mesa redonda')
    expect(html).toContain('25 de novembro de 2026')
  })

  it('não embute o script de hidratação de dados (sem loaders)', async () => {
    expect(await renderizar('/')).not.toContain('__staticRouterHydrationData')
  })
})
```

- [ ] **Passo 2:** rodar — FALHA (módulo não existe).
- [ ] **Passo 3: Implementar `entry-server.tsx`**

```tsx
import { renderToString } from 'react-dom/server'
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from 'react-router-dom'
import { routes } from './routes'
import { SITE_URL } from './seo/rotas'

export { ROTAS_SEO } from './seo/rotas'
export { injetarHtml } from './seo/head'
export { gerarSitemap } from './seo/sitemap'

// Renderiza uma rota pública no servidor (build). Sem loaders/actions, então não há dados para hidratar
// (hydrate={false}: o cliente monta o roteador sozinho e só reaproveita o DOM).
export async function renderizar(caminho: string): Promise<string> {
  const handler = createStaticHandler(routes)
  const contexto = await handler.query(new Request(`${SITE_URL}${caminho}`))
  if (contexto instanceof Response) {
    throw new Error(`Rota ${caminho} respondeu ${contexto.status} em vez de renderizar`)
  }
  const roteador = createStaticRouter(handler.dataRoutes, contexto)
  return renderToString(<StaticRouterProvider router={roteador} context={contexto} hydrate={false} />)
}
```

- [ ] **Passo 4:** `npx vitest run src/entry-server.test.tsx`. Esperado: PASS. Possíveis falhas e correções: (a) erro de `window is not defined` em algum import de nível de módulo → mover o acesso para dentro de função/efeito (registrar qual arquivo); (b) `setupTests` quebra em ambiente node → manter o docblock e, se necessário, mover o teste para um `describe` com `// @vitest-environment jsdom` (o `Request` global do Node continua disponível).
- [ ] **Passo 5:** `npx tsc -b && npx eslint src` — sem erros.
- [ ] **Passo 6:** Commit `feat(seo): entry de servidor que renderiza as rotas publicas`.

---

### Tarefa 6: Hidratação no cliente

**Arquivos:** editar `frontend/src/main.tsx`

- [ ] **Passo 1:** substituir o conteúdo por:

```tsx
import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import './styles/tokens.css'
import App from './App.tsx'

const raiz = document.getElementById('root')!
const app = (
  <StrictMode>
    <App />
  </StrictMode>
)

// Páginas pré-renderizadas vêm com o #root preenchido: o React assume o DOM existente.
// A shell (áreas com login e rotas desconhecidas) vem vazia: renderização normal no cliente.
if (raiz.hasChildNodes()) hydrateRoot(raiz, app)
else createRoot(raiz).render(app)
```

- [ ] **Passo 2:** `npx tsc -b && npx eslint src && npx vitest run` — esperado: tudo verde (123 + novos).
- [ ] **Passo 3:** Commit `feat(seo): hidratacao no cliente quando o HTML vem pre-renderizado`.

---

### Tarefa 7: Script de pré-renderização e build

**Arquivos:** criar `frontend/scripts/prerender.mjs`; editar `frontend/package.json`, `frontend/eslint.config.js`, `.gitignore`; remover `frontend/public/sitemap.xml`

- [ ] **Passo 1: Criar `scripts/prerender.mjs`**

```js
// Gera o HTML estático das rotas públicas a partir da shell limpa (dist/index.html) e do bundle SSR (dist-server).
// Roda no `npm run build` (GitHub Actions e cron da VPS). Só Node; falha alto se algo não bater.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(raiz, 'dist')
const { renderizar, ROTAS_SEO, injetarHtml, gerarSitemap } = await import(
  pathToFileURL(join(raiz, 'dist-server', 'entry-server.js')).href
)

const shell = await readFile(join(dist, 'index.html'), 'utf8')
if (shell.includes('<h1')) throw new Error('dist/index.html já tem conteúdo: a shell precisa estar limpa')

for (const rota of ROTAS_SEO) {
  const corpo = await renderizar(rota.caminho)
  if (!corpo.includes('<h1')) throw new Error(`${rota.caminho}: renderização sem <h1>`)
  const destino = join(dist, rota.arquivo)
  await mkdir(dirname(destino), { recursive: true })
  await writeFile(destino, injetarHtml(shell, rota, corpo))
  console.log(`prerender: ${rota.caminho} -> dist/${rota.arquivo}`)
}

await writeFile(join(dist, 'sitemap.xml'), gerarSitemap(ROTAS_SEO))
console.log(`prerender: sitemap.xml com ${ROTAS_SEO.length} URLs`)
```

- [ ] **Passo 2:** em `package.json`, trocar o script `build` por:

```json
"build": "tsc -b && vite build && vite build --ssr src/entry-server.tsx --outDir dist-server --emptyOutDir && node scripts/prerender.mjs",
```

- [ ] **Passo 3:** ignorar `dist-server`: no `.gitignore` da raiz acrescentar `frontend/dist-server/` ao lado de `frontend/dist/`; em `eslint.config.js` trocar `globalIgnores(['dist'])` por `globalIgnores(['dist', 'dist-server'])`.
- [ ] **Passo 4:** `git rm frontend/public/sitemap.xml` (passa a ser gerado; sem isso o arquivo à mão seria sobrescrito silenciosamente).
- [ ] **Passo 5:** `npm run build`. Esperado: 5 linhas `prerender: ... -> dist/...` e `sitemap.xml com 5 URLs`; `dist/index.html` continua sem `<h1`; `dist/inicio.html`, `dist/palestras.html`, `dist/palestras/sala-de-parto.html`, `dist/links.html`, `dist/privacidade.html` existem. Se o SSR build gerar `entry-server.mjs` em vez de `.js`, ajustar o caminho no script.
- [ ] **Passo 6: Conferências no disco**

```bash
grep -c "<h1" dist/index.html            # 0
grep -o 'rel="canonical" href="[^"]*"' dist/inicio.html dist/palestras/sala-de-parto.html
grep -c 'application/ld+json' dist/inicio.html    # >= 1
grep -o '<iframe[^>]*>' dist/palestras/sala-de-parto.html
ls dist/apresentacoes/sala-de-parto | head -3     # pasta copiada intacta
```

- [ ] **Passo 7:** Commit `feat(seo): pre-renderizacao no build (SSR + script) e sitemap gerado`.

---

### Tarefa 8: Verificação local no navegador (hidratação e palestra)

- [ ] **Passo 1:** subir um servidor estático local que imita o Nginx novo (script temporário FORA do repo, no scratchpad), servindo `dist/`: `/` → `inicio.html`; `/x` → `x.html` se existir; senão arquivo; senão `index.html`; `/apresentacoes/...` por pasta com `index.html`.
- [ ] **Passo 2:** no Chrome, abrir `/`, `/palestras`, `/palestras/sala-de-parto`, `/links`, `/privacidade`, `/familia`. Para cada: `read_console_messages` sem erro de hidratação ("Hydration failed", "did not match", "Minified React error #418/#423/#425"); aparência igual à de produção (comparar com `https://raquelmachadoped.com.br/...`).
- [ ] **Passo 3:** na palestra: `iframe.contentDocument.querySelectorAll('.reveal .slides > section').length === 15`, fonte Jost carregada (`document.fonts` do iframe), título da aba `Sala de parto no follow-up do prematuro · Dra. Raquel Machado`.
- [ ] **Passo 4:** `/familia` (sem sessão) redireciona para `/familia/entrar` e mostra o formulário.
- [ ] **Passo 5:** se QUALQUER rota apresentar erro de hidratação, corrigir a causa; se for a da palestra e a causa não for trivial, removê-la de `ROTAS_SEO` (critério de aceite 7) e registrar.
- [ ] **Passo 6:** `node scripts/verificar-site.mjs http://localhost:<porta> --prerender` — esperado: tudo `OK` exceto o que depende do Nginx real (cabeçalhos HTTP e 301): o servidor temporário não os replica, então só avaliar as linhas de HTML.

---

### Tarefa 9: Nginx (referência no repo)

**Arquivos:** editar `nginx.conf` (raiz do repo)

- [ ] **Passo 1:** substituir o último bloco (`# SPA React ... location / { ... }`) por:

```nginx
    # Páginas públicas pré-renderizadas (geradas no build): / -> inicio.html, /palestras -> palestras.html, etc.
    # Se o arquivo não existir (site antigo ou rota com login), cai na shell index.html (SPA).
    location = / {
        root /var/www/raquel-frontend;
        try_files /inicio.html /index.html;
    }

    # SPA React: $uri.html serve a página pré-renderizada; /familia, /painel, /admin e o resto caem na shell.
    # Sem $uri/ de propósito: com a pasta palestras/ existindo, /palestras/ daria 403 (diretório sem índice).
    location / {
        root /var/www/raquel-frontend;
        index index.html;
        try_files $uri $uri.html /index.html;
    }
```

- [ ] **Passo 2:** commit `feat(nginx): servir paginas pre-renderizadas (referencia; aplicar na VPS antes do push)`.

---

### Tarefa 10: Teste na VPS em porta separada (sem tocar a produção)

Acesso: `ssh -p 22022 root@108.174.148.138`.

- [ ] **Passo 1: Enviar o build para um diretório separado**

```bash
rsync -a --delete -e "ssh -p 22022" frontend/dist/ root@108.174.148.138:/var/www/raquel-frontend-next/
```

- [ ] **Passo 2: Gerar o servidor temporário a partir do `nginx.conf` novo (na VPS)**

```bash
scp -P 22022 nginx.conf root@108.174.148.138:/root/nginx.next.conf
ssh -p 22022 root@108.174.148.138 'bash -s' <<'EOF'
set -e
python3 - <<'PY'
import re
s = open('/root/nginx.next.conf').read()
# só o 2º bloco server (o 443), trocando SSL por HTTP local e a raiz do site
blocos = s.split('server {')
srv = 'server {' + blocos[2]
srv = re.sub(r'\n\s*ssl_[a-z_]+ [^;]+;', '', srv)
srv = srv.replace('listen 443 ssl;', 'listen 127.0.0.1:8081;')
srv = srv.replace('/var/www/raquel-frontend', '/var/www/raquel-frontend-next')
srv = re.sub(r'server_name [^;]+;', 'server_name _;', srv)
srv = re.sub(r'\n\s*if \(\$host = www[^}]+\}', '', srv)
open('/etc/nginx/sites-available/raquel-next-test', 'w').write(srv)
PY
ln -sf /etc/nginx/sites-available/raquel-next-test /etc/nginx/sites-enabled/raquel-next-test
nginx -t && systemctl reload nginx
EOF
```

(Executado em 25/11 gerando o arquivo localmente com Node e enviando por scp, sem Python.)

(Se o Python não existir na VPS, gerar o arquivo localmente com o mesmo `re` em Node e enviar com `scp`.) O `server_tokens off;` do topo do arquivo fica fora do bloco extraído e já existe na config real.

- [ ] **Passo 3: Rodar a verificação na VPS**

```bash
ssh -p 22022 root@108.174.148.138 'cd /tmp && curl -s http://127.0.0.1:8081/ -o /dev/null -w "%{http_code}\n"'
```

e, de volta na máquina local, abrir um túnel e rodar o script:

```bash
ssh -N -L 8081:127.0.0.1:8081 -p 22022 root@108.174.148.138 &
node scripts/verificar-site.mjs http://127.0.0.1:8081 --prerender
```

Esperado: tudo `OK`, incluindo os cabeçalhos de `/apresentacoes/`, `/palestras/` = 200 e `/xyz-inexistente` = shell. Comparar com o baseline da Tarefa 0.

- [ ] **Passo 4: Chrome pelo túnel** (`http://127.0.0.1:8081/palestras/sala-de-parto`): iframe com 15 slides, console sem erro de hidratação. (A CSP do site não bloqueia: mesma origem.)
- [x] **Passo 5 (resultado em 25/11: Nginx novo + site antigo OK; Nginx antigo + site novo QUEBRA /palestras e /palestras/ com 403, então a ordem Nginx-primeiro é obrigatória): Compatibilidade nos dois sentidos**: (a) Nginx novo com o site ANTIGO: apontar temporariamente `root` do teste para um diretório com o build antigo (`/var/www/raquel-frontend` é a produção atual, mesmo conteúdo) e rodar o script SEM `--prerender`: tudo `OK`; (b) site novo com Nginx ANTIGO: `curl` na produção atual não se aplica; basta confirmar que `index.html` do build novo é a shell limpa (`grep -c "<h1" dist/index.html` = 0), que é o único arquivo que o Nginx antigo serve.
- [ ] **Passo 6: Limpar o servidor temporário**

```bash
ssh -p 22022 root@108.174.148.138 'rm -f /etc/nginx/sites-enabled/raquel-next-test /etc/nginx/sites-available/raquel-next-test /root/nginx.next.conf && rm -rf /var/www/raquel-frontend-next && nginx -t && systemctl reload nginx'
kill %1   # encerra o túnel
```

---

### Tarefa 11: Revisão final antes do deploy

- [ ] `npx tsc -b && npx eslint . && npx vitest run && npm run build` — tudo verde.
- [ ] Revisão do diff completo (`git diff master...HEAD`) contra a spec e os critérios de aceite 1 a 7; nada fora do escopo (nenhuma mudança em `useRevelar`, `/apresentacoes/`, backend).
- [ ] Registrar decisão em `knowledge/decisions.md` do vault e copiar spec e plano para o vault (`knowledge/`), conforme as regras do Peter.
- [ ] **Parar e pedir autorização ao Peter para o deploy** (Nginx na VPS + push no master). O deploy é uma ação separada, com a ordem: (1) aplicar o Nginx real com backup (`/root/backups/raquel-site/nginx.2026-11-25.bak`), `nginx -t`, reload; (2) merge `--no-ff` no master e push; (3) aguardar o cron; (4) `node scripts/verificar-site.mjs https://raquelmachadoped.com.br --prerender`; (5) Chrome na palestra; (6) limpar o cache da Cloudflare e repetir.

---

## Autorrevisão do plano

**Cobertura da spec:** mapa único (T2), JSON-LD (T2), head/OG/canonical (T3), sitemap (T4), SSR e prerender (T5, T7), hidratação (T6, T8), Nginx (T9), teste isolado na VPS e compatibilidade nos dois sentidos (T10), critérios de aceite 1 a 7 (T0, T8, T10), deploy e reversão (T11). Fora do escopo respeitado (sem `og:image`, sem `Event`, sem mexer em fotos).

**Placeholders:** nenhum. Pontos condicionais têm instrução de correção (T5 passo 4, T7 passo 5, T10 passo 2).

**Consistência de tipos/nomes:** `RotaSeo`, `ROTAS_SEO`, `buscarSeo`, `arquivoDe`, `SITE_URL`, `SITE_NOME`, `montarHead`, `injetarHtml`, `gerarSitemap`, `renderizar`, `jsonLdMedica`, `jsonLdMigalhas`, `tituloCurto`, `descricao` usados de forma idêntica em todas as tarefas.
