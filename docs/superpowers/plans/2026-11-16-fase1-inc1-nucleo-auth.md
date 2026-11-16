# Fase 1 · Incremento 1 — Núcleo de autenticação + guia pela API — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/familia` passa a exigir login; o guia sai do bundle e vem da API; contas criadas por CLI.

**Architecture/Spec:** `docs/superpowers/specs/2026-11-16-fase1-login-design.md`. Backend com injeção de dependência (`criarApp({repo, config})`) → testes sem MySQL; SQL só em `repositorio.js`.

**Tech Stack:** Express 4, bcryptjs, jsonwebtoken, express-rate-limit, mysql2, Jest+supertest · React 19 + RR7 + Vitest.

**Convenção TDD:** em cada task, teste → ver falhar pelo motivo certo → implementar → ver passar → commit.

---

## Task 1 — Dependências, config e senhas
**Files:** `backend/package.json`; create `src/config.js`, `src/senhas.js`, `tests/senhas.test.js`, `tests/config.test.js`.
- [ ] Instalar `bcryptjs@^3`, `jsonwebtoken@^9`, `express-rate-limit@^8`.
- [ ] **Testes `senhas`:** `validarNovaSenha(senha, {login, nome, senhaAtual})` recusa `< 10` caracteres, igual ao login, contendo o login inteiro, igual à senhaAtual, só espaços; aceita frase longa. `senhaTemporaria()` tem 12 caracteres do alfabeto sem ambíguos, 1000 gerações sem repetição, e nunca contém `0 O 1 l I`. `hashSenha`/`conferirSenha` (bcrypt custo 12; `conferirSenha` com hash `null` ou login inexistente ainda gasta tempo: usa `HASH_FICTICIO` e devolve `false`).
- [ ] **Testes `config`:** em produção sem `JWT_SECRET`, curto (< 32) ou contendo "trocar" → lança erro explicativo; fora de produção gera segredo efêmero com aviso.
- [ ] Implementar. Commit.

## Task 2 — Sessão (JWT/cookie) e middlewares
**Files:** `src/sessao.js`, `src/middleware/{sessao,papel,origem}.js`, `tests/sessao.test.js`, `tests/middleware.test.js`.
- [ ] **Testes:** `assinar({id, papel, senhaAtualizadaEm})`/`verificar` ida e volta; token adulterado/expirado → `null`; `v` (`sessao_versao`) diferente do banco invalida; usuário `ativo=0` invalida; **papel vem do banco, não do token** (token com `papel:'admin'` de usuário `familia` ⇒ acesso de `familia`); cookie com `httpOnly`, `sameSite=lax`, `secure` só em produção. `exigirPapel('medica')` deixa passar `medica`/`admin`, barra `familia` (403); `exigirPapel('familia')` deixa os três; sem sessão → 401. `origem`: POST com `Origin: https://evil.com` e `Host: raquelmachadoped.com.br` → 403; mesmo host → ok; sem `Origin` → ok; GET nunca barrado.
- [ ] Implementar com o repositório injetado (`repo.buscarUsuarioPorId`). Commit.

## Task 3 — Repositório (SQL) e migrations
**Files:** `migrations/002_usuarios.sql`, `migrations/003_configuracoes.sql`, `src/repositorio.js`, `tests/repositorio.integracao.test.js` (só roda com `TEST_DB_HOST`), `tests/repositorioFalso.js` (helper de teste, em memória).
- [ ] Migrations conforme o spec (idempotentes; `INSERT IGNORE` do valor 400).
- [ ] `repositorio.js` com: `buscarUsuarioPorLogin`, `buscarUsuarioPorId`, `criarUsuario`, `atualizarSenha(id, hash, precisaTrocar)`, `registrarAcesso(id)`, `lerConfig(chave)`, `gravarConfig(chave, valor, porId)`. Só consultas parametrizadas.
- [ ] **Teste de integração** (pulado sem `TEST_DB_*`): roda as migrations 001–003 em MySQL descartável e exercita cada função, inclusive login único e `INSERT IGNORE`. Rodar localmente no WSL.
- [ ] `repositorioFalso.js` implementa a mesma interface em memória (usado por todos os testes de rotas). Commit.

## Task 4 — Rotas de autenticação
**Files:** `src/rotas/auth.js`, `src/app.js` (vira `criarApp`), `tests/auth.test.js`; atualizar `tests/health.test.js`.
- [ ] **Testes (supertest + repositório falso):**
  login ok (cookie `rm_session` httpOnly, corpo sem senha/hash) · senha errada → 401 genérico · login inexistente → mesma resposta **e** `bcrypt` foi chamado (tempo constante) · área inalcançável (`familia` entrando em `painel`) → 403 sem revelar a senha certa · usuário inativo → 401 · rate limit por IP (30) e por login+IP (8) só nas falhas (429 após o limite; o mesmo login vindo de outro IP não é bloqueado) · `GET /me` com/sem cookie · logout limpa o cookie · `trocar-senha`: valida política, exige senha atual correta, zera `precisa_trocar_senha`, emite novo cookie, e **o cookie antigo deixa de valer** (`sessao_versao`) · corpo não-JSON/campos faltando → 400 · Origin cruzado → 403.
- [ ] `app.js`: `criarApp({repo, config})`; `module.exports = criarApp()` com o repositório real **carregado de forma preguiçosa** (o teste de health continua sem MySQL). Rotas `/api/auth/*`. Commit.

## Task 5 — Guia pela API e valor da consulta
**Files:** `src/conteudo/guiaConsulta.js`, `src/rotas/familia.js`, `tests/familia.test.js`.
- [ ] Mover o texto de `frontend/src/content/guiaConsulta.ts` para o backend (mesma estrutura; **sem preço**).
- [ ] **Testes:** sem sessão → 401 · `familia`, `medica`, `admin` → 200 `{guia, valorConsulta}` · `precisa_trocar_senha=1` → 403 `{codigo:'trocar_senha'}` · `valorConsulta` vem de `configuracoes` (número) e cai em 400 só se a chave faltar · o JSON contém os 7 capítulos e as 6 faixas. Commit.

## Task 6 — CLI de contas
**Files:** `src/bin/criar-usuario.js`, `tests/criarUsuario.test.js`.
- [ ] Função pura `executar(argv, {repo, saida})` (testável): `--papel admin|medica|familia --login x --nome "Y" [--contato 5584…]` cria com senha temporária (12 caracteres) e `precisa_trocar_senha=1`; `--redefinir --login x` gera nova temporária e invalida sessões; login duplicado/papel inválido → erro claro e código ≠ 0. A senha vai **só para a saída padrão, uma vez**.
- [ ] Teste: nada da senha em log de erro; hash gravado ≠ senha. Commit.

## Task 7 — Frontend: API, auth e guarda
**Files:** `frontend/src/lib/{api.ts,auth.tsx}`, `components/RequerPapel.tsx`, `pages/{Entrar,TrocarSenha}.tsx` (+ `.module.css`), testes de cada; `vite.config.ts` (proxy `/api`).
- [ ] **Testes:** `RequerPapel` (carregando, sem sessão → redireciona para `/familia/entrar`, `precisaTrocarSenha` → `/conta/senha`, papel suficiente → renderiza); `Entrar` (envia `area`, mostra erro genérico em 401, 429 com mensagem de espera, redireciona de volta ao destino); `TrocarSenha` (regras mostradas, erro da API, sucesso leva à área); `auth` (`entrar`/`sair`/`me` atualizam o estado).
- [ ] Visual no padrão do site (frontend-design): tela de login como "porta da caderneta" — cartão claro sobre o fundo do hero, Fraunces no título, mostrar/ocultar senha, foco visível, mobile-first. Commit.

## Task 8 — `/familia` consome a API; menu; rotas
**Files:** `pages/Familia.tsx`, `routes.tsx`, `components/SiteHeader.tsx`, `frontend/public/robots.txt`; remover `content/guiaConsulta.ts`, `lib/valorConsulta.ts` e seus testes; ajustar `valorConsulta.guard.test.ts`.
- [ ] Rotas: `/familia/entrar`, `/conta/senha`, `/familia` dentro de `RequerPapel papel="familia"`. `Familia` busca o guia (carregando/erro/tentar de novo) e formata o valor com `formatarBRL` (função mantida num util puro, **sem** número).
- [ ] `SiteHeader`: "Sair" quando logado (chama `sair()` e vai para `/`). Testes de rotas atualizados (header/rodapé nas novas páginas; `/familia` sem sessão redireciona).
- [ ] `robots.txt`: `Disallow: /familia/ /painel/ /admin/ /conta/` (e `noindex` nas páginas). Commit.

## Task 9 — Verificação local ponta a ponta (MySQL no WSL + Chrome)
- [ ] MySQL descartável (porta 3319), rodar `seed.js` (001–003), subir backend `:3337` e Vite com proxy; criar contas pela CLI (`admin`, `medica`, `familia`).
- [ ] No Chrome (localhost — ambiente de teste): login de cada papel; guarda redireciona; troca obrigatória de senha; sessão antiga cai após trocar; logout; erro e rate limit visíveis; `/familia` renderiza o guia vindo da API com o valor do banco; alterar o valor direto no banco e recarregar; mobile (iframe 390 px).
- [ ] Rodar a integração do repositório. Limpar o MySQL. Todos os testes + `tsc` + lint + build verdes.

## Task 10 — Produção (Inc. 1)
- [ ] **Pré-voo na VPS** (como na Fase 0): testes, `compose config`, `docker build`.
- [ ] Garantir `JWT_SECRET` forte no `.env` da VPS **sem imprimir** (se curto/placeholder, gerar 64 hex e gravar; backup do `.env` antes).
- [ ] Merge → deploys (workflow + cron) → migrations 002/003 → `docker logs`.
- [ ] Criar `peter` (admin) e `raquel` (médica) via `docker exec … criar-usuario`; **combinar com o Peter como entregar as senhas temporárias** (não em texto no repositório; troca obrigatória no 1º acesso).
- [ ] Verificação pública **sem autenticar**: `/api/familia/guia` → 401, `/api/auth/me` → 401, login errado → 401 genérico, 9ª falha seguida do mesmo login+IP → 429 (**usar login fictício**, nunca `peter`/`raquel` reais), `/familia` carrega a tela de login, bundle público **não contém** o texto do guia (`grep` no JS).
- [ ] Registrar no vault; apagar a branch.

---

## Incrementos seguintes (planos próprios quando chegar a vez)
- **Inc. 2 — `/painel`:** `GET/POST /api/painel/familias`, `POST …/:id/redefinir`, `PATCH …/:id` (ativar/desativar), `PUT /api/painel/config/valor-consulta`; telas com mensagem de WhatsApp pronta; menu "Área médica".
- **Inc. 3 — `/admin`:** `GET/POST /api/admin/usuarios`, redefinir, desativar; trava para o último admin ativo; menu "Administrador".


---

## Emendas do plano após a revisão independente (valem sobre o texto acima; ver as 12 emendas do spec)

- **Task 1:** + `BCRYPT_COST` configurável (teste = 4); senha máx. 72 bytes; igual ao `nome` recusada (testes); `config.js` com função `carregar(env)` testável e `JWT_SECRET` forte obrigatório em produção.
- **Task 2:** middleware `sessao()` único com `precisa_trocar_senha` embutido (testes: rota qualquer → 403 `trocar_senha`; liberadas `/me`, `/logout`, `/trocar-senha`); `jwt.verify` com `algorithms:['HS256']`; `no-store`/`Vary: Cookie`/ETag off como middleware de `/api` (teste de cabeçalhos).
- **Task 3:** + **`src/db.js`** (pool preguiçoso sem `multipleStatements`; corrigir o comentário do `seed.js`); migration `002` com `sessao_versao`; `atualizarSenha` incrementa `sessao_versao` e `desativar` também; o repositório falso imita (contador). Teste de integração cobre as duas coisas.
- **Task 4:** limitadores dentro de `criarApp({ limites })`; handler de erro JSON (teste: corpo inválido → 400 JSON); destino pós-login (query `next`) só caminho interno; `GET /api/auth/login` continua 404 (rota só POST — `health.test.js` segue valendo).
- **Task 5:** o 403 `trocar_senha` sai do middleware (não duplicar na rota).
- **Task 7/8:** `AuthProvider` em `AreaRestrita` (layout das áreas restritas), **não** em `Raiz`; `BarraSessao` com "Sair" dentro das áreas; **`SiteHeader` não muda**; `robots.txt` só `/painel/` e `/admin/`; teste-guarda via `fs` (frontend + backend).
- **Task 10 (produção) — ordem revisada:**
  1. Backup do `.env` (`/root/backups/raquel-site/…`) e **gerar `JWT_SECRET` forte** (64 hex) no `.env` da VPS sem imprimir; conferir só comprimento/flags.
  2. Pré-voo: testes, `compose config`, `docker build` **e boot check** (`docker run --rm --env-file .env -e NODE_ENV=production <img> node -e "require('./src/config').carregar(process.env)"` → deve passar).
  3. `nginx.conf` do repo ganha **redirect `www` → apex** e um comentário documentando o `cloudflare-realip.conf`; aplicar na VPS (backup, `nginx -t`, reload) e testar `www`.
  4. Merge → deploys (as duas pipelines podem entrar em ordem diferente: se o frontend entrar antes, `/familia` mostra "tentar de novo" por ~1 min — aceitável) → migrations 002/003 → logs.
  5. Contas iniciais pela CLI; **checar o IP visto pelo limitador** (login fictício errado 9× de um IP → 429; do mesmo ponto com outro login → não bloqueado).
  6. Verificação pública sem autenticar (401/403/429/`no-store`), bundle público **sem** o texto do guia; purgar cache do Cloudflare se possível.
