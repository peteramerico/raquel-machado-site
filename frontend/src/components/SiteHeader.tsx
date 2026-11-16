import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { CLINICAS } from '../content/contatos'
import styles from './SiteHeader.module.css'

const SECOES = [
  { hash: 'sobre', rotulo: 'Sobre' },
  { hash: 'especialidades', rotulo: 'Especialidades' },
  { hash: 'depoimentos', rotulo: 'Depoimentos' },
  { hash: 'contato', rotulo: 'Contato' },
]

export default function SiteHeader() {
  const [rolou, setRolou] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)
  const [agendarAberto, setAgendarAberto] = useState(false)
  const agendarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 60)
    aoRolar()
    window.addEventListener('scroll', aoRolar, { passive: true })
    return () => window.removeEventListener('scroll', aoRolar)
  }, [])

  useEffect(() => {
    const aoClicarFora = (e: MouseEvent) => {
      if (agendarRef.current && !agendarRef.current.contains(e.target as Node)) setAgendarAberto(false)
    }
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuAberto(false)
        setAgendarAberto(false)
      }
    }
    document.addEventListener('mousedown', aoClicarFora)
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('mousedown', aoClicarFora)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [])

  const fechar = () => {
    setMenuAberto(false)
    setAgendarAberto(false)
  }

  return (
    <header className={`${styles.header} ${rolou || menuAberto ? styles.rolou : ''}`}>
      <Link to="/" className={styles.logo} onClick={fechar}>
        <span className={styles.nome}>Dra. Raquel Machado</span>
        <span className={styles.sub}>Pediatra · Neonatologista</span>
      </Link>

      <button
        type="button"
        className={styles.hamburguer}
        aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={menuAberto}
        aria-controls="menu-principal"
        onClick={() => setMenuAberto((v) => !v)}
      >
        <span className={styles.barra} />
        <span className={styles.barra} />
        <span className={styles.barra} />
      </button>

      <nav id="menu-principal" aria-label="Principal" className={`${styles.nav} ${menuAberto ? styles.navAberto : ''}`}>
        <ul className={styles.links}>
          {SECOES.map((s) => (
            <li key={s.hash}>
              <Link to={{ pathname: '/', hash: `#${s.hash}` }} className={styles.link} onClick={fechar}>
                {s.rotulo}
              </Link>
            </li>
          ))}
          <li>
            <NavLink
              to="/familia"
              className={({ isActive }) => `${styles.link} ${styles.linkFamilia} ${isActive ? styles.linkAtivo : ''}`}
              onClick={fechar}
            >
              Área da família
            </NavLink>
          </li>
        </ul>

        <div className={styles.agendar} ref={agendarRef}>
          <button
            type="button"
            className={styles.cta}
            aria-expanded={agendarAberto}
            aria-haspopup="true"
            onClick={() => setAgendarAberto((v) => !v)}
          >
            Agendar Consulta
            <svg className={`${styles.chevron} ${agendarAberto ? styles.chevronAberto : ''}`} viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className={styles.dropdown} hidden={!agendarAberto}>
            {CLINICAS.map((c) => (
              <a key={c.nome} href={c.whatsapp} className={styles.dropdownItem} target="_blank" rel="noopener noreferrer" onClick={fechar}>
                <span className={styles.dropdownNome}>{c.nome}</span>
                <span className={styles.dropdownSub}>{c.endereco}</span>
              </a>
            ))}
          </div>
        </div>
      </nav>
    </header>
  )
}
