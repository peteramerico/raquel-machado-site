import { useEffect } from 'react'

// Páginas de login/áreas restritas: ajusta o título da aba e pede aos buscadores para não indexar.
// (`noindex` na página, não Disallow no robots.txt: o Disallow esconderia o noindex.)
export function useNoIndex(titulo: string) {
  useEffect(() => {
    const anterior = document.title
    document.title = titulo
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => {
      document.title = anterior
      meta.remove()
    }
  }, [titulo])
}
