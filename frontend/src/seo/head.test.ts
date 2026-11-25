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
    expect(montarHead({ ...rota, imagem: 'https://exemplo.com/a.jpg' })).toContain(
      'property="og:image" content="https://exemplo.com/a.jpg"',
    )
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
