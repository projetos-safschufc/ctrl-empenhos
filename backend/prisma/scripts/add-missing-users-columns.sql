-- Adiciona colunas que podem estar faltando em ctrl.users (ex.: active, updated_at).
-- Execute no banco SAFS quando aparecer erro "The column users.active does not exist".
-- Uso: psql ou DBeaver conectado ao banco safs.

-- Coluna active (obrigatória para o login)
ALTER TABLE "ctrl"."users" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

-- Coluna updated_at (se a tabela foi criada por versão antiga sem ela)
ALTER TABLE "ctrl"."users" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3);
UPDATE "ctrl"."users" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
ALTER TABLE "ctrl"."users" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ctrl"."users" ALTER COLUMN "updated_at" SET NOT NULL;
