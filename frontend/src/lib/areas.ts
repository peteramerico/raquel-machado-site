import type { Area, Papel } from './tipos'

// Fonte única do mapa de áreas (login, destino padrão, papel mínimo, textos).
export const ENTRADA: Record<Area, string> = {
  familia: '/familia/entrar',
  painel: '/painel/entrar',
  admin: '/admin/entrar',
}

export const DESTINO_PADRAO: Record<Area, string> = {
  familia: '/familia',
  painel: '/painel',
  admin: '/admin',
}

export const PAPEL_MINIMO: Record<Area, Papel> = {
  familia: 'familia',
  painel: 'medica',
  admin: 'admin',
}

export const ORDEM_PAPEL: Record<Papel, number> = { familia: 1, medica: 2, admin: 3 }

export const TEXTO_AREA: Record<Area, { titulo: string; chamada: string }> = {
  familia: { titulo: 'Área da família', chamada: 'Entre para ver o guia da consulta e as orientações da Dra. Raquel.' },
  painel: { titulo: 'Área médica', chamada: 'Acesso da equipe médica.' },
  admin: { titulo: 'Administrador', chamada: 'Acesso restrito à administração do site.' },
}
