import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// BrowserRouter não rola para #âncora nem volta ao topo sozinho.
export default function ScrollToHash() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      const id = decodeURIComponent(hash.slice(1))
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView())
    } else {
      window.scrollTo(0, 0)
    }
  }, [pathname, hash])

  return null
}
