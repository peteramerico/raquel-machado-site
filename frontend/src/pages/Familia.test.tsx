import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import Familia from './Familia'
import { guia } from '../content/guiaConsulta'

function montar() {
  return render(
    <MemoryRouter initialEntries={['/familia']}>
      <Familia />
    </MemoryRouter>,
  )
}

describe('Familia', () => {
  afterEach(() => {
    document.head.querySelector('meta[name="robots"]')?.remove()
  })

  it('tem um único h1 com o título do guia', () => {
    montar()
    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveTextContent('Guia da consulta com a Dra. Raquel')
  })

  it('renderiza os 7 capítulos, cada um com seu h2', () => {
    montar()
    for (const c of guia.capitulos) {
      expect(screen.getByRole('heading', { level: 2, name: c.titulo })).toBeInTheDocument()
    }
  })

  it('os atalhos apontam para as âncoras dos capítulos', () => {
    montar()
    const indice = screen.getByRole('navigation', { name: 'Neste guia' })
    for (const c of guia.capitulos) {
      expect(within(indice).getByRole('link', { name: new RegExp(c.rotulo) })).toHaveAttribute('href', `#${c.id}`)
    }
  })

  it('mostra as 6 faixas do calendário', () => {
    montar()
    const faixas = screen.getAllByRole('listitem').filter((li) => li.hasAttribute('data-faixa'))
    expect(faixas).toHaveLength(6)
  })

  it('mostra o checklist com os 5 itens', () => {
    montar()
    for (const item of guia.trazer.itens) {
      expect(screen.getByText(item.titulo)).toBeInTheDocument()
    }
  })

  it('mostra o valor vindo da fonte única e a urgência', () => {
    montar()
    expect(screen.getByText(/^R\$\s400,00$/)).toBeInTheDocument()
    expect(screen.getByText('Em caso de urgência, procurem um pronto atendimento.')).toBeInTheDocument()
  })

  it('marca a página como noindex e ajusta o título', () => {
    montar()
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
    expect(document.title).toMatch(/Guia da consulta/)
  })
})
