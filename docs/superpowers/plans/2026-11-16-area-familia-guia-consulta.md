# Área da família — Guia da consulta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar `/familia` (guia da consulta, sem login) com header/footer compartilhados, valor da consulta como fonte única e testes.

**Architecture:** Conteúdo em `content/guiaConsulta.ts` (separado do layout, pronto para virar API). `SiteHeader`/`SiteFooter` substituem nav/footer embutidos da Home sem mudar o visual. Preço só via `useValorConsulta()`.

**Tech Stack:** React 19, Vite 8, TypeScript, React Router 7 (`BrowserRouter`), CSS Modules, Vitest + Testing Library (novo).

**Spec:** `docs/superpowers/specs/2026-11-15-area-familia-guia-consulta-design.md` · **Branch:** `feat/area-familia-guia` · **Pasta de trabalho:** `frontend/`

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/setupTests.ts`, `vite.config.ts` | infra Vitest (mesma do Primeiro Colo) |
| `src/styles/tokens.css` | tokens do site em `:root` |
| `src/lib/valorConsulta.ts` (+ `.test.ts`, `.guard.test.ts`) | fonte única do preço |
| `src/content/contatos.ts` | WhatsApp/Instagram/clínicas (hoje constantes soltas na Home) |
| `src/content/guiaConsulta.ts` (+ `.test.ts`) | todo o texto e dados do guia |
| `src/components/SiteHeader.tsx` / `.module.css` (+ `.test.tsx`) | header compartilhado + hambúrguer |
| `src/components/SiteFooter.tsx` / `.module.css` | rodapé compartilhado |
| `src/lib/useRevelar.ts` | revelação ao rolar (IntersectionObserver) |
| `src/lib/ScrollToHash.tsx` | rola para `#âncora` / topo ao navegar |
| `src/pages/Familia.tsx` / `.module.css` (+ `.test.tsx`) | a página |
| `src/pages/Home.tsx` / `.module.css` | trocar nav/footer inline pelos componentes |
| `src/App.tsx` | rota `/familia` + `ScrollToHash` |

---

### Task 1: Infra de testes (Vitest)

**Files:** Modify `frontend/package.json`, `frontend/vite.config.ts` · Create `frontend/src/setupTests.ts`

- [ ] **Step 1: Instalar**

```bash
cd frontend && npm i -D vitest@^4.1.10 jsdom@^29.1.1 @testing-library/react@^16.3.2 @testing-library/jest-dom@^7.0.0 @testing-library/user-event@^14
```

- [ ] **Step 2: Script de teste** — em `package.json`, dentro de `scripts`, adicionar `"test": "vitest run"`.

- [ ] **Step 3: `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
})
```

- [ ] **Step 4: `src/setupTests.ts`**

```ts
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(cleanup)
```

- [ ] **Step 5: Verificar** — `npm test` → "No test files found" (exit 1 é esperado aqui) e `npm run build` passa.
- [ ] **Step 6: Commit** — `git add -A frontend && git commit -m "chore(test): vitest + testing-library"`

---

### Task 2: Tokens e fonte única do valor

**Files:** Create `src/styles/tokens.css`, `src/lib/valorConsulta.ts`, `src/lib/valorConsulta.test.ts`, `src/lib/valorConsulta.guard.test.ts` · Modify `src/main.tsx`

- [ ] **Step 1: Testes que falham** — `src/lib/valorConsulta.test.ts`

```ts
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VALOR_CONSULTA_PADRAO, formatarBRL, useValorConsulta } from './valorConsulta'

describe('valorConsulta', () => {
  it('o valor padrão é 400', () => {
    expect(VALOR_CONSULTA_PADRAO).toBe(400)
  })
  it('formata em reais no padrão brasileiro', () => {
    expect(formatarBRL(400)).toBe('R$ 400,00')
    expect(formatarBRL(1234.5)).toBe('R$ 1.234,50')
  })
  it('o hook devolve o valor padrão', () => {
    const { result } = renderHook(() => useValorConsulta())
    expect(result.current).toBe(400)
  })
})
```

`src/lib/valorConsulta.guard.test.ts` — impede preço escrito fora da fonte única:

```ts
import { describe, expect, it } from 'vitest'

const arquivos = import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

describe('guarda do valor da consulta', () => {
  it('nenhum arquivo de produção escreve o preço fixo', () => {
    const ofensores = Object.entries(arquivos)
      .filter(([caminho]) => !/valorConsulta|\.test\.|setupTests/.test(caminho))
      .filter(([, conteudo]) => /R\$\s*400|400,00/.test(conteudo))
      .map(([caminho]) => caminho)
    expect(ofensores).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar** — `npm test` → FAIL (módulo `./valorConsulta` não existe).

- [ ] **Step 3: Implementar** — `src/lib/valorConsulta.ts`

```ts
// Fonte ÚNICA do valor da consulta. Nenhuma página escreve o preço em texto:
// todas usam useValorConsulta(). Quando existir a área médica, este hook passa a
// buscar GET /api/config/publica (valor editável lá) e cai neste padrão se a API falhar.
export const VALOR_CONSULTA_PADRAO = 400

export function formatarBRL(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

export function useValorConsulta(): number {
  return VALOR_CONSULTA_PADRAO
}
```

- [ ] **Step 4: Rodar** — `npm test` → PASS (2 arquivos).

- [ ] **Step 5: Tokens** — `src/styles/tokens.css` (mesmos valores do `.page` da Home + 2 extras):

```css
:root {
  --rose-50: #fff5f8;
  --rose-100: #fde7ef;
  --rose-200: #f9cfdf;
  --rose-300: #f2a9c3;
  --rose-500: #d63384;
  --rose-600: #b8296f;
  --rose-700: #8f1e56;
  --plum-900: #2b1424;
  --cream: #fff8f3;
  --ink: #2b1424;
  --ink-soft: #6a4a59;
  --ink-mute: #9a7a89;
  --gold: #c9a77b;
  --gold-700: #7a5c32;
  --ease-site: cubic-bezier(0.2, 0.8, 0.2, 1);
}
```

Em `src/main.tsx`, acrescentar `import './styles/tokens.css'` depois de `import './index.css'`.

- [ ] **Step 6: Commit** — `git add -A frontend && git commit -m "feat: fonte única do valor da consulta + tokens globais"`

---

### Task 3: Contatos compartilhados e conteúdo do guia

**Files:** Create `src/content/contatos.ts`, `src/content/guiaConsulta.ts`, `src/content/guiaConsulta.test.ts` · Modify `src/pages/Home.tsx` (importar constantes)

- [ ] **Step 1: `src/content/contatos.ts`** (valores copiados de `Home.tsx`)

```ts
export const WHATSAPP_CATIVA = 'https://wa.me/5584996770404'
export const WHATSAPP_FABRICA = 'https://wa.me/5584992215656'
export const INSTAGRAM = 'https://www.instagram.com/raquelmachado_ped/'

export const CLINICAS = [
  { nome: 'Clínica Cativa', endereco: 'Tyrol Business Center · Sala 514', whatsapp: WHATSAPP_CATIVA },
  { nome: 'Fábrica do Amanhã', endereco: 'Rua Dr. Horácio, 595 · Lagoa Nova', whatsapp: WHATSAPP_FABRICA },
] as const
```

Em `Home.tsx`, apagar as 3 `const` do topo e importar de `../content/contatos`.

- [ ] **Step 2: Teste do conteúdo (falha)** — `src/content/guiaConsulta.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { guia } from './guiaConsulta'

describe('guiaConsulta', () => {
  it('tem os 7 capítulos na ordem do guia', () => {
    expect(guia.capitulos.map((c) => c.id)).toEqual([
      'puericultura', 'retorno', 'calendario', 'prenatal', 'trazer', 'whatsapp', 'valor',
    ])
  })
  it('o calendário tem 6 faixas, da primeira consulta à anual', () => {
    expect(guia.calendario.faixas).toHaveLength(6)
    expect(guia.calendario.faixas[0].idade).toBe('Primeira consulta do recém-nascido')
    expect(guia.calendario.faixas[5].frequencia).toBe('Anual')
  })
  it('o checklist tem 5 itens', () => {
    expect(guia.trazer.itens).toHaveLength(5)
  })
  it('não guarda o preço (vem de useValorConsulta)', () => {
    expect(JSON.stringify(guia)).not.toMatch(/R\$|400/)
  })
})
```

- [ ] **Step 3: Rodar** → FAIL.

- [ ] **Step 4: `src/content/guiaConsulta.ts`** — texto do Peter, sem reescrever:

```ts
export interface Capitulo { id: string; rotulo: string; titulo: string }
export interface FaixaCalendario { idade: string; frequencia: string }
export interface ItemChecklist { titulo: string; detalhe?: string }

export const guia = {
  titulo: 'Guia da consulta com a Dra. Raquel',
  subtitulo: 'Pediatra e neonatologista',
  abertura:
    'Que bom ter vocês aqui! Meu trabalho é acompanhar a saúde e o desenvolvimento do seu filho ao longo do tempo. Em cada consulta, quero entender como ele está, ouvir o que vocês têm observado em casa e construir juntos um plano de cuidado que faça sentido para a rotina da família.',

  capitulos: [
    { id: 'puericultura', rotulo: 'Puericultura', titulo: 'Como funciona a consulta de puericultura' },
    { id: 'retorno', rotulo: 'Retorno', titulo: 'Quando eu indico um retorno' },
    { id: 'calendario', rotulo: 'Calendário', titulo: 'Calendário de acompanhamento' },
    { id: 'prenatal', rotulo: 'Pré-natal', titulo: 'Consulta pré-natal pediátrica' },
    { id: 'trazer', rotulo: 'O que trazer', titulo: 'O que trazer para a consulta da criança' },
    { id: 'whatsapp', rotulo: 'WhatsApp', titulo: 'WhatsApp entre as consultas' },
    { id: 'valor', rotulo: 'Valor', titulo: 'Valor da consulta' },
  ] satisfies Capitulo[],

  puericultura: [
    'A puericultura é a consulta de acompanhamento da criança. Reservo cerca de uma hora para conversar com vocês, examinar seu filho e avaliar como ele está crescendo e se desenvolvendo. A gente conversa sobre alimentação, sono, vacinas e as dúvidas que surgem em cada fase. Ao final, combinamos os próximos passos e quando será a próxima avaliação.',
    'Cada visita do calendário de puericultura é uma nova consulta. Nela, faço uma avaliação global da saúde e do desenvolvimento da criança, considerando o que mudou desde o último encontro.',
  ],

  retorno: {
    intro:
      'O retorno é uma reavaliação focada no motivo pelo qual eu pedi que vocês voltassem. Por exemplo, se solicitei um exame para esclarecer uma dúvida da consulta, esse encontro é dedicado a revisar o resultado e concluir a orientação sobre aquele assunto.',
    puericultura: {
      rotulo: 'Consulta de puericultura',
      pontos: [
        'Acontece nos intervalos planejados',
        'Volto a olhar para a saúde e o desenvolvimento do seu filho como um todo',
      ],
    },
    retorno: {
      rotulo: 'Retorno',
      pontos: [
        'Eu indico e combino o agendamento com vocês',
        'Focado no motivo pelo qual pedi que voltassem',
        'Em geral, em até 15 dias, conforme o caso',
        'Sem nova cobrança quando dá continuidade à consulta anterior',
      ],
    },
  },

  calendario: {
    intro:
      'Uso as orientações da Sociedade Brasileira de Pediatria (SBP) como referência e ajusto o calendário conforme as necessidades de cada criança.',
    faixas: [
      { idade: 'Primeira consulta do recém-nascido', frequencia: 'Entre 7 e 10 dias de vida' },
      { idade: 'Até os 6 meses', frequencia: 'Mensal' },
      { idade: 'Dos 6 meses a 1 ano', frequencia: 'A cada 2 meses' },
      { idade: 'De 1 ano a 1 ano e meio', frequencia: 'A cada 3 meses' },
      { idade: 'De 1 ano e meio a 5 anos', frequencia: 'A cada 6 meses' },
      { idade: 'Dos 5 aos 18 anos', frequencia: 'Anual' },
    ] satisfies FaixaCalendario[],
    prematuro: {
      rotulo: 'Bebê prematuro',
      texto:
        'No acompanhamento do bebê prematuro, planejamos a primeira consulta para os primeiros dias após a alta, conforme a orientação da equipe. Depois, as consultas são mensais até os 6 meses de idade corrigida. A partir daí, combinamos os intervalos de acordo com o crescimento, o desenvolvimento e as necessidades do bebê.',
    },
  },

  prenatal: {
    semana: '28ª',
    legendaSemana: 'semana de gestação',
    texto:
      'A partir da 28ª semana de gestação, podemos nos encontrar para conversar sobre a chegada do bebê. É um momento para tirar dúvidas sobre amamentação, cuidados nos primeiros dias de vida e triagens do recém-nascido.',
    trazer: 'Para essa consulta, tragam a caderneta da gestante e os exames do pré-natal.',
  },

  trazer: {
    itens: [
      { titulo: 'Caderneta da Criança', detalhe: 'com o registro das vacinas' },
      { titulo: 'Exames e relatórios recentes' },
      { titulo: 'Lista de medicamentos e suplementos em uso' },
      { titulo: 'Resumo da maternidade ou da internação', detalhe: 'na primeira consulta após a alta' },
      { titulo: 'Dúvidas anotadas', detalhe: 'se quiserem, anotem o que surgir em casa, para conversarmos com calma' },
    ] satisfies ItemChecklist[],
  },

  whatsapp: {
    texto:
      'O WhatsApp é uma cortesia para as famílias em acompanhamento regular. É um espaço para esclarecer dúvidas pontuais sobre as orientações combinadas em consulta.',
    horarios: [
      { quando: 'Dias úteis', como: 'Leio as mensagens no fim da tarde' },
      { quando: 'Fim de semana', como: 'Respondo na segunda-feira' },
    ],
    urgencia: 'Em caso de urgência, procurem um pronto atendimento.',
  },

  valor: { rotulo: 'O valor de cada consulta é' },

  assinatura: { nome: 'Dra. Raquel Machado', titulo: 'Pediatra e neonatologista' },
}
```

- [ ] **Step 5: Rodar** — `npm test` → PASS. `npx tsc -b` sem erros.
- [ ] **Step 6: Commit** — `git add -A frontend && git commit -m "feat: conteúdo do guia da consulta + contatos compartilhados"`

---

### Task 4: SiteHeader

**Files:** Create `src/components/SiteHeader.tsx`, `SiteHeader.module.css`, `SiteHeader.test.tsx`

- [ ] **Step 1: Teste que falha** — `SiteHeader.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import SiteHeader from './SiteHeader'

function montar() {
  return render(<MemoryRouter><SiteHeader /></MemoryRouter>)
}

describe('SiteHeader', () => {
  it('tem o link Área da família apontando para /familia', () => {
    montar()
    expect(screen.getByRole('link', { name: 'Área da família' })).toHaveAttribute('href', '/familia')
  })

  it('os links de seção apontam para a Home com âncora', () => {
    montar()
    expect(screen.getByRole('link', { name: 'Sobre' })).toHaveAttribute('href', '/#sobre')
    expect(screen.getByRole('link', { name: 'Contato' })).toHaveAttribute('href', '/#contato')
  })

  it('o hambúrguer abre, fecha e responde ao Esc', async () => {
    const user = userEvent.setup()
    montar()
    const botao = screen.getByRole('button', { name: 'Abrir menu' })
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    await user.click(botao)
    expect(screen.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('Agendar Consulta mostra as duas clínicas com WhatsApp', async () => {
    const user = userEvent.setup()
    montar()
    expect(screen.queryByRole('link', { name: /Clínica Cativa/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Agendar Consulta/ }))
    expect(screen.getByRole('link', { name: /Clínica Cativa/ })).toHaveAttribute('href', 'https://wa.me/5584996770404')
    expect(screen.getByRole('link', { name: /Fábrica do Amanhã/ })).toHaveAttribute('href', 'https://wa.me/5584992215656')
  })

  it('clicar fora fecha o dropdown de clínicas', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByRole('button', { name: /Agendar Consulta/ }))
    await user.click(document.body)
    expect(screen.queryByRole('link', { name: /Clínica Cativa/ })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar** → FAIL.

- [ ] **Step 3: `SiteHeader.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { CLINICAS } from '../content/contatos'
import styles from './SiteHeader.module.css'

const SECOES = [
  { hash: 'sobre', rotulo: 'Sobre' },
  { hash: 'especialidades', rotulo: 'Especialidades' },
  { hash: 'depoimentos', rotulo: 'Depoimentos' },
  { hash: 'contato', rotulo: 'Contato' },
]

export default function SiteHeader() {
  const [rolou, setRolou] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)
  const [agendarAberto, setAgendarAberto] = useState(false)
  const agendarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 60)
    aoRolar()
    window.addEventListener('scroll', aoRolar, { passive: true })
    return () => window.removeEventListener('scroll', aoRolar)
  }, [])

  useEffect(() => {
    const aoClicarFora = (e: MouseEvent) => {
      if (agendarRef.current && !agendarRef.current.contains(e.target as Node)) setAgendarAberto(false)
    }
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuAberto(false)
        setAgendarAberto(false)
      }
    }
    document.addEventListener('mousedown', aoClicarFora)
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('mousedown', aoClicarFora)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [])

  const fechar = () => {
    setMenuAberto(false)
    setAgendarAberto(false)
  }

  return (
    <header className={`${styles.header} ${rolou || menuAberto ? styles.rolou : ''}`}>
      <Link to="/" className={styles.logo} onClick={fechar}>
        <span className={styles.nome}>Dra. Raquel Machado</span>
        <span className={styles.sub}>Pediatra · Neonatologista</span>
      </Link>

      <button
        type="button"
        className={styles.hamburguer}
        aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={menuAberto}
        aria-controls="menu-principal"
        onClick={() => setMenuAberto((v) => !v)}
      >
        <span className={styles.barra} />
        <span className={styles.barra} />
        <span className={styles.barra} />
      </button>

      <nav id="menu-principal" aria-label="Principal" className={`${styles.nav} ${menuAberto ? styles.navAberto : ''}`}>
        <ul className={styles.links}>
          {SECOES.map((s) => (
            <li key={s.hash}>
              <Link to={{ pathname: '/', hash: `#${s.hash}` }} className={styles.link} onClick={fechar}>
                {s.rotulo}
              </Link>
            </li>
          ))}
          <li>
            <NavLink
              to="/familia"
              className={({ isActive }) => `${styles.link} ${styles.linkFamilia} ${isActive ? styles.linkAtivo : ''}`}
              onClick={fechar}
            >
              Área da família
            </NavLink>
          </li>
        </ul>

        <div className={styles.agendar} ref={agendarRef}>
          <button
            type="button"
            className={styles.cta}
            aria-expanded={agendarAberto}
            aria-haspopup="true"
            onClick={() => setAgendarAberto((v) => !v)}
          >
            Agendar Consulta
            <svg className={`${styles.chevron} ${agendarAberto ? styles.chevronAberto : ''}`} viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className={styles.dropdown} hidden={!agendarAberto}>
            {CLINICAS.map((c) => (
              <a key={c.nome} href={c.whatsapp} className={styles.dropdownItem} target="_blank" rel="noopener noreferrer" onClick={fechar}>
                <span className={styles.dropdownNome}>{c.nome}</span>
                <span className={styles.dropdownSub}>{c.endereco}</span>
              </a>
            ))}
          </div>
        </div>
      </nav>
    </header>
  )
}
```

- [ ] **Step 4: `SiteHeader.module.css`** — copiar do `Home.module.css` (linhas 26–170) as regras `.nav`→`.header`, `.navScrolled`→`.rolou`, `.navLogo`→`.logo`, `.navName`→`.nome`, `.navSub`→`.sub`, `.navLink`→`.link`, `.navCta`→`.cta`, `.navCtaChevron`→`.chevron`, `.navCtaChevronOpen`→`.chevronAberto`, `.navDropdown`→`.dropdown` (+ keyframes `dropIn`), `.navDropdownItem/Name/Sub`→`.dropdownItem/Nome/Sub`, `.navCtaWrap`→`.agendar`, `.navLinks`→`.links` (agora `ul` com `list-style:none;margin:0;padding:0`; `display:flex; gap:32px; align-items:center`). `.header` mantém `position:fixed; z-index:100`; `.nav` novo = `display:flex; align-items:center; gap:32px`. Acrescentar:
  - `.linkFamilia` e `.linkAtivo`: cor `--rose-600`, `font-weight:700`, sublinhado de 2px rosa (`text-decoration-thickness`, `underline-offset:6px`) quando ativo.
  - `.hamburguer`: `display:none`; 44×44px; 3 `.barra` (22×2px, `--plum-900`, `border-radius:2px`, `transition: transform .25s var(--ease-site)`); no estado `[aria-expanded='true']` a 1ª gira 45° e desce, a 2ª some, a 3ª gira −45° e sobe.
  - `@media (max-width: 900px)`: `.header{padding:12px 20px}`; `.hamburguer{display:flex; flex-direction:column; gap:5px; align-items:center; justify-content:center}`; `.nav` vira painel (`position:fixed; inset:60px 0 auto 0; flex-direction:column; align-items:stretch; background:rgba(255,248,243,.97); backdrop-filter:blur(16px); padding:12px 24px 28px; box-shadow; transform:translateY(-8px); opacity:0; visibility:hidden; transition`) e `.navAberto{opacity:1; visibility:visible; transform:none}`; `.links{flex-direction:column; align-items:stretch; gap:0}`; `.link{display:block; padding:16px 4px; border-bottom:1px solid rgba(214,51,132,.1); font-size:16px}`; `.agendar{margin-top:16px}`; `.cta{width:100%; justify-content:center; padding:14px}`; `.dropdown{position:static; box-shadow:none; margin-top:8px; border:1px solid rgba(214,51,132,.12)}`.
  - `@media (prefers-reduced-motion: reduce)`: remove transições/animações.
  - `:focus-visible` em `.link`, `.cta`, `.hamburguer`, `.dropdownItem`: `outline:2px solid var(--rose-500); outline-offset:3px; border-radius:6px`.

- [ ] **Step 5: Rodar** — `npm test` → PASS (5 testes do header).
- [ ] **Step 6: Commit** — `git add -A frontend && git commit -m "feat: SiteHeader compartilhado com hambúrguer e Área da família"`

---

### Task 5: SiteFooter

**Files:** Create `src/components/SiteFooter.tsx`, `SiteFooter.module.css`

- [ ] **Step 1: `SiteFooter.tsx`**

```tsx
import { Link } from 'react-router-dom'
import { INSTAGRAM, WHATSAPP_CATIVA, WHATSAPP_FABRICA } from '../content/contatos'
import styles from './SiteFooter.module.css'

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.marca}>
          <span className={styles.nome}>Dra. Raquel Machado</span>
          <span className={styles.sub}>Pediatra &amp; Neonatologista · CRM-RN 9383</span>
        </div>
        <div className={styles.links}>
          <a href={INSTAGRAM} target="_blank" rel="noopener noreferrer" className={styles.link}>Instagram</a>
          <a href={WHATSAPP_CATIVA} target="_blank" rel="noopener noreferrer" className={styles.link}>WhatsApp Cativa</a>
          <a href={WHATSAPP_FABRICA} target="_blank" rel="noopener noreferrer" className={styles.link}>WhatsApp Fábrica</a>
          <Link to="/familia" className={styles.link}>Área da família</Link>
          <Link to="/links" className={styles.link}>Links</Link>
        </div>
        <p className={styles.copy}>
          © 2026 Dra. Raquel Machado · Todos os direitos reservados ·{' '}
          <Link to="/privacidade" className={styles.link}>Política de Privacidade</Link>
        </p>
      </div>
    </footer>
  )
}
```

- [ ] **Step 2: `SiteFooter.module.css`** — mover as regras `.footer…` do `Home.module.css` (linhas 775–835) renomeando `.footerInner`→`.inner`, `.footerBrand`→`.marca`, `.footerName`→`.nome`, `.footerSub`→`.sub`, `.footerLinks`→`.links`, `.footerLink`→`.link`, `.footerCopy`→`.copy`; incluir `@media (max-width:900px){.footer{padding:48px 24px}}` e `:focus-visible` rosa-300.
- [ ] **Step 3: Commit** — `git add -A frontend && git commit -m "feat: SiteFooter compartilhado"`

---

### Task 6: Home usa Header/Footer (visual idêntico)

**Files:** Modify `src/pages/Home.tsx`, `src/pages/Home.module.css`

- [ ] **Step 1: Capturar "antes"** — `npm run dev`, abrir `http://localhost:5173/` no Chrome em 1280px e 390px, capturar topo + rodapé (guardar no scratchpad).
- [ ] **Step 2: `Home.tsx`** — importar `SiteHeader` e `SiteFooter`; substituir todo o bloco `{/* NAV */}…</nav>` por `<SiteHeader />` e o bloco `{/* FOOTER */}…</footer>` por `<SiteFooter />`; remover `scrolled`, `dropdownOpen`, `dropdownRef`, os dois `useEffect` e o import de `useState/useEffect/useRef` se ficarem sem uso (`useEffect` etc.). `export default function Home()` passa a só retornar o JSX.
- [ ] **Step 3: `Home.module.css`** — apagar as regras `.nav*` (linhas 26–170), `.footer*` (775–835), e as linhas `.navLinks { display: none; }`, `.nav { padding: 12px 20px; }`, `.footer { padding: 48px 24px; }` do `@media`. Rodar `grep -n "styles\.nav\|styles\.footer" src/pages/Home.tsx` → vazio.
- [ ] **Step 4: Verificar** — `npx tsc -b && npm test && npm run build` passam; recapturar "depois" e comparar com "antes": mesmo visual (header transparente no topo, blur ao rolar, dropdown, rodapé). Menu mobile agora existe em 390px.
- [ ] **Step 5: Commit** — `git add -A frontend && git commit -m "refactor(home): usa SiteHeader e SiteFooter (visual idêntico)"`

---

### Task 7: Rota, ScrollToHash e a página `/familia`

**Files:** Create `src/lib/ScrollToHash.tsx`, `src/lib/useRevelar.ts`, `src/pages/Familia.tsx`, `src/pages/Familia.module.css`, `src/pages/Familia.test.tsx` · Modify `src/App.tsx`

- [ ] **Step 1: Teste que falha** — `Familia.test.tsx`

```tsx
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import Familia from './Familia'
import { guia } from '../content/guiaConsulta'

function montar() {
  return render(<MemoryRouter initialEntries={['/familia']}><Familia /></MemoryRouter>)
}

describe('Familia', () => {
  afterEach(() => { document.head.querySelector('meta[name="robots"]')?.remove() })

  it('tem um único h1 com o título do guia', () => {
    montar()
    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveTextContent('Guia da consulta com a Dra. Raquel')
  })

  it('renderiza os 7 capítulos, cada um com seu h2', () => {
    montar()
    for (const c of guia.capitulos) {
      expect(screen.getByRole('heading', { level: 2, name: c.titulo })).toBeInTheDocument()
    }
  })

  it('os atalhos apontam para as âncoras dos capítulos', () => {
    montar()
    const indice = screen.getByRole('navigation', { name: 'Neste guia' })
    for (const c of guia.capitulos) {
      expect(within(indice).getByRole('link', { name: new RegExp(c.rotulo) })).toHaveAttribute('href', `#${c.id}`)
    }
  })

  it('mostra as 6 faixas do calendário', () => {
    montar()
    expect(screen.getAllByRole('listitem').filter((li) => li.hasAttribute('data-faixa'))).toHaveLength(6)
  })

  it('mostra o valor vindo da fonte única e a urgência', () => {
    montar()
    expect(screen.getByText('R$ 400,00')).toBeInTheDocument()
    expect(screen.getByText('Em caso de urgência, procurem um pronto atendimento.')).toBeInTheDocument()
  })

  it('marca a página como noindex e ajusta o título', () => {
    montar()
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
    expect(document.title).toMatch(/Guia da consulta/)
  })
})
```

- [ ] **Step 2: Rodar** → FAIL (módulo não existe).

- [ ] **Step 3: `src/lib/useRevelar.ts`**

```ts
import { useEffect, useRef, useState } from 'react'

const semAnimacao = () =>
  typeof IntersectionObserver === 'undefined' ||
  (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

// Revela o elemento quando ele entra na tela. Sem IntersectionObserver ou com
// prefers-reduced-motion, já nasce visível (nada fica escondido por falha de JS).
export function useRevelar<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [visivel, setVisivel] = useState(semAnimacao)

  useEffect(() => {
    const el = ref.current
    if (!el || visivel) return
    const obs = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setVisivel(true)
          obs.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [visivel])

  return { ref, visivel }
}
```

- [ ] **Step 4: `src/lib/ScrollToHash.tsx`**

```tsx
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// BrowserRouter não rola para #âncora nem volta ao topo sozinho.
export default function ScrollToHash() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      const id = decodeURIComponent(hash.slice(1))
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView())
    } else {
      window.scrollTo(0, 0)
    }
  }, [pathname, hash])
  return null
}
```

- [ ] **Step 5: `src/pages/Familia.tsx`** — estrutura (componentes locais pequenos no mesmo arquivo: `Capitulo`, `Revelar`):

```tsx
import { useEffect, type ReactNode } from 'react'
import SiteFooter from '../components/SiteFooter'
import SiteHeader from '../components/SiteHeader'
import { guia } from '../content/guiaConsulta'
import { useRevelar } from '../lib/useRevelar'
import { formatarBRL, useValorConsulta } from '../lib/valorConsulta'
import styles from './Familia.module.css'

function Revelar({ children, atraso = 0, className = '' }: { children: ReactNode; atraso?: number; className?: string }) {
  const { ref, visivel } = useRevelar<HTMLDivElement>()
  return (
    <div ref={ref} className={`${styles.revelar} ${className}`} data-visivel={visivel} style={{ '--atraso': `${atraso}ms` } as React.CSSProperties}>
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
          <ol className={styles.linhaTempo}>
            {calendario.faixas.map((f, i) => (
              <li key={f.idade} data-faixa className={styles.faixa} style={{ '--i': i } as React.CSSProperties}>
                <span className={styles.faixaPonto} aria-hidden="true" />
                <span className={styles.faixaIdade}>{f.idade}</span>
                <span className={styles.faixaFreq}>{f.frequencia}</span>
              </li>
            ))}
          </ol>
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
          <ul className={styles.checklist}>
            {trazer.itens.map((it, i) => (
              <li key={it.titulo} className={styles.item} style={{ '--i': i } as React.CSSProperties}>
                <svg className={styles.check} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.14" />
                  <path d="M7 12.5l3.2 3.2L17 8.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className={styles.itemTitulo}>{it.titulo}</span>
                {'detalhe' in it && it.detalhe && <span className={styles.itemDetalhe}>{it.detalhe}</span>}
              </li>
            ))}
          </ul>
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
```

- [ ] **Step 6: `Familia.module.css`** — implementar a "Direção de design" do spec com os tokens de `tokens.css`. Classes obrigatórias (todas usadas acima): `.page .hero .heroBg .heroInner .heroTexto .eyebrow .heroTitulo .heroSub .heroAbertura .indice .chip .chipNum .heroFoto .fotoMancha .fotoAnel .fotoImg .capitulo .capInner .capCabecalho .capNumero .capTitulo .prosa .revelar .comparar .cartaoClaro .cartaoRosa .cartaoRotulo .pontos .linhaTempo .faixa .faixaPonto .faixaIdade .faixaFreq .notaOuro .notaRotulo .prenatal .semana .semanaNum .semanaLegenda .destaqueInline .checklist .item .check .itemTitulo .itemDetalhe .horarios .horario .horarioQuando .horarioComo .urgencia .urgenciaIcone .ticket .ticketRotulo .ticketPreco .assinatura .assinaturaFoto .assinaturaNome .assinaturaTitulo`. Regras-chave:
  - `.page`: `font-family:'Manrope'`, `background:var(--cream)`, `color:var(--ink)`, `overflow-x:clip`. Títulos em `'Fraunces', serif` (peso 400–500; itálico só 400).
  - `.heroBg`: os mesmos gradientes radiais do `.heroBg` da Home. `.heroInner`: grid `55fr 45fr`, `max-width:1200px`, `padding:130px 48px 72px`. `.heroTitulo`: `clamp(40px,6vw,72px)`, `line-height:1.04`, `letter-spacing:-0.03em`; `em`: itálico, `--rose-600`. `.eyebrow`: 11px/700/`letter-spacing:.16em`/uppercase/`--rose-600` com `::before` linha de 28px.
  - Entrada do hero: `@keyframes subir {from{opacity:0;transform:translateY(16px)}}`; filhos de `.heroTexto` com `animation: subir .8s var(--ease-site) both` e `animation-delay: calc(var(--n)*90ms)` (usar `nth-child`); foto com `@keyframes surgir` (scale .94→1).
  - `.fotoImg`: `width:min(380px,80vw); aspect-ratio:1; border-radius:50%; object-fit:cover; object-position:50% 18%; box-shadow:0 30px 60px -24px rgba(143,30,86,.45)`. `.fotoAnel`: `inset:-18px; border:1.5px dashed var(--rose-300); border-radius:50%; animation:girar 70s linear infinite`. `.fotoMancha`: círculo `--rose-200` deslocado (`translate(28px,34px)`), `z-index:-1`.
  - `.indice`: `display:flex; gap:8px; flex-wrap:wrap` (≤900px: `overflow-x:auto; flex-wrap:nowrap; scroll-snap-type:x proximity`). `.chip`: pílula branca com borda `rgba(214,51,132,.18)`, hover `--rose-100`, `.chipNum` em Fraunces `--rose-500`.
  - `.capitulo`: `padding:96px 24px`; `:nth-of-type(even)` com `background:rgba(255,255,255,.62)` e filetes `rgba(214,51,132,.08)`; `scroll-margin-top:72px`. `.capInner`: `max-width:1040px; margin:0 auto`. `.capCabecalho`: `position:relative; margin-bottom:32px`. `.capNumero`: Fraunces `clamp(96px,16vw,168px)`, `color:var(--rose-200)`, `line-height:.8`, `position:absolute; left:-4px; top:-26px; z-index:0`; `.capTitulo` `position:relative; z-index:1; font-size:clamp(28px,4.4vw,46px); padding-top:40px`.
  - `.prosa`: `max-width:62ch; font-size:17px; line-height:1.8; color:var(--ink-soft)`; `p+p{margin-top:1.1em}`.
  - `.revelar`: `opacity:0; transform:translateY(20px); transition:opacity .7s var(--ease-site) var(--atraso), transform .7s var(--ease-site) var(--atraso)`; `[data-visivel='true']{opacity:1; transform:none}`. `.linhaTempo .faixa` e `.checklist .item` também revelam com `animation` por `--i` (ou pelo `Revelar` do pai) — escolher a opção que não esconda conteúdo sem JS.
  - `.comparar`: grid 2 colunas (1 no mobile), `gap:20px; margin-top:36px`. `.cartaoClaro`: branco, `border:1px solid var(--rose-200)`, raio 24px. `.cartaoRosa`: `linear-gradient(155deg,var(--rose-600),var(--rose-700))`, texto branco, `box-shadow:0 24px 48px -24px rgba(143,30,86,.55)`. `.pontos li`: marcador customizado (círculo 6px) via `::before`.
  - `.linhaTempo`: `list-style:none; position:relative; margin:40px 0; padding-left:34px`; linha vertical 2px com gradiente `--rose-200→--rose-300`; `.faixa`: grid `1fr auto`, cartão branco, `padding:18px 22px`, raio 18px, `margin-bottom:12px`; `.faixaPonto`: 14px, `--rose-500`, anel `4px var(--cream)`, posicionado sobre a linha; `.faixaIdade`: Fraunces 20px; `.faixaFreq`: pílula `--rose-100`/`--rose-700`, 13px/700.
  - `.notaOuro`: `border-left:4px solid var(--gold); background:color-mix(in srgb,var(--gold) 14%,white); border-radius:0 18px 18px 0; padding:22px 26px`; `.notaRotulo`: `--gold-700`, uppercase 11px/700.
  - `.prenatal`: grid `auto 1fr`, `gap:48px`, `align-items:center`; `.semanaNum`: Fraunces itálico 400, `clamp(110px,18vw,200px)`, `--rose-500`, `line-height:.9`; `.destaqueInline`: fundo `--rose-100`, raio 14px, `padding:14px 18px`, `color:var(--rose-700); font-weight:600`.
  - `.checklist`: grid `repeat(auto-fit,minmax(260px,1fr))`, `gap:16px`; `.item`: cartão branco com ícone `.check` (28px, `--rose-500`), título 700 e detalhe `--ink-mute`.
  - `.horarios`: grid 2 colunas (1 no mobile); `.horario`: cartão `--rose-50`, raio 18px; `.horarioQuando` uppercase 11px/700 `--rose-600`.
  - `.urgencia`: `background:var(--plum-900); color:#fff; border-radius:28px; padding:28px 32px; display:flex; gap:20px; align-items:center; margin-top:28px`; `p` Fraunces `clamp(20px,3vw,28px)`; `.urgenciaIcone` 40px `--rose-300`.
  - `.ticket`: `max-width:520px; background:#fff; border-radius:28px; padding:40px 32px; text-align:center; position:relative`; entalhes laterais com `mask: radial-gradient(circle 14px at 0 50%, #0000 98%, #000) , radial-gradient(circle 14px at 100% 50%, #0000 98%, #000)` (`mask-composite:intersect`); borda tracejada interna `1.5px dashed var(--rose-200)`; `.ticketPreco` Fraunces `clamp(54px,10vw,84px)`, `--rose-600`.
  - `.assinatura`: centralizada, `padding:72px 24px 96px`; foto 96px redonda; nome Fraunces itálico 28px; título uppercase 11px/700 `--rose-600`.
  - `@media (max-width:900px)`: hero 1 coluna com foto antes do texto (`order:-1`), `heroInner{padding:104px 24px 56px; text-align:left}`, `.capitulo{padding:72px 20px}`, `.prenatal{grid-template-columns:1fr; gap:16px}`, `.comparar,.horarios{grid-template-columns:1fr}`.
  - `@media (prefers-reduced-motion: reduce)`: `.revelar{opacity:1; transform:none; transition:none}`, `.fotoAnel{animation:none}`, entradas do hero sem animação.
  - `a:focus-visible` com `outline:2px solid var(--rose-500)`. Sem overflow horizontal em 360 px.

- [ ] **Step 7: `App.tsx`**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Links from './pages/Links'
import Privacidade from './pages/Privacidade'
import Familia from './pages/Familia'
import ScrollToHash from './lib/ScrollToHash'

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToHash />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/familia" element={<Familia />} />
        <Route path="/links" element={<Links />} />
        <Route path="/privacidade" element={<Privacidade />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 8: Rodar** — `npm test` → todos PASS (inclui guarda do valor); `npx tsc -b` limpo; `npm run lint` sem erros novos; `npm run build` ok.
- [ ] **Step 9: Commit** — `git add -A frontend && git commit -m "feat: página /familia (guia da consulta, sem login)"`

---

### Task 8: Verificação visual e de navegação (Chrome)

- [ ] **Step 1:** `npm run dev`; abrir `/familia` em 1280 px e 360 px. Conferir: hero, chips rolando as âncoras sem ficar sob o header, os 7 capítulos, timeline, retorno (2 cartões), urgência, ticket, assinatura. Sem overflow horizontal (`document.documentElement.scrollWidth <= innerWidth`).
- [ ] **Step 2:** Menu: hambúrguer em 360 px (abrir/fechar/Esc), dropdown de clínicas, "Área da família" ativo em `/familia`; de `/familia` clicar "Sobre" → vai para `/#sobre` e rola; "Dra. Raquel Machado" volta ao topo da Home.
- [ ] **Step 3:** `prefers-reduced-motion` (DevTools → Rendering) deixa tudo visível sem animação. Título da aba muda em `/familia` e volta na Home; `meta robots noindex` só em `/familia`.
- [ ] **Step 4:** Corrigir o que aparecer (commit por correção). Conferir de novo a Home contra as capturas "antes" (Task 6).

---

### Task 9: Revisão, merge, deploy, registro

- [ ] **Step 1:** `npm test && npx tsc -b && npm run lint && npm run build` limpos.
- [ ] **Step 2:** Revisar o diff completo (`git diff origin/master --stat` e leitura) contra o spec: cobertura dos 8 blocos, valor só via hook, sem `Disallow` novo, sitemap intacto.
- [ ] **Step 3:** Pedir autorização do Peter para o merge (merge em `master` dispara deploy em produção). Com o "sim": `git checkout master && git pull && git merge --no-ff feat/area-familia-guia && git push`.
- [ ] **Step 4:** `gh run watch` até ✓; abrir `https://raquelmachadoped.com.br/familia` e a Home em produção; `git push origin --delete feat/area-familia-guia && git branch -d feat/area-familia-guia`.
- [ ] **Step 5:** Registrar no vault: daily `Sistema/sessions/2026-11-16.md`, `project_raquel_site.md` (área da família + valor fonte única + plano da remodelagem), cópias do spec/plano em `knowledge/raquel-machado-site/`, pendências para a remodelagem (apagar blog; valor editável na área médica; conteúdo via API).
