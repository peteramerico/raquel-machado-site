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
