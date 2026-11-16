import { useState } from 'react'
import type { Credenciais } from '../../lib/tipos'
import { linkWhatsApp, mensagemAcesso } from '../../lib/whatsapp'
import styles from './Painel.module.css'

// Cartão que mostra o acesso gerado UMA vez (a senha temporária não é guardada em lugar nenhum).
// Fechar sem ter copiado/enviado pede confirmação — a senha se perde ao fechar.
interface Props {
  credenciais: Credenciais
  onFechar: () => void
  // Padrões = família. Equipe (médica/admin) passa o login da própria área, um aviso sem "família" e semWhatsApp.
  urlEntrada?: string
  aviso?: string
  mensagem?: string
  semWhatsApp?: boolean
}

export default function CartaoCredenciais({ credenciais, onFechar, urlEntrada, aviso, mensagem, semWhatsApp = false }: Props) {
  const [usado, setUsado] = useState(false) // copiou a mensagem ou abriu o WhatsApp
  const [copiado, setCopiado] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  const url = urlEntrada ?? `${window.location.origin}/familia/entrar`
  const texto = mensagem ?? mensagemAcesso({ nome: credenciais.nome, login: credenciais.login, senha: credenciais.senhaTemporaria, url })
  const link = semWhatsApp ? null : linkWhatsApp(credenciais.contato, texto)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setUsado(true)
    } catch {
      setCopiado(false) // sem permissão de área de transferência: a mensagem está visível abaixo para copiar à mão
    }
  }

  function fechar() {
    if (usado) return onFechar()
    setConfirmando(true)
  }

  return (
    <section className={styles.credenciais} aria-labelledby="titulo-credenciais" role="region">
      <h2 id="titulo-credenciais" className={styles.credTitulo}>Acesso de {credenciais.nome}</h2>
      <p className={styles.credAviso}>
        <strong>Esta senha só aparece agora.</strong>{' '}
        {aviso ?? 'Copie a mensagem ou envie pelo WhatsApp antes de fechar. Peça para a família entrar logo: a senha é temporária e deve ser trocada no primeiro acesso.'}
      </p>

      <dl className={styles.credDados}>
        <div>
          <dt>Usuário</dt>
          <dd className={styles.mono}>{credenciais.login}</dd>
        </div>
        <div>
          <dt>Senha temporária</dt>
          <dd className={`${styles.mono} ${styles.credSenha}`}>{credenciais.senhaTemporaria}</dd>
        </div>
      </dl>

      <pre className={styles.credMensagem} aria-label="Mensagem pronta">{texto}</pre>

      <div className={styles.credAcoes}>
        <button type="button" className={styles.botaoClaro} onClick={copiar}>
          {copiado ? 'Mensagem copiada ✓' : 'Copiar mensagem'}
        </button>
        {link ? (
          <a className={styles.botaoPrimario} href={link} target="_blank" rel="noopener noreferrer" onClick={() => setUsado(true)}>
            Enviar pelo WhatsApp
          </a>
        ) : (
          !semWhatsApp && <span className={styles.credSemContato}>Sem WhatsApp cadastrado: use “Copiar mensagem”.</span>
        )}
        <button type="button" className={styles.botaoTexto} onClick={fechar}>Fechar</button>
      </div>

      {confirmando && (
        <div role="alertdialog" aria-label="Fechar sem copiar" className={styles.confirmacao}>
          <p>Você ainda não copiou nem enviou a mensagem. Fechando, a senha se perde (dá para gerar uma nova depois).</p>
          <div className={styles.credAcoes}>
            <button type="button" className={styles.botaoClaro} onClick={() => setConfirmando(false)}>Voltar</button>
            <button type="button" className={styles.botaoPerigo} onClick={onFechar}>Fechar mesmo assim</button>
          </div>
        </div>
      )}
    </section>
  )
}
