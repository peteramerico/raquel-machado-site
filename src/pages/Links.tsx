import LinkButton from '../components/LinkButton'
import styles from '../styles/Links.module.css'

const LINKS = {
  instagram: 'https://instagram.com/raquelmachado_ped',
  whatsappCativa: 'https://wa.me/5584XXXXXXXXX',      // substituir pelo número real
  whatsappFabrica: 'https://wa.me/5584XXXXXXXXX',     // substituir pelo número real
  mapsCativa: 'https://maps.google.com/?q=Tyrol+Business+Center+Natal+RN+Sala+514', // ajustar
  mapsFabrica: 'https://maps.google.com/?q=Fabrica+do+Amanha+Natal+RN',             // ajustar
}

export default function Links() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.profile}>
          <img
            src="/raquel-avatar.jpg"
            alt="Dra. Raquel Machado"
            className={styles.avatar}
            onError={(e) => {
              e.currentTarget.style.display = 'none'
              e.currentTarget.nextElementSibling?.removeAttribute('style')
            }}
          />
          <div className={styles.avatarFallback} style={{ display: 'none' }}>👩‍⚕️</div>
          <h1 className={styles.name}>Raquel Machado</h1>
          <p className={styles.subtitle}>Pediatra &amp; Neonatologista<br />Sala de parto · Consultório</p>
        </div>

        <div className={styles.links}>
          <LinkButton
            href={LINKS.instagram}
            label="@raquelmachado_ped"
            icon="📸"
            variant="secondary"
          />

          <p className={styles.sectionLabel}>Agendamento</p>

          <LinkButton
            href={LINKS.whatsappCativa}
            label="WhatsApp — Clínica Cativa"
            icon="💬"
            variant="primary"
          />
          <LinkButton
            href={LINKS.whatsappFabrica}
            label="WhatsApp — Fábrica do Amanhã"
            icon="💬"
            variant="primary"
          />

          <p className={styles.sectionLabel}>Endereços</p>

          <LinkButton
            href={LINKS.mapsCativa}
            label={"Clínica Cativa\nTyrol Business Center · Sala 514"}
            icon="📍"
            variant="address"
          />
          <LinkButton
            href={LINKS.mapsFabrica}
            label="Fábrica do Amanhã"
            icon="📍"
            variant="address"
          />
        </div>
      </div>
    </div>
  )
}
