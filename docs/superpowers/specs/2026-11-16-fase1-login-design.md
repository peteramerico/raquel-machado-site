# Fase 1 — Login com 3 áreas (família · médica · administrador) — Design

Data: 2026-11-16 · Repo: `raquel-machado-site` · Base: Fase 0 em produção (backend Docker `/api` em 3337, migrations versionadas, `RootLayout`)

## Objetivo

Colocar "Área da família", "Área médica" e "Administrador" atrás de login, como no Primeiro Colo, e **tirar o conteúdo do guia do bundle público** (esconder rota no React não protege conteúdo: o JS estático é público). O valor da consulta passa a ser um dado do servidor, editável na área médica e refletido em todo o site.

## Decisões (todas reversíveis; marcadas com ★ as que o Peter pode querer mudar)

1. **Uma tabela `usuarios` com papel** (`familia` | `medica` | `admin`) em vez de uma tabela/cookie por área (Primeiro Colo). ★ Razão: aqui são poucas pessoas e o admin (Peter) e a médica (Raquel) precisam enxergar a área da família; um cookie, uma sessão, um modelo. **Hierarquia:** `admin` ⊇ `medica` ⊇ `familia` (quem tem papel maior acessa as áreas menores).
2. **Três entradas no menu, três telas de login** (`/familia/entrar`, `/painel/entrar`, `/admin/entrar`), todas chamando o mesmo `POST /api/auth/login` com `area`. O servidor recusa se o papel do usuário não alcança a área ("esse acesso é de outra área").
3. **Sem cadastro aberto e sem e-mail nesta fase.** A médica cria o acesso da família (login + senha temporária mostrados uma vez, com mensagem pronta de WhatsApp — como no Primeiro Colo); o admin cria médicas/admins. Esqueci-a-senha por e-mail fica para depois; até lá, quem criou redefine (nova senha temporária).
4. **Senha temporária + troca obrigatória no 1º acesso** (`precisa_trocar_senha`). Nunca senha padrão fixa (o "123456" do Primeiro Colo não se repete). Contas iniciais (`peter` admin, `raquel` médica) criadas por **CLI no container**, com senha aleatória exibida uma vez.
5. **Guia servido pela API** (`GET /api/familia/guia`, exige login), conteúdo em `backend/src/conteudo/guiaConsulta.js` (sai do frontend). ★ Editar o texto continua sendo por deploy; editor de texto fica para outra fase (YAGNI).
6. **Valor da consulta** em `configuracoes` (chave `valor_consulta`, seed 400), lido junto com o guia e editado em `PUT /api/painel/config/valor-consulta` (médica/admin). O frontend perde `valorConsulta.ts` e o preço fixo; o teste-guarda continua proibindo `R$ 400` escrito fora do banco/seed.
7. **Entrega em 3 incrementos independentes**, cada um no ar antes do próximo:
   - **Inc. 1 — Núcleo:** usuários, sessão, login/logout/me/trocar-senha, CLI de contas, guia via API, `/familia` protegida, menu.
   - **Inc. 2 — Área médica (`/painel`):** lista de famílias, criar acesso (senha temporária + WhatsApp), redefinir senha, desativar/reativar, editar valor da consulta.
   - **Inc. 3 — Administrador (`/admin`):** gerenciar contas de qualquer papel (criar médica/admin, redefinir, desativar).

## Modelo de dados (migrations idempotentes)

`002_usuarios.sql`
```
usuarios(id PK AI, login VARCHAR(40) UNIQUE NOT NULL, nome VARCHAR(120) NOT NULL,
  papel ENUM('familia','medica','admin') NOT NULL, senha_hash VARCHAR(100) NOT NULL,
  precisa_trocar_senha TINYINT(1) NOT NULL DEFAULT 1, ativo TINYINT(1) NOT NULL DEFAULT 1,
  sessao_versao INT NOT NULL DEFAULT 1,  -- +1 a cada troca/redefinição de senha e desativação: derruba as sessões antigas
  criado_por INT NULL, criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP, ultimo_acesso_em TIMESTAMP NULL,
  contato VARCHAR(40) NULL  -- WhatsApp da família (só para montar a mensagem de acesso)
  INDEX(papel, ativo))
```
`003_configuracoes.sql`: `configuracoes(chave VARCHAR(60) PK, valor VARCHAR(255) NOT NULL, atualizado_em, atualizado_por INT NULL)` + `INSERT IGNORE ('valor_consulta','400')`.

## API (Inc. 1)

| Método e rota | Quem | Resultado |
|---|---|---|
| `POST /api/auth/login` `{login, senha, area}` | público (rate limit) | 200 `{nome, papel, precisaTrocarSenha}` + cookie; 401 genérico; 403 se o papel não alcança `area` |
| `POST /api/auth/logout` | qualquer | limpa o cookie |
| `GET /api/auth/me` | logado | `{nome, papel, precisaTrocarSenha}`; 401 |
| `POST /api/auth/trocar-senha` `{senhaAtual, novaSenha}` | logado | troca, zera `precisa_trocar_senha`, renova cookie; invalida as outras sessões |
| `GET /api/familia/guia` | `familia`+ (e já sem `precisa_trocar_senha`) | `{ guia, valorConsulta }` |

Inc. 2/3 acrescentam `/api/painel/*` e `/api/admin/*`.

## Segurança (requisitos, não detalhes)

- **Sessão:** JWT HS256 (`{sub, v}`; `v` = `sessao_versao`) em cookie **httpOnly, Secure (produção), SameSite=Lax, path=/**, 7 dias. trocar/redefinir senha e desativar a conta incrementam `sessao_versao` e **invalidam** as sessões antigas (contador de versão, não timestamp: duas trocas no mesmo segundo também invalidam). O middleware relê o usuário no banco a cada requisição (`ativo`, papel atual, `v`) — papel nunca é confiado só do token.
- **Login:** `bcryptjs` custo 12; **tempo constante** (sempre roda `compare`, contra um hash fictício se o login não existe); mensagem única "Usuário ou senha incorretos"; rate limit **por IP (30/15 min)** e **por (login + IP) (8/15 min)**, ambos só contando falhas (`skipSuccessfulRequests`) — a chave login+IP evita que um atacante trave a conta real de outra pessoa; `trocar-senha` também limitado (10/15 min por usuário), pois é um oráculo da senha atual; login normalizado (minúsculo, sem acento).
- **Senhas:** mínimo 10 e máximo 72 bytes (limite do bcrypt), não pode ser igual/conter o login nem ser igual ao nome, diferente da atual; temporária = 12 caracteres sem caracteres ambíguos, `crypto.randomInt`.
- **CSRF:** SameSite=Lax + corpo JSON + verificação de `Origin` em métodos que alteram estado (rejeita se o host do `Origin` ≠ `Host` da requisição; sem depender de configuração por ambiente).
- `JWT_SECRET` obrigatório em produção (≥ 32 caracteres e sem "trocar"): o backend **não sobe** sem ele (nada de segredo aleatório por boot, que derrubaria as sessões a cada restart). Garantir/gerar o valor na VPS sem imprimi-lo.
- Nada de senha/hash/token em log; respostas de erro sem detalhe interno; `req.ip` real (nginx envia `X-Forwarded-For`; `trust proxy` já ligado).
- Páginas de login/troca com `noindex`; `robots.txt` ganha `Disallow` das áreas.

## Arquitetura do backend (injeção de dependência → testável sem MySQL)

```
src/app.js            criarApp({ repo, config }) → Express (export default = app com o repo real)
src/config.js         lê env, valida JWT_SECRET
src/repositorio.js    ÚNICO lugar com SQL (usuarios, configuracoes); recebe o pool
src/senhas.js         hash/verify/validar/temporária
src/sessao.js         assinar/verificar JWT, opções do cookie
src/middleware/{sessao,papel,origem}.js
src/rotas/{auth,familia}.js
src/conteudo/guiaConsulta.js
src/bin/criar-usuario.js   CLI (criar / --redefinir), senha temporária impressa uma vez
```
Testes unitários com **repositório falso em memória**; SQL do repositório coberto por um teste de integração que roda só com `TEST_DB_*` definido (local, MySQL no WSL), fora do CI e do hook (que não têm MySQL).

## Frontend

- `lib/api.ts` (fetch com `credentials`), `lib/auth.tsx` (`AuthProvider`/`useAuth`: `me()`, `entrar()`, `sair()`), `components/RequerPapel.tsx` (guarda: carregando → skeleton; sem sessão → `/<area>/entrar`; `precisaTrocarSenha` → `/conta/senha`; papel insuficiente → mensagem).
- Páginas: `Entrar` (uma, parametrizada por área, visual do site), `TrocarSenha`, `Familia` (agora busca `/api/familia/guia`; estados carregando/erro), e (Inc. 2/3) `Painel*`/`Admin*`.
- `SiteHeader`: "Área da família" → `/familia`; quando logado aparece "Sair". "Área médica" e "Administrador" só entram no menu no incremento em que existirem (nada de link morto).
- Remove `content/guiaConsulta.ts` e `lib/valorConsulta.ts` do bundle (e o teste-guarda passa a vigiar `src/` + `backend/src/conteudo`).
- Dev: proxy do Vite `/api → http://localhost:3337`.

## Operação (por incremento)
Deploy pelos dois caminhos já migrados; migrations rodam no boot; contas iniciais por `docker exec raquel-backend node src/bin/criar-usuario.js …`. Verificação em produção **sem autenticar** (401/403/rate limit); o fluxo logado completo é testado em local (MySQL descartável) e na primeira entrada real do Peter. Rollback: `git revert` do merge (o cron redeploya) + as tabelas novas podem ficar (inofensivas).

## Fora de escopo
E-mail/esqueci-senha, 2FA, editor de texto do guia, anexos/PDF do guia, histórico de consultas/prontuário (LGPD: nenhum dado clínico entra nesta fase — só nome e contato).


## Emendas após a revisão independente (2026-11-16) — valem sobre o texto acima

Fatos verificados em produção: o **realip do Cloudflare existe** na VPS (`/etc/nginx/conf.d/cloudflare-realip.conf`, `real_ip_header CF-Connecting-IP`) — o rate limit conta por cliente real (passa a ser **documentado** no `nginx.conf` de referência); o `JWT_SECRET` atual da VPS é o **placeholder do blog antigo** (38 caracteres, contém "trocar"); `www` e apex servem 200 sem redirect.

1. **`JWT_SECRET`:** gerar um segredo forte na VPS (sem imprimir; backup do `.env`) **antes** do merge, e um *boot check* de pré-voo (`docker run` da imagem com `NODE_ENV=production` e o `.env` real executando só a validação). Rotacionar o segredo derruba todas as sessões (documentado).
2. **`www` → apex:** redirect 301 no nginx (cookie host-only; senão a sessão se divide entre `www` e apex).
3. **Respostas `/api/*`:** `Cache-Control: no-store`, `Vary: Cookie`, ETag desligado. Pós-deploy: purgar o cache do Cloudflare se o token permitir (o bundle antigo, com o guia, só é alcançável por URL com hash).
4. **`precisa_trocar_senha` centralizado no middleware de sessão** (todas as rotas, inclusive `/painel` e `/admin` futuros, exigem senha já trocada; liberados só `/me`, `/logout`, `/trocar-senha`).
5. **Limitadores criados dentro de `criarApp`** com limites injetáveis (testes não compartilham estado e não levam 429 espúrio). **Custo do bcrypt configurável** (`BCRYPT_COST`, 12 em produção, 4 em teste).
6. **Pool do app em `src/db.js`** (sem `multipleStatements`), criado de forma preguiçosa; usado por `repositorio`, `server` e CLI.
7. **Handler de erro JSON** (corpo inválido → 400 JSON, nunca HTML); `algorithms: ['HS256']` no `jwt.verify`; destino pós-login validado como caminho interno (`/x`, nunca `//x` ou URL absoluta).
8. **Frontend:** `AuthProvider` **só** na rota-layout das áreas restritas (`AreaRestrita`) — páginas públicas não chamam `/api/auth/me` e os testes atuais seguem sem provider; contexto com valor padrão seguro. **"Sair" mora dentro das áreas** (`BarraSessao`), **não** no `SiteHeader`.
9. **`area` ∈ `familia | painel | admin`** (papel mínimo: `familia`, `medica`, `admin`). O 403 de "área errada" só ocorre com senha correta (aceito: o usuário já é um usuário válido do sistema).
10. **`robots.txt`:** `Disallow` só de `/painel/` e `/admin/`; `/familia`/`/conta` usam só `noindex` (o Disallow esconderia o `noindex`).
11. **Teste-guarda do preço** lê arquivos com `fs` em `frontend/src` **e** `backend/src` (o `import.meta.glob` não alcança o backend).
12. **Nota de honestidade:** o texto do guia esteve público (site e PDF) até esta entrega; o login protege daqui para frente, não retroativamente.
