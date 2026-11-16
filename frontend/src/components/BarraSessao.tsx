import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import styles from './BarraSessao.module.css'

// "Olá, Ana · Sair" — vive dentro das áreas restritas (não no SiteHeader, que é público).
export default function BarraSessao() {
  const { estado, sair } = useAuth()
  const navegar = useNavigate()
  if (estado.situacao !== 'logado') return null

  const primeiroNome = estado.usuario.nome.trim().split(/\s+/)[0]
  return (
    <div className={styles.barra}>
      <span className={styles.ola}>Olá, {primeiroNome}</span>
      <button
        type="button"
        className={styles.sair}
        onClick={async () => {
          await sair()
          navegar('/', { replace: true })
        }}
      >
        Sair
      </button>
    </div>
  )
}
