import { PALESTRAS } from '../content/palestras'
import { SITE_URL, jsonLdMedica, jsonLdMigalhas } from './jsonld'

export { SITE_URL }
export const SITE_NOME = 'Dra. Raquel Machado'

export type RotaSeo = {
  caminho: string
  /** Arquivo gerado em dist/ (relativo). A home vai para inicio.html para não sobrescrever a shell (index.html). */
  arquivo: string
  titulo: string
  descricao: string
  canonical: string
  /** URL absoluta da imagem Open Graph. Ausente por decisão de 25/11/2026. */
  imagem?: string
  jsonLd: readonly object[]
}

export const arquivoDe = (caminho: string) => (caminho === '/' ? 'inicio.html' : `${caminho.slice(1)}.html`)
const canonicalDe = (caminho: string) => `${SITE_URL}${caminho}`

function rota(r: Omit<RotaSeo, 'arquivo' | 'canonical'>): RotaSeo {
  return { ...r, arquivo: arquivoDe(r.caminho), canonical: canonicalDe(r.caminho) }
}

const migalhasPalestras = [
  { nome: 'Início', caminho: '/' },
  { nome: 'Palestras', caminho: '/palestras' },
]

export const ROTAS_SEO: readonly RotaSeo[] = [
  rota({
    caminho: '/',
    titulo: 'Dra. Raquel Machado · Pediatra & Neonatologista em Natal/RN',
    descricao:
      'Pediatra e neonatologista em Natal/RN, com dupla residência pela Unicamp. Atendimento humanizado para bebês, crianças e famílias.',
    jsonLd: [jsonLdMedica()],
  }),
  rota({
    caminho: '/palestras',
    titulo: `Palestras · ${SITE_NOME}`,
    descricao: 'Apresentações da Dra. Raquel Machado, pediatra e neonatologista, para profissionais de saúde.',
    jsonLd: [jsonLdMigalhas(migalhasPalestras)],
  }),
  ...PALESTRAS.map((p) =>
    rota({
      caminho: `/palestras/${p.slug}`,
      titulo: `${p.tituloCurto} · ${SITE_NOME}`,
      descricao: p.descricao,
      jsonLd: [jsonLdMigalhas([...migalhasPalestras, { nome: p.tituloCurto, caminho: `/palestras/${p.slug}` }])],
    }),
  ),
  rota({
    caminho: '/links',
    titulo: `Links · ${SITE_NOME}`,
    descricao: 'Links da Dra. Raquel Machado: agende uma consulta pelo WhatsApp, veja os endereços das clínicas e o Instagram.',
    jsonLd: [],
  }),
  rota({
    caminho: '/privacidade',
    titulo: `Política de Privacidade · ${SITE_NOME}`,
    descricao: 'Como o site da Dra. Raquel Machado coleta e trata dados pessoais (LGPD).',
    jsonLd: [],
  }),
]

export function buscarSeo(caminho: string): RotaSeo | undefined {
  return ROTAS_SEO.find((r) => r.caminho === caminho)
}
