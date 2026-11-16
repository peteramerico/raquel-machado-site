import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { api, ApiErro } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import type { Credenciais, FamiliaItem, ListaFamilias } from '../../lib/tipos'
import CartaoCredenciais from './CartaoCredenciais'
import styles from './Painel.module.css'

type Acao = { tipo: 'nova-senha' | 'desativar'; id: number }

function formatarData(iso: string | null): string {
  if (!iso) return 'ainda não entrou'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

export default function PainelFamilias() {
  const { recarregar } = useAuth()
  const idNome = useId()
  const idContato = useId()
  const [lista, setLista] = useState<ListaFamilias | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [novo, setNovo] = useState(false)
  const [nome, setNome] = useState('')
  const [contato, setContato] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [credenciais, setCredenciais] = useState<Credenciais | null>(null)
  const [confirmar, setConfirmar] = useState<Acao | null>(null)
  const [ocupado, setOcupado] = useState<number | null>(null)

  // 401 no meio da sessão: pede à guarda para reavaliar (ela leva ao login) em vez de mostrar um "erro" confuso
  const tratar = useCallback((err: unknown, padrao: string) => {
    if (err instanceof ApiErro && err.status === 401) {
      void recarregar()
      return
    }
    setErro(err instanceof ApiErro ? err.message : padrao)
  }, [recarregar])

  const carregar = useCallback(async () => {
    try {
      setLista(await api<ListaFamilias>('/painel/familias'))
      setErro(null)
    } catch (err) {
      tratar(err, 'Não foi possível carregar as famílias agora.')
    }
  }, [tratar])

  useEffect(() => {
    let ativo = true
    api<ListaFamilias>('/painel/familias')
      .then((l) => { if (ativo) { setLista(l); setErro(null) } })
      .catch((err) => { if (ativo) tratar(err, 'Não foi possível carregar as famílias agora.') })
    return () => { ativo = false }
  }, [tratar])

  async function criar(e: FormEvent) {
    e.preventDefault()
    if (enviando) return // duplo clique não cria duas contas
    setErro(null)
    setEnviando(true)
    try {
      const r = await api<{ login: string; nome: string; contato: string | null; senhaTemporaria: string }>('/painel/familias', {
        metodo: 'POST',
        corpo: { nome: nome.trim(), contato: contato.trim() || undefined },
      })
      // `contato` volta do servidor já normalizado (DDI 55), pronto para o link do WhatsApp
      setCredenciais({ nome: r.nome, login: r.login, senhaTemporaria: r.senhaTemporaria, contato: r.contato })
      setNome('')
      setContato('')
      setNovo(false)
      await carregar()
    } catch (err) {
      tratar(err, 'Não foi possível criar o acesso agora.')
    } finally {
      setEnviando(false)
    }
  }

  async function novaSenha(f: FamiliaItem) {
    setOcupado(f.id)
    setConfirmar(null)
    setErro(null)
    try {
      const r = await api<{ login: string; senhaTemporaria: string }>(`/painel/familias/${f.id}/redefinir`, { metodo: 'POST', corpo: {} })
      setCredenciais({ nome: f.nome, login: r.login, senhaTemporaria: r.senhaTemporaria, contato: f.contato })
      await carregar()
    } catch (err) {
      tratar(err, 'Não foi possível gerar a nova senha agora.')
    } finally {
      setOcupado(null)
    }
  }

  async function definirAtivo(f: FamiliaItem, ativo: boolean) {
    setOcupado(f.id)
    setConfirmar(null)
    setErro(null)
    try {
      await api(`/painel/familias/${f.id}`, { metodo: 'PATCH', corpo: { ativo } })
      await carregar()
    } catch (err) {
      tratar(err, 'Não foi possível alterar a conta agora.')
    } finally {
      setOcupado(null)
    }
  }

  return (
    <section aria-labelledby="titulo-familias">
      <div className={styles.secaoTopo}>
        <h2 id="titulo-familias" className={styles.secaoTitulo}>Famílias</h2>
        {!novo && (
          <button type="button" className={styles.botaoPrimario} onClick={() => { setNovo(true); setCredenciais(null) }}>
            Novo acesso
          </button>
        )}
      </div>

      {erro && <p role="alert" className={styles.erro}>{erro}</p>}

      {credenciais && <CartaoCredenciais credenciais={credenciais} onFechar={() => setCredenciais(null)} />}

      {novo && (
        <form className={styles.formNovo} onSubmit={criar} noValidate aria-label="Novo acesso">
          <div className={styles.campo}>
            <label htmlFor={idNome} className={styles.rotulo}>Nome da família ou do responsável</label>
            <input id={idNome} className={styles.entrada} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" required />
          </div>
          <div className={styles.campo}>
            <label htmlFor={idContato} className={styles.rotulo}>WhatsApp (opcional)</label>
            <input
              id={idContato}
              className={styles.entrada}
              value={contato}
              onChange={(e) => setContato(e.target.value)}
              inputMode="tel"
              placeholder="(84) 99999-0000"
              autoComplete="off"
            />
            <p className={styles.dica}>Com o WhatsApp, a mensagem de acesso abre pronta para enviar.</p>
          </div>
          <div className={styles.acoes}>
            <button type="submit" className={styles.botaoPrimario} disabled={enviando || nome.trim().length < 2}>
              {enviando ? 'Criando…' : 'Criar acesso'}
            </button>
            <button type="button" className={styles.botaoTexto} onClick={() => setNovo(false)} disabled={enviando}>Cancelar</button>
          </div>
        </form>
      )}

      {lista === null && !erro && <p role="status" className={styles.estado}>Carregando famílias…</p>}

      {lista && lista.itens.length === 0 && (
        <p className={styles.vazio}>Nenhuma família cadastrada ainda. Use “Novo acesso” para liberar a primeira.</p>
      )}

      {lista && lista.truncada && (
        <p className={styles.dica}>Mostrando as primeiras {lista.itens.length} famílias.</p>
      )}

      {lista && lista.itens.length > 0 && (
        <ul className={styles.lista}>
          {lista.itens.map((f) => (
            <li key={f.id} className={`${styles.cartao} ${f.ativo ? '' : styles.inativo}`}>
              <div className={styles.cartaoTopo}>
                <div>
                  <h3 className={styles.nomeFamilia}>{f.nome}</h3>
                  <p className={styles.meta}>
                    Usuário <span className={styles.mono}>{f.login}</span>
                    {f.contato ? ` · WhatsApp ${f.contato}` : ''}
                  </p>
                </div>
                <span className={f.ativo ? (f.precisaTrocarSenha ? styles.selaAguarda : styles.selaAtiva) : styles.selaInativa}>
                  {!f.ativo ? 'Desativada' : f.precisaTrocarSenha ? 'Aguardando 1º acesso' : 'Ativa'}
                </span>
              </div>
              <p className={styles.meta}>Último acesso: {formatarData(f.ultimoAcessoEm)}</p>

              {confirmar?.id === f.id ? (
                <div role="alertdialog" aria-label={`Confirmar ação para ${f.nome}`} className={styles.confirmacao}>
                  <p>
                    {confirmar.tipo === 'nova-senha'
                      ? `Gerar uma nova senha temporária para ${f.nome}? A senha atual deixa de valer e a sessão aberta é encerrada.`
                      : `Desativar o acesso de ${f.nome}? A família sai agora e não consegue entrar até você reativar.`}
                  </p>
                  <div className={styles.acoes}>
                    <button type="button" className={styles.botaoClaro} onClick={() => setConfirmar(null)}>Cancelar</button>
                    <button
                      type="button"
                      className={styles.botaoPerigo}
                      onClick={() => (confirmar.tipo === 'nova-senha' ? novaSenha(f) : definirAtivo(f, false))}
                    >
                      {confirmar.tipo === 'nova-senha' ? 'Gerar nova senha' : 'Desativar'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.acoes}>
                  {f.ativo ? (
                    <>
                      <button type="button" className={styles.botaoClaro} disabled={ocupado === f.id} onClick={() => setConfirmar({ tipo: 'nova-senha', id: f.id })}>Nova senha</button>
                      <button type="button" className={styles.botaoTexto} disabled={ocupado === f.id} onClick={() => setConfirmar({ tipo: 'desativar', id: f.id })}>Desativar</button>
                    </>
                  ) : (
                    <button type="button" className={styles.botaoClaro} disabled={ocupado === f.id} onClick={() => definirAtivo(f, true)}>Reativar</button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
