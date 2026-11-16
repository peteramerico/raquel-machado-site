import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import { AuthContext, type Auth, type EstadoAuth } from '../lib/auth'
import type { Area, Usuario } from '../lib/tipos'

// Só envolve as áreas restritas (rota AreaRestrita): as páginas públicas nunca chamam /api/auth/me.
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoAuth>({ situacao: 'carregando' })

  const buscarUsuario = useCallback(async (): Promise<EstadoAuth> => {
    try {
      const usuario = await api<Usuario>('/auth/me')
      return { situacao: 'logado', usuario }
    } catch {
      return { situacao: 'anonimo' } // 401 (ou servidor fora): trata como sem sessão
    }
  }, [])

  const recarregar = useCallback(async () => {
    setEstado(await buscarUsuario())
  }, [buscarUsuario])

  useEffect(() => {
    let ativo = true
    buscarUsuario().then((e) => {
      if (ativo) setEstado(e)
    })
    return () => {
      ativo = false
    }
  }, [buscarUsuario])

  const entrar = useCallback(
    async (login: string, senha: string, area: Area) => {
      const r = await api<{ precisaTrocarSenha: boolean }>('/auth/login', { metodo: 'POST', corpo: { login, senha, area } })
      await recarregar()
      return { precisaTrocarSenha: r.precisaTrocarSenha }
    },
    [recarregar],
  )

  const sair = useCallback(async () => {
    try {
      await api('/auth/logout', { metodo: 'POST', corpo: {} })
    } catch {
      /* sem rede/servidor: o cookie vence sozinho; o cliente sai de qualquer jeito */
    }
    setEstado({ situacao: 'anonimo' })
  }, [])

  const valor = useMemo<Auth>(() => ({ estado, entrar, sair, recarregar }), [estado, entrar, sair, recarregar])
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
