# Esqueci a senha + expiração da senha temporária — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Steps usam checkbox (`- [ ]`). TDD: teste vermelho → verde → commit.

**Goal:** (A) senha temporária vence em 72 h; (B) toda conta de família/médica tem e-mail verificado; (C) "Esqueci minha senha" por e-mail com link de uso único.

**Design:** `docs/superpowers/specs/2026-11-17-esqueci-senha-design.md` (decisões, API, segurança — ler primeiro).

**Stack/convenções:** igual à Fase 1 — SQL só em `repositorio.js` (espelhado em `tests/helpers/repoFalso.js` + integração em MySQL real), DI em `criarApp({repo, config, limites, emailer})`, Jest+supertest no backend, Vitest+Testing Library no frontend (`mockFetch`), um branch por incremento (`feat/esqueci-inc-X`) → merge → apagar branch. **Entrega em 3 incrementos independentes**, cada um verificado em produção antes do próximo.

**Pré-requisitos:** branch limpo a partir de `master` (fa1e6a8); MySQL de teste no WSL (porta 3319, `TEST_DB_*`); nenhum segredo no git.

---

## Incremento A — Expiração da senha temporária (sem e-mail)

### Task A1 — Migration 004 + repositório
- Create `backend/migrations/004_recuperacao_senha.sql` (SQL do design: colunas `email`, `email_verificado_em`, `email_pendente`, `senha_temporaria_expira_em`, `UNIQUE(email)`, backfill de 7 dias, tabela `tokens_conta`). **Criar tudo já no A** (uma migration só) — o código do B/C vem depois.
- Modify `repositorio.js`: `COLUNAS`/`paraUsuario` ganham `senhaTemporariaExpiraEm` (Date|null) **e `temporariaVencida` calculado no SQL** (`senha_temporaria_expira_em IS NOT NULL AND senha_temporaria_expira_em < NOW()`, relógio do banco, nunca `new Date()`); `criarUsuario({..., temporariaHoras})` e `atualizarSenha(id, hash, pendente, {papel, temporariaHoras})`: se `pendente` → `expira_em = DATE_ADD(NOW(), INTERVAL ? HOUR)`, senão `NULL`. `listarUsuarios`/`listarFamilias` devolvem `senhaTemporariaExpiraEm` e `temporariaVencida`.
- Modify `tests/helpers/repoFalso.js` (mesma interface; relógio injetável `repo._avancarRelogio(ms)` para testes).
- Integração SQL (`repositorio.integracao.test.js`): temporária criada vence só depois do prazo (usar `temporariaHoras` 0 ou `UPDATE` direto para o passado); `atualizarSenha(..., false)` zera o prazo; `atualizarSenha(..., true)` renova; migration idempotente e backfill atinge só `precisa_trocar_senha=1`; `migrar.test.js` ganha a 004.

### Task A2 — Config + login + middleware
- Modify `config.js`: `senhaTemporariaHoras` (env `SENHA_TEMPORARIA_HORAS`, padrão 72, limitado a 1–720).
- Modify `rotas/auth.js` (`/login`): após senha correta, conta ativa e área permitida, se `usuario.precisaTrocarSenha && usuario.temporariaVencida` → **403** `{erro:'Sua senha temporária expirou. Peça uma nova à Dra. Raquel.', codigo:'senha_expirada'}` sem cookie e sem `registrarAcesso`. (Só depois de a senha conferir: não vaza existência.)
- Modify `middleware/sessao.js`: `precisaTrocarSenha && temporariaVencida` → **401** `Sessão inválida ou expirada.` (inclusive com `permitirTrocaPendente`).
- Modify `rotas/painel.js`, `rotas/admin.js`, `bin/criar-usuario.js`: passam `temporariaHoras: config.senhaTemporariaHoras` ao criar/redefinir; a resposta de criar/redefinir ganha `senhaTemporariaExpiraEm`; CLI imprime "válida até DD/MM HH:MM".
- Testes (`auth.test.js`, `middleware.test.js`, `painel.test.js`, `admin.test.js`, `criarUsuario.test.js`): login com temporária vencida → 403 `senha_expirada` e sem cookie; login com a senha **errada** numa conta vencida continua 401 genérico; sessão aberta antes do vencimento cai (401) após `_avancarRelogio`; `/trocar-senha` com temporária vencida → 401; trocar a senha antes do vencimento zera o prazo; "Nova senha" (painel e admin) renova e a conta volta a entrar; criar família grava prazo = agora + 72 h; `SENHA_TEMPORARIA_HORAS` respeitado; conta sem temporária (já trocou) nunca vence; reativar não altera prazo.

### Task A3 — Frontend
- Modify `lib/tipos.ts` (`senhaTemporariaExpiraEm`, `temporariaVencida`), `pages/Entrar.tsx` (mensagem do 403 `senha_expirada` em destaque, texto de contato), `pages/painel/PainelFamilias.tsx`, `pages/admin/AdminUsuarios.tsx` (selo **Expirada** + "Nova senha" em destaque; selo "Aguardando 1º acesso · expira em X"), `CartaoCredenciais` (aviso "Senha temporária válida por 72 horas — o prazo vale a partir de agora").
- Testes: selos nos 3 estados (aguardando, expirada, ativa); login com 403 mostra a mensagem certa; formatação do prazo (pt-BR, "expira em 2 dias").

### Task A4 — Verificação e deploy do A
- Suíte completa verde (backend + frontend + `tsc` + build); revisão independente do diff; merge; deploy via fluxo normal; **confirmar em produção** (SSH): migration 004 aplicada, `SELECT login, precisa_trocar_senha, senha_temporaria_expira_em FROM usuarios` mostra `peter`/`raquel` com ~7 dias; login anônimo 401 e `/api/health` 200.

---

## Incremento B — E-mail verificado e porta de entrada

### Task B1 — Tokens no repositório
- Modify `repositorio.js` (+ `repoFalso`): `criarToken({usuarioId, tipo, tokenHash, email, minutos})` (invalida os não usados do mesmo usuário/tipo; `expira_em = DATE_ADD(NOW(), INTERVAL ? MINUTE)`; apaga expirados há > 7 dias; devolve `{criado, recentes}`), `contarTokensRecentes(usuarioId, tipo, minutos)`, `consumirToken(tokenHash, tipo)` (`UPDATE … SET usado_em=NOW() WHERE token_hash=? AND tipo=? AND usado_em IS NULL AND expira_em>NOW()`; devolve `{usuarioId, email}` ou `null`; **atômico**), `definirEmailPendente(id, email)`, `confirmarEmail(usuarioId, email)` (seta `email`, `email_verificado_em=NOW()`, limpa `email_pendente`; `ER_DUP_ENTRY` → `{ok:false, motivo:'email_em_uso'}`), `buscarUsuarioPorEmailVerificado(email)`.
- Integração SQL: consumo atômico com 2 conexões simultâneas (uma vence); expirado/usado/inexistente → `null`; novo token invalida o anterior; `UNIQUE(email)` barra e-mail duplicado (também com caixa diferente); `ON DELETE CASCADE`; limpeza de expirados antigos.

### Task B2 — `src/tokens.js` e `src/email.js`
- `tokens.js`: `gerarToken()` → `{token (32 bytes base64url), hash (SHA-256 hex)}`, `hashToken(t)`; `normalizarEmail(s)` (trim, lower, ≤254, regex simples, sem espaços) → `{ok, valor}`; `mascararEmail`.
- `email.js`: `criarEmailer(config)` (nodemailer) com `ativo`, `enviarVerificacao`, `enviarRedefinicao`, `enviarAvisoSenhaAlterada`; templates HTML+texto com escape de nome; `criarEmailerConsole()` para dev; `tests/helpers/emailerFalso.js` guarda `{tipo, destinatario, nome, link, token}`.
- Modify `config.js`: `emailAtivo`, `frontendUrl` (`FRONTEND_URL`, padrão `https://raquelmachadoped.com.br`), `email: {host, port, user, pass, from}`; produção sem credenciais ⇒ `console.warn` (não falha).
- Testes: `tokens.test.js` (formato, hash estável, normalização: espaços, maiúsculas, inválidos, 255 chars), `email.test.js` (nodemailer com `jsonTransport`: assunto/remetente/links; nome com `<script>` escapado; link só com `frontendUrl`; texto puro presente), `config.test.js`.

### Task B3 — Rotas de e-mail + porta de entrada
- Modify `rotas/auth.js`: `POST /email`, `POST /email/reenviar`, `POST /confirmar-email`; `/me` com `email` mascarado, `emailVerificado`, `emailPendente`, `precisaEmail`. Modify `middleware/sessao.js`: `precisaEmail` (papel ∈ {familia, medica}, sem `email` nem `email_pendente`, `config.emailAtivo`) ⇒ 403 `informar_email`, exceto rotas com `permitirTrocaPendente`/`permitirEmailPendente` (`/me`, `/logout`, `/trocar-senha`, `/email`, `/email/reenviar`). Modify `app.js`: recebe `emailer` (padrão `criarEmailer(config)`) e novos `LIMITES_PADRAO` (`email` 5/h por usuário, `token` 20/h por IP). `server.js` monta com o emailer real.
- Testes (`email.test.js` de rotas): informar e-mail grava `email_pendente`, envia 1 mensagem com link `…/conta/confirmar-email#t=` (token em claro só no mock); formato inválido 400; trocar e-mail já verificado exige `senhaAtual` (errada → 401, certa → pendente, antigo segue valendo); confirmar com token válido → `email` setado e pendente limpo, mesmo token de novo → 400 `link_invalido`; expirado (`_avancarRelogio`) → 400; e-mail de outra conta → 409 `email_em_uso` (mensagem neutra); reenviar respeita 5/h; admin **nunca** recebe `precisaEmail`; `emailAtivo=false` ⇒ `precisaEmail=false` e nenhuma mensagem; conta com `precisaEmail` toma 403 `informar_email` em `/api/familia/guia` e `/api/painel/*` e passa em `/me`/`/email`; sessão sem cookie → 401; mass assignment (campos extras) ignorado.

### Task B4 — Frontend do e-mail
- Create `pages/ContaEmail.tsx` (`/conta/email`: formulário, estados *sem e-mail / pendente (reenviar, trocar) / verificado (trocar com senha)*), `pages/ConfirmarEmail.tsx` (`/conta/confirmar-email`: lê `#t=`, apaga o hash da barra, chama a API, mostra sucesso/erro; funciona sem login); modify `RequerPapel`/`AreaRestrita` (redireciona `precisaEmail` → `/conta/email`, preservando destino), `TrocarSenha` (após trocar, `navegar` para `/conta/email` se `precisaEmail`), faixa "Confirme seu e-mail" no `BarraSessao`; `routes.tsx`; `public/robots.txt` (`Disallow: /conta`); `useNoIndex` + `<meta name="referrer" content="no-referrer">` nas páginas de token.
- Testes: fluxo 1º acesso completo (trocar senha → cai em `/conta/email` → informa → mensagem "enviamos um link" → faixa de pendente); confirmar com e sem token válido; hash removido da URL; área bloqueada até informar; reenviar; admin não é redirecionado.

### Task B5 — Verificação e deploy do B
- Suíte + revisão independente + merge + deploy com **e-mail desativado** (sem `EMAIL_*` no `.env`): confirmar que nada muda para o usuário (`precisaEmail=false`) e `/api/health`/`me` ok.
- **Configurar o e-mail (ação do Peter, sem o segredo passar pelo chat):** o Peter gera a senha de app (conta Google com verificação em 2 etapas → "Senhas de app") e roda na VPS `bash /opt/raquel-backend/configurar-email.sh` (script que eu entrego: `read -s` da senha, grava `EMAIL_USER`/`EMAIL_PASS`/`EMAIL_FROM` no `.env` com `chmod 600`, recria o container). Smoke real: enviar uma verificação para um e-mail do Peter e confirmar que chega (caixa de entrada, não spam) e o link abre.

---

## Incremento C — Esqueci minha senha

### Task C1 — Rotas
- Modify `rotas/auth.js`: `POST /esqueci-senha` (valida formato; **sempre** `200 {ok:true}`; só então, sem `await` do SMTP: `buscarUsuarioPorEmailVerificado` → conta ativa, papel ≠ admin, teto de 3 tokens/h/conta → `criarToken` 30 min → `emailer.enviarRedefinicao`; erros de envio só em `console.error` sem token) e `POST /redefinir-senha` (`validarNovaSenha` **antes** de consumir; `consumirToken` → conta ativa? senão `link_invalido`; `atualizarSenha(id, hash, false)` + zera prazo; invalida os demais tokens; `emailer.enviarAvisoSenhaAlterada`; **não** define cookie). Limitadores: `esqueci` 10/h/IP e 3/h/(e-mail+IP); `token` 20/h/IP.
- Testes (`recuperacao.test.js`): e-mail existente/inexistente/não verificado/de conta inativa/de admin ⇒ mesma resposta 200 (corpo idêntico) e só o 1º caso envia; **sem `await`**: o handler responde mesmo com `emailer` lento (promessa pendente) e mesmo com `emailer` que rejeita; 4º pedido na hora para a mesma conta não envia; redefinir: token válido → senha nova entra, a antiga não, `precisaTrocarSenha` falso, prazo zerado, sessão aberta cai, 2º uso do token → 400, token expirado → 400, token de conta desativada → 400, senha fraca → 400 **e o token continua válido**, senha contendo usuário → 400, nenhum cookie na resposta, aviso "senha alterada" enviado; redefinir com conta de senha temporária pendente zera pendência; **teste de vazamento**: nenhuma resposta nem log (`console.error` espionado) contém o token ou o hash; `FRONTEND_URL` usado no link mesmo com `Host` forjado.
- Integração SQL: redefinição concorrente com o mesmo token ⇒ exatamente uma conta atualizada.

### Task C2 — Frontend
- Create `pages/EsqueciSenha.tsx` (`/conta/esqueci`) e `pages/RedefinirSenha.tsx` (`/conta/redefinir`, `#t=`); modify `Entrar.tsx` (link "Esqueci minha senha"); `routes.tsx`.
- Testes: link no login; envio mostra a mensagem neutra (e a mesma para erro 429); redefinir (confirmação diferente, senha curta, sucesso → botão "Entrar"), link inválido → mensagem + "pedir outro"; hash apagado da URL.

### Task C3 — E2E, docs, deploy
- E2E local (MySQL WSL + Chrome com emailer de console): criar família → trocar temporária → informar e-mail → confirmar → sair → "esqueci" → redefinir → entrar; temporária vencida (ajustar prazo por SQL) → 403 e "Nova senha" resolve; mobile 390 px.
- Docs: `README.md` (variáveis `EMAIL_*`, `FRONTEND_URL`, `SENHA_TEMPORARIA_HORAS`), `backend/.env.example`, runbook (revogar senha de app, trocar remetente, reset do admin pela CLI), `.github/workflows` sem mudança.
- Deploy; **smoke real em produção** com o e-mail de teste do Peter: pedir "esqueci" → chega → redefinir → entrar; conferir `nginx` logs **sem** token (fragmento) e `docker logs raquel-backend` sem segredo.

---

## Riscos e mitigação
- **Gmail pessoal (senha de app):** acesso à caixa inteira se `.env` vazar → `chmod 600`, só root na VPS, revogável; recomendação de migrar para Gmail dedicado fica no runbook.
- **Entrega em spam:** remetente Gmail autenticado pelo próprio Google ⇒ risco baixo; texto simples + botão, sem rastreadores. Limite do Gmail (~500/dia) é folgado para o volume.
- **Trancar quem ainda não entrou:** `peter`/`raquel` com 7 dias; se vencer, `docker exec raquel-backend node src/bin/criar-usuario.js --redefinir --login X` (SSH).
- **Migration irreversível?** Só aditiva; reverter o código não exige desfazer a migration.
- **Falta de e-mail configurado em produção:** degradação suave (passo de e-mail não exigido; "esqueci" inerte) — o código pode ir antes da senha de app.
- **Enumeração/abuso:** resposta única, SMTP assíncrono, teto por conta e por IP; `UNIQUE(email)` só vaza em sessão autenticada.

---

## Emendas após a revisão independente (valem sobre o texto acima e sobre o design)

Revisão adversarial confrontou o plano com o código real. Verificados no código antes de aceitar: `migrar.js` não é re-executável (registra só ao fim do arquivo; comentário nas linhas 10–13), o `DROP TABLE` do teste de integração não lista `tokens_conta` (FK ⇒ erro na 2ª execução), `FRONTEND_URL` é lido direto de `process.env` em `app.js:35`, e `criarLimitador` usa `skipSuccessfulRequests:true`.

**Críticos**
1. **Migrations em 3 arquivos** (cada um atômico/re-executável): `004_usuarios_email_senha_temp.sql` (um único `ALTER TABLE`), `005_tokens_conta.sql` (`CREATE TABLE IF NOT EXISTS`), `006_backfill_senha_temporaria.sql` (`UPDATE … WHERE precisa_trocar_senha=1 AND senha_temporaria_expira_em IS NULL`). Antes do merge: rodar as 3 **duas vezes** num MySQL 8 real e provar que a 2ª execução não falha. **Sem a coluna `email_verificado_em`** (`email` só é preenchido na verificação).
2. **Limitadores que contam sucessos** (padrão `limiteGeracao` de `painel.js`, não `criarLimitador`): `/esqueci-senha` 10/h/IP e 3/h/(e-mail normalizado+IP); `/email*` 5/h/usuário; `/redefinir-senha` e `/confirmar-email` 20/h/IP. Chave por e-mail só depois de `typeof string` + normalizar. Teste: o N+1º pedido devolve 429 mesmo com respostas 200.
3. **"Nova senha" (painel, admin, CLI) revoga tudo:** `atualizarSenha(..., pendente=true)` apaga os tokens da conta, limpa `email_pendente` **e o `email` verificado**, na mesma transação. Motivo: "Nova senha" = "não confio em quem tem a conta"; senão um e-mail de invasor continuaria podendo redefinir. (A pessoa legítima cadastra de novo no convite pós-troca.)

**Importantes**
4. **`/email` não usa `permitirTrocaPendente`:** só depois da temporária trocada; exige `senhaAtual` **sempre**; recusa conta que não seja `familia`.
5. **Tokens:** `buscarTokenValido(hash, tipo)` (leitura, devolve usuário + e-mail alvo) para validar a senha antes de queimar; o token de redefinição grava o e-mail alvo e só vale se `usuarios.email` ainda for esse (troca de e-mail invalida o link antigo), conta ativa e papel `familia`; **consumir + atualizar a senha na mesma transação**; `criarToken` também transacional (um ativo por conta/tipo, sem corrida).
6. **Anti-spam a partir do Gmail da Dra.:** teto por **destinatário** (2 e-mails/dia por endereço, via `tokens_conta.email`) e **global** (100/dia). Teto por conta 5/h + intervalo mínimo de 60 s entre emissões (cooldown), documentando que um atacante pode adiar — não impedir — o link da vítima.
7. **Validador de e-mail estrito:** só ASCII, um único `@`, sem espaço nem `, ; < > " ( ) \`, ≤254, domínio com ponto; testes: vírgula, ponto-e-vírgula, `Nome <a@b.com>`, zero-width, maiúsculas.
8. **Envio:** `requireTLS:true`, timeouts de 10 s (connection/greeting/socket), `transporter.verify()` no boot (só loga). **Aviso ao Peter:** o e-mail com o link fica na pasta Enviados do Gmail escolhido (e é acessível por IMAP com a senha de app) — por isso a recomendação de um Gmail dedicado continua de pé; a troca é só variável de ambiente e o plano funciona com qualquer um.
9. **100% em segundo plano:** `/esqueci-senha` responde logo e todo o trabalho (busca + `criarToken` + SMTP) roda num helper `emitir(promessa)` com `.catch` que só loga a mensagem (sem token), para não derrubar o Node nem vazar a existência pelo tempo. `criarApp` expõe um conjunto de pendentes (`app.locals.aguardar()`) para os testes não ficarem instáveis.
10. **Analytics × fragmento:** `index.html` ganha um script inline **antes** do Umami que move `#t=…` para `sessionStorage` e limpa o hash na hora; as páginas leem do `sessionStorage`. Sem `<meta name="referrer">` (fragmento nunca vai no Referer).
11. **Confirmar e-mail exige clique** (botão "Confirmar meu e-mail"), não POST ao abrir (scanners de link; StrictMode). `history.replaceState(history.state, '', pathname+search)` preserva o estado do router.
12. **Expiração no lugar certo:** `criarRepositorio(pool, { temporariaHoras })` com o prazo **dentro do repositório** (padrão 72); os call-sites (`painel.js`, `admin.js`, `criar-usuario.js` ×2) não passam parâmetro — impossível esquecer e criar temporária eterna. A CLI usa env/`carregar()` para o prazo.
13. **CI e integração:** incluir `tokens_conta` no `DROP TABLE` de `repositorio.integracao.test.js`; adicionar `services: mysql:8.0` + `TEST_DB_*` ao job `backend-deploy` do `deploy.yml` para a integração rodar de verdade (hoje cai em `describe.skip`).
14. **Gate `informar_email` CORTADO** (`email_pendente` já o satisfaria com qualquer endereço, trancava quem não tem e-mail e tocava `sessao.js`, `RequerPapel`, `AreaRestrita`, `Familia`, Painel, Admin e todos os testes). **Substituído por convite não bloqueante:** após a 1ª troca de senha a UI leva a `/conta/email` com "Pular por agora"; faixa "Cadastre/confirme seu e-mail para poder recuperar a senha" no `BarraSessao` enquanto não houver e-mail verificado. `/me` devolve `email` mascarado, `emailVerificado`, `emailPendente` e `sugerirEmail`. *O pedido original do Peter era "obrigatório"; o objetivo real (e-mail verificado) é o mesmo e o "esqueci" só vale com verificado — registrar a mudança para ele confirmar.* `middleware/sessao.js` só muda para a expiração.
15. **Prazo exibido sem depender de fuso:** a API devolve `segundosRestantes` (`TIMESTAMPDIFF(SECOND, NOW(), …)`) e a tela formata com esse número. Conferir `SELECT @@global.time_zone, NOW()` na VPS no passo A4.
16. **`FRONTEND_URL` uma só fonte:** `config.js` lê uma vez, remove barra final, exige `https://` em produção (aviso alto); `app.js` usa `config.frontendUrl` também no CORS. Conferir o valor real no `.env` da VPS no A4.

**Menores aceitos**
17. Backfill de **14 dias** (não 7) para `peter`/`raquel`.
18. `robots.txt` **sem** `Disallow: /conta` (o projeto prefere `noindex`; `useNoIndex` nas páginas).
19. Aviso "senha alterada" também ao e-mail **antigo** quando o e-mail é trocado; `trocar-senha` normal também avisa.
20. `lib/whatsapp.ts:mensagemAcesso` informa o prazo ("válida por N horas", derivado da resposta, não fixo); o cartão do painel idem.
21. Console emailer **opt-in** (`EMAIL_CONSOLE=1`), nunca implícito.
22. Atualizar `auth.test.js` (`toEqual` exato de `/login` e `/me`) e `repoFalso` (`listarUsuarios`/`listarFamilias`/`semear` com e-mail e prazo).
23. `nodemailer` em `backend/package.json` + lockfile (versão fixa; o Docker usa `npm ci --omit=dev`).
24. `configurar-email.sh` vive em `backend/` (versionado): o `rsync --delete` apagaria arquivo solto em `/opt/raquel-backend/`.
25. **"Esqueci" por e-mail só para `familia`** (médica e admin: reset pelo admin em `/admin` ou CLI). A médica é dona do Gmail remetente e gerencia todas as famílias; reduz o estrago de uma caixa invadida. O convite de e-mail só aparece para `familia`.
26. Tolerância de 5 min no prazo **não adotada** (mensagem de "expirada" clara; painel/CLI renovam); documentado.

## Emendas de 25/11/2026 (remetente = domínio, no Mailu como no Ponto Doméstico; valem sobre o texto acima, o design e as emendas 1–26)

**Decisão do Peter (25/11):** os e-mails saem de uma caixa do domínio `raquelmachadoped.com.br`, **no mesmo padrão do Ponto Doméstico**: Mailu da VPS cajutech (`mail.cajutech.dev`), caixa dedicada, SMTP SSL 465, senha só no Bitwarden. Isso substitui a decisão 2 do design ("Envio por Gmail pessoal da Dra. Raquel") e o aviso da emenda 8 sobre IMAP e pasta Enviados do Gmail.

**Como o Ponto Doméstico faz (conferido no vault em 25/11, notas `2026-10-13-prospeccao-email-plano-tecnico-aleksei` e `2026-11-09-caixa-contato-plano`):** domínio cadastrado no Mailu; rspamd assina DKIM (seletor `dkim`); SPF `v=spf1 mx a:mail.cajutech.dev ~all`; DMARC com relatórios para `admin@cajutech.dev`; backend com `EMAIL_HOST=mail.cajutech.dev`, `EMAIL_PORT=465`, login da caixa `naoresponda@`; caixa criada por `Sistema/scripts/prospeccao-criar-caixa.sh` (gera a senha, grava no Bitwarden antes, cria o usuário no Mailu por SSH, desfaz tudo se falhar); teste de envio pela 465 em `Sistema/scripts/prospeccao-teste-465.cjs`; conferência de `SPF/DKIM/DMARC=pass` em "Mostrar original".

27. **Variáveis (sem código novo):** `EMAIL_HOST=mail.cajutech.dev`, `EMAIL_PORT=465` com `secure:true` (o `email.js` do plano usa `requireTLS` na 587; **na 465 usar `secure:true`**, a porta que conecta da rede do Peter e da produção do Ponto), `EMAIL_USER=naoresponda@raquelmachadoped.com.br`, `EMAIL_PASS` (do Bitwarden), `EMAIL_FROM="Dra. Raquel Machado <naoresponda@raquelmachadoped.com.br>"`, `EMAIL_REPLY_TO=contato@raquelmachadoped.com.br`. Mantêm-se timeouts de 10 s e `verify()` no boot (emenda 8); o teto global de 100/dia (emenda 6) segue.
28. **Duas caixas, como no Ponto:** `naoresponda@` (usuário real, só envia, reputação isolada) e `contato@` (**alias** para o e-mail que a Raquel já lê; o Mailu encaminha com SRS). O destino do alias é informado pela Raquel. Se ela preferir ler no webmail, `contato@` vira caixa real, como foi feito no Ponto.
29. **DNS na Cloudflare da Raquel (hoje vazio: conferido em 25/11, sem MX, sem SPF, sem DMARC):** `MX` → `mail.cajutech.dev` (prioridade 10); `TXT` SPF `v=spf1 mx a:mail.cajutech.dev ~all`; `TXT dkim._domainkey` com a chave que o Mailu gerar para o domínio; `TXT _dmarc` **`v=DMARC1; p=none; rua=mailto:admin@cajutech.dev`** nas duas primeiras semanas (domínio novo no Mailu; o Ponto usa `p=reject` estrito, mas já tinha histórico), depois `p=quarantine`. Todos em "somente DNS" (sem proxy laranja).
30. **Segredo:** a senha do `naoresponda@` é gerada pelo script, vai ao Bitwarden e ao Mailu por stdin e depois à VPS da Raquel por `read -s` (B5). Nunca passa pelo chat.
31. **Base do plano:** o branch parte do `master` atual, não de `fa1e6a8`. Conferido em 25/11: `git diff fa1e6a8 HEAD -- backend` é vazio, então o plano continua válido; migrations livres a partir de `004` (existem 001 a 003).
32. **Risco herdado do Ponto (aceito):** o Mailu roda num IP compartilhado com a Cajutech, e o **PTR do IP não bate com `mail.cajutech.dev`** (pedido #1 ao Aleksei em 13/10; conferir se foi resolvido). Gmail e Outlook aceitaram sem aviso nos testes do Ponto, mas filtros mais rígidos podem penalizar. Mitigações: volume mínimo (links de recuperação, poucas famílias), caixa separada, `p=none` no começo, teste de entrega nos dois provedores antes do B. **Botão de emergência:** desabilitar o usuário `naoresponda@raquelmachadoped.com.br` no painel do Mailu.
33. **Combinar com o Aleksei (co-gestor da VPS cajutech):** o domínio da Raquel passa a usar o Mailu dele. É aditivo (não mexe em nada existente), mas é produção compartilhada; avisar antes.

## Incremento 0 — E-mail do domínio no Mailu (paralelo ao A; B só começa depois)

Mexe em produção compartilhada (Mailu da cajutech) e no DNS da Raquel: **cada passo com OK do Peter**. A zona DNS está na conta Cloudflare do `peterpeny@gmail.com`; o Chrome do Claude costuma estar logado em outra conta lá, então o Peter faz o login.

- [ ] **0.1 Somente leitura (nada é alterado):** SSH na VPS cajutech e `cd /opt/mailu && docker compose exec -T admin flask mailu domain --help < /dev/null` e `... user --help` (ordem dos argumentos, como no passo 2 do plano de 09/11); listar os domínios existentes; repetir `nslookup -type=MX/TXT raquelmachadoped.com.br` e `_dmarc` (hoje vazios). Conferir se o PTR do IP foi corrigido (`nslookup 108.174.144.237`).
- [ ] **0.2 Avisar o Aleksei** (item 33) e **confirmar com o Peter** o e-mail de destino do alias `contato@`.
- [ ] **0.3 Cadastrar o domínio no Mailu** `raquelmachadoped.com.br` (comando `flask mailu domain` ou painel admin) e **gerar a chave DKIM** (painel admin do Mailu → domínio → registros DNS; ele mostra o TXT pronto). Anotar os registros pedidos.
- [ ] **0.4 Criar `naoresponda@`** com `bash Sistema/scripts/prospeccao-criar-caixa.sh naoresponda raquelmachadoped.com.br` (script existente: Bitwarden primeiro, Mailu depois, desfaz se falhar; ajustar só o texto da nota do item). Criar o alias `contato@` para o destino confirmado (`flask mailu alias contato raquelmachadoped.com.br <destino>`).
- [ ] **0.5 DNS na Cloudflare** (Peter logado): MX, SPF, DKIM e DMARC da emenda 29. Conferir cada registro por `nslookup` antes de testar.
- [ ] **0.6 Teste de entrega:** adaptar `prospeccao-teste-465.cjs` (host `mail.cajutech.dev`, login `naoresponda@raquelmachadoped.com.br`) e enviar para o Gmail e para o Outlook do Peter. Em "Mostrar original": `spf=pass`, `dkim=pass (d=raquelmachadoped.com.br)`, `dmarc=pass`; caixa de entrada, não spam. Teste de **recebimento:** mandar de um Gmail para `contato@raquelmachadoped.com.br` e conferir que chega ao destino do alias. Logs: `docker compose logs --since 10m smtp | grep 'to=<'` e `docker compose logs antispam | grep DKIM_SIGNED`.
- [ ] **0.7 Gate:** só então começar o Incremento B. Se cair em spam ou falhar, ajustar o DNS/PTR antes de escrever código.

**Ajuste em B5:** o smoke real passa a conferir também os cabeçalhos de autenticação (0.6) com a mensagem enviada pelo próprio sistema, e o `configurar-email.sh` grava `EMAIL_HOST/PORT/USER/PASS/FROM/REPLY_TO` na VPS da Raquel. **Conferir antes** que a VPS da Raquel (108.174.148.138) alcança `mail.cajutech.dev:465` (`timeout 5 bash -c '</dev/tcp/mail.cajutech.dev/465' && echo ok`).
**Ordem recomendada:** A (sem e-mail) pode ir já; 0 corre em paralelo; B depois do gate 0.7; C por último.
