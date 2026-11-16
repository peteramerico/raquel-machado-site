# raquel-machado-site

Site da Dra. Raquel Machado (pediatra e neonatologista) — https://raquelmachadoped.com.br

```
frontend/   React 19 + Vite + TypeScript + React Router 7 + CSS Modules · testes: Vitest
backend/    Express + MySQL 2 em Docker · migrations versionadas · testes: Jest + supertest
docs/superpowers/{specs,plans}   design e planos de cada entrega
```

## Desenvolvimento

```bash
cd frontend && npm ci && npm run dev      # http://localhost:5173
cd frontend && npm test                   # Vitest
cd backend  && npm ci && npm test         # Jest
```

O backend sobe em Docker (`backend/docker-compose.yml`: MySQL + API em `127.0.0.1:3337`); as migrations de
`backend/migrations/NNN_nome.sql` rodam no boot do container (`src/seed.js`) e ficam registradas em `schema_migracoes`.
Migrations devem ser idempotentes e nunca editadas depois de aplicadas em produção.

## Deploy

Push no `master` publica em produção por **dois caminhos equivalentes** (mantê-los em sincronia):

1. `.github/workflows/deploy.yml` — testes, build, `rsync` do frontend e do backend, `docker compose up -d --build`.
2. Cron `*/2` na VPS (`/var/www/deploy/auto-deploy/`, hook `/opt/deploy-scripts/deploy-raquel-site.sh`).

O nginx **não** é gerado por deploy: a config fica na VPS (`/etc/nginx/sites-available/raquelmachadoped`).

## Áreas do site

- `/` landing, `/links`, `/privacidade` — públicas.
- `/familia` — guia da consulta (hoje sem login; vira "Área da família" com login na próxima fase).
- Planejadas: Área médica e Administrador (ver `docs/superpowers/`).
