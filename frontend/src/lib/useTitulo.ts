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
