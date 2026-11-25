import { Link } from 'react-router-dom'
import { PALESTRAS } from '../content/palestras'
import { useTitulo } from '../lib/useTitulo'
import styles from './Palestras.module.css'

export default function Palestras() {
  useTitulo('Palestras · Dra. Raquel Machado')
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Conteúdo</p>
        <h1 className={styles.titulo}>Palestras</h1>
        <p className={styles.intro}>Apresentações da Dra. Raquel Machado para profissionais de saúde.</p>
        <ul className={styles.lista}>
          {PALESTRAS.map((p) => (
            <li key={p.slug}>
              <Link to={`/palestras/${p.slug}`} className={styles.cartao}>
                <span className={styles.cartaoSub}>{p.subtitulo}</span>
                <span className={styles.cartaoTitulo}>{p.titulo}</span>
                <span className={styles.cartaoMeta}>
                  {p.evento.nome} · {p.evento.data}
                </span>
                <span className={styles.cartaoLink}>Ver palestra →</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
