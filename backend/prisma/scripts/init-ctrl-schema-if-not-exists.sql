-- Script idempotente: criar schema e tabelas no banco SAFS se não existirem.
-- Execute manualmente (psql, DBeaver, etc.) ou use: npm run db:init
-- Depois marque a migration como aplicada: npx prisma migrate resolve --applied 20250213000000_init_schema_ctrl

CREATE SCHEMA IF NOT EXISTS "ctrl";

CREATE TABLE IF NOT EXISTS "ctrl"."profiles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" TEXT,
    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "profiles_name_key" ON "ctrl"."profiles"("name");

CREATE TABLE IF NOT EXISTS "ctrl"."users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "profile_id" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "ctrl"."users"("email");

CREATE TABLE IF NOT EXISTS "ctrl"."safs_catalogo" (
    "id" SERIAL NOT NULL,
    "master" TEXT NOT NULL,
    "descricao" TEXT,
    "resp_controle" TEXT,
    "setor" TEXT,
    "unidade" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "safs_catalogo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "safs_catalogo_master_key" ON "ctrl"."safs_catalogo"("master");

CREATE TABLE IF NOT EXISTS "ctrl"."hist_ctrl_empenho" (
    "id" SERIAL NOT NULL,
    "material_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "classificacao" VARCHAR(100),
    "resp_controle" VARCHAR(100),
    "setor_controle" VARCHAR(100),
    "master_descritivo" VARCHAR(255),
    "numero_registro" VARCHAR(50),
    "valor_unit_registro" DECIMAL(18,4),
    "saldo_registro" DECIMAL(18,4),
    "qtde_por_embalagem" DECIMAL(18,4),
    "tipo_armazenamento" VARCHAR(100),
    "capacidade_estocagem" VARCHAR(100),
    "observacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hist_ctrl_empenho_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."empenho" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50),
    "material" VARCHAR(50),
    "quantidade" DECIMAL(18,4),
    "valor" DECIMAL(18,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "empenho_pkey" PRIMARY KEY ("id")
);

-- FKs só se as tabelas existirem e as FKs ainda não (cada um em bloco para não abortar tudo)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_profile_id_fkey') THEN
    ALTER TABLE "ctrl"."users" ADD CONSTRAINT "users_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "ctrl"."profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hist_ctrl_empenho_material_id_fkey') THEN
    ALTER TABLE "ctrl"."hist_ctrl_empenho" ADD CONSTRAINT "hist_ctrl_empenho_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "ctrl"."safs_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hist_ctrl_empenho_usuario_id_fkey') THEN
    ALTER TABLE "ctrl"."hist_ctrl_empenho" ADD CONSTRAINT "hist_ctrl_empenho_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "ctrl"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
