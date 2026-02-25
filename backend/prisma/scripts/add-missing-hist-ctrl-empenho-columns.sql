-- Adiciona colunas de snapshot e created_at em ctrl.hist_ctrl_empenho (para o botão Salvar do Controle de Empenhos).

ALTER TABLE "ctrl"."hist_ctrl_empenho" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ctrl"."hist_ctrl_empenho" ADD COLUMN IF NOT EXISTS "classificacao" VARCHAR(100);
ALTER TABLE "ctrl"."hist_ctrl_empenho" ADD COLUMN IF NOT EXISTS "resp_controle" VARCHAR(200);
ALTER TABLE "ctrl"."hist_ctrl_empenho" ADD COLUMN IF NOT EXISTS "setor_controle" VARCHAR(100);
ALTER TABLE "ctrl"."hist_ctrl_empenho" ADD COLUMN IF NOT EXISTS "master_descritivo" VARCHAR(100);
ALTER TABLE "ctrl"."hist_ctrl_empenho" ADD COLUMN IF NOT EXISTS "numero_registro" VARCHAR(50);
ALTER TABLE "ctrl"."hist_ctrl_empenho" ADD COLUMN IF NOT EXISTS "valor_unit_registro" DECIMAL(18,4);
ALTER TABLE "ctrl"."hist_ctrl_empenho" ADD COLUMN IF NOT EXISTS "saldo_registro" DECIMAL(18,4);
