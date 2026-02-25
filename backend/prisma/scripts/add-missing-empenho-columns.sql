-- Adiciona colunas usadas pela tela Empenhos Pendentes em public.empenho (se não existirem).

ALTER TABLE "public"."empenho" ADD COLUMN IF NOT EXISTS "nm_fornecedor" VARCHAR(255);
ALTER TABLE "public"."empenho" ADD COLUMN IF NOT EXISTS "nu_registro_licitacao" VARCHAR(50);
ALTER TABLE "public"."empenho" ADD COLUMN IF NOT EXISTS "nu_pregao" VARCHAR(50);
ALTER TABLE "public"."empenho" ADD COLUMN IF NOT EXISTS "dt_fim_vigencia" DATE;
ALTER TABLE "public"."empenho" ADD COLUMN IF NOT EXISTS "item" VARCHAR(50);
ALTER TABLE "public"."empenho" ADD COLUMN IF NOT EXISTS "qt_saldo" DECIMAL(18,4);
ALTER TABLE "public"."empenho" ADD COLUMN IF NOT EXISTS "qt_saldo_item" DECIMAL(18,4);
ALTER TABLE "public"."empenho" ADD COLUMN IF NOT EXISTS "qt_de_embalagem" DECIMAL(18,4);
ALTER TABLE "public"."empenho" ADD COLUMN IF NOT EXISTS "vl_saldo" DECIMAL(18,2);
ALTER TABLE "public"."empenho" ADD COLUMN IF NOT EXISTS "vl_unidade" DECIMAL(18,4);
ALTER TABLE "public"."empenho" ADD COLUMN IF NOT EXISTS "fl_evento" VARCHAR(50);
ALTER TABLE "public"."empenho" ADD COLUMN IF NOT EXISTS "nu_documento_siafi" VARCHAR(50);
ALTER TABLE "public"."empenho" ADD COLUMN IF NOT EXISTS "status_item" VARCHAR(50);
ALTER TABLE "public"."empenho" ADD COLUMN IF NOT EXISTS "status_pedido" VARCHAR(50);
