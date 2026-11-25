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
  console.log(`${cond ? 'OK   ' : 'FALHA'} ${msg}`)
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
const publicas = ['/', '/palestras', '/palestras/sala-de-parto', '/links', '/privacidade']
for (const caminho of publicas) {
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
