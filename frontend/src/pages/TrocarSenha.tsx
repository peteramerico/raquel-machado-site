import { useId, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { api, ApiErro } from '../lib/api'
import { DESTINO_PADRAO, ENTRADA } from '../lib/areas'
import { destinoSeguro, useAuth } from '../lib/auth'
import type { Area } from '../lib/tipos'
import { useNoIndex } from '../lib/useNoIndex'
import styles from './Acesso.module.css'

// Troca da senha (obrigatória no 1º acesso, quando a conta tem senha temporária).
export default function TrocarSenha() {
  const { estado, recarregar } = useAuth()
  const navegar = useNavigate()
  const local = useLocation()
  const idAtual = useId()
  const idNova = useId()
  const idConfirma = useId()
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirma, setConfirma] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useNoIndex('Trocar senha · Dra. Raquel Machado')

  const dadosRota = local.state as { de?: unknown; area?: Area } | null
  const area: Area = dadosRota?.area ?? 'familia'
  const destino = destinoSeguro(dadosRota?.de, DESTINO_PADRAO[area])

  if (estado.situacao === 'carregando') {
    return <main className={styles.pagina}><p role="status" className={styles.estado}>Carregando…</p></main>
  }
  if (estado.situacao === 'anonimo') {
    return <Navigate to={ENTRADA[area]} replace />
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (enviando) return
    setErro(null)
    if (nova.length < 10) return setErro('A nova senha precisa ter pelo menos 10 caracteres.')
    if (nova !== confirma) return setErro('A confirmação não é igual à nova senha.')
    setEnviando(true)
    try {
      await api('/auth/trocar-senha', { metodo: 'POST', corpo: { senhaAtual: atual, novaSenha: nova } })
      await recarregar()
      navegar(destino, { replace: true })
    } catch (err) {
      setErro(err instanceof ApiErro ? err.message : 'Não foi possível trocar a senha agora. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  const tipo = mostrar ? 'text' : 'password'
  const pendente = estado.usuario.precisaTrocarSenha

  return (
    <main className={styles.pagina}>
      <section className={styles.cartao} aria-labelledby="titulo-senha">
        <span className={styles.selo} aria-hidden="true">R</span>
        <p className={styles.eyebrow}>{pendente ? 'Primeiro acesso' : 'Sua conta'}</p>
        <h1 id="titulo-senha" className={styles.titulo}>Crie sua senha</h1>
        <p className={styles.chamada}>
          {pendente
            ? 'A senha que você recebeu é temporária. Escolha uma só sua para continuar.'
            : 'Escolha uma nova senha para a sua conta.'}
        </p>

        <form className={styles.form} onSubmit={enviar} noValidate>
          <div className={styles.campo}>
            <label htmlFor={idAtual} className={styles.rotulo}>{pendente ? 'Senha temporária' : 'Senha atual'}</label>
            <input id={idAtual} className={styles.entrada} type={tipo} autoComplete="current-password" required value={atual} onChange={(e) => setAtual(e.target.value)} />
          </div>

          <div className={styles.campo}>
            <label htmlFor={idNova} className={styles.rotulo}>Nova senha</label>
            <div className={styles.senhaCampo}>
              <input id={idNova} className={styles.entrada} type={tipo} autoComplete="new-password" required aria-describedby="regras-senha" value={nova} onChange={(e) => setNova(e.target.value)} />
              <button type="button" className={styles.mostrar} onClick={() => setMostrar((v) => !v)} aria-pressed={mostrar}>
                {mostrar ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <p id="regras-senha" className={styles.dica}>
              Pelo menos 10 caracteres. Uma frase longa é mais segura e mais fácil de lembrar. Não use o seu usuário nem o seu nome.
            </p>
          </div>

          <div className={styles.campo}>
            <label htmlFor={idConfirma} className={styles.rotulo}>Repita a nova senha</label>
            <input id={idConfirma} className={styles.entrada} type={tipo} autoComplete="new-password" required value={confirma} onChange={(e) => setConfirma(e.target.value)} />
          </div>

          {erro && <p role="alert" className={styles.erro}>{erro}</p>}

          <button type="submit" className={styles.botao} disabled={enviando || !atual || !nova || !confirma}>
            {enviando ? 'Salvando…' : 'Salvar nova senha'}
          </button>
        </form>
      </section>
    </main>
  )
}
