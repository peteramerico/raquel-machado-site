import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AuthProvider from '../../components/AuthProvider'
import PainelValor from './PainelValor'
import { USUARIO_MEDICA, mockFetch } from '../../testUtils'

const ME = { 'GET /api/auth/me': { body: USUARIO_MEDICA } }

function montar() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <PainelValor />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('PainelValor', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('mostra o valor atual em reais e preenche o campo no formato brasileiro', async () => {
    mockFetch({ ...ME, 'GET /api/painel/config': { body: { valorConsulta: 450.5 } } })
    montar()
    expect(await screen.findByText(/^R\$\s450,50$/)).toBeInTheDocument()
    expect(screen.getByLabelText('Novo valor (R$)')).toHaveValue('450,50')
  })

  it('o botão só habilita depois de carregar o valor', async () => {
    mockFetch({ ...ME, 'GET /api/painel/config': { body: { valorConsulta: 450 } } })
    montar()
    expect(screen.getByRole('button', { name: 'Salvar valor' })).toBeDisabled()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar valor' })).toBeEnabled())
  })

  it('formato inválido → erro local e NADA é enviado', async () => {
    const { chamadas } = mockFetch({ ...ME, 'GET /api/painel/config': { body: { valorConsulta: 450 } } })
    const user = userEvent.setup()
    montar()
    const campo = await screen.findByLabelText('Novo valor (R$)')
    for (const ruim of ['abc', '1e3', '450,505', '12.345,00']) {
      await user.clear(campo)
      await user.type(campo, ruim)
      await user.click(screen.getByRole('button', { name: 'Salvar valor' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(/até 2 casas/i)
    }
    expect(chamadas.some((c) => c.chave === 'PUT /api/painel/config')).toBe(false)
  })

  it('salvar: envia o texto digitado, atualiza o valor e confirma', async () => {
    const { chamadas } = mockFetch({
      ...ME,
      'GET /api/painel/config': { body: { valorConsulta: 450 } },
      'PUT /api/painel/config': { body: { valorConsulta: 480 } },
    })
    const user = userEvent.setup()
    montar()
    const campo = await screen.findByLabelText('Novo valor (R$)')
    await user.clear(campo)
    await user.type(campo, '480,00')
    await user.click(screen.getByRole('button', { name: 'Salvar valor' }))
    expect(await screen.findByRole('status')).toHaveTextContent(/atualizado para R\$\s480,00/)
    expect(chamadas.find((c) => c.chave === 'PUT /api/painel/config')?.corpo).toEqual({ valorConsulta: '480,00' })
    expect(screen.getByText(/^R\$\s480,00$/)).toBeInTheDocument()
  })

  it('erro do servidor é mostrado e o valor atual não muda', async () => {
    mockFetch({
      ...ME,
      'GET /api/painel/config': { body: { valorConsulta: 450 } },
      'PUT /api/painel/config': { status: 400, body: { erro: 'Informe um valor entre 1,00 e 100.000,00, com até 2 casas decimais.' } },
    })
    const user = userEvent.setup()
    montar()
    const campo = await screen.findByLabelText('Novo valor (R$)')
    await user.clear(campo)
    await user.type(campo, '999999')
    await user.click(screen.getByRole('button', { name: 'Salvar valor' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/entre 1,00 e 100.000,00/)
    expect(screen.getByText(/^R\$\s450,00$/)).toBeInTheDocument()
  })

  it('401 no meio da sessão pede à guarda para reavaliar (sem alerta de erro)', async () => {
    const { chamadas } = mockFetch({ 'GET /api/auth/me': { body: USUARIO_MEDICA }, 'GET /api/painel/config': { status: 401, body: { erro: 'x' } } })
    montar()
    await waitFor(() => expect(chamadas.filter((c) => c.chave === 'GET /api/auth/me').length).toBeGreaterThanOrEqual(2))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
