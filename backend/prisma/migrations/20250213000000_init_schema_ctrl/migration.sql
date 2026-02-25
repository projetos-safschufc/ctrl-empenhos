-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "ctrl";

-- CreateTable (schema ctrl)
CREATE TABLE "ctrl"."profiles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" TEXT,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "profiles_name_key" ON "ctrl"."profiles"("name");

-- CreateTable (schema ctrl)
CREATE TABLE "ctrl"."users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "profile_id" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "ctrl"."users"("email");

-- CreateTable (schema ctrl)
CREATE TABLE "ctrl"."safs_catalogo" (
    "id" SERIAL NOT NULL,
    "master" TEXT NOT NULL,
    "descricao" TEXT,
    "resp_controle" TEXT,
    "setor" TEXT,
    "unidade" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "safs_catalogo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "safs_catalogo_master_key" ON "ctrl"."safs_catalogo"("master");

-- CreateTable (schema ctrl)
CREATE TABLE "ctrl"."hist_ctrl_empenho" (
    "id" SERIAL NOT NULL,
    "material_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "qtde_por_embalagem" DECIMAL(18,4),
    "tipo_armazenamento" VARCHAR(100),
    "capacidade_estocagem" VARCHAR(100),
    "observacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hist_ctrl_empenho_pkey" PRIMARY KEY ("id")
);

-- CreateTable (schema public)
CREATE TABLE "public"."empenho" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50),
    "material" VARCHAR(50),
    "quantidade" DECIMAL(18,4),
    "valor" DECIMAL(18,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empenho_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey (ctrl.users -> ctrl.profiles)
ALTER TABLE "ctrl"."users" ADD CONSTRAINT "users_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "ctrl"."profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (ctrl.hist_ctrl_empenho -> ctrl.safs_catalogo)
ALTER TABLE "ctrl"."hist_ctrl_empenho" ADD CONSTRAINT "hist_ctrl_empenho_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "ctrl"."safs_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (ctrl.hist_ctrl_empenho -> ctrl.users)
ALTER TABLE "ctrl"."hist_ctrl_empenho" ADD CONSTRAINT "hist_ctrl_empenho_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "ctrl"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
