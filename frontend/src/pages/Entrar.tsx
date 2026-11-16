import { useId, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { WHATSAPP_CATIVA } from '../content/contatos'
import { ApiErro } from '../lib/api'
import { DESTINO_PADRAO, TEXTO_AREA } from '../lib/areas'
import { destinoSeguro, useAuth } from '../lib/auth'
import type { Area } from '../lib/tipos'
import { useNoIndex } from '../lib/useNoIndex'
import styles from './Acesso.module.css'

// Tela de login de uma área (família · painel · admin). Todas falam com o mesmo POST /api/auth/login.
export default function Entrar({ area }: { area: Area }) {
  const { estado, entrar } = useAuth()
  const navegar = useNavigate()
  const local = useLocation()
  const idLogin = useId()
  const idSenha = useId()
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const texto = TEXTO_AREA[area]
  useNoIndex(`${texto.titulo} · Entrar · Dra. Raquel Machado`)

  // para onde voltar depois de entrar: o destino que a guarda guardou, ou a página inicial da área
  const destino = destinoSeguro((local.state as { de?: unknown } | null)?.de, DESTINO_PADRAO[area])

  if (estado.situacao === 'logado' && !estado.usuario.precisaTrocarSenha) {
    return <Navigate to={destino} replace />
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (enviando) return
    setErro(null)
    setEnviando(true)
    try {
      const { precisaTrocarSenha } = await entrar(login.trim(), senha, area)
      navegar(precisaTrocarSenha ? '/conta/senha' : destino, { replace: true, state: { de: destino, area } })
    } catch (err) {
      setErro(err instanceof ApiErro ? err.message : 'Não foi possível entrar agora. Tente novamente.')
      setSenha('')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className={styles.pagina}>
      <section className={styles.cartao} aria-labelledby="titulo-entrar">
        <span className={styles.selo} aria-hidden="true">R</span>
        <p className={styles.eyebrow}>Dra. Raquel Machado</p>
        <h1 id="titulo-entrar" className={styles.titulo}>{texto.titulo}</h1>
        <p className={styles.chamada}>{texto.chamada}</p>

        <form className={styles.form} onSubmit={enviar} noValidate>
          <div className={styles.campo}>
            <label htmlFor={idLogin} className={styles.rotulo}>Usuário</label>
            <input
              id={idLogin}
              className={styles.entrada}
              type="text"
              name="usuario"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
          </div>

          <div className={styles.campo}>
            <label htmlFor={idSenha} className={styles.rotulo}>Senha</label>
            <div className={styles.senhaCampo}>
              <input
                id={idSenha}
                className={styles.entrada}
                type={mostrar ? 'text' : 'password'}
                name="senha"
                autoComplete="current-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
              <button
                type="button"
                className={styles.mostrar}
                onClick={() => setMostrar((v) => !v)}
                aria-pressed={mostrar}
              >
                {mostrar ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          {erro && <p role="alert" className={styles.erro}>{erro}</p>}

          <button type="submit" className={styles.botao} disabled={enviando || !login.trim() || !senha}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className={styles.ajuda}>
          Esqueceu a senha ou ainda não tem acesso?{' '}
          <a href={WHATSAPP_CATIVA} target="_blank" rel="noopener noreferrer">Fale com a Dra. Raquel</a>
        </p>
      </section>
    </main>
  )
}
