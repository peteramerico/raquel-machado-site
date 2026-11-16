import { createContext, useContext } from 'react'
import type { Area, Usuario } from './tipos'

export type EstadoAuth =
  | { situacao: 'carregando' }
  | { situacao: 'anonimo' }
  | { situacao: 'logado'; usuario: Usuario }

export interface Auth {
  estado: EstadoAuth
  entrar: (login: string, senha: string, area: Area) => Promise<{ precisaTrocarSenha: boolean }>
  sair: () => Promise<void>
  recarregar: () => Promise<void>
}

export const AuthContext = createContext<Auth | null>(null)

export function useAuth(): Auth {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider> (rota AreaRestrita).')
  return ctx
}

// Só caminhos internos ("/x"): barra "//x", "http://…" e coisas como "/\evil" (redirecionamento aberto).
export function destinoSeguro(destino: unknown, padrao: string): string {
  if (typeof destino !== 'string') return padrao
  if (!destino.startsWith('/') || destino.startsWith('//') || destino.includes('\\')) return padrao
  return destino
}
