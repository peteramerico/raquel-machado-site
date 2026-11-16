import { Link, Outlet } from 'react-router-dom'
import BarraSessao from '../../components/BarraSessao'
import { useNoIndex } from '../../lib/useNoIndex'
import styles from '../painel/Painel.module.css'

// Casca da área do administrador (mesmo painel claro da área médica).
export default function AdminLayout() {
  useNoIndex('Administrador · Dra. Raquel Machado')

  return (
    <div className={styles.pagina}>
      <main className={styles.conteudo}>
        <header className={styles.topo}>
          <div>
            <p className={styles.eyebrow}>Dra. Raquel Machado</p>
            <h1 className={styles.titulo}>Administrador</h1>
          </div>
          <BarraSessao />
        </header>

        <p className={styles.explica}>
          Contas de acesso do site. Para liberar o acesso de uma família ou mudar o valor da consulta, use a{' '}
          <Link to="/painel" className={styles.linkTexto}>Área médica</Link>.
        </p>

        <Outlet />
      </main>
    </div>
  )
}
