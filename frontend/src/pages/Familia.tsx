import { useEffect, type CSSProperties, type ReactNode } from 'react'
import SiteFooter from '../components/SiteFooter'
import SiteHeader from '../components/SiteHeader'
import { guia } from '../content/guiaConsulta'
import { useRevelar } from '../lib/useRevelar'
import { formatarBRL, useValorConsulta } from '../lib/valorConsulta'
import styles from './Familia.module.css'

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

function Capitulo({ id, numero, children }: { id: string; numero: number; children: ReactNode }) {
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

export default function Familia() {
  const valor = useValorConsulta()

  // Página sem login por enquanto: não indexar. (Sem Disallow no robots.txt de propósito —
  // ele esconderia o noindex e ainda anunciaria a URL.)
  useEffect(() => {
    const tituloAnterior = document.title
    document.title = 'Guia da consulta · Dra. Raquel Machado'
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => {
      document.title = tituloAnterior
      meta.remove()
    }
  }, [])

  const { puericultura, retorno, calendario, prenatal, trazer, whatsapp } = guia

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main>
        {/* ABERTURA */}
        <section className={styles.hero}>
          <div className={styles.heroBg} />
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
              <img src="/images/hero.jpg" alt="Dra. Raquel Machado, pediatra e neonatologista" className={styles.fotoImg} />
            </div>
          </div>
        </section>

        {/* 1 PUERICULTURA */}
        <Capitulo id="puericultura" numero={1}>
          <Revelar className={styles.prosa}>
            {puericultura.map((p) => <p key={p}>{p}</p>)}
          </Revelar>
        </Capitulo>

        {/* 2 RETORNO */}
        <Capitulo id="retorno" numero={2}>
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
        <Capitulo id="calendario" numero={3}>
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
        <Capitulo id="prenatal" numero={4}>
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
        <Capitulo id="trazer" numero={5}>
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
        <Capitulo id="whatsapp" numero={6}>
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
        <Capitulo id="valor" numero={7}>
          <Revelar className={styles.ticket}>
            <span className={styles.ticketRotulo}>{guia.valor.rotulo}</span>
            <span className={styles.ticketPreco}>{formatarBRL(valor)}</span>
          </Revelar>
        </Capitulo>

        {/* ASSINATURA */}
        <section className={styles.assinatura} aria-label="Assinatura">
          <img src="/images/sobre.jpg" alt="" className={styles.assinaturaFoto} />
          <p className={styles.assinaturaNome}>{guia.assinatura.nome}</p>
          <p className={styles.assinaturaTitulo}>{guia.assinatura.titulo}</p>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
