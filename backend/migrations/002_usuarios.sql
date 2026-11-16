-- Contas de acesso das 3 áreas (família · médica · administrador). Uma tabela, um papel por conta.
-- sessao_versao: +1 a cada troca/redefinição de senha e desativação — derruba as sessões (JWT) antigas.
-- Sem dado clínico: só nome, login e (opcional) contato da família para montar a mensagem de acesso.
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  login VARCHAR(40) NOT NULL,
  nome VARCHAR(120) NOT NULL,
  papel ENUM('familia','medica','admin') NOT NULL,
  senha_hash VARCHAR(100) NOT NULL,
  precisa_trocar_senha TINYINT(1) NOT NULL DEFAULT 1,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  sessao_versao INT NOT NULL DEFAULT 1,
  contato VARCHAR(40) NULL,
  criado_por INT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_acesso_em TIMESTAMP NULL,
  UNIQUE KEY uq_usuarios_login (login),
  KEY idx_usuarios_papel_ativo (papel, ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
