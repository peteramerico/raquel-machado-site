import { useState } from 'react'
import LinkButton from '../components/LinkButton'
import { InstagramIcon, WhatsAppIcon, MapPinIcon } from '../components/icons'
import styles from '../styles/Links.module.css'

const LINKS = {
  instagram: 'https://instagram.com/raquelmachado_ped',
  whatsappCativa: 'https://wa.me/5584996770404',
  whatsappFabrica: 'https://wa.me/5584992215656',
  mapsCativa: 'https://maps.app.goo.gl/xjfA9Au2hrnofZue6',
  mapsFabrica: 'https://maps.app.goo.gl/cyWUyaNC4ybWVxnJ7',
}

export default function Links() {
  const [imgError, setImgError] = useState(false)

  return (
    <div className={styles.page}>
      <div className={styles.grain} aria-hidden="true" />
      <div className={styles.glow} aria-hidden="true" />

      <main className={styles.card}>
        <header className={styles.profile}>
          <div className={styles.avatarRing}>
            {imgError ? (
              <div
                className={styles.avatarFallback}
                role="img"
                aria-label="Dra. Raquel Machado"
              >
                RM
              </div>
            ) : (
              <img
                src="/raquel-avatar.jpg"
                alt="Dra. Raquel Machado"
                className={styles.avatar}
                onError={() => setImgError(true)}
              />
            )}
          </div>

          <p className={styles.eyebrow}>Dra.</p>
          <h1 className={styles.name}>
            Raquel <em>Machado</em>
          </h1>
          <p className={styles.credentials}>Pediatra &amp; Neonatologista</p>
          <p className={styles.places}>Sala de parto · Consultório · Natal / RN</p>
        </header>

        <div className={styles.divider} aria-hidden="true">
          <span />
        </div>

        <section className={styles.section}>
          <LinkButton
            href={LINKS.instagram}
            label="@raquelmachado_ped"
            sublabel="Conteúdo para famílias no Instagram"
            icon={<InstagramIcon />}
            variant="secondary"
          />
        </section>

        <section className={styles.section}>
          <p className={styles.sectionLabel}>
            <span>Agendamento</span>
          </p>
          <LinkButton
            href={LINKS.whatsappCativa}
            label="Clínica Cativa"
            sublabel="WhatsApp · Tyrol Business Center"
            icon={<WhatsAppIcon />}
            variant="primary"
          />
          <LinkButton
            href={LINKS.whatsappFabrica}
            label="Fábrica do Amanhã"
            sublabel="WhatsApp · agendamento direto"
            icon={<WhatsAppIcon />}
            variant="primary"
          />
        </section>

        <section className={styles.section}>
          <p className={styles.sectionLabel}>
            <span>Endereços</span>
          </p>
          <LinkButton
            href={LINKS.mapsCativa}
            label="Clínica Cativa"
            sublabel="Tyrol Business Center · Sala 514"
            icon={<MapPinIcon />}
            variant="address"
          />
          <LinkButton
            href={LINKS.mapsFabrica}
            label="Fábrica do Amanhã"
            sublabel="Abrir no Google Maps"
            icon={<MapPinIcon />}
            variant="address"
          />
        </section>

        <footer className={styles.footer}>
          <span>CRM-RN · Pediatria &amp; Neonatologia</span>
        </footer>
      </main>
    </div>
  )
}
