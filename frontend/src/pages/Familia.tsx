import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import BarraSessao from '../components/BarraSessao'
import { api, ApiErro } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatarBRL } from '../lib/formatar'
import type { Guia, RespostaGuia } from '../lib/tipos'
import { useNoIndex } from '../lib/useNoIndex'
import { useRevelar } from '../lib/useRevelar'
import styles from './Familia.module.css'
import { Foto } from '../components/Foto'

function Revelar({ children, atraso = 0, className = '' }: { children: ReactNode; atraso?: number; className?: string }) {
  const { ref, visivel } = useRevelar<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className={`${styles.revelar} ${className}`}
      data-visivel={visivel}
      style={{ '--atraso': `${atraso}ms` } as CSSProperties}
    >
      {children}
    </div>
  )
}

function Capitulo({ guia, id, numero, children }: { guia: Guia; id: string; numero: number; children: ReactNode }) {
  const cap = guia.capitulos.find((c) => c.id === id)!
  return (
    <section id={id} className={styles.capitulo} aria-labelledby={`${id}-titulo`}>
      <div className={styles.capInner}>
        <header className={styles.capCabecalho}>
          <span className={styles.capNumero} aria-hidden="true">{String(numero).padStart(2, '0')}</span>
          <h2 id={`${id}-titulo`} className={styles.capTitulo}>{cap.titulo}</h2>
        </header>
        {children}
      </div>
    </section>
  )
}

function GuiaConteudo({ guia, valorConsulta }: { guia: Guia; valorConsulta: number }) {
  const { puericultura, retorno, calendario, prenatal, trazer, whatsapp } = guia

  return (
    <div className={styles.page}>
      <main>
        {/* ABERTURA */}
        <section className={styles.hero}>
          <div className={styles.heroBg} />
          <div className={styles.sessao}><BarraSessao /></div>
          <div className={styles.heroInner}>
            <div className={styles.heroTexto}>
              <p className={styles.eyebrow}>Área da família</p>
              <h1 className={styles.heroTitulo}>
                Guia da <em>consulta</em> com a Dra. Raquel
              </h1>
              <p className={styles.heroSub}>{guia.subtitulo}</p>
              <p className={styles.heroAbertura}>{guia.abertura}</p>
              <nav aria-label="Neste guia" className={styles.indice}>
                {guia.capitulos.map((c, i) => (
                  <a key={c.id} href={`#${c.id}`} className={styles.chip}>
                    <span className={styles.chipNum}>{String(i + 1).padStart(2, '0')}</span>
                    {c.rotulo}
                  </a>
                ))}
              </nav>
            </div>
            <div className={styles.heroFoto}>
              <div className={styles.fotoMancha} aria-hidden="true" />
              <div className={styles.fotoAnel} aria-hidden="true" />
              <Foto nome="hero" larguras={[480, 800, 1200]} reserva={1200} largura={1200} altura={1810} sizes="(max-width: 500px) 78vw, 390px" alt="Dra. Raquel Machado, pediatra e neonatologista" className={styles.fotoImg} prioridade />
            </div>
          </div>
        </section>

        {/* 1 PUERICULTURA */}
        <Capitulo guia={guia} id="puericultura" numero={1}>
          <Revelar className={styles.prosa}>
            {puericultura.map((p) => <p key={p}>{p}</p>)}
          </Revelar>
        </Capitulo>

        {/* 2 RETORNO */}
        <Capitulo guia={guia} id="retorno" numero={2}>
          <Revelar className={styles.prosa}><p>{retorno.intro}</p></Revelar>
          <div className={styles.comparar}>
            <Revelar className={styles.cartaoClaro}>
              <span className={styles.cartaoRotulo}>{retorno.puericultura.rotulo}</span>
              <ul className={styles.pontos}>{retorno.puericultura.pontos.map((p) => <li key={p}>{p}</li>)}</ul>
            </Revelar>
            <Revelar atraso={120} className={styles.cartaoRosa}>
              <span className={styles.cartaoRotulo}>{retorno.retorno.rotulo}</span>
              <ul className={styles.pontos}>{retorno.retorno.pontos.map((p) => <li key={p}>{p}</li>)}</ul>
            </Revelar>
          </div>
        </Capitulo>

        {/* 3 CALENDÁRIO */}
        <Capitulo guia={guia} id="calendario" numero={3}>
          <Revelar className={styles.prosa}><p>{calendario.intro}</p></Revelar>
          <Revelar className={styles.grupo}>
            <ol className={styles.linhaTempo}>
              {calendario.faixas.map((f, i) => (
                <li key={f.idade} data-faixa className={styles.faixa} style={{ '--i': i } as CSSProperties}>
                  <span className={styles.faixaPonto} aria-hidden="true" />
                  <span className={styles.faixaIdade}>{f.idade}</span>
                  <span className={styles.faixaFreq}>{f.frequencia}</span>
                </li>
              ))}
            </ol>
          </Revelar>
          <Revelar className={styles.notaOuro}>
            <span className={styles.notaRotulo}>{calendario.prematuro.rotulo}</span>
            <p>{calendario.prematuro.texto}</p>
          </Revelar>
        </Capitulo>

        {/* 4 PRÉ-NATAL */}
        <Capitulo guia={guia} id="prenatal" numero={4}>
          <div className={styles.prenatal}>
            <Revelar className={styles.semana}>
              <span className={styles.semanaNum} aria-hidden="true">{prenatal.semana}</span>
              <span className={styles.semanaLegenda}>{prenatal.legendaSemana}</span>
            </Revelar>
            <Revelar atraso={100} className={styles.prosa}>
              <p>{prenatal.texto}</p>
              <p className={styles.destaqueInline}>{prenatal.trazer}</p>
            </Revelar>
          </div>
        </Capitulo>

        {/* 5 O QUE TRAZER */}
        <Capitulo guia={guia} id="trazer" numero={5}>
          <Revelar className={styles.grupo}>
            <ul className={styles.checklist}>
              {trazer.itens.map((it, i) => (
                <li key={it.titulo} className={styles.item} style={{ '--i': i } as CSSProperties}>
                  <svg className={styles.check} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.14" />
                    <path d="M7 12.5l3.2 3.2L17 8.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className={styles.itemTitulo}>{it.titulo}</span>
                  {'detalhe' in it && it.detalhe && <span className={styles.itemDetalhe}>{it.detalhe}</span>}
                </li>
              ))}
            </ul>
          </Revelar>
        </Capitulo>

        {/* 6 WHATSAPP */}
        <Capitulo guia={guia} id="whatsapp" numero={6}>
          <Revelar className={styles.prosa}><p>{whatsapp.texto}</p></Revelar>
          <div className={styles.horarios}>
            {whatsapp.horarios.map((h) => (
              <Revelar key={h.quando} className={styles.horario}>
                <span className={styles.horarioQuando}>{h.quando}</span>
                <span className={styles.horarioComo}>{h.como}</span>
              </Revelar>
            ))}
          </div>
          <Revelar className={styles.urgencia}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={styles.urgenciaIcone}>
              <path d="M12 3l10 18H2L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M12 10v5M12 18v.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <p>{whatsapp.urgencia}</p>
          </Revelar>
        </Capitulo>

        {/* 7 VALOR */}
        <Capitulo guia={guia} id="valor" numero={7}>
          <Revelar className={styles.ticket}>
            <span className={styles.ticketRotulo}>{guia.valor.rotulo}</span>
            <span className={styles.ticketPreco}>{formatarBRL(valorConsulta)}</span>
          </Revelar>
        </Capitulo>

        {/* ASSINATURA */}
        <section className={styles.assinatura} aria-label="Assinatura">
          <Foto nome="sobre" larguras={[480, 920, 1200]} reserva={1200} largura={1200} altura={1801} sizes="96px" alt="" className={styles.assinaturaFoto} />
          <p className={styles.assinaturaNome}>{guia.assinatura.nome}</p>
          <p className={styles.assinaturaTitulo}>{guia.assinatura.titulo}</p>
        </section>
      </main>
    </div>
  )
}

type Estado =
  | { situacao: 'carregando' }
  | { situacao: 'erro'; mensagem: string }
  | { situacao: 'ok'; dados: RespostaGuia }

// Página da Área da família: o guia vem da API (só para quem está logado); não fica no bundle público.
export default function Familia() {
  const { recarregar } = useAuth()
  const [estado, setEstado] = useState<Estado>({ situacao: 'carregando' })
  const [tentativa, setTentativa] = useState(0)

  useNoIndex('Guia da consulta · Dra. Raquel Machado')

  const buscar = useCallback(async (): Promise<Estado> => {
    try {
      return { situacao: 'ok', dados: await api<RespostaGuia>('/familia/guia') }
    } catch (err) {
      if (err instanceof ApiErro && (err.status === 401 || err.codigo === 'trocar_senha')) {
        void recarregar() // sessão caiu / senha pendente: a guarda de rota decide a próxima tela
        return { situacao: 'carregando' }
      }
      return { situacao: 'erro', mensagem: err instanceof ApiErro ? err.message : 'Não foi possível carregar o guia agora.' }
    }
  }, [recarregar])

  useEffect(() => {
    let ativo = true
    buscar().then((e) => {
      if (ativo) setEstado(e)
    })
    return () => {
      ativo = false
    }
  }, [buscar, tentativa])

  if (estado.situacao === 'ok') return <GuiaConteudo guia={estado.dados.guia} valorConsulta={estado.dados.valorConsulta} />

  return (
    <div className={styles.page}>
      <main className={styles.estadoPagina}>
        <div className={styles.sessao}><BarraSessao /></div>
        {estado.situacao === 'carregando' ? (
          <p role="status" className={styles.estadoTexto}>Carregando o guia…</p>
        ) : (
          <div className={styles.estadoErro}>
            <p role="alert" className={styles.estadoTexto}>{estado.mensagem}</p>
            <button type="button" className={styles.estadoBotao} onClick={() => { setEstado({ situacao: 'carregando' }); setTentativa((n) => n + 1) }}>
              Tentar de novo
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
