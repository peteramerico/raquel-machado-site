import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { api, ApiErro } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import type { Credenciais, ListaUsuarios, Papel, UsuarioItem } from '../../lib/tipos'
import { mensagemAcessoEquipe } from '../../lib/whatsapp'
import CartaoCredenciais from '../painel/CartaoCredenciais'
import styles from '../painel/Painel.module.css'

type Acao = { tipo: 'nova-senha' | 'desativar'; id: number }
type Mostrando = { credenciais: Credenciais; papel: Papel }

const NOME_PAPEL: Record<Papel, string> = { admin: 'Administrador', medica: 'Médica', familia: 'Família' }
const AREA_PAPEL: Record<Exclude<Papel, 'familia'>, { rotulo: string; caminho: string }> = {
  admin: { rotulo: 'Administrador', caminho: '/admin/entrar' },
  medica: { rotulo: 'Área médica', caminho: '/painel/entrar' },
}

function formatarData(iso: string | null): string {
  if (!iso) return 'ainda não entrou'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

export default function AdminUsuarios() {
  const { recarregar } = useAuth()
  const idNome = useId()
  const idLogin = useId()
  const idPapel = useId()
  const [lista, setLista] = useState<ListaUsuarios | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [novo, setNovo] = useState(false)
  const [nome, setNome] = useState('')
  const [login, setLogin] = useState('')
  const [papel, setPapel] = useState<'medica' | 'admin'>('medica')
  const [enviando, setEnviando] = useState(false)
  const [mostrando, setMostrando] = useState<Mostrando | null>(null)
  const [confirmar, setConfirmar] = useState<Acao | null>(null)
  const [ocupado, setOcupado] = useState<number | null>(null)
  const [verFamilias, setVerFamilias] = useState(false)

  const tratar = useCallback((err: unknown, padrao: string) => {
    if (err instanceof ApiErro && err.status === 401) {
      void recarregar() // sessão caiu: a guarda leva ao login
      return
    }
    setErro(err instanceof ApiErro ? err.message : padrao)
  }, [recarregar])

  const carregar = useCallback(async () => {
    try {
      setLista(await api<ListaUsuarios>('/admin/usuarios'))
      setErro(null)
    } catch (err) {
      tratar(err, 'Não foi possível carregar as contas agora.')
    }
  }, [tratar])

  useEffect(() => {
    let ativo = true
    api<ListaUsuarios>('/admin/usuarios')
      .then((l) => { if (ativo) { setLista(l); setErro(null) } })
      .catch((err) => { if (ativo) tratar(err, 'Não foi possível carregar as contas agora.') })
    return () => { ativo = false }
  }, [tratar])

  function mostrarEquipe(c: { nome: string; login: string; senhaTemporaria: string }, p: 'medica' | 'admin') {
    setMostrando({ credenciais: { ...c, contato: null }, papel: p })
  }

  async function criar(e: FormEvent) {
    e.preventDefault()
    if (enviando) return // duplo clique não cria duas contas
    setErro(null)
    setEnviando(true)
    try {
      const r = await api<{ login: string; nome: string; papel: 'medica' | 'admin'; senhaTemporaria: string }>('/admin/usuarios', {
        metodo: 'POST',
        corpo: { nome: nome.trim(), login: login.trim(), papel },
      })
      mostrarEquipe(r, r.papel)
      setNome('')
      setLogin('')
      setNovo(false)
      await carregar()
    } catch (err) {
      tratar(err, 'Não foi possível criar a conta agora.')
    } finally {
      setEnviando(false)
    }
  }

  async function novaSenha(u: UsuarioItem) {
    setOcupado(u.id)
    setConfirmar(null)
    setErro(null)
    try {
      const r = await api<{ login: string; senhaTemporaria: string }>(`/admin/usuarios/${u.id}/redefinir`, { metodo: 'POST', corpo: {} })
      if (u.papel === 'familia') {
        setMostrando({ credenciais: { nome: u.nome, login: r.login, senhaTemporaria: r.senhaTemporaria, contato: u.contato }, papel: 'familia' })
      } else {
        mostrarEquipe({ nome: u.nome, login: r.login, senhaTemporaria: r.senhaTemporaria }, u.papel)
      }
      await carregar()
    } catch (err) {
      tratar(err, 'Não foi possível gerar a nova senha agora.')
    } finally {
      setOcupado(null)
    }
  }

  async function definirAtivo(u: UsuarioItem, ativo: boolean) {
    setOcupado(u.id)
    setConfirmar(null)
    setErro(null)
    try {
      await api(`/admin/usuarios/${u.id}`, { metodo: 'PATCH', corpo: { ativo } })
      await carregar()
    } catch (err) {
      tratar(err, 'Não foi possível alterar a conta agora.')
    } finally {
      setOcupado(null)
    }
  }

  function cartaoDeCredenciais() {
    if (!mostrando) return null
    const { credenciais, papel: p } = mostrando
    const fechar = () => setMostrando(null)
    if (p === 'familia') return <CartaoCredenciais credenciais={credenciais} onFechar={fechar} />
    const area = AREA_PAPEL[p]
    const url = `${window.location.origin}${area.caminho}`
    return (
      <CartaoCredenciais
        credenciais={credenciais}
        onFechar={fechar}
        urlEntrada={url}
        semWhatsApp
        aviso="Copie a mensagem e envie por um canal seguro antes de fechar. A senha é temporária e deve ser trocada no primeiro acesso."
        mensagem={mensagemAcessoEquipe({ nome: credenciais.nome, login: credenciais.login, senha: credenciais.senhaTemporaria, url, area: area.rotulo })}
      />
    )
  }

  function linha(u: UsuarioItem) {
    return (
      <li key={u.id} className={`${styles.cartao} ${u.ativo ? '' : styles.inativo}`}>
        <div className={styles.cartaoTopo}>
          <div>
            <h3 className={styles.nomeFamilia}>
              {u.nome} {u.voce && <span className={styles.voce}>Você</span>}
            </h3>
            <p className={styles.meta}>
              <span className={styles.papel}>{NOME_PAPEL[u.papel]}</span> · Usuário <span className={styles.mono}>{u.login}</span>
            </p>
          </div>
          <span className={u.ativo ? (u.precisaTrocarSenha ? styles.selaAguarda : styles.selaAtiva) : styles.selaInativa}>
            {!u.ativo ? 'Desativada' : u.precisaTrocarSenha ? 'Aguardando 1º acesso' : 'Ativa'}
          </span>
        </div>
        <p className={styles.meta}>Último acesso: {formatarData(u.ultimoAcessoEm)}</p>

        {u.voce ? null : confirmar?.id === u.id ? (
          <div role="alertdialog" aria-label={`Confirmar ação para ${u.nome}`} className={styles.confirmacao}>
            <p>
              {confirmar.tipo === 'nova-senha'
                ? `Gerar uma nova senha temporária para ${u.nome}? A senha atual deixa de valer e a sessão aberta é encerrada.`
                : `Desativar a conta de ${u.nome}? A pessoa sai agora e não consegue entrar até você reativar.`}
            </p>
            <div className={styles.acoes}>
              <button type="button" className={styles.botaoClaro} onClick={() => setConfirmar(null)}>Cancelar</button>
              <button type="button" className={styles.botaoPerigo} onClick={() => (confirmar.tipo === 'nova-senha' ? novaSenha(u) : definirAtivo(u, false))}>
                {confirmar.tipo === 'nova-senha' ? 'Gerar nova senha' : 'Desativar'}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.acoes}>
            {u.ativo ? (
              <>
                <button type="button" className={styles.botaoClaro} disabled={ocupado === u.id} onClick={() => setConfirmar({ tipo: 'nova-senha', id: u.id })}>Nova senha</button>
                <button type="button" className={styles.botaoTexto} disabled={ocupado === u.id} onClick={() => setConfirmar({ tipo: 'desativar', id: u.id })}>Desativar</button>
              </>
            ) : (
              <button type="button" className={styles.botaoClaro} disabled={ocupado === u.id} onClick={() => definirAtivo(u, true)}>Reativar</button>
            )}
          </div>
        )}
      </li>
    )
  }

  const equipe = lista?.itens.filter((u) => u.papel !== 'familia') ?? []
  const familias = lista?.itens.filter((u) => u.papel === 'familia') ?? []

  return (
    <section aria-labelledby="titulo-contas">
      <div className={styles.secaoTopo}>
        <h2 id="titulo-contas" className={styles.secaoTitulo}>Equipe</h2>
        {!novo && (
          <button type="button" className={styles.botaoPrimario} onClick={() => { setNovo(true); setMostrando(null) }}>
            Nova conta
          </button>
        )}
      </div>

      {erro && <p role="alert" className={styles.erro}>{erro}</p>}

      {cartaoDeCredenciais()}

      {novo && (
        <form className={styles.formNovo} onSubmit={criar} noValidate aria-label="Nova conta">
          <div className={styles.campo}>
            <label htmlFor={idNome} className={styles.rotulo}>Nome</label>
            <input id={idNome} className={styles.entrada} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" required />
          </div>
          <div className={styles.campo}>
            <label htmlFor={idLogin} className={styles.rotulo}>Usuário (para entrar)</label>
            <input
              id={idLogin}
              className={styles.entrada}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              placeholder="ex.: dra.maria"
            />
            <p className={styles.dica}>3 a 40 caracteres: letras, números, ponto, hífen ou sublinhado.</p>
          </div>
          <div className={styles.campo}>
            <label htmlFor={idPapel} className={styles.rotulo}>Tipo de conta</label>
            <select id={idPapel} className={styles.entrada} value={papel} onChange={(e) => setPapel(e.target.value as 'medica' | 'admin')}>
              <option value="medica">Médica (Área médica)</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div className={styles.acoes}>
            <button type="submit" className={styles.botaoPrimario} disabled={enviando || nome.trim().length < 2 || login.trim().length < 3}>
              {enviando ? 'Criando…' : 'Criar conta'}
            </button>
            <button type="button" className={styles.botaoTexto} onClick={() => setNovo(false)} disabled={enviando}>Cancelar</button>
          </div>
        </form>
      )}

      {lista === null && !erro && <p role="status" className={styles.estado}>Carregando contas…</p>}

      {lista && equipe.length > 0 && <ul className={styles.lista}>{equipe.map(linha)}</ul>}

      {lista && familias.length > 0 && (
        <div className={styles.blocoFamilias}>
          <button type="button" className={styles.botaoClaro} aria-expanded={verFamilias} onClick={() => setVerFamilias((v) => !v)}>
            {verFamilias ? 'Ocultar famílias' : `Mostrar famílias (${familias.length})`}
          </button>
          {verFamilias && <ul className={styles.lista}>{familias.map(linha)}</ul>}
        </div>
      )}

      {lista && lista.truncada && <p className={styles.dica}>Mostrando as primeiras {lista.itens.length} contas.</p>}
    </section>
  )
}
