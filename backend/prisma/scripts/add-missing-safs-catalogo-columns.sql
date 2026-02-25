-- Adiciona colunas que podem estar faltando em ctrl.safs_catalogo.
-- Execute quando aparecer erro de coluna inexistente (descricao, serv_aquisicao, apres, xyz).

ALTER TABLE "ctrl"."safs_catalogo" ADD COLUMN IF NOT EXISTS "descricao" TEXT;
ALTER TABLE "ctrl"."safs_catalogo" ADD COLUMN IF NOT EXISTS "resp_controle" TEXT;
ALTER TABLE "ctrl"."safs_catalogo" ADD COLUMN IF NOT EXISTS "setor" TEXT;
ALTER TABLE "ctrl"."safs_catalogo" ADD COLUMN IF NOT EXISTS "unidade" TEXT;
ALTER TABLE "ctrl"."safs_catalogo" ADD COLUMN IF NOT EXISTS "serv_aquisicao" VARCHAR(100);
ALTER TABLE "ctrl"."safs_catalogo" ADD COLUMN IF NOT EXISTS "apres" VARCHAR(200);
ALTER TABLE "ctrl"."safs_catalogo" ADD COLUMN IF NOT EXISTS "xyz" VARCHAR(50);
ALTER TABLE "ctrl"."safs_catalogo" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ctrl"."safs_catalogo" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
