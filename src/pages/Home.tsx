import { useEffect, useState } from 'react'
import styles from './Home.module.css'

const WHATSAPP_CATIVA = 'https://wa.me/5584996770404'
const WHATSAPP_FABRICA = 'https://wa.me/5584992215656'
const INSTAGRAM = 'https://www.instagram.com/raquelmachado_ped/'

const testimonials = [
  {
    name: 'Lays Gayoso',
    initials: 'LG',
    text: 'Desde o nascimento da minha filha, tivemos a sorte de contar com uma pediatra que foi muito mais do que uma médica — foi um anjo em forma de profissional. Ela esteve presente no parto e, com sua competência e agilidade, salvou a vida da minha ursinha. Sua presença trouxe segurança, sua atenção trouxe alívio e sua doçura fez toda a diferença para nós como pais de primeira viagem. Muito obrigada, doutora Raquel, por tudo!',
    stars: 5,
  },
  {
    name: 'Marina Bruxel dos Santos',
    initials: 'MB',
    text: 'Experiência incrível, do início ao fim. Dra. Raquel é realmente uma pessoa muito especial. Fui ainda gestante e o acolhimento foi maravilhoso, esclareceu todas as dúvidas demonstrando muita confiança. Me sinto muito mais leve de saber que uma ótima profissional irá acompanhar minha bebê desde os primeiros momentos de vida.',
    stars: 5,
  },
  {
    name: 'Maria Luisa Michelon Albuquerque',
    initials: 'ML',
    text: 'Excelente atendimento e profissionalismo da Dra. Raquel. Uma médica atenciosa, paciente e cuidadosa com nosso pequeno RN. Adoramos!',
    stars: 5,
  },
  {
    name: 'Danielle Ferreira',
    initials: 'DF',
    text: 'Ótima, atenciosa e simpática, esclarece todas as dúvidas além de trazer diversas recomendações. Um atendimento muito humano.',
    stars: 5,
  },
]

export default function Home() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className={styles.page}>

      {/* NAV */}
      <nav className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`}>
        <a href="/" className={styles.navLogo}>
          <span className={styles.navName}>Dra. Raquel Machado</span>
          <span className={styles.navSub}>Pediatra · Neonatologista</span>
        </a>
        <div className={styles.navLinks}>
          <a href="#sobre" className={styles.navLink}>Sobre</a>
          <a href="#especialidades" className={styles.navLink}>Especialidades</a>
          <a href="#depoimentos" className={styles.navLink}>Depoimentos</a>
          <a href="#contato" className={styles.navLink}>Contato</a>
        </div>
        <a href={WHATSAPP_CATIVA} className={styles.navCta} target="_blank" rel="noopener noreferrer">
          Agendar Consulta
        </a>
      </nav>

      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <p className={styles.heroEyebrow}>Pediatra &amp; Neonatologista · Natal/RN</p>
            <h1 className={styles.heroTitle}>
              Cuidado especializado<br />
              <em>desde o primeiro dia</em>
            </h1>
            <p className={styles.heroSub}>
              Dupla residência médica pela Unicamp em Pediatria e Neonatologia.
              Atendimento humanizado e baseado em evidências para bebês, crianças e suas famílias.
            </p>
            <div className={styles.heroCtas}>
              <a href={WHATSAPP_CATIVA} className={styles.btnPrimary} target="_blank" rel="noopener noreferrer">
                Agendar na Clínica Cativa
              </a>
              <a href={WHATSAPP_FABRICA} className={styles.btnOutline} target="_blank" rel="noopener noreferrer">
                Fábrica do Amanhã
              </a>
            </div>
            <div className={styles.heroStats}>
              <div className={styles.stat}>
                <span className={styles.statNum}>2</span>
                <span className={styles.statLabel}>Residências<br />Unicamp</span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.stat}>
                <span className={styles.statNum}>+5</span>
                <span className={styles.statLabel}>Anos de<br />experiência</span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.stat}>
                <span className={styles.statNum}>UTI</span>
                <span className={styles.statLabel}>Neonatal &amp;<br />sala de parto</span>
              </div>
            </div>
          </div>
          <div className={styles.heroImageWrap}>
            <div className={styles.heroImageDecor} />
            <img
              src="/images/hero.jpg"
              alt="Dra. Raquel Machado — Pediatra e Neonatologista"
              className={styles.heroImage}
            />
          </div>
        </div>
      </section>

      {/* SOBRE */}
      <section id="sobre" className={styles.sobre}>
        <div className={styles.sobreInner}>
          <div className={styles.sobreImageWrap}>
            <img
              src="/images/sobre.jpg"
              alt="Dra. Raquel Machado no consultório"
              className={styles.sobreImage}
            />
            <div className={styles.sobreImageBadge}>
              <span>CRM-RN</span>
              <strong>9383</strong>
            </div>
          </div>
          <div className={styles.sobreText}>
            <p className={styles.sectionEyebrow}>Quem sou eu</p>
            <h2 className={styles.sectionTitle}>
              Formação de excelência,<br /><em>cuidado com alma</em>
            </h2>
            <p className={styles.sobrePara}>
              Formada em Medicina pela Universidade Federal do Rio Grande do Norte (UFRN), com dupla residência médica pela Universidade Estadual de Campinas (Unicamp) — uma das instituições mais renomadas do país.
            </p>
            <p className={styles.sobrePara}>
              Residência em Pediatria (2018–2021) e especialização em Neonatologia (2021–2023), com experiência prática em UTI neonatal, sala de parto, alojamento conjunto e pronto atendimento pediátrico em hospitais de referência em São Paulo e Minas Gerais.
            </p>
            <p className={styles.sobrePara}>
              Coautora de capítulos do <em>Manual de Urgência e Emergências em Pediatria</em> (Editora Sanar, 2018). Atende hoje em Natal/RN com o compromisso de oferecer pediatria humanizada, baseada em evidências, desde o nascimento.
            </p>
            <div className={styles.sobreCredenciais}>
              <div className={styles.credencial}>
                <strong>Graduação</strong>
                <span>UFRN · Medicina</span>
              </div>
              <div className={styles.credencial}>
                <strong>Residência em Pediatria</strong>
                <span>Unicamp · 2018–2021</span>
              </div>
              <div className={styles.credencial}>
                <strong>Residência em Neonatologia</strong>
                <span>Unicamp · 2021–2023</span>
              </div>
              <div className={styles.credencial}>
                <strong>Publicação</strong>
                <span>Manual de Urgência Pediátrica · Sanar</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ESPECIALIDADES */}
      <section id="especialidades" className={styles.especialidades}>
        <div className={styles.especialidadesHeader}>
          <p className={styles.sectionEyebrow}>O que faço</p>
          <h2 className={styles.sectionTitle}>Especialidades</h2>
        </div>
        <div className={styles.especialidadesGrid}>
          <div className={styles.espCard}>
            <div className={styles.espCardImg}>
              <img src="/images/pediatria.jpg" alt="Pediatria Geral" />
            </div>
            <div className={styles.espCardBody}>
              <h3 className={styles.espCardTitle}>Pediatria Geral</h3>
              <p className={styles.espCardText}>
                Acompanhamento do crescimento e desenvolvimento desde o nascimento até a adolescência,
                com consultas de puericultura, vacinação, orientação nutricional e tratamento de doenças agudas e crônicas.
              </p>
              <ul className={styles.espCardList}>
                <li>Consultas de puericultura</li>
                <li>Calendário vacinal</li>
                <li>Orientação nutricional</li>
                <li>Doenças agudas e crônicas</li>
              </ul>
            </div>
          </div>
          <div className={styles.espCard}>
            <div className={styles.espCardImg}>
              <img src="/images/neonatologia.jpg" alt="Neonatologia" />
            </div>
            <div className={styles.espCardBody}>
              <h3 className={styles.espCardTitle}>Neonatologia</h3>
              <p className={styles.espCardText}>
                Cuidado especializado ao recém-nascido em berçário, UTI neonatal e sala de parto,
                com formação avançada em reanimação neonatal e suporte ao prematuro.
              </p>
              <ul className={styles.espCardList}>
                <li>Atenção ao recém-nascido</li>
                <li>Reanimação neonatal</li>
                <li>Suporte ao prematuro</li>
                <li>UTI neonatal e sala de parto</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section id="depoimentos" className={styles.depoimentos}>
        <div className={styles.depoimentosHeader}>
          <p className={styles.sectionEyebrow}>O que dizem as famílias</p>
          <h2 className={styles.sectionTitle}>Depoimentos</h2>
        </div>
        <div className={styles.depoimentosGrid}>
          {testimonials.map((t, i) => (
            <div key={i} className={styles.depoCard}>
              <div className={styles.depoStars}>{'★'.repeat(t.stars)}</div>
              <p className={styles.depoText}>"{t.text}"</p>
              <div className={styles.depoAuthor}>
                <div className={styles.depoAvatar}>{t.initials}</div>
                <span className={styles.depoName}>{t.name}</span>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.depoFooter}>
          <a
            href="https://www.google.com/search?q=Raquel+Machado+pediatra+neonatologista+Natal+RN"
            className={styles.depoGoogleLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver todas as avaliações no Google →
          </a>
        </div>
      </section>

      {/* CONTATO */}
      <section id="contato" className={styles.contato}>
        <div className={styles.contatoInner}>
          <div className={styles.contatoHeader}>
            <p className={styles.sectionEyebrow}>Onde me encontrar</p>
            <h2 className={styles.sectionTitle}>Consultórios em Natal</h2>
          </div>
          <div className={styles.clinicasGrid}>
            <div className={styles.clinicaCard}>
              <div className={styles.clinicaIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
              </div>
              <h3 className={styles.clinicaName}>Clínica Cativa</h3>
              <p className={styles.clinicaAddress}>
                Tyrol Business Center · Sala 514<br />
                Natal/RN
              </p>
              <a href={WHATSAPP_CATIVA} className={styles.btnPrimary} target="_blank" rel="noopener noreferrer">
                Agendar pelo WhatsApp
              </a>
              <a
                href="https://www.google.com/maps/search/Tyrol+Business+Center+Natal+RN"
                className={styles.clinicaMaps}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver no mapa →
              </a>
            </div>
            <div className={styles.clinicaCard}>
              <div className={styles.clinicaIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
              </div>
              <h3 className={styles.clinicaName}>Fábrica do Amanhã</h3>
              <p className={styles.clinicaAddress}>
                Natal/RN
              </p>
              <a href={WHATSAPP_FABRICA} className={styles.btnPrimary} target="_blank" rel="noopener noreferrer">
                Agendar pelo WhatsApp
              </a>
              <a
                href="https://www.google.com/maps/search/Fábrica+do+Amanhã+Natal+RN"
                className={styles.clinicaMaps}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver no mapa →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <span className={styles.footerName}>Dra. Raquel Machado</span>
            <span className={styles.footerSub}>Pediatra &amp; Neonatologista · CRM-RN 9383</span>
          </div>
          <div className={styles.footerLinks}>
            <a href={INSTAGRAM} target="_blank" rel="noopener noreferrer" className={styles.footerLink}>Instagram</a>
            <a href={WHATSAPP_CATIVA} target="_blank" rel="noopener noreferrer" className={styles.footerLink}>WhatsApp Cativa</a>
            <a href={WHATSAPP_FABRICA} target="_blank" rel="noopener noreferrer" className={styles.footerLink}>WhatsApp Fábrica</a>
            <a href="/links" className={styles.footerLink}>Links</a>
          </div>
          <p className={styles.footerCopy}>© 2026 Dra. Raquel Machado · Todos os direitos reservados</p>
        </div>
      </footer>

    </div>
  )
}
