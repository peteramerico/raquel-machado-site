import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import SiteHeader from './SiteHeader'

function montar() {
  return render(<MemoryRouter><SiteHeader /></MemoryRouter>)
}

describe('SiteHeader', () => {
  it('tem o link Área da família apontando para /familia', () => {
    montar()
    expect(screen.getByRole('link', { name: 'Área da família' })).toHaveAttribute('href', '/familia')
  })

  it('os links de seção apontam para a Home com âncora', () => {
    montar()
    expect(screen.getByRole('link', { name: 'Sobre' })).toHaveAttribute('href', '/#sobre')
    expect(screen.getByRole('link', { name: 'Contato' })).toHaveAttribute('href', '/#contato')
  })

  it('o hambúrguer abre, fecha e responde ao Esc', async () => {
    const user = userEvent.setup()
    montar()
    const botao = screen.getByRole('button', { name: 'Abrir menu' })
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    await user.click(botao)
    expect(screen.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('Agendar Consulta mostra as duas clínicas com WhatsApp', async () => {
    const user = userEvent.setup()
    montar()
    expect(screen.queryByRole('link', { name: /Clínica Cativa/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Agendar Consulta/ }))
    expect(screen.getByRole('link', { name: /Clínica Cativa/ })).toHaveAttribute('href', 'https://wa.me/5584996770404')
    expect(screen.getByRole('link', { name: /Fábrica do Amanhã/ })).toHaveAttribute('href', 'https://wa.me/5584992215656')
  })

  it('clicar fora fecha o dropdown de clínicas', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByRole('button', { name: /Agendar Consulta/ }))
    await user.click(document.body)
    expect(screen.queryByRole('link', { name: /Clínica Cativa/ })).not.toBeInTheDocument()
  })
})
