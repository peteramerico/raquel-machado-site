-- Remove as tabelas do blog descontinuado (estavam vazias: posts = 0 linhas, admin_users = 2 contas).
-- No banco de produção, o backup (mysqldump de raquel_blog) é feito à mão ANTES do deploy que roda esta migration.
-- Em banco novo é um no-op.
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS admin_users;
