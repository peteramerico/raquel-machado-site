import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ENTRADA, ORDEM_PAPEL, PAPEL_MINIMO } from '../lib/areas'
import { useAuth } from '../lib/auth'
import type { Area } from '../lib/tipos'
import styles from '../pages/Acesso.module.css'

// Guarda de rota (layout route): só renderiza as filhas para quem tem sessão e papel suficiente.
// A guarda NÃO é a proteção do conteúdo — o servidor é (a API recusa sem sessão); ela só decide a tela.
export default function RequerPapel({ area }: { area: Area }) {
  const { estado, sair } = useAuth()
  const local = useLocation()

  if (estado.situacao === 'carregando') {
    return (
      <main className={styles.pagina}>
        <p role="status" className={styles.estado}>Carregando…</p>
      </main>
    )
  }

  if (estado.situacao === 'anonimo') {
    return <Navigate to={ENTRADA[area]} replace state={{ de: local.pathname + local.search }} />
  }

  if (estado.usuario.precisaTrocarSenha) {
    return <Navigate to="/conta/senha" replace state={{ de: local.pathname + local.search, area }} />
  }

  if (ORDEM_PAPEL[estado.usuario.papel] < ORDEM_PAPEL[PAPEL_MINIMO[area]]) {
    return (
      <main className={styles.pagina}>
        <section className={styles.cartao}>
          <h1 className={styles.titulo}>Acesso restrito</h1>
          <p className={styles.chamada}>Sua conta não tem permissão para esta área.</p>
          <button type="button" className={styles.botao} onClick={() => void sair()}>Sair</button>
        </section>
      </main>
    )
  }

  return <Outlet />
}
