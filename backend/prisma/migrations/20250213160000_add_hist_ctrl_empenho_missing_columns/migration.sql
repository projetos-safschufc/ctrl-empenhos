-- Colunas faltantes em ctrl.hist_ctrl_empenho (alinhar com Prisma schema).
-- A migração inicial criou apenas: id, material_id, usuario_id, qtde_por_embalagem, tipo_armazenamento, capacidade_estocagem, observacao, created_at.

ALTER TABLE "ctrl"."hist_ctrl_empenho" ADD COLUMN IF NOT EXISTS "classificacao" VARCHAR(100);
ALTER TABLE "ctrl"."hist_ctrl_empenho" ADD COLUMN IF NOT EXISTS "resp_controle" VARCHAR(200);
ALTER TABLE "ctrl"."hist_ctrl_empenho" ADD COLUMN IF NOT EXISTS "setor_controle" VARCHAR(100);
ALTER TABLE "ctrl"."hist_ctrl_empenho" ADD COLUMN IF NOT EXISTS "master_descritivo" VARCHAR(100);
ALTER TABLE "ctrl"."hist_ctrl_empenho" ADD COLUMN IF NOT EXISTS "numero_registro" VARCHAR(50);
ALTER TABLE "ctrl"."hist_ctrl_empenho" ADD COLUMN IF NOT EXISTS "valor_unit_registro" DECIMAL(18,4);
ALTER TABLE "ctrl"."hist_ctrl_empenho" ADD COLUMN IF NOT EXISTS "saldo_registro" DECIMAL(18,4);
