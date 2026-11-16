import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { api, ApiErro } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { formatarBRL } from '../../lib/formatar'
import styles from './Painel.module.css'

const FORMATO = /^\d{1,6}([.,]\d{1,2})?$/ // o servidor valida de novo; aqui só poupa uma ida e volta

export default function PainelValor() {
  const { recarregar } = useAuth()
  const idValor = useId()
  const [atual, setAtual] = useState<number | null>(null)
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState<number | null>(null)
  const [enviando, setEnviando] = useState(false)

  const tratar = useCallback((err: unknown, padrao: string) => {
    if (err instanceof ApiErro && err.status === 401) {
      void recarregar()
      return
    }
    setErro(err instanceof ApiErro ? err.message : padrao)
  }, [recarregar])

  useEffect(() => {
    let ativo = true
    api<{ valorConsulta: number }>('/painel/config')
      .then((r) => {
        if (!ativo) return
        setAtual(r.valorConsulta)
        setTexto(r.valorConsulta.toFixed(2).replace('.', ','))
      })
      .catch((err) => { if (ativo) tratar(err, 'Não foi possível carregar o valor agora.') })
    return () => { ativo = false }
  }, [tratar])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (enviando) return
    setErro(null)
    setSalvo(null)
    if (!FORMATO.test(texto.trim())) {
      setErro('Digite o valor em reais, com até 2 casas decimais (por exemplo, 450,00).')
      return
    }
    setEnviando(true)
    try {
      const r = await api<{ valorConsulta: number }>('/painel/config', { metodo: 'PUT', corpo: { valorConsulta: texto.trim() } })
      setAtual(r.valorConsulta)
      setTexto(r.valorConsulta.toFixed(2).replace('.', ','))
      setSalvo(r.valorConsulta)
    } catch (err) {
      tratar(err, 'Não foi possível salvar o valor agora.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section aria-labelledby="titulo-valor">
      <div className={styles.secaoTopo}>
        <h2 id="titulo-valor" className={styles.secaoTitulo}>Valor da consulta</h2>
      </div>
      <p className={styles.explica}>
        É o valor que as famílias veem no guia da consulta. Ao salvar, o guia já passa a mostrar o novo valor — sem esperar nenhuma atualização do site.
      </p>

      {atual !== null && (
        <p className={styles.valorAtual}>
          <span className={styles.rotulo}>Valor atual</span>
          <strong className={styles.valorGrande}>{formatarBRL(atual)}</strong>
        </p>
      )}

      <form className={styles.formNovo} onSubmit={salvar} noValidate>
        <div className={styles.campo}>
          <label htmlFor={idValor} className={styles.rotulo}>Novo valor (R$)</label>
          <input
            id={idValor}
            className={styles.entrada}
            inputMode="decimal"
            autoComplete="off"
            placeholder="450,00"
            value={texto}
            onChange={(e) => { setTexto(e.target.value); setSalvo(null) }}
          />
          <p className={styles.dica}>Entre 1,00 e 100.000,00, com até 2 casas decimais. Pode usar vírgula.</p>
        </div>

        {erro && <p role="alert" className={styles.erro}>{erro}</p>}
        {salvo !== null && (
          <p role="status" className={styles.sucesso}>Valor atualizado para {formatarBRL(salvo)}. O guia da família já mostra o novo valor.</p>
        )}

        <div className={styles.acoes}>
          <button type="submit" className={styles.botaoPrimario} disabled={enviando || atual === null || texto.trim() === ''}>
            {enviando ? 'Salvando…' : 'Salvar valor'}
          </button>
        </div>
      </form>
    </section>
  )
}
