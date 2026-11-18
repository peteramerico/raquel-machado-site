# Esqueci a senha (por e-mail) + expiração da senha temporária — Design

Data: 2026-11-17 · Base: Fase 1 em produção (`usuarios`, `criarApp`, `/api/auth|familia|painel|admin`, `sessao_versao`, `precisa_trocar_senha`). Padrão de e-mail copiado do Primeiro Colo (nodemailer + Gmail SMTP `smtp.gmail.com:587` com senha de app), **com melhorias** (token com hash, link em fragmento, TTL pelo relógio do banco).

## Objetivo
1. **Autoatendimento:** quem esqueceu a senha recebe por e-mail um link de uso único e define uma nova senha, sem depender da Dra. Raquel.
2. **Senha temporária com prazo:** a senha que a médica/admin entrega por WhatsApp deixa de valer depois de **72 h** (hoje vale para sempre até o 1º acesso).

## Decisões (confirmadas com o Peter em 2026-11-17)
1. **Recuperação por e-mail**, não assistida (a assistida continua existindo: "Nova senha" no painel).
2. **Envio por Gmail pessoal da Dra. Raquel** via SMTP + senha de app (como no Primeiro Colo). Sem DNS novo. *Risco aceito e documentado:* uma senha de app do Google dá acesso SMTP/IMAP à caixa inteira; por isso o `.env` fica `chmod 600`, a senha de app pode ser revogada a qualquer momento em myaccount.google.com e trocar o remetente depois é só mudar variáveis de ambiente (recomendação original: Gmail dedicado do site).
3. **E-mail coletado no 1º acesso, obrigatório e verificado:** logo depois de trocar a senha temporária, a pessoa informa o e-mail e confirma por um link. O "esqueci" só vale para e-mail **verificado**.

## Decisões de desenho (minhas — sujeitas à revisão)
4. **Admin fora do autoatendimento:** conta `admin` não usa "esqueci" nem é obrigada a cadastrar e-mail (reset do admin = CLI `--redefinir` via SSH). Reduz o estrago de uma caixa de e-mail invadida. Reversível mudando uma constante.
5. **O "esqueci" pede o e-mail** (quem esqueceu a senha costuma esquecer o usuário gerado). Por isso o **e-mail verificado é único** entre as contas (`UNIQUE`); se já estiver em uso em outra conta, a verificação recusa com mensagem neutra.
6. **Resposta sempre igual** ("Se este e-mail estiver cadastrado, enviaremos um link"), 200 em todos os casos; o envio SMTP é feito **depois** de responder (sem `await`), então tempo e texto não revelam se o e-mail existe.
7. **Token:** 32 bytes aleatórios (base64url), no banco só o **SHA-256**; uso único atômico; **um token ativo por usuário/tipo** (novo invalida o anterior). Validade **30 min** (redefinição) e **24 h** (verificação de e-mail), medida com `NOW()` do MySQL (nada de relógio do Node vs. banco).
8. **Link com o token no fragmento** (`/conta/redefinir#t=…`): o fragmento não vai para o nginx/Cloudflare (logs) nem no `Referer`. A página lê o `#`, apaga da barra (`history.replaceState`) e usa `Referrer-Policy: no-referrer`.
9. **Links montados só com `FRONTEND_URL`** (config), nunca com o cabeçalho `Host` (injeção de host).
10. **Redefinir não loga:** a pessoa volta ao login. A redefinição incrementa `sessao_versao` (derruba todas as sessões), zera `precisa_trocar_senha` e o prazo da temporária, invalida os outros tokens e **avisa por e-mail** "sua senha foi alterada".
11. **Troca de e-mail** exige a senha atual quando já existe e-mail verificado; o novo fica `email_pendente` até confirmar (o antigo continua valendo para o "esqueci").
12. **E-mail não configurado não derruba nem tranca ninguém:** sem `EMAIL_USER/EMAIL_PASS`, o app sobe normalmente, o passo "informar e-mail" **não é exigido** e o "esqueci" apenas registra erro no log. Permite deployar o código antes de existir a senha de app.
13. **Expiração:** `senha_temporaria_expira_em = NOW() + 72 h` ao gerar temporária (criar família/conta, "Nova senha", CLI). Expirada: login → **403 `senha_expirada`** ("Sua senha temporária expirou. Peça uma nova à Dra. Raquel."); a sessão já aberta com temporária vencida também cai (middleware), inclusive `/trocar-senha`. Trocar/redefinir a senha zera o prazo. Contas pendentes hoje (`peter`, `raquel`) ganham **7 dias a partir da migration** (não 72 h, para não trancar quem ainda não entrou).
14. **Prazo configurável** por `SENHA_TEMPORARIA_HORAS` (padrão 72).

## Modelo de dados — migration `004_recuperacao_senha.sql`
```sql
ALTER TABLE usuarios
  ADD COLUMN email VARCHAR(254) NULL,
  ADD COLUMN email_verificado_em TIMESTAMP NULL,
  ADD COLUMN email_pendente VARCHAR(254) NULL,
  ADD COLUMN senha_temporaria_expira_em TIMESTAMP NULL,
  ADD UNIQUE KEY uq_usuarios_email (email);
UPDATE usuarios SET senha_temporaria_expira_em = DATE_ADD(NOW(), INTERVAL 7 DAY) WHERE precisa_trocar_senha = 1;
CREATE TABLE tokens_conta (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  tipo ENUM('verificar_email','redefinir_senha') NOT NULL,
  token_hash CHAR(64) NOT NULL,
  email VARCHAR(254) NULL,            -- alvo da verificação (cópia do email_pendente no envio)
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_em TIMESTAMP NOT NULL,
  usado_em TIMESTAMP NULL,
  UNIQUE KEY uq_tokens_hash (token_hash),
  KEY idx_tokens_usuario (usuario_id, tipo),
  CONSTRAINT fk_tokens_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```
Só aditiva (colunas nulas + tabela nova): o código antigo continua funcionando se for preciso reverter. `UNIQUE(email)` com collation `_unicode_ci` ⇒ unicidade sem diferenciar maiúsculas.

## API (todas em `/api/auth`, `no-store`, CSRF/Origin já aplicado)
| Rota | Sessão | Corpo | Resposta |
|---|---|---|---|
| `POST /esqueci-senha` | não | `{email}` | sempre 200 `{ok:true}` (limites: ver abaixo) |
| `POST /redefinir-senha` | não (token) | `{token, novaSenha}` | 200 `{ok:true}` · 400 senha fraca · 400 `link_invalido` (inexistente/expirado/usado/conta inativa — mesma mensagem) |
| `POST /email` | sim (permite troca pendente) | `{email, senhaAtual?}` | 200 `{ok:true}`; envia verificação; `senhaAtual` obrigatória se já há e-mail verificado |
| `POST /email/reenviar` | sim | — | 200 `{ok:true}` (máx. 5/h/conta) |
| `POST /confirmar-email` | não (token) | `{token}` | 200 `{ok:true}` · 400 `link_invalido` · 409 `email_em_uso` |
| `GET /me` | sim | — | acrescenta `email` mascarado (`m***@gmail.com`), `emailVerificado`, `emailPendente` (mascarado), `precisaEmail` |
| `POST /login` | — | — | passa a devolver 403 `senha_expirada` |

**Porta de entrada central (`middleware/sessao.js`):** (a) temporária vencida ⇒ 401 sempre; (b) `precisaEmail` (familia/medica, sem e-mail nem pendente, e-mail configurado) ⇒ 403 `informar_email`, liberando só `/me`, `/logout`, `/trocar-senha`, `/email`, `/email/reenviar`.

**Limites de taxa** (express-rate-limit, em memória como os atuais): `/esqueci-senha` 10/h por IP e 3/h por (e-mail+IP); **teto por conta**: no máximo 3 e-mails de redefinição por hora por usuário (contando tokens criados; excedeu ⇒ silêncio); `/email*` 5/h por usuário; `/redefinir-senha` e `/confirmar-email` 20/h por IP (tentativa de adivinhar token: 256 bits, inviável, mas limita ruído).

## E-mail (`src/email.js`, injetado em `criarApp({ …, emailer })`)
- `criarEmailer(config)` → `{ ativo, enviarVerificacao, enviarRedefinicao, enviarAvisoSenhaAlterada }` com nodemailer (`EMAIL_HOST` padrão `smtp.gmail.com`, `EMAIL_PORT` 587, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` padrão `"Dra. Raquel Machado" <EMAIL_USER>`).
- HTML + texto puro, identidade do site (rosa/creme/ameixa), **nome escapado** (o Primeiro Colo interpolava sem escapar), botão + link em texto, sem rastreamento.
- Fora de produção sem credenciais: `emailer` de console imprime o link (só dev/E2E). **Nunca logar token em produção.**
- Testes usam um `emailerFalso` que guarda as mensagens (e o token em claro) para os asserts.

## Frontend
- `Entrar`: link "Esqueci minha senha" → `/conta/esqueci`.
- `/conta/esqueci` (e-mail → confirmação neutra), `/conta/redefinir` (lê `#t=`, nova senha + confirmação, sucesso → "Entrar"), `/conta/confirmar-email` (lê `#t=`, chama a API, mostra resultado), `/conta/email` (informar/trocar e-mail, status, reenviar). Todas `noindex`; `robots.txt` ganha `Disallow: /conta`.
- `RequerPapel`/`AreaRestrita`: além de `precisaTrocarSenha`, redireciona para `/conta/email` quando `precisaEmail`. Faixa discreta "Confirme seu e-mail" enquanto houver pendente.
- Painel/Admin: selo **"Expirada"** quando `senhaTemporariaExpiraEm` passou (com "Nova senha" em destaque); selo "Aguardando 1º acesso · expira em X"; cartão de credenciais diz "válida por 72 horas". Lista mostra só `emailVerificado` (nunca o endereço — dado mínimo).

## Segurança (requisitos testáveis)
- Token em claro só no e-mail; no banco só hash; token inexistente/expirado/usado/de conta inativa ⇒ mesma resposta; consumo atômico (duas requisições simultâneas ⇒ uma passa — teste SQL real).
- E-mail **não verificado nunca** recebe link de redefinição. E-mail verificado duplicado é impossível (UNIQUE).
- Resposta e tempo de `/esqueci-senha` independentes de o e-mail existir (envio sem `await`).
- Redefinição derruba sessões; senha nova passa por `validarNovaSenha` (login/nome) **antes** de consumir o token (erro de digitação não queima o link).
- Sem enumeração por `/email`: e-mail já em uso só é descoberto na verificação (mensagem neutra) e exige sessão.
- Temporária vencida não entra por login, nem por sessão antiga, nem por `/trocar-senha`.
- Nenhum token/senha em logs; `FRONTEND_URL` fixo; `no-store` herdado; `Referrer-Policy: no-referrer` nas páginas de token.

## Fora de escopo
Redefinição do admin por e-mail, 2FA, SMS/WhatsApp automático, edição do texto do guia, reautenticação admin⇢admin, limpeza agendada de tokens (feita por oportunidade: ao criar token, apaga expirados há > 7 dias).

> **Revisão independente (2026-11-17):** as emendas no fim de `plans/2026-11-17-esqueci-senha.md` **prevalecem** sobre este design. Principais: migrations em 3 arquivos, "Nova senha" revoga e-mail e tokens, limitadores que contam sucessos, convite de e-mail **não bloqueante** (em vez do gate), "esqueci" só para `familia`, sem `email_verificado_em`, token amarrado ao e-mail alvo, fragmento movido para `sessionStorage` antes do analytics.
