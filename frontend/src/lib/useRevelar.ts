import { useEffect, useRef, useState } from 'react'

const semAnimacao = () =>
  typeof IntersectionObserver === 'undefined' ||
  (typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

// Revela o elemento quando ele entra na tela. Sem IntersectionObserver ou com
// prefers-reduced-motion, já nasce visível (nada fica escondido por falha de JS).
export function useRevelar<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [visivel, setVisivel] = useState(semAnimacao)

  useEffect(() => {
    const el = ref.current
    if (!el || visivel) return
    const obs = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setVisivel(true)
          obs.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [visivel])

  return { ref, visivel }
}
