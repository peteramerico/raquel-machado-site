import { NavLink, Outlet } from 'react-router-dom'
import BarraSessao from '../../components/BarraSessao'
import { useNoIndex } from '../../lib/useNoIndex'
import styles from './Painel.module.css'

// Casca da área médica: título, abas (Famílias · Valor da consulta) e a barra "Olá, X · Sair".
export default function PainelLayout() {
  useNoIndex('Área médica · Dra. Raquel Machado')
  const classeAba = ({ isActive }: { isActive: boolean }) => (isActive ? `${styles.aba} ${styles.abaAtiva}` : styles.aba)

  return (
    <div className={styles.pagina}>
      <main className={styles.conteudo}>
        <header className={styles.topo}>
          <div>
            <p className={styles.eyebrow}>Dra. Raquel Machado</p>
            <h1 className={styles.titulo}>Área médica</h1>
          </div>
          <BarraSessao />
        </header>

        <nav aria-label="Seções da área médica" className={styles.abas}>
          <NavLink to="/painel" end className={classeAba}>Famílias</NavLink>
          <NavLink to="/painel/valor" className={classeAba}>Valor da consulta</NavLink>
        </nav>

        <Outlet />
      </main>
    </div>
  )
}
