import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Foto } from './Foto'

describe('Foto', () => {
  const base = { nome: 'hero', larguras: [480, 800, 1200], reserva: 1200, largura: 1200, altura: 1810, alt: 'Dra. Raquel' }

  it('monta o srcset WebP e o JPG de reserva', () => {
    const { container } = render(<Foto {...base} sizes="(max-width: 900px) 90vw, 400px" />)
    const fonte = container.querySelector('source')!
    expect(fonte.getAttribute('type')).toBe('image/webp')
    expect(fonte.getAttribute('srcset')).toBe('/images/hero-480.webp 480w, /images/hero-800.webp 800w, /images/hero-1200.webp 1200w')
    expect(container.querySelector('img')!.getAttribute('src')).toBe('/images/hero-1200.jpg')
  })

  it('declara largura e altura (evita salto de layout) e é lazy por padrão', () => {
    const img = render(<Foto {...base} sizes="100vw" />).container.querySelector('img')!
    expect(img.getAttribute('width')).toBe('1200')
    expect(img.getAttribute('height')).toBe('1810')
    expect(img.getAttribute('loading')).toBe('lazy')
  })

  it('prioridade: sem lazy e com fetchpriority alto', () => {
    const img = render(<Foto {...base} sizes="100vw" prioridade />).container.querySelector('img')!
    expect(img.getAttribute('loading')).toBeNull()
    expect(img.getAttribute('fetchpriority')).toBe('high')
  })

  it('o picture não cria caixa própria (layout igual ao de um img solto)', () => {
    const pic = render(<Foto {...base} sizes="100vw" />).container.querySelector('picture')!
    expect(pic.style.display).toBe('contents')
  })

  it('repassa a classe e o alt', () => {
    const img = render(<Foto {...base} sizes="100vw" className="foto" />).container.querySelector('img')!
    expect(img.className).toBe('foto')
    expect(img.getAttribute('alt')).toBe('Dra. Raquel')
  })
})
