import { useAuth } from '../lib/auth'
import styles from './BarraSessao.module.css'

// "Olá, Ana · Sair" — vive dentro das áreas restritas (não no SiteHeader, que é público).
export default function BarraSessao() {
  const { estado, sair } = useAuth()
  if (estado.situacao !== 'logado') return null

  const primeiroNome = estado.usuario.nome.trim().split(/\s+/)[0]
  return (
    <div className={styles.barra}>
      <span className={styles.ola}>Olá, {primeiroNome}</span>
      <button
        type="button"
        className={styles.sair}
        // ao sair o estado vira "anônimo" e a guarda (RequerPapel) leva ao login da área
        onClick={() => void sair()}
      >
        Sair
      </button>
    </div>
  )
}
