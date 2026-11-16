import { vi } from 'vitest'

// Respostas da API nos testes do frontend: "MÉTODO /api/caminho" → { status, body } (ou função do corpo enviado).
export type RespostaMock = { status?: number; body?: unknown }
export type Rotas = Record<string, RespostaMock | ((corpo: unknown) => RespostaMock)>

export function mockFetch(rotas: Rotas) {
  const chamadas: { chave: string; corpo: unknown }[] = []
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const chave = `${init?.method ?? 'GET'} ${url}`
    const corpo = init?.body ? JSON.parse(String(init.body)) : undefined
    chamadas.push({ chave, corpo })
    const r = rotas[chave]
    if (!r) return new Response(JSON.stringify({ erro: `rota não mockada: ${chave}` }), { status: 500 })
    const resp = typeof r === 'function' ? r(corpo) : r
    return new Response(JSON.stringify(resp.body ?? {}), {
      status: resp.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fn)
  return { fn, chamadas }
}

export const USUARIO_FAMILIA = { nome: 'Ana Souza', login: 'ana', papel: 'familia', precisaTrocarSenha: false }
