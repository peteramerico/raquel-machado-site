# Remodelagem — Fase 0 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apagar o blog e levar o site da Raquel ao framework do Primeiro Colo (backend Docker + migrations + roteador + testes + deploy), sem mudança visível.

**Architecture:** ver `docs/superpowers/specs/2026-11-16-remodelagem-fase0-design.md`. Backend mínimo (só `/api/health`) com runner de migrations versionadas; roteador com `RootLayout`; deploy por workflow **e** hook da VPS migrados juntos; cutover do nginx com backup e rollback.

**Tech Stack:** Node 20/22, Express 4, mysql2, Jest + supertest, React 19 + RR7 (`createBrowserRouter`), Vitest, Docker Compose, nginx.

**Gates (pedir OK do Peter antes):** A) backup + hook na VPS; B) troca do nginx; C) limpeza final (parar o systemd antigo / apagar o legado do host).

---

## Task 1 — Backend novo (substitui o do blog) — TDD

**Files:** Delete `backend/src/routes/**`, `backend/src/views/**`, `backend/src/services/scheduler.js`, `backend/src/middleware/auth.js`, `backend/scripts/seed-admin.js`, `backend/migrations/001_init.sql`. Create `backend/Dockerfile`, `backend/.dockerignore`, `backend/src/{db,config,server,app,migrar,seed}.js`, `backend/migrations/001_remover_blog.sql`, `backend/tests/{migrar,health}.test.js`. Modify `backend/package.json`, `backend/docker-compose.yml`, `backend/.env.example`.

- [ ] **1.1** Remover o código do blog (lista acima) e as dependências `ejs node-cron slugify multer bcrypt jsonwebtoken cors`(mantém `cors`); adicionar `jest` e `supertest` (dev) e scripts `start`, `seed`, `test`.
- [ ] **1.2 Teste que falha — `tests/migrar.test.js`** (runner com pool falso em memória):
  - aplica em ordem de nome só as migrations ainda não registradas;
  - não reaplica as já registradas (idempotente, 2 execuções = 1 aplicação);
  - se uma migration falha, não registra e propaga o erro (para o container falhar alto, não silenciosamente);
  - ignora arquivos que não são `NNN_nome.sql`.
- [ ] **1.3 Implementar `src/migrar.js`**: `async function migrar(pool, dir)` → garante `schema_migracoes(nome PK, aplicada_em)`, `GET_LOCK('raquel_migrar', 30)`, lê `dir`, filtra `/^\d{3}_.+\.sql$/`, ordena, pula as registradas, executa o SQL (várias instruções, via conexão com `multipleStatements`), registra, `RELEASE_LOCK` em `finally`.
- [ ] **1.4 Teste que falha — `tests/health.test.js`** (supertest em `app.js`, sem abrir porta): `GET /api/health` → 200 `{ ok: true }`; rota desconhecida em `/api/x` → 404 JSON.
- [ ] **1.5 Implementar `src/app.js`** (Express, `trust proxy`, `cors({ origin: FRONTEND_URL })`, `cookie-parser`, `/api/health`, 404 de `/api`) e `src/server.js` (`listen(PORT||3337)`); `src/seed.js` roda `migrar(pool, ../migrations)` e sai com código ≠ 0 se falhar; `src/config.js` e `src/db.js` copiados do padrão do Primeiro Colo.
- [ ] **1.6 `migrations/001_remover_blog.sql`**: `DROP TABLE IF EXISTS posts; DROP TABLE IF EXISTS admin_users;` com comentário "backup manual antes (gate A)".
- [ ] **1.7 Docker:** `Dockerfile` (`FROM node:20-alpine`, `ENV NODE_ENV=production`, `WORKDIR /app`, `COPY package*.json`, `npm ci --omit=dev`, `COPY . .`, `CMD ["sh","-c","node src/seed.js && node src/server.js"]`); `docker-compose.yml` conforme o spec (serviço `mysql` mantém `container_name: raquel-mysql`, volume externo `backend_raquel-mysql-data`, `name: raquel-site`, + healthcheck `mysqladmin ping`; serviço `raquel-backend` com `build: .`, `container_name: raquel-backend`, `env_file: .env`, `environment: {DB_HOST: mysql, DB_PORT: "3306", PORT: "3337"}`, `ports: ["127.0.0.1:3337:3337"]`, `depends_on: mysql: condition: service_healthy`, `restart: unless-stopped`). O bind `./migrations:/docker-entrypoint-initdb.d` **sai** (migrations passam a ser do runner).
- [ ] **1.8 Rodar** `npm test` → PASS; `npm ci` limpo; `node -e "require('./src/app')"` sem erro. Commit.
- [ ] **1.9 Teste de integração real (WSL):** MySQL 8 descartável em `:3319`, banco com `posts` e `admin_users` criados (réplica do estado de produção) → rodar `node src/seed.js` duas vezes: a 1ª derruba as tabelas e registra `001`; a 2ª não faz nada. Subir `server.js` e `curl /api/health`. Apagar o MySQL descartável.

## Task 2 — Frontend: `createBrowserRouter` + `RootLayout` — TDD

**Files:** Modify `frontend/src/App.tsx`, `frontend/src/pages/Home.tsx`, `frontend/src/pages/Familia.tsx` (+ testes). Create `frontend/src/components/RootLayout.tsx`, `frontend/src/App.test.tsx`.

- [ ] **2.1 Teste que falha** (`App.test.tsx`, `createMemoryRouter` exportando `routes`): em `/` e `/familia` há `header` do site e `footer`; em `/links` e `/privacidade` **não** há; `/qualquer` redireciona para `/`; a rota raiz inclui `ScrollToHash`.
- [ ] **2.2** `RootLayout` = `<SiteHeader/>` + `<Outlet/>` + `<SiteFooter/>`; `App.tsx` exporta `routes` e usa `createBrowserRouter(routes)` + `RouterProvider`; `ScrollToHash` no elemento raiz pathless; `Home` e `Familia` perdem `<SiteHeader/>`/`<SiteFooter/>`.
- [ ] **2.3** Ajustar `Familia.test.tsx` (deixa de esperar header/footer dentro da página); `npm test`, `tsc -b`, `lint`, `build` verdes. Capturas antes/depois de `/` e `/familia` (desktop + 390px) idênticas. Commit.

## Task 3 — Remover `admin/` e migrar o workflow

**Files:** Delete `admin/`. Modify `.github/workflows/deploy.yml`, `README.md` (se citar blog/admin), `frontend/public/robots.txt` (mantém `Disallow: /admin/` — reservado ao futuro admin).

- [ ] **3.1** `git rm -r admin`; `grep -rn "admin" frontend/src` sem referências ao admin do blog.
- [ ] **3.2 `deploy.yml`** (padrão do Primeiro Colo): job `build-deploy` (checkout, setup-node 22 com cache npm, `npm ci`, `npm test`, `npm run build`, `burnett01/rsync-deployments@7.0.1` de `frontend/dist/` para `/var/www/raquel-frontend/` com `--delete`) e job `backend-deploy` (rsync de `backend/` para `/opt/raquel-backend/` com `--exclude=node_modules --exclude=.env --exclude=uploads` **sem** `--delete` na 1ª rodada, depois `appleboy/ssh-action` com `cd /opt/raquel-backend && docker compose up -d --build`). **Sem** o passo do nginx, **sem** systemd, **sem** admin. Mesmos secrets (`SSH_HOST/PORT/USER/PRIVATE_KEY`).
- [ ] **3.3** Revisão do diff inteiro da branch contra o spec (nenhuma referência a blog/admin/systemd restante). Commit.

## Task 4 — Preparar a VPS (GATE A: pedir OK)

Scripts em `scratchpad/vps.py` (paramiko, só chave SSH).

- [ ] **4.1 Backups** em `/root/backups/raquel-site/2026-11-16/`: `mysqldump --single-transaction raquel_blog | gzip`, `cp -a /etc/nginx/sites-available/raquelmachadoped`, `tar czf opt-raquel-backend.tgz` (sem `node_modules`), `cp /opt/deploy-scripts/deploy-raquel-site.sh` e a unit `raquel-backend.service`. Conferir tamanho > 0 e `gunzip -t`.
- [ ] **4.2 Hook transicional** `/opt/deploy-scripts/deploy-raquel-site.sh`: `if [ -f "$WT/backend/Dockerfile" ]` → fluxo novo (frontend `npm ci && npm run build` → rsync para `/var/www/raquel-frontend/`; rsync do backend; `docker compose up -d --build`), `else` → fluxo antigo (conteúdo atual preservado). `bash -n` antes de salvar; manter cópia `.bak`.
- [ ] **4.3** Confirmar que o cron segue verde com o estado atual do `master` (o hook antigo ainda funciona).
- [ ] **4.4 Pré-voo na VPS (revisão de 2026-11-16, não altera nada em produção):** enviar `git archive` da branch por SFTP para `/tmp/raquel-preflight/`; com o Node que o hook usa (`/opt/node22/bin`): `npm ci && npm test` no frontend e no backend; `docker compose -f ... --env-file /opt/raquel-backend/.env config -q`; `docker build -t raquel-backend-preflight` (sem subir nada) e remover a imagem e a pasta. Falhou = corrigir na branch antes do merge (senão o deploy trava o SHA).
- [ ] **4.5 Rollback pronto antes de mexer (revisão):** `/root/backups/raquel-site/2026-11-16-remodelagem/rollback.sh` + nota abaixo. O `rsync --delete` do deploy novo apaga o código antigo do blog em `/opt/raquel-backend`, então `systemctl start raquel-backend` sozinho NÃO volta o blog. Rollback completo: (1) `git revert -m 1 <merge>` + push → o cron roda o ramo antigo do hook (restaura `admin/` e backend antigos e reinicia o systemd em ~2 min); (2) restaurar o nginx do backup + `nginx -t` + reload; (3) `docker stop raquel-backend && docker rm raquel-backend` (e o compose antigo só sobe o mysql); (4) só se for preciso reter o blog: `gunzip < raquel_blog.sql.gz | mysql` para recriar `posts`/`admin_users`. O script faz (2), (3) e (4) opcional e imprime o (1).

## Task 5 — Merge e subida do backend novo

- [ ] **5.1** Revisão final (spec ↔ diff) e **pedir OK do Peter para o merge** (dispara os dois deploys em produção).
- [ ] **5.2** `git merge --no-ff` → push; acompanhar `gh run watch` e `/var/www/deploy/auto-deploy/logs/deploy.log`.
- [ ] **5.3 Validar na VPS** (inclui: o `raquel-mysql` recriado voltou `healthy` e o volume segue o mesmo; o hook do cron terminou `DEPLOY OK`; só um `docker compose` rodou por vez): `docker ps` (`raquel-backend` Up, `raquel-mysql` healthy), `curl 127.0.0.1:3337/api/health`, `docker logs raquel-backend` (migração `001` aplicada), tabelas `posts`/`admin_users` ausentes, `schema_migracoes` com 1 linha. O visitante continua sendo servido pelo systemd antigo em 3001.

## Task 6 — Cutover do nginx (GATE B: pedir OK)

- [ ] **6.1** Gerar o novo `raquelmachadoped` a partir do atual (mesmos cabeçalhos/CSP/SSL): `location /blog { return 301 /; }`, `location ^~ /api/ { proxy_pass http://127.0.0.1:3337/api/; ... }`, **remove** `/admin` estático e `/uploads`. `nginx -t` → reload.
- [ ] **6.2 Smoke test** (`curl -sI`): `/` 200, `/familia` 200, `/links` 200, `/privacidade` 200, `/blog` 301→`/`, `/api/health` 200 (agora do container), `/admin` 200 (SPA, redireciona no cliente). Conferir logs do nginx sem 5xx.
- [ ] **6.3 Rollback pronto:** comandos de restauração do nginx de backup anotados no relatório.

## Task 7 — Limpeza (GATE C) e registro

- [ ] **7.1** Após uma janela sem problemas: `systemctl disable --now raquel-backend` (mantendo a unit), remover `node_modules` antigo do host. Deixar o legado (código antigo/unit) por alguns dias.
- [ ] **7.2** Remover do hook o ramo antigo (transicional → só o fluxo novo) num commit pequeno.
- [ ] **7.3 Registrar:** daily, `decisions.md`, `project_raquel_site.md`, `project_vps_raquel.md` (nova porta/serviço, fim do systemd), lição sobre "migrar os dois mecanismos de deploy juntos", cópias do spec/plano em `knowledge/raquel-machado-site/`; apagar a branch.
