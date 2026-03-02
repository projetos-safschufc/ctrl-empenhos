-- =============================================
-- ÍNDICES CONCURRENTLY: public.nf_obs (produção)
-- Use em tabela já populada para evitar lock prolongado.
-- Executar cada comando separadamente (CONCURRENTLY não roda em transação).
-- =============================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nf_obs_empenho_id ON public.nf_obs(empenho_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nf_obs_date_desc ON public.nf_obs("date" DESC NULLS LAST);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nf_obs_empenho_date ON public.nf_obs(empenho_id, "date" DESC NULLS LAST);

ANALYZE public.nf_obs;
