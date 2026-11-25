export type Palestra = {
  slug: string
  titulo: string
  subtitulo: string
  resumo: string
  temas: readonly string[]
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
    caminho: '/apresentacoes/sala-de-parto/',
    tituloIframe: 'Apresentação: aspectos da sala de parto no follow-up do RNPT',
  },
]

export function buscarPalestra(slug: string | undefined): Palestra | undefined {
  return PALESTRAS.find((p) => p.slug === slug)
}
