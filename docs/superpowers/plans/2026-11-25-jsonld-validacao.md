# Validação do JSON-LD no Google Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** provar que o JSON-LD da home (`Physician` + 2× `MedicalClinic`) e as migalhas de `/palestras` e `/palestras/sala-de-parto` são válidos no validador do schema.org e no Teste de Resultados Enriquecidos do Google, e corrigir só o que os validadores apontarem.

**Architecture:** o JSON-LD já é gerado em `frontend/src/seo/jsonld.ts` e injetado no HTML pré-renderizado (`head.ts`). Este plano não muda a arquitetura: valida o que está **no ar**, corrige `jsonld.ts` com teste primeiro, republica e revalida.

**Tech Stack:** Schema Markup Validator (validator.schema.org), Teste de Resultados Enriquecidos (search.google.com/test/rich-results), Search Console (aba Aprimoramentos), Vitest.

**Dependência:** fazer **depois** do plano de fotos ([[2026-11-25-fotos-otimizacao]]): o campo `image` recomendado para `LocalBusiness` reaproveita `hero-1440.jpg` (≤ 350 KB), e não o JPG de 5 MB.

**Expectativa honesta:** o Google só mostra rich result para alguns tipos. `Physician` e `MedicalClinic` podem sair como "válido, sem resultado enriquecido"; isso não é falha. Vale o critério: **0 erros** nos dois validadores; avisos decididos um a um.

---

### Task 1: Linha de base no ar

- [ ] **Step 1: Extrair o JSON-LD publicado**

```bash
curl -s https://raquelmachadoped.com.br/ | grep -o '<script type="application/ld+json">[^<]*</script>' | sed 's/<[^>]*>//g' > "$SCRATCH/home.jsonld"
python -c "import json,sys; d=json.load(open(sys.argv[1],encoding='utf-8')); print([n['@type'] for n in d['@graph']])" "$SCRATCH/home.jsonld"
```
Expected: `['Physician', 'MedicalClinic', 'MedicalClinic']`.

- [ ] **Step 2: Mesmo para as duas páginas de palestra** (`/palestras`, `/palestras/sala-de-parto`): cada uma deve trazer um `BreadcrumbList` com 2 e 3 itens.

---

### Task 2: Schema Markup Validator

- [ ] **Step 1:** Chrome em `https://validator.schema.org/`, aba "Fetch URL", colar `https://raquelmachadoped.com.br/` e rodar. Repetir com `/palestras` e `/palestras/sala-de-parto`. (Só lê páginas públicas; nada é enviado a ninguém.)
- [ ] **Step 2:** registrar numa tabela (neste arquivo) por URL: itens detectados, **erros** e **avisos** com o texto exato.
- [ ] **Step 3:** suspeitas a conferir com o resultado real (não corrigir antes de ver o aviso):
  1. `medicalSpecialty: 'Pediatric'` como texto; o tipo esperado é o enum `MedicalSpecialty` (URL `https://schema.org/Pediatric`).
  2. `address` sem `postalCode`.
  3. `Physician.workLocation` apontando para os `MedicalClinic` por `@id`.

---

### Task 3: Teste de Resultados Enriquecidos do Google

- [ ] **Step 1:** Chrome em `https://search.google.com/test/rich-results`, testar as mesmas 3 URLs (rastreador "Smartphone"). A página pode pedir login do Google: usar a conta já aberta; não aceitar nenhum compartilhamento além do teste.
- [ ] **Step 2:** registrar: itens válidos, **erros críticos**, avisos (campos "recomendados" de `Negócio local`: `image`, `geo`, `openingHoursSpecification`, `priceRange`) e se "Trilha de navegação" foi detectada nas palestras.
- [ ] **Step 3:** decidir cada aviso (tabela abaixo). Regra: **nunca inventar dado**.

| Campo | Ação | Fonte do dado |
|---|---|---|
| `image` | Adicionar `https://raquelmachadoped.com.br/images/hero-1440.jpg` na `Physician` e nas clínicas | já temos (após o plano de fotos) |
| `address.postalCode` | Adicionar **só** com o CEP confirmado das duas clínicas | perguntar à Raquel (Cativa e Fábrica do Amanhã) |
| `openingHoursSpecification` | **Não adicionar** sem os horários reais | perguntar à Raquel; se não houver, deixar de fora |
| `geo` | **Não adicionar** por enquanto | coordenadas só se a Raquel ou o Google Maps das clínicas confirmarem |
| `priceRange` | **Não adicionar** (consulta tem valor em área restrita) | — |

---

### Task 4: Corrigir o que foi apontado (TDD)

**Files:** Modify `frontend/src/seo/jsonld.ts`, `frontend/src/seo/rotas.test.ts`

- [ ] **Step 1: Teste que falha** (acrescentar em `rotas.test.ts`, só para o que a Task 2/3 confirmou; exemplo para `image` e enum):

```ts
it('médica e clínicas trazem image absoluta e especialidade como enum do schema.org', () => {
  const grafo = ROTAS_SEO.find((r) => r.caminho === '/')!.jsonLd[0] as { '@graph': Array<Record<string, unknown>> }
  for (const no of grafo['@graph']) {
    expect(String(no.image)).toMatch(/^https:\/\/raquelmachadoped\.com\.br\/images\/hero-1440\.jpg$/)
    expect(no.medicalSpecialty).toBe('https://schema.org/Pediatric')
  }
})
```
- [ ] **Step 2:** `npx vitest run src/seo` → FAIL.
- [ ] **Step 3: Implementar** em `jsonld.ts`: `const IMAGEM = \`${SITE_URL}/images/hero-1440.jpg\``; acrescentar `image: IMAGEM` na `Physician` e nas clínicas; `medicalSpecialty: 'https://schema.org/Pediatric'` (só se a Task 2 confirmar o aviso); `postalCode` só se o CEP vier da Raquel (acrescentar o campo em `ENDERECOS` e no teste).
- [ ] **Step 4:** `npx tsc -b && npm test` → verde (inclui `hidratacao.test.tsx` e `rotas.test.ts`, que já proíbe segredos/telefones fora do padrão).
- [ ] **Step 5: Commit** — `git commit -am "fix(seo): JSON-LD conforme validadores (image, enum de especialidade)"`

---

### Task 5: Publicar e revalidar

- [ ] **Step 1:** branch → master → push (mesma ordem do projeto); esperar o cron (~2 min). **O HTML não é cacheado** (`cf-cache-status: DYNAMIC`), então o JSON-LD novo aparece direto.
- [ ] **Step 2:** repetir as Tasks 2 e 3 nas 3 URLs: critério de aceite = **0 erros** no validador do schema.org e **0 erros críticos** no teste do Google.
- [ ] **Step 3:** Search Console → "Inspeção de URL" da home → "Testar URL ao vivo" → "Solicitar indexação" para o Google ler o JSON-LD novo.
- [ ] **Step 4 (em 7 a 14 dias):** Search Console → Aprimoramentos: conferir se aparece "Trilha de navegação" válida e nenhum erro de dados estruturados.
- [ ] **Step 5:** registrar no vault (daily + resultado dos validadores).

## Riscos

- **Dado inventado:** a regra da Task 3 impede horário, geo e preço sem fonte.
- **Rich result não aparece:** esperado para `Physician`/`MedicalClinic`; o ganho aqui é o Google entender entidade, endereço e telefone, não uma estrela nos resultados.
- **Login do Google no teste:** só abre página pública do site; se pedir mais que isso, parar e falar com o Peter.
