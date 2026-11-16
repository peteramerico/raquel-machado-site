# Remodelagem do site da Raquel — Fase 0 (framework do Primeiro Colo) — Design

Data: 2026-11-16 · Repo: `raquel-machado-site` · Branch: `feat/remodelagem-fase0`

## Objetivo

Colocar o site da Raquel no mesmo framework de trabalho do Primeiro Colo e **apagar o blog**, sem mudar nada visível para o visitante. Esta fase **não cria login nem rotas novas de produto** — entrega a base (backend em Docker, migrations, roteador, testes, deploy) sobre a qual as Fases 1 (login) e 2 (área médica/admin, valor da consulta editável) serão construídas.

Decisões já tomadas pelo Peter (ver `knowledge/decisions.md`, 15/11): apagar o blog; seguir o framework do Primeiro Colo; página `/familia` antes (feita, no ar); depois login com 3 papéis servindo o conteúdo pela API. SSH via paramiko liberado.

## Estado encontrado (produção, 2026-11-16, só leitura)

- Backend do blog: serviço **systemd** `raquel-backend` (`/opt/raquel-backend`, `node src/server.js`, porta **3001**), MySQL em container `raquel-mysql` (compose project `raquel-site`, volume externo `backend_raquel-mysql-data`, `127.0.0.1:3306`).
- Banco `raquel_blog`: `posts` = **0 linhas**, `admin_users` = **2 linhas**. `/uploads` vazio (4 KB). `/blog` mostra "Nenhum post publicado ainda". Nada a preservar além de um backup por precaução.
- nginx (`/etc/nginx/sites-available/raquelmachadoped`) gerado pelo workflow: `/blog`, `/api`, `/uploads` → 3001; `/admin` → estático (admin do blog); `/` → SPA.
- **Dois deploys paralelos fazem o mesmo trabalho:** (a) workflow do GitHub (reescreve o nginx a cada deploy; `scp` do backend; systemd) e (b) cron `*/2` na VPS com o hook `/opt/deploy-scripts/deploy-raquel-site.sh` (faz `cd admin && npm ci` e `systemctl restart raquel-backend`; **não** mexe no nginx). Os dois precisam ser migrados juntos, senão: apagar `admin/` quebra o hook em todo deploy, e o workflow antigo reescreve o nginx de volta com `/blog`.
- Portas ocupadas: 3100 (umami), 3306/3307/3308/3309, 3335 (Primeiro Colo), 3336 (financeiro). **3337 livre** → novo backend da Raquel.
- Umami (`/opt/umami`) é independente (MySQL próprio) e não é tocado.

## Estado-alvo

```
raquel-machado-site/
  frontend/   React 19 + Vite + RR7 `createBrowserRouter` + RootLayout (Header/Footer) + Vitest   [já tem Vitest]
  backend/    Express + mysql2 em Docker (Dockerfile, docker-compose.yml), Jest + supertest
  docs/superpowers/{specs,plans}
```

### Backend (novo, mínimo e testado)
- `src/server.js`: Express, `trust proxy`, `cors` restrito ao site, `cookie-parser`, `GET /api/health` → `{ ok: true }`. **Nenhuma outra rota** (YAGNI; Fase 1 acrescenta).
- `src/db.js`, `src/config.js` (JWT_SECRET com fallback aleatório + aviso, igual ao Primeiro Colo).
- **Migrations versionadas** (`migrations/NNN_nome.sql`) aplicadas por `src/migrar.js` no boot (`src/seed.js`), registradas em `schema_migracoes`. Substitui os dois mecanismos do Primeiro Colo (`initdb` que só roda em volume vazio + `ALTER`s soltos no seed) — a causa do incidente de 2026-09-18 deles (ALTER obsoleto no seed derrubou a produção por ~5 min). Cada migration roda uma vez, com lock (`GET_LOCK`) contra dois containers subindo juntos. Migrations devem ser **idempotentes** (`IF EXISTS`/`IF NOT EXISTS`), porque DDL no MySQL faz commit implícito (não dá para reverter uma migration que falhou no meio).
- Migration `001_remover_blog.sql`: `DROP TABLE IF EXISTS posts, admin_users` (no-op em banco novo). **Só roda depois do backup manual** (gate).
- Dockerfile `node:20-alpine`, `CMD node src/seed.js && node src/server.js` (padrão do Primeiro Colo).
- `docker-compose.yml`: serviço `mysql` **idêntico em identidade** ao atual (`container_name: raquel-mysql`, volume externo `backend_raquel-mysql-data`, projeto `raquel-site`) + `healthcheck`; serviço `raquel-backend` (porta `127.0.0.1:3337`, `env_file: .env`, `environment` força `DB_HOST=mysql`, `DB_PORT=3306`, `PORT=3337` — o `.env` da VPS, que não está no repo, continua válido sem editar).
- Removidos: `routes/blog.js`, `routes/api/*`, `views/`, `services/scheduler.js`, `middleware/auth.js`, `scripts/seed-admin.js`, `migrations/001_init.sql` (schema do blog), dependências `ejs`, `node-cron`, `slugify`, `multer`, `bcrypt`, `jsonwebtoken` (voltam na Fase 1 com o que o Primeiro Colo usa: `bcryptjs`, `jsonwebtoken`).

### Frontend
- `App.tsx` passa a `createBrowserRouter`: rota raiz sem path (com `ScrollToHash`), filho **com** `SiteHeader`/`SiteFooter` (`/`, `/familia`), e rotas sem layout (`/links`, `/privacidade`, como hoje). `Home` e `Familia` deixam de renderizar header/footer próprios.
- Visual idêntico (verificado por captura antes/depois).
- Testes de roteamento (rota existe, `*` redireciona, header/footer só onde devem).

### Deploy (os dois caminhos, atualizados juntos)
- **Workflow:** padrão do Primeiro Colo — `build-deploy` (npm ci, `npm test`, build, `rsync` do `dist`) e `backend-deploy` (`rsync` + `docker compose up -d --build`). **Remove** o passo que reescreve o nginx e todo o `admin`.
- **Hook da VPS** (`deploy-raquel-site.sh`): versão **transicional** — se o worktree tem `backend/Dockerfile` usa o fluxo novo (build do frontend, rsync, `docker compose up -d --build`), senão o antigo. Instalado **antes** do merge para não bloquear o SHA.
- **nginx** (editado uma vez, com backup, na VPS): `/api` → `127.0.0.1:3337`; `/blog` → `301 /`; remove `/admin` (estático) e `/uploads`; resto igual. Cabeçalhos/CSP inalterados. A partir daí o nginx **não é mais reescrito por deploy**.

## Cutover (ordem e rollback)
1. Backup do banco (`mysqldump raquel_blog` → `/root/backups/raquel-site/`) e do nginx e do diretório `/opt/raquel-backend`. **Gate A.**
2. Hook transicional instalado (backward-compatible).
3. Merge → os dois deploys sobem o container novo em **3337** (o systemd antigo segue servindo 3001; nada muda para o visitante). O `001_remover_blog` roda aqui.
4. Validar `127.0.0.1:3337/api/health`, logs do container, tabelas.
5. Trocar nginx (`nginx -t` + reload): `/api`→3337, `/blog`→301. Validar `/`, `/familia`, `/links`, `/privacidade`, `/blog`, `/api/health`. **Gate B.**
6. Parar e **desabilitar** `raquel-backend.service` (mantendo o arquivo da unit). Limpar `node_modules`/código antigo do host só depois de dias sem problema.
- **Rollback:** restaurar o nginx do backup + `systemctl start raquel-backend` + `git revert` do merge (o hook transicional volta ao fluxo antigo). O banco não é afetado (tabelas do blog estavam vazias; backup existe).

## Riscos
- Recriação do container `raquel-mysql` por causa do `healthcheck` (alguns segundos; dados no volume externo). Mitigado: acontece quando o blog já está morto e só o novo backend usa o banco.
- Dois deploys concorrentes executando `docker compose up -d --build` no mesmo projeto (já é assim no Primeiro Colo). Mitigado: `up -d --build` é idempotente; o cron só age em SHA novo e leva até 2 min.
- Testar Docker localmente não é possível (sem Docker no Windows); backend testado com Jest + MySQL descartável no WSL; a imagem é validada na VPS no passo 3 antes do cutover do nginx.
