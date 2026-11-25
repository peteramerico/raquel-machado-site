export type ItemPrograma = {
  titulo: string
  /** Quem apresenta. */
  quem: string
  duracao: string
}

/** Evento em que a palestra foi apresentada. Texto neutro quanto ao tempo (vale antes e depois da data). */
export type Evento = {
  nome: string
  /** Título da mesa redonda. */
  mesa: string
  data: string
  horario: string
  local: string
  programa: readonly ItemPrograma[]
  debatedoras: readonly string[]
}

export type Palestra = {
  slug: string
  titulo: string
  subtitulo: string
  resumo: string
  temas: readonly string[]
  evento: Evento
  /** URL do arquivo estático da apresentação (fora da SPA). */
  caminho: string
  /** Título acessível do iframe. */
  tituloIframe: string
}

export const PALESTRAS: readonly Palestra[] = [
  {
    slug: 'sala-de-parto',
    titulo: 'Aspectos da sala de parto no follow-up do recém-nascido prematuro',
    subtitulo: 'Novembro Roxo · Dra. Raquel Machado, pediatra e neonatologista',
    resumo:
      'Palestra para profissionais de saúde. Percorre aspectos da reanimação do recém-nascido prematuro na sala de parto e o que cada um pode significar no seguimento no consultório. Baseada nas diretrizes PRN-SBP 2026 (Sociedade Brasileira de Pediatria). É material educativo: não substitui a avaliação individual de cada criança.',
    temas: [
      'Clampeamento do cordão',
      'Normotermia',
      'CPAP precoce e intubação',
      'Aspiração de vias aéreas',
      'Oxigênio: a dose e o alvo',
      'Um caso, dois relatos de reanimação',
    ],
    evento: {
      nome: 'Mês da Prematuridade',
      mesa: 'Impacto do Minuto e da Hora Ouro no follow up do prematuro',
      data: '25 de novembro de 2026',
      horario: '18h',
      local: 'Sociedade de Pediatria do Rio Grande do Norte',
      programa: [
        { titulo: 'Aspectos da sala de parto no follow up', quem: 'Dra. Raquel Machado', duracao: '20 min' },
        { titulo: 'Organização do follow up do pré-termo', quem: 'Dra. Maria Luiza Saraiva Costa', duracao: '20 min' },
        { titulo: 'Debate', quem: 'Mesa e plateia', duracao: '30 min' },
      ],
      debatedoras: ['Dra. Claudia Rodrigues S. Maia', 'Dra. Nivia Maria Rodrigues Arrais'],
    },
    caminho: '/apresentacoes/sala-de-parto/',
    tituloIframe: 'Apresentação: aspectos da sala de parto no follow-up do RNPT',
  },
]

export function buscarPalestra(slug: string | undefined): Palestra | undefined {
  return PALESTRAS.find((p) => p.slug === slug)
}
