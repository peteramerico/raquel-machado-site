import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiErro, api } from './api'
import { mockFetch } from '../testUtils'

describe('api', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('GET: prefixa /api, envia credentials e devolve o JSON', async () => {
    const { fn } = mockFetch({ 'GET /api/auth/me': { body: { nome: 'Ana' } } })
    expect(await api('/auth/me')).toEqual({ nome: 'Ana' })
    const [url, init] = fn.mock.calls[0]
    expect(url).toBe('/api/auth/me')
    expect(init).toMatchObject({ method: 'GET', credentials: 'include' })
    expect((init as RequestInit).headers).toBeUndefined()
    expect((init as RequestInit).body).toBeUndefined()
  })

  it('POST com corpo: Content-Type JSON e corpo serializado', async () => {
    const { chamadas, fn } = mockFetch({ 'POST /api/auth/login': { body: { ok: true } } })
    await api('/auth/login', { metodo: 'POST', corpo: { login: 'a', senha: 'b' } })
    expect((fn.mock.calls[0][1] as RequestInit).headers).toEqual({ 'Content-Type': 'application/json' })
    expect(chamadas[0].corpo).toEqual({ login: 'a', senha: 'b' })
  })

  it('erro HTTP vira ApiErro com status, mensagem e código do servidor', async () => {
    mockFetch({ 'GET /api/x': { status: 403, body: { erro: 'Troque a senha.', codigo: 'trocar_senha' } } })
    const erro = (await api('/x').catch((e: unknown) => e)) as ApiErro
    expect(erro).toBeInstanceOf(ApiErro)
    expect(erro).toMatchObject({ status: 403, message: 'Troque a senha.', codigo: 'trocar_senha' })
  })

  it('erro sem corpo JSON usa mensagem genérica', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>502</html>', { status: 502 })))
    const erro = (await api('/x').catch((e: unknown) => e)) as ApiErro
    expect(erro).toMatchObject({ status: 502 })
    expect(erro.message).toMatch(/tente novamente/i)
  })

  it('falha de rede vira ApiErro status 0 ("sem conexão")', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const erro = (await api('/x').catch((e: unknown) => e)) as ApiErro
    expect(erro).toMatchObject({ status: 0 })
    expect(erro.message).toMatch(/conexão/i)
  })
})
