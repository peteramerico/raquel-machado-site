import { Link, Navigate, useParams } from 'react-router-dom'
import { buscarPalestra, type Palestra as DadosPalestra } from '../content/palestras'
import { useTitulo } from '../lib/useTitulo'
import styles from './Palestra.module.css'

function Conteudo({ palestra }: { palestra: DadosPalestra }) {
  useTitulo(`${palestra.titulo} · Dra. Raquel Machado`)
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <Link to="/palestras" className={styles.voltar}>← Todas as palestras</Link>
        <p className={styles.eyebrow}>Palestra</p>
        <h1 className={styles.titulo}>{palestra.titulo}</h1>
        <p className={styles.subtitulo}>{palestra.subtitulo}</p>

        <div className={styles.palco}>
          <iframe
            src={palestra.caminho}
            title={palestra.tituloIframe}
            allow="fullscreen"
            allowFullScreen
            loading="lazy"
            style={{ width: '100%', height: '100%', border: 0 }}
          />
        </div>

        <div className={styles.acoes}>
          {/* <a> comum, não <Link>: o destino fica fora da SPA */}
          <a href={palestra.caminho} target="_blank" rel="noopener" className={styles.botao}>
            Abrir em tela cheia
          </a>
          <p className={styles.ajuda}>
            Use as setas do teclado, a barra de espaço ou toque para avançar. Tecla F: tela cheia. Esc: visão geral.
          </p>
        </div>

        <section className={styles.evento} aria-labelledby="evento-palestra">
          <p className={styles.eventoNome}>{palestra.evento.nome}</p>
          <h2 id="evento-palestra" className={styles.eventoMesa}>
            Mesa redonda: {palestra.evento.mesa}
          </h2>
          <dl className={styles.eventoDados}>
            <div>
              <dt>Data</dt>
              <dd>{palestra.evento.data}, {palestra.evento.horario}</dd>
            </div>
            <div>
              <dt>Local</dt>
              <dd>{palestra.evento.local}</dd>
            </div>
          </dl>
          <ol className={styles.programa}>
            {palestra.evento.programa.map((i) => (
              <li key={i.titulo}>
                <span className={styles.programaTitulo}>{i.titulo}</span>
                <span className={styles.programaQuem}>{i.quem} · {i.duracao}</span>
              </li>
            ))}
          </ol>
          <p className={styles.debatedoras}>
            Debatedoras: {palestra.evento.debatedoras.join(' e ')}.
          </p>
        </section>

        <section className={styles.sobre} aria-labelledby="sobre-palestra">
          <h2 id="sobre-palestra" className={styles.sobreTitulo}>Sobre a palestra</h2>
          <p className={styles.resumo}>{palestra.resumo}</p>
          <h3 className={styles.temasTitulo}>Temas</h3>
          <ul className={styles.temas}>
            {palestra.temas.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}

export default function Palestra() {
  const { slug } = useParams()
  const palestra = buscarPalestra(slug)
  if (!palestra) return <Navigate to="/palestras" replace />
  return <Conteudo palestra={palestra} />
}
