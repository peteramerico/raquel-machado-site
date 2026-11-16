# Fase 1 · Incremento 2 — Área médica (`/painel`) — Design e Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A médica (e o admin) gerencia o acesso das famílias e o valor da consulta, sem precisar de CLI nem de deploy.

**Base:** Inc. 1 em produção (`usuarios`, sessão com `sessao_versao`, `criarApp({repo, config, limites})`, `RequerPapel`, `AreaRestrita`). Spec geral: `2026-11-16-fase1-login-design.md`.

**Tech:** Express + repositório (SQL só em `repositorio.js`), Jest + repo falso; React 19 + RR7 + Vitest.

---

## Decisões

1. **Escopo da médica = só contas `familia`.** Médica/admin NUNCA mexem em contas `medica`/`admin` por `/api/painel` (isso é do Inc. 3, só admin). Alvo com outro papel → **404** (não revela que existe). Admin também usa `/painel` (hierarquia), com o mesmo recorte.
2. **Criar acesso** = nome (+ contato opcional). O servidor gera o `login` (1º nome sem acento/símbolos, ≥ 3 letras; colisão → `maria2`, `maria3`…; corrida resolvida pela UNIQUE com nova tentativa) e uma senha temporária; devolve `{login, senhaTemporaria}` **uma única vez**. Quem criou fica em `criado_por`.
3. **Mensagem de WhatsApp pronta** (montada no frontend, texto em português neutro): endereço do login, usuário, senha temporária e aviso de troca no 1º acesso; botão "Enviar pelo WhatsApp" (`wa.me/<contato>?text=…`) quando há contato, e "Copiar mensagem" sempre. A senha temporária só existe na tela logo após criar/redefinir — não é armazenada em claro em lugar nenhum.
4. **Redefinir senha** = nova temporária + `precisa_trocar_senha=1` + `sessao_versao+1` (derruba as sessões da família). **Desativar** = `ativo=0` + `sessao_versao+1` (derruba na hora); **reativar** = `ativo=1` (senha e pendência intactas). Ações destrutivas pedem confirmação **na própria página** (sem `confirm()` do navegador).
5. **Valor da consulta:** `GET/PUT /api/painel/config` (médica/admin). Validação: número, 1 ≤ valor ≤ 100.000, no máximo 2 casas (arredonda); grava `configuracoes.valor_consulta` com `atualizado_por`. O guia (`/api/familia/guia`) já lê dali — a mudança aparece na hora, sem deploy.
6. **Lista:** `GET /api/painel/familias` → `[{id, login, nome, contato, ativo, precisaTrocarSenha, ultimoAcessoEm, criadoEm}]` por nome (limite 500). Nunca devolve hash.
7. **Menu:** "Área médica" entra no header e no rodapé (`/painel`), como as outras. `/painel/entrar` usa o `Entrar` existente (`area="painel"`).
8. **Fora de escopo:** editar nome/contato depois de criado, apagar contas (só desativar), histórico/auditoria de ações, e-mail, contas médica/admin (Inc. 3).

## Segurança (requisitos)
- Todas as rotas: `sessao()` (com troca pendente bloqueada) + `exigirPapel('medica')` + `origem()` já global; respostas `no-store` (a senha temporária trafega em JSON).
- ID do alvo: inteiro positivo; qualquer outra coisa → 400; conta inexistente **ou de outro papel** → 404 idêntico.
- A senha temporária nunca vai para log; `console.error` só com `err.message`.
- Rate limit leve nas rotas que geram senha (criar/redefinir): 30/hora por usuário (protege de clique repetido e de sessão sequestrada em massa).
- Corrida de login duplicado: até 5 tentativas com sufixo; depois 503 explícito.

## API

| Rota | Corpo | Resposta |
|---|---|---|
| `GET /api/painel/familias` | — | lista (acima) |
| `POST /api/painel/familias` | `{nome, contato?}` | 201 `{id, login, nome, senhaTemporaria}` |
| `POST /api/painel/familias/:id/redefinir` | — | `{login, senhaTemporaria}` |
| `PATCH /api/painel/familias/:id` | `{ativo: boolean}` | `{id, ativo}` |
| `GET /api/painel/config` | — | `{valorConsulta}` |
| `PUT /api/painel/config` | `{valorConsulta}` | `{valorConsulta}` |

## Tasks (TDD: teste → falhar → implementar → passar → commit)

### Task 1 — Repositório
- Modify `backend/src/repositorio.js`, `backend/tests/helpers/repoFalso.js`, `backend/tests/repositorio.integracao.test.js`.
- Novo: `listarFamilias()` (papel `familia`, por nome, `LIMIT 500`; colunas sem hash, com `ultimo_acesso_em`/`criado_em`) e `definirAtivo(id, ativo)` (incrementa `sessao_versao` na mesma instrução; devolve a nova versão). `criarUsuario` já aceita `criadoPor`.
- Testes de integração: lista só famílias e ordenada; `definirAtivo(false)` derruba a versão (+1) e `buscarUsuarioPorId` reflete `ativo=false`.

### Task 2 — Gerador de login
- Create `backend/src/login.js` + `tests/login.test.js`: `loginBase(nome)` (sem acento, só `[a-z0-9]`, 1º nome, mínimo 3 — completa com `fam`), `gerarLogin(nome, existe)` (`maria`, `maria2`… até 99; depois sufixo aleatório de 3 dígitos). Testes: acentos, nomes com símbolos, nome de 1–2 letras, colisões sequenciais, nome só com símbolos.

### Task 3 — Rotas `/api/painel`
- Create `backend/src/rotas/painel.js`, `tests/painel.test.js`; modify `backend/src/app.js` (montar `/api/painel`, limitador de geração de senha injetável em `limites.geracaoSenha`).
- **Testes:** matriz de autorização (sem sessão 401; `familia` 403 em todas; `medica` e `admin` 200; senha temporária pendente 403 `trocar_senha`) · criar (201, login gerado, senha com 12 caracteres, hash ≠ senha, `criado_por`, `precisaTrocarSenha=true`, contato só dígitos 8–15 ou `null`, nome inválido 400, colisão gera `maria2`, corrida simulada com `LOGIN_DUPLICADO` tenta de novo, 5 falhas → 503) · a senha **não** aparece na lista nem em respostas seguintes · redefinir (nova senha confere, `precisaTrocarSenha` volta a true, sessão antiga da família cai) · desativar (login da família passa a dar 401 e a sessão antiga cai) / reativar (volta a entrar com a mesma senha) · **alvo de outro papel (`medica`/`admin`) → 404 em redefinir e PATCH**, id inexistente 404, id inválido (`abc`, `-1`, `1.5`, `0`) 400 · valor (GET devolve o atual; PUT aceita `450`, `"450.5"`; recusa `0`, negativo, `NaN`, texto, `100001`, 3+ casas arredonda para 2; o guia reflete o novo valor na hora) · rate limit de geração (limite injetado baixo → 429) · cabeçalhos `no-store`.

### Task 4 — Frontend: telas
- Create `frontend/src/pages/painel/{PainelLayout,PainelFamilias,PainelValor}.tsx` (+ `Painel.module.css`), `frontend/src/lib/whatsapp.ts` (`mensagemAcesso`, `linkWhatsApp`) e testes de cada; ampliar `lib/tipos.ts`.
- **Testes:** `whatsapp` (mensagem contém endereço, usuário e senha; `linkWhatsApp` com e sem contato; texto codificado) · `PainelFamilias` (lista carrega e mostra estados; "Novo acesso" envia `{nome, contato}`, mostra o cartão de credenciais **uma vez** com Copiar/WhatsApp e some ao fechar; redefinir e desativar pedem confirmação inline e só então chamam a API; erro da API aparece; lista vazia amigável; recarrega após ações) · `PainelValor` (mostra o atual formatado; valida antes de enviar; salva e confirma; erro do servidor) · `PainelLayout` (abas Famílias/Valor, `BarraSessao`, `aria-current`).
- Visual no padrão do site (frontend-design): painel claro, cartões brancos sobre creme, tabela vira cartões no mobile; cartão de credenciais em destaque (ameixa) com a senha em fonte monoespaçada grande; toque ≥ 44 px.

### Task 5 — Rotas, menu e robots
- Modify `routes.tsx` (`/painel/entrar`, `/painel` e `/painel/valor` sob `RequerPapel area="painel"`), `SiteHeader.tsx` e `SiteFooter.tsx` (link "Área médica"), testes de rotas/header (links, hierarquia: família em `/painel` → "Acesso restrito"); `robots.txt` já cobre `/painel/`.

### Task 6 — E2E local + produção
- Local (MySQL no WSL + Chrome): médica cria acesso → copia a mensagem → família entra com a temporária e troca → médica redefine/desativa/reativa → família com sessão aberta cai → médica edita o valor e o guia mostra o novo; família no `/painel` → "Acesso restrito"; mobile (390 px).
- Produção: pré-voo na VPS (testes, compose config, docker build, boot check), merge, deploys, verificação **sem autenticar** (todas as rotas novas → 401) e smoke do bundle; o fluxo logado completo da médica real fica para o primeiro uso da Raquel. Registrar no vault; apagar a branch.


---

## Emendas após a revisão independente (valem sobre o texto acima)

1. **Limitador de geração de senha PRÓPRIO** (`limites.geracaoSenha`, 30/hora): `skipSuccessfulRequests: false` (criar/redefinir com sucesso TAMBÉM contam), chave `u${req.usuario.id}`, montado **depois** de `sessao()` e `exigirPapel('medica')`. Não reutilizar o `criarLimitador` do login (ele só conta falhas). Teste: N sucessos seguidos → 429.
2. **Valor da consulta — parser estrito** (`backend/src/valor.js`): aceita só `number` finito ou string `/^\d{1,6}([.,]\d{1,2})?$/` (vírgula pt-BR permitida); converte para **centavos inteiros** (sem ponto flutuante); **recusa** mais de 2 casas (400, sem arredondar em silêncio); faixa 1,00–100.000,00. Recusa `true`, `""`, `"0x10"`, `"1e3"`, `[450]`, `null`, `NaN`, `Infinity`. Grava `"450.50"`.
3. **Login gerado:** base truncada em 30 caracteres; base < 3 caracteres → `fam` + o que houver (`li` → `lifam`; vazio → `familia`); logins **reservados** (`admin`, `administrador`, `root`, `painel`, `api`, `suporte`, `raquel`, `peter`, `familia`…) recebem sufixo; sufixo numérico até 99 e depois 3 dígitos aleatórios, sempre respeitando 40 caracteres; `existe` é **async**. Testes: nome de 80 letras, sufixo no limite, reservados.
4. **`:id` estrito:** `/^[1-9]\d{0,9}$/` (testar `1e3`, `01`, ` 1`, `1.0`, `0x10`, `99999999999`) → 400.
5. **Escrita com guarda de papel no SQL:** `atualizarSenha(id, hash, pendente, { papel })` e `definirAtivo(id, ativo, { papel })` fazem `UPDATE … WHERE id = ? AND papel = ?` e devolvem `null` quando nenhuma linha casa (→ 404); sem ler-e-depois-escrever. Repo falso idem. As rotas do painel passam `{ papel: 'familia' }`.
6. **Senha temporária sem expiração = risco aceito e documentado** (nesta fase): ela só vale até o 1º login, a troca é obrigatória, e o login tem rate limit por (login+IP). Mitigação futura: expirar em 72 h (coluna nova). Aviso na tela: "peça para a família entrar logo". O link `wa.me?text=` leva a senha para o histórico do navegador de quem envia — dito no aviso.
7. **Criação não idempotente:** botão desabilitado durante o envio; cartão de credenciais avisa "esta senha só aparece agora — copie ou envie antes de fechar" e confirma antes de fechar sem ter copiado/enviado.
8. **Contato:** remove máscara (`(84) 99999-0000` → dígitos); se informado e inválido → **400**; 10–11 dígitos ganham prefixo `55`; 12–13 dígitos começando em `55` ficam; fora disso → 400. (O `wa.me` exige DDI.)
9. **401 no meio da sessão:** as páginas do painel, ao receber `ApiErro` 401, chamam `recarregar()` do `useAuth` e a guarda redireciona ao login (sem mostrar "erro" confuso).
10. **Caminho do valor:** `GET/PUT /api/painel/config` (e **não** `/config/valor-consulta`); o spec geral é corrigido.
11. **Menores:** `paraUsuario` passa a incluir `criadoPor`; repo falso guarda `criadoEm`, `ultimoAcessoEm` e `atualizadoPor`; **redefinir conta desativada → 409**; `PATCH` só aceita `ativo` booleano **estrito** (`"false"`/`0` → 400) e ignora campos extras (`papel`, `nome`) — com teste de mass assignment; a lista devolve `truncada: true` se passar de 500; placeholders do frontend sem o preço antigo (o `precoFixo.test` varre `src`).
