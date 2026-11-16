// Contrato da API (espelha backend/src/rotas e backend/src/conteudo).

export type Papel = 'familia' | 'medica' | 'admin'
// O que a tela de login pede ao servidor (papel mínimo: familia | medica | admin).
export type Area = 'familia' | 'painel' | 'admin'

export interface Usuario {
  nome: string
  login: string
  papel: Papel
  precisaTrocarSenha: boolean
}

export interface CapituloGuia { id: string; rotulo: string; titulo: string }
export interface PontosCartao { rotulo: string; pontos: string[] }

export interface Guia {
  titulo: string
  subtitulo: string
  abertura: string
  capitulos: CapituloGuia[]
  puericultura: string[]
  retorno: { intro: string; puericultura: PontosCartao; retorno: PontosCartao }
  calendario: {
    intro: string
    faixas: { idade: string; frequencia: string }[]
    prematuro: { rotulo: string; texto: string }
  }
  prenatal: { semana: string; legendaSemana: string; texto: string; trazer: string }
  trazer: { itens: { titulo: string; detalhe?: string }[] }
  whatsapp: { texto: string; horarios: { quando: string; como: string }[]; urgencia: string }
  valor: { rotulo: string }
  assinatura: { nome: string; titulo: string }
}

export interface RespostaGuia {
  guia: Guia
  valorConsulta: number
}
