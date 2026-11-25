import { Link } from 'react-router-dom'
import { INSTAGRAM, WHATSAPP_CATIVA, WHATSAPP_FABRICA } from '../content/contatos'
import styles from './SiteFooter.module.css'

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.marca}>
          <span className={styles.nome}>Dra. Raquel Machado</span>
          <span className={styles.sub}>Pediatra &amp; Neonatologista · CRM-RN 9383</span>
        </div>
        <div className={styles.links}>
          <a href={INSTAGRAM} target="_blank" rel="noopener noreferrer" className={styles.link}>Instagram</a>
          <a href={WHATSAPP_CATIVA} target="_blank" rel="noopener noreferrer" className={styles.link}>WhatsApp Cativa</a>
          <a href={WHATSAPP_FABRICA} target="_blank" rel="noopener noreferrer" className={styles.link}>WhatsApp Fábrica</a>
          <Link to="/palestras" className={styles.link}>Palestras</Link>
          <Link to="/familia" className={styles.link}>Área da família</Link>
          <Link to="/painel" className={styles.link}>Área médica</Link>
          <Link to="/admin" className={styles.link}>Administrador</Link>
          <Link to="/links" className={styles.link}>Links</Link>
        </div>
        <p className={styles.copy}>
          © 2026 Dra. Raquel Machado · Todos os direitos reservados ·{' '}
          <Link to="/privacidade" className={styles.link}>Política de Privacidade</Link>
        </p>
      </div>
    </footer>
  )
}
