-- =============================================
-- ÍNDICES: public.nf_obs (performance)
-- Aplicar em ambiente onde a tabela já existe.
-- Idempotente: CREATE INDEX IF NOT EXISTS.
-- =============================================

-- Busca por empenho (ex.: listar observações de um empenho)
CREATE INDEX IF NOT EXISTS idx_nf_obs_empenho_id ON public.nf_obs(empenho_id);

-- Ordenação por data (ex.: listagem global por mais recente)
CREATE INDEX IF NOT EXISTS idx_nf_obs_date_desc ON public.nf_obs("date" DESC NULLS LAST);

-- Padrão mais comum: filtrar por empenho + ordenar por data (Index-Only ou Index Scan)
CREATE INDEX IF NOT EXISTS idx_nf_obs_empenho_date ON public.nf_obs(empenho_id, "date" DESC NULLS LAST);

ANALYZE public.nf_obs;
