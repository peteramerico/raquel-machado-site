import { vi } from 'vitest'
import type { Guia } from './lib/tipos'

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

export const USUARIO_MEDICA = { nome: 'Raquel Machado', login: 'raquel', papel: 'medica', precisaTrocarSenha: false }
export const USUARIO_PENDENTE = { nome: 'Ana Souza', login: 'ana', papel: 'familia', precisaTrocarSenha: true }

// Fixture compacta com a MESMA estrutura do que a API devolve (o texto real mora em backend/src/conteudo).
export const GUIA_TESTE: Guia = {
  titulo: 'Guia da consulta com a Dra. Raquel',
  subtitulo: 'Pediatra e neonatologista',
  abertura: 'Que bom ter vocês aqui!',
  capitulos: [
    { id: 'puericultura', rotulo: 'Puericultura', titulo: 'Como funciona a consulta de puericultura' },
    { id: 'retorno', rotulo: 'Retorno', titulo: 'Quando eu indico um retorno' },
    { id: 'calendario', rotulo: 'Calendário', titulo: 'Calendário de acompanhamento' },
    { id: 'prenatal', rotulo: 'Pré-natal', titulo: 'Consulta pré-natal pediátrica' },
    { id: 'trazer', rotulo: 'O que trazer', titulo: 'O que trazer para a consulta da criança' },
    { id: 'whatsapp', rotulo: 'WhatsApp', titulo: 'WhatsApp entre as consultas' },
    { id: 'valor', rotulo: 'Valor', titulo: 'Valor da consulta' },
  ],
  puericultura: ['Primeiro parágrafo da puericultura.', 'Segundo parágrafo.'],
  retorno: {
    intro: 'O retorno é uma reavaliação focada.',
    puericultura: { rotulo: 'Consulta de puericultura', pontos: ['Nos intervalos planejados'] },
    retorno: { rotulo: 'Retorno', pontos: ['Eu indico e combino', 'Em até 15 dias'] },
  },
  calendario: {
    intro: 'Uso as orientações da SBP.',
    faixas: [
      { idade: 'Primeira consulta do recém-nascido', frequencia: 'Entre 7 e 10 dias de vida' },
      { idade: 'Até os 6 meses', frequencia: 'Mensal' },
      { idade: 'Dos 6 meses a 1 ano', frequencia: 'A cada 2 meses' },
      { idade: 'De 1 ano a 1 ano e meio', frequencia: 'A cada 3 meses' },
      { idade: 'De 1 ano e meio a 5 anos', frequencia: 'A cada 6 meses' },
      { idade: 'Dos 5 aos 18 anos', frequencia: 'Anual' },
    ],
    prematuro: { rotulo: 'Bebê prematuro', texto: 'Texto do prematuro.' },
  },
  prenatal: { semana: '28ª', legendaSemana: 'semana de gestação', texto: 'A partir da 28ª semana.', trazer: 'Tragam a caderneta da gestante.' },
  trazer: {
    itens: [
      { titulo: 'Caderneta da Criança', detalhe: 'com o registro das vacinas' },
      { titulo: 'Exames e relatórios recentes' },
      { titulo: 'Lista de medicamentos e suplementos em uso' },
      { titulo: 'Resumo da maternidade ou da internação' },
      { titulo: 'Dúvidas anotadas' },
    ],
  },
  whatsapp: {
    texto: 'O WhatsApp é uma cortesia.',
    horarios: [{ quando: 'Dias úteis', como: 'Leio no fim da tarde' }, { quando: 'Fim de semana', como: 'Respondo na segunda' }],
    urgencia: 'Em caso de urgência, procurem um pronto atendimento.',
  },
  valor: { rotulo: 'O valor de cada consulta é' },
  assinatura: { nome: 'Dra. Raquel Machado', titulo: 'Pediatra e neonatologista' },
}
