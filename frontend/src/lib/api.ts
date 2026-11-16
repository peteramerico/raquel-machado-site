export class ApiErro extends Error {
  status: number
  codigo?: string

  constructor(status: number, mensagem: string, codigo?: string) {
    super(mensagem)
    this.name = 'ApiErro'
    this.status = status
    this.codigo = codigo
  }
}

interface Opcoes {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  corpo?: unknown
}

// Cliente único da API: mesma origem (nginx → /api), cookie de sessão via `credentials`.
// Erros viram ApiErro com a mensagem em português que o servidor mandou (ou uma genérica).
export async function api<T = unknown>(caminho: string, { metodo = 'GET', corpo }: Opcoes = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${caminho}`, {
      method: metodo,
      credentials: 'include',
      headers: corpo !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    })
  } catch {
    throw new ApiErro(0, 'Sem conexão. Verifique a internet e tente de novo.')
  }

  let dados: unknown = null
  try {
    dados = await res.json()
  } catch {
    /* corpo vazio ou não-JSON */
  }

  if (!res.ok) {
    const d = (dados ?? {}) as { erro?: string; codigo?: string }
    throw new ApiErro(res.status, d.erro ?? 'Não foi possível concluir. Tente novamente.', d.codigo)
  }
  return dados as T
}
