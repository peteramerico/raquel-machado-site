-- Configurações editáveis do site (chave/valor). Hoje: valor da consulta (editável na área médica, Incremento 2).
CREATE TABLE IF NOT EXISTS configuracoes (
  chave VARCHAR(60) NOT NULL PRIMARY KEY,
  valor VARCHAR(255) NOT NULL,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  atualizado_por INT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO configuracoes (chave, valor) VALUES ('valor_consulta', '400');
