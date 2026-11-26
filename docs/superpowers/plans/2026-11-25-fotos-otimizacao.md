# Otimização das fotos do site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** tirar ~37 MB de fotos do site (hoje 4 JPGs de 5 a 19 MB, usadas em Home, Familia e Links) sem mudar o visual, com WebP responsivo, dimensões declaradas e carregamento certo (hero prioritário, resto lazy).

**Architecture:** otimização **uma vez, fora do build**: script em `tools/imagens/` (pasta com `package.json` próprio, fora do `frontend/`, para o `npm ci` do cron da VPS nunca instalar `sharp`) gera `-{largura}.webp` + um JPG de reserva; os arquivos finais são commitados em `frontend/public/images/`. Um componente `Foto` renderiza `<picture>` com `srcset`. Um teste de "orçamento" falha se alguma imagem passar de 350 KB.

**Tech Stack:** sharp (só local, em `tools/imagens`), React 19, Vitest.

**Decisão do Peter (25/11):** otimizar uma vez e commitar (não pipeline no build).

**Regra de cache (lição do deck, 25/11):** a Cloudflare guarda arquivo estático por até 4 h. Por isso **todo nome de arquivo muda** (`hero-1440.jpg`, `hero-960.webp`…); o `hero.jpg` antigo some. URL nova nunca sai do cache antigo.

---

## File Structure

- Create: `tools/imagens/package.json`, `tools/imagens/otimizar.mjs` — gerador (roda local).
- Create: `frontend/src/components/Foto.tsx`, `Foto.test.tsx` — `<picture>` responsivo.
- Create: `frontend/src/imagens.test.ts` — orçamento de bytes.
- Modify: `frontend/src/pages/Home.tsx`, `Familia.tsx`, `Links.tsx` — usam `Foto`.
- Delete (após o uso): `frontend/public/images/{hero,sobre,pediatria,neonatologia}.jpg`, `frontend/public/raquel-avatar.jpg`.
- Backup fora do repo: `C:\Users\peter\Downloads\raquel-fotos-originais\` (os originais continuam no histórico do git).

---

### Task 1: Medir o que cada foto precisa (sem código)

- [ ] **Step 1: Backup dos originais**

```bash
mkdir -p "C:/Users/peter/Downloads/raquel-fotos-originais"
cp frontend/public/images/*.jpg frontend/public/raquel-avatar.jpg "C:/Users/peter/Downloads/raquel-fotos-originais/"
```

- [ ] **Step 2: Larguras renderizadas.** No Chrome, com a janela em 1440 e depois em 390 de largura, em `/` e em `/familia`, rodar no console `[...document.images].map(i => [i.getAttribute('src'), Math.round(i.getBoundingClientRect().width), i.naturalWidth])` e anotar na tabela abaixo (editar este arquivo).

| Foto | Onde | Largura CSS 1440 | Largura CSS 390 | Larguras geradas |
|---|---|---|---|---|
| hero | Home, Familia | (medir) | (medir) | 480, 960, 1440 |
| sobre | Home, Familia | (medir) | (medir) | 480, 960, 1440 |
| pediatria | Home (cartão) | (medir) | (medir) | 640, 1280 |
| neonatologia | Home (cartão) | (medir) | (medir) | 640, 1280 |
| raquel-avatar | Links | (medir) | (medir) | 192, 384 |

Regra: gerar até 2× a maior largura CSS medida (telas retina); se a medida pedir mais que a coluna "Larguras geradas", ajustar a lista antes da Task 3.

---

### Task 2: Teste de orçamento (vermelho)

**Files:** Create `frontend/src/imagens.test.ts`

- [ ] **Step 0: Branch** — `git checkout -b feat/fotos-otimizadas` (a partir do `master` limpo).

- [ ] **Step 1: Escrever o teste**

```ts
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const LIMITE_KB = 350
const pastas = ['public/images', 'public']
const arquivos = pastas.flatMap((pasta) =>
  readdirSync(join(process.cwd(), pasta))
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .map((f) => join(pasta, f)),
)

describe('orçamento de imagens', () => {
  it.each(arquivos)('%s cabe em 350 KB', (arquivo) => {
    const kb = statSync(join(process.cwd(), arquivo)).size / 1024
    expect(kb).toBeLessThanOrEqual(LIMITE_KB)
  })
})
```

- [ ] **Step 2: Ver falhar**

Run (em `frontend/`): `npx vitest run src/imagens.test.ts`
Expected: FAIL em `hero.jpg`, `sobre.jpg`, `pediatria.jpg`, `neonatologia.jpg` e `raquel-avatar.jpg` (`apple-touch-icon.png` passa).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/imagens.test.ts
git commit -m "test: orçamento de 350 KB por imagem (vermelho)"
```

---

### Task 3: Gerador e imagens finais

**Files:** Create `tools/imagens/package.json`, `tools/imagens/otimizar.mjs`; criar os arquivos em `frontend/public/images/`

- [ ] **Step 1: `tools/imagens/package.json`**

```json
{
  "name": "otimizar-imagens-raquel",
  "private": true,
  "type": "module",
  "dependencies": { "sharp": "^0.34.0" }
}
```

- [ ] **Step 2: `tools/imagens/otimizar.mjs`**

```js
// Uso: node otimizar.mjs <pasta-dos-originais> <pasta-de-saida>
// Gera <nome>-<largura>.webp e <nome>-<maior>.jpg (reserva). Rodar só localmente.
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

const [origem, destino] = process.argv.slice(2)
if (!origem || !destino) throw new Error('Uso: node otimizar.mjs <originais> <saida>')

const FOTOS = [
  { nome: 'hero', arquivo: 'hero.jpg', larguras: [480, 960, 1440] },
  { nome: 'sobre', arquivo: 'sobre.jpg', larguras: [480, 960, 1440] },
  { nome: 'pediatria', arquivo: 'pediatria.jpg', larguras: [640, 1280] },
  { nome: 'neonatologia', arquivo: 'neonatologia.jpg', larguras: [640, 1280] },
  { nome: 'raquel-avatar', arquivo: 'raquel-avatar.jpg', larguras: [192, 384] },
]

await mkdir(destino, { recursive: true })
for (const f of FOTOS) {
  const base = sharp(join(origem, f.arquivo), { failOn: 'none' }).rotate() // respeita a rotação EXIF
  for (const w of f.larguras) {
    await base.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toFile(join(destino, `${f.nome}-${w}.webp`))
  }
  const maior = Math.max(...f.larguras)
  await base.clone().resize({ width: maior, withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toFile(join(destino, `${f.nome}-${maior}.jpg`))
  console.log('ok', f.nome)
}
```

- [ ] **Step 3: Rodar**

```bash
cd tools/imagens && npm install
node otimizar.mjs "C:/Users/peter/Downloads/raquel-fotos-originais" "../../frontend/public/images"
```
Expected: `ok hero`, `ok sobre`, `ok pediatria`, `ok neonatologia`, `ok raquel-avatar`.

- [ ] **Step 4: Olhar cada imagem gerada** (abrir `hero-1440.jpg`, `sobre-1440.jpg`, `pediatria-1280.webp`, `neonatologia-1280.webp`, `raquel-avatar-384.webp`): rosto sem corte, cor igual ao original, sem faixa de compressão. Se alguma passar de 350 KB, baixar a qualidade dessa foto (jpeg 74 / webp 72) e regerar.

- [ ] **Step 5: Mover o avatar** para a pasta de imagens (`raquel-avatar-*` já saiu em `frontend/public/images/`) e apagar os antigos:

```bash
git rm frontend/public/images/hero.jpg frontend/public/images/sobre.jpg frontend/public/images/pediatria.jpg frontend/public/images/neonatologia.jpg frontend/public/raquel-avatar.jpg
```

- [ ] **Step 6: Commit** (sem `node_modules` do `tools/imagens`: conferir o `.gitignore`)

```bash
git add tools/imagens/package.json tools/imagens/otimizar.mjs frontend/public/images
git commit -m "feat(imagens): fotos otimizadas (WebP responsivo + JPG de reserva) e gerador local"
```

---

### Task 4: Componente `Foto` (TDD)

**Files:** Create `frontend/src/components/Foto.test.tsx`, `Foto.tsx`

- [ ] **Step 1: Teste que falha**

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Foto } from './Foto'

describe('Foto', () => {
  const base = { nome: 'hero', larguras: [480, 960, 1440], reserva: 1440, largura: 1440, altura: 2160, alt: 'Dra. Raquel' }

  it('monta o srcset WebP e o JPG de reserva', () => {
    const { container } = render(<Foto {...base} sizes="(max-width: 900px) 90vw, 480px" />)
    const fonte = container.querySelector('source')!
    expect(fonte.getAttribute('type')).toBe('image/webp')
    expect(fonte.getAttribute('srcset')).toBe('/images/hero-480.webp 480w, /images/hero-960.webp 960w, /images/hero-1440.webp 1440w')
    expect(container.querySelector('img')!.getAttribute('src')).toBe('/images/hero-1440.jpg')
  })

  it('declara largura e altura (evita salto de layout) e é lazy por padrão', () => {
    const img = render(<Foto {...base} sizes="100vw" />).container.querySelector('img')!
    expect(img.getAttribute('width')).toBe('1440')
    expect(img.getAttribute('height')).toBe('2160')
    expect(img.getAttribute('loading')).toBe('lazy')
  })

  it('prioridade: sem lazy e com fetchpriority alto', () => {
    const img = render(<Foto {...base} sizes="100vw" prioridade />).container.querySelector('img')!
    expect(img.getAttribute('loading')).toBeNull()
    expect(img.getAttribute('fetchpriority')).toBe('high')
  })
})
```

- [ ] **Step 2: Ver falhar** — `npx vitest run src/components/Foto.test.tsx` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar `Foto.tsx`**

```tsx
type Props = {
  nome: string
  larguras: readonly number[]
  reserva: number
  largura: number
  altura: number
  alt: string
  sizes: string
  prioridade?: boolean
  className?: string
}

export function Foto({ nome, larguras, reserva, largura, altura, alt, sizes, prioridade = false, className }: Props) {
  const srcSet = larguras.map((w) => `/images/${nome}-${w}.webp ${w}w`).join(', ')
  return (
    <picture>
      <source type="image/webp" srcSet={srcSet} sizes={sizes} />
      <img
        src={`/images/${nome}-${reserva}.jpg`}
        width={largura}
        height={altura}
        alt={alt}
        className={className}
        decoding="async"
        {...(prioridade ? { fetchPriority: 'high' as const } : { loading: 'lazy' as const })}
      />
    </picture>
  )
}
```

- [ ] **Step 4: Ver passar** — mesmo comando → PASS (3 testes).

- [ ] **Step 5: Commit** — `git add frontend/src/components/Foto*.tsx && git commit -m "feat: componente Foto (picture responsivo, dimensões, lazy/prioridade)"`

---

### Task 5: Trocar as `<img>` das páginas

**Files:** Modify `frontend/src/pages/Home.tsx` (linhas ~77, 90, 145, 163), `Familia.tsx` (~70, 179), `Links.tsx` (~39)

- [ ] **Step 1:** em cada `<img src="/images/X.jpg" ...>` trocar por `<Foto nome="X" larguras={[...]} reserva={...} largura={...} altura={...} alt="<mesmo alt de hoje>" sizes="<da tabela da Task 1>" className="<mesma classe>" />`. `largura`/`altura` = dimensão do arquivo de reserva gerado (ex.: hero-1440.jpg → `largura={1440}` e `altura` proporcional à foto original 2674×4032 = 2171). Só as fotos acima da dobra (hero da Home, avatar do Links) levam `prioridade`; as demais ficam lazy. **Manter os `alt` exatos de hoje** (o da `sobre` em `Familia` continua `""`).
- [ ] **Step 2:** `npx tsc -b && npm test` → tudo verde, **incluindo** `hidratacao.test.tsx` (o HTML pré-renderizado tem de bater com o do cliente) e `imagens.test.ts` (agora verde).
- [ ] **Step 3: Commit** — `git commit -am "feat(imagens): Home, Familia e Links usam Foto"`

---

### Task 6: Verificar no navegador (antes de publicar)

- [ ] **Step 1:** `npm run build` e servir `dist/` com `node <scratchpad>/servir-dist.cjs frontend/dist 5199` (o servidor local que imita o Nginx).
- [ ] **Step 2:** Chrome em `http://127.0.0.1:5199/` e `/familia` (exige login: conferir só `/` e `/links`) nas larguras 1440 e 390: capturas lado a lado com a produção atual (rosto, enquadramento e cor iguais; nenhuma foto esticada). Console sem erro.
- [ ] **Step 3:** aba Network (ou `performance.getEntriesByType('resource')`): soma das imagens da Home ≤ 1 MB em 390 px. Registrar o antes (≈ 37 MB) e o depois.
- [ ] **Step 4:** `node scripts/verificar-site.mjs --prerender` contra o servidor local → "Tudo certo".

---

### Task 7: Publicar (ordem do projeto: branch → master → push)

- [ ] **Step 1:** branch `feat/fotos-otimizadas` já criada na Task 2; `git checkout master && git merge --no-ff feat/fotos-otimizadas && git push origin master`; apagar a branch.
- [ ] **Step 2:** esperar o cron (~2 min) e conferir em produção: `curl -sI https://raquelmachadoped.com.br/images/hero-1440.jpg | grep -i -E "HTTP|content-length"` → 200 e < 350 KB; `curl -s https://raquelmachadoped.com.br/ | grep -c "hero-960.webp"` → 1.
- [ ] **Step 3:** Chrome em produção, `/` e `/links`: sem imagem quebrada. Rodar `node scripts/verificar-site.mjs --prerender` contra produção → "Tudo certo".
- [ ] **Step 4:** registrar no vault (daily + decisão: "fotos otimizadas uma vez, fora do build; nomes novos por causa do cache de 4 h da Cloudflare").

## Riscos

- **Corte/cor diferente:** mitigado pelo olhar da Task 3 (passo 4) e pelas capturas da Task 6.
- **Cache da Cloudflare:** mitigado pelos nomes novos.
- **Foto trocada no futuro:** rodar de novo `otimizar.mjs` com o original novo e commitar; o teste de orçamento impede subir arquivo gordo por engano.
- **Fora do escopo (avisar o Peter):** existe `frontend/src/src/` versionado, uma cópia antiga de páginas e estilos que parece código morto. Não mexer sem pedido.
