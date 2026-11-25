import { CLINICAS, INSTAGRAM } from '../content/contatos'

export const SITE_URL = 'https://raquelmachadoped.com.br'

// Telefone no formato E.164, tirado dos links wa.me do site (content/contatos.ts).
const telefoneDe = (wa: string) => `+${wa.replace('https://wa.me/', '')}`

const ENDERECOS = {
  'Clínica Cativa': { id: 'clinica-cativa', streetAddress: 'Tyrol Business Center, Sala 514' },
  'Fábrica do Amanhã': { id: 'fabrica-do-amanha', streetAddress: 'Rua Dr. Horácio, 595, Lagoa Nova' },
} as const

export function jsonLdMedica(): object {
  const clinicas = CLINICAS.map((c) => ({
    '@type': 'MedicalClinic',
    '@id': `${SITE_URL}/#${ENDERECOS[c.nome].id}`,
    name: c.nome,
    url: `${SITE_URL}/`,
    telephone: telefoneDe(c.whatsapp),
    medicalSpecialty: 'Pediatric',
    address: {
      '@type': 'PostalAddress',
      streetAddress: ENDERECOS[c.nome].streetAddress,
      addressLocality: 'Natal',
      addressRegion: 'RN',
      addressCountry: 'BR',
    },
  }))

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Physician',
        '@id': `${SITE_URL}/#medica`,
        name: 'Raquel Machado',
        honorificPrefix: 'Dra.',
        description: 'Pediatra e neonatologista em Natal/RN.',
        url: `${SITE_URL}/`,
        medicalSpecialty: 'Pediatric',
        knowsAbout: ['Pediatria', 'Neonatologia'],
        identifier: { '@type': 'PropertyValue', propertyID: 'CRM-RN', value: '9383' },
        alumniOf: [
          { '@type': 'CollegeOrUniversity', name: 'Universidade Federal do Rio Grande do Norte (UFRN)' },
          { '@type': 'CollegeOrUniversity', name: 'Universidade Estadual de Campinas (Unicamp)' },
        ],
        areaServed: { '@type': 'City', name: 'Natal' },
        sameAs: [INSTAGRAM],
        workLocation: clinicas.map((c) => ({ '@id': c['@id'] })),
      },
      ...clinicas,
    ],
  }
}

export function jsonLdMigalhas(itens: ReadonlyArray<{ nome: string; caminho: string }>): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: itens.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.nome,
      item: `${SITE_URL}${it.caminho}`,
    })),
  }
}
