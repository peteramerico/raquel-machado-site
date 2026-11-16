# Fase 1 · Incremento 3 — Administrador (`/admin`) — Design e Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps usam checkbox (`- [ ]`).

**Goal:** O administrador (Peter) gerencia as contas da equipe — criar médica/admin, redefinir senha, desativar/reativar — **sem nunca conseguir ficar sem administrador** nem se trancar para fora.

**Base:** Inc. 1 e 2 em produção (`usuarios`, `criarApp`, `/api/painel`, `CartaoCredenciais`, `RequerPapel`). Spec geral: `2026-11-16-fase1-login-design.md`.

---

## Decisões

1. **Só `admin` acessa `/api/admin`** (`exigirPapel('admin')`; médica → 403). Menu "Administrador" (header/rodapé), login em `/admin/entrar`.
2. **Escopo = contas da equipe:** o admin cria contas `medica` e `admin` (famílias continuam sendo criadas na área médica) e lista **todas** as contas (inclusive famílias, só leitura de estado) para poder desativar/redefinir qualquer uma em emergência.
3. **Criar conta de equipe:** `{nome, login, papel: 'medica'|'admin'}` — **o admin escolhe o login** (equipe é pequena e conhecida; regex `/^[a-z0-9._-]{3,40}$/` após normalizar). Login em uso → **409**. Senha temporária de 12 caracteres devolvida uma vez; troca obrigatória no 1º acesso.
4. **Papel é imutável** (sem promover/rebaixar conta): quem precisa de outro papel ganha uma conta nova. Menos superfície, e a guarda de papel nos UPDATEs continua válida.
5. **Trava do último administrador (atômica):** desativar um `admin` só ocorre se **sobrar ao menos um outro admin ativo**; a verificação e o UPDATE rodam na **mesma transação** com `SELECT … FOR UPDATE` nas linhas de admins ativos (duas desativações simultâneas não passam ambas). Violação → **409** "Mantenha ao menos um administrador ativo."
6. **Sem autolockout:** o admin **não** desativa a própria conta (409) nem redefine a própria senha por aqui (400: "use Trocar senha" — redefinir derrubaria a própria sessão). A lista marca a linha do próprio usuário (`voce: true`) e a tela não oferece ações nela.
7. **Redefinir/desativar** valem para qualquer papel (incluindo outro admin e famílias), sempre com `sessao_versao+1`. Conta desativada → redefinir = 409.
8. **Mesmos padrões do Inc. 2:** `:id` estrito `/^[1-9]\d{0,9}$/`; `PATCH {ativo}` booleano estrito, campos extras ignorados; 404 idêntico para inexistente; limitador **próprio** de geração de senha (conta sucessos), por usuário; respostas `no-store`; erros em JSON.
9. **Auditoria mínima:** `criado_por` já grava quem criou. Sem trilha de auditoria nesta fase (anotado como futuro).
10. **Fora de escopo:** mudar papel, editar nome/login, apagar contas, e-mail/esqueci-senha, 2FA.

## Segurança (requisitos)
- Nunca devolver `senha_hash`; senha temporária só na resposta de criar/redefinir.
- A trava do último admin precisa valer também sob concorrência (teste de integração SQL real com duas conexões) e quando o alvo já está inativo (desativar inativo não conta como "último").
- Criar conta com `papel` fora de `medica|admin` → 400 (mass assignment: `ativo`, `criadoPor`, `sessaoVersao` ignorados).
- Reativar uma conta nunca altera senha nem pendência.

## API

| Rota | Corpo | Resposta |
|---|---|---|
| `GET /api/admin/usuarios` | — | `{itens:[{id,login,nome,papel,contato,ativo,precisaTrocarSenha,ultimoAcessoEm,criadoEm,voce}], truncada}` (por papel: admin, medica, familia; depois nome) |
| `POST /api/admin/usuarios` | `{nome, login, papel}` | 201 `{id, login, nome, papel, senhaTemporaria}` |
| `POST /api/admin/usuarios/:id/redefinir` | — | `{login, senhaTemporaria}` |
| `PATCH /api/admin/usuarios/:id` | `{ativo: boolean}` | `{id, ativo}` |

## Tasks (TDD)

### Task 1 — Repositório
- Modify `repositorio.js`, `tests/helpers/repoFalso.js`, `tests/repositorio.integracao.test.js`.
- `listarUsuarios(limite=500)` (todos os papéis, sem hash, ordenado por papel[admin,medica,familia] e nome; `truncada`).
- `definirAtivoComTrava(id, ativo)` → `{ok:true, versao}` | `{ok:false, motivo:'nao_encontrada'|'ultimo_admin'}` (transação + `FOR UPDATE`). O repo falso imita a regra.
- Integração: lista completa e ordenada; desativar o único admin → `ultimo_admin` e nada muda; com 2 admins desativa 1 mas o 2º é barrado; desativar admin já inativo não conta; reativar sempre ok; **concorrência:** duas conexões desativando os dois únicos admins ao mesmo tempo → exatamente 1 sucesso.

### Task 2 — Rotas `/api/admin`
- Create `rotas/admin.js`, `tests/admin.test.js`; modify `app.js` (monta `/api/admin`, `limites.geracaoSenha` próprio).
- Testes: matriz de autorização (sem sessão 401; família 403; **médica 403**; admin 200; senha pendente 403) · lista (todas as contas, sem hash, `voce` só na própria) · criar (201; login normalizado; papel `medica`/`admin`; senha de 12 chars; hash≠senha; `criado_por`; troca obrigatória; login em uso 409 inclusive diferindo por maiúscula/acento; login inválido (curto, espaço, 41 chars, símbolos) 400; papel `familia`/`superuser`/ausente 400; nome inválido 400; mass assignment ignorado) · a conta de equipe criada entra em `/painel/entrar` (médica) ou `/admin/entrar` (admin) e cai na troca obrigatória · redefinir (nova senha confere; derruba a sessão do alvo; qualquer papel; **self → 400**; inativa → 409; inexistente 404; id inválido 400) · desativar (derruba a sessão na hora; self → 409; **último admin → 409** e a conta continua ativa; com 2 admins desativa um e barra o segundo; alvo família/médica ok; `ativo` não-booleano 400; extras ignorados) · reativar volta a entrar com a mesma senha · rate limit de geração (conta sucessos, por usuário).

### Task 3 — Frontend
- Create `pages/admin/{AdminLayout,AdminUsuarios}.tsx` (+ testes) usando `Painel.module.css`; generalizar `CartaoCredenciais` com `mensagem` opcional (equipe: texto "Usuário/Senha temporária/Endereço do login da área", sem WhatsApp); tipos em `lib/tipos.ts`.
- Testes: lista agrupada por papel com chips; linha "Você" sem ações; criar conta (form: nome, usuário, papel) → cartão de credenciais **sem** link de WhatsApp, com Copiar; erro 409 de login em uso e de último admin aparecem em alerta; confirmações inline (nova senha / desativar) antes de chamar a API; reativar direto; 401 no meio da sessão aciona `recarregar`; duplo clique cria uma conta só.
- Visual: o mesmo painel claro do Inc. 2; seção de equipe em destaque, famílias recolhidas por padrão ("Mostrar famílias").

### Task 4 — Rotas, menu, robots
- `routes.tsx` (`/admin/entrar`, `/admin` sob `RequerPapel area="admin"` + `AdminLayout`); `SiteHeader`/`SiteFooter` ("Administrador"); testes de rotas (anônimo → `/admin/entrar`; médica → "Acesso restrito"; admin → painel de contas) e do menu; `robots.txt` já cobre `/admin/`.

### Task 5 — E2E local + produção
- Local (MySQL no WSL + Chrome): admin entra e troca a senha → cria médica → médica entra em `/painel/entrar` (e é barrada em `/admin`) → admin tenta desativar a si mesmo (bloqueado) e, com 1 admin só, o "último admin" → cria 2º admin → desativa o 1º ok e o 2º barrado → mobile.
- Produção: pré-voo (testes, compose config, build, boot check), merge, deploys, verificação **sem autenticar** (4 rotas novas → 401), smoke do bundle. Não mexo nas contas reais (`peter` e `raquel`): o 1º uso real é do Peter.


---

## Emendas após a revisão independente (valem sobre o texto acima)

1. **Ordem dos locks (anti-deadlock):** `definirAtivoComTrava` trava **primeiro** o conjunto de admins ativos (`SELECT id … WHERE papel='admin' AND ativo=1 ORDER BY id FOR UPDATE`), depois o alvo, decide e só então faz o UPDATE. Erro `ER_LOCK_DEADLOCK` (1213) → **503** com mensagem de tentar de novo, nunca 500.
2. **A trava é defesa em profundidade, inalcançável por HTTP em condições normais** (o ator precisa estar ativo e ser diferente do alvo ⇒ sempre sobra outro admin; só uma corrida a dispara). Portanto: **cobrir no repositório (repo falso + integração SQL com barreira de transação aberta)** e, na rota, só testar o **mapeamento** `ultimo_admin → 409` com um repo que devolve esse motivo. **Retirado** o passo "com 1 admin só" do E2E.
3. **`definirAtivo` só muda quando o estado muda** (`UPDATE … AND ativo <> ?`): reativar conta já ativa (ou desativar já inativa) **não** incrementa `sessao_versao` nem desloga ninguém. Devolve `null` (não encontrada) ou `{ mudou, versao }`. Vale para `/painel` (corrige o Inc. 2) e `/admin`. No `/admin`, **qualquer PATCH no próprio usuário → 409**.
4. **`CartaoCredenciais` generalizado por props** (com os defaults atuais de família): `urlEntrada`, `aviso`, `mensagem`, `semWhatsApp`. Equipe: URL do login da área do papel, aviso sem "família", mensagem própria, **sem** WhatsApp e **sem** o texto "Sem WhatsApp cadastrado". Redefinir uma **família** pela lista do admin mantém mensagem e WhatsApp de família.
5. **Admin sobre admin sem reautenticação = risco aceito e documentado** (hierarquia: admin ⊇ tudo; a trava mantém ao menos um admin ativo). Mitigação futura: pedir a senha atual para ações em outro admin.
6. **Deploy:** sem migration; rollback = `git revert`. A verificação sem autenticar (401, não 404) prova backend + rotas no ar. **Runbook de recuperação:** a CLI ganha `--reativar --login x` (além de `--redefinir`), para destravar conta desativada.
7. **Menores:** lista `ORDER BY papel DESC, nome, id` (ENUM ordena pelo índice: familia < medica < admin); testes de integração do "único admin" limpam admins antes (banco compartilhado); login de equipe pode ser qualquer um que case com a regex (logins não viram rotas — `RESERVADOS` só vale para o gerador de famílias); `USUARIO_ADMIN` em `testUtils`; `robots.txt` passa a `Disallow: /admin` e `/painel` (sem barra); `AdminLayout` com link para a área médica; o limitador de geração do admin é **uma instância própria** reutilizando `limites.geracaoSenha` (cada `rateLimit` tem store próprio), montado depois de `sessao` e `exigirPapel`.
