-- =============================================
-- OTIMIZAÇÕES DE ÍNDICES PARA QUERIES CRÍTICAS
-- Sistema de Controle de Empenhos e Estoque
-- Ambiente: INTRANET (Otimizado para performance)
-- =============================================

-- ========== SCHEMA CTRL ==========

-- Índice para busca rápida de materiais por master (usado frequentemente)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_safs_catalogo_master 
ON ctrl.safs_catalogo(master);

-- Índice para busca por responsável (filtro comum)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_safs_catalogo_resp_controle 
ON ctrl.safs_catalogo(resp_controle) WHERE resp_controle IS NOT NULL;

-- Índice para busca por setor (filtro comum)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_safs_catalogo_setor 
ON ctrl.safs_catalogo(setor) WHERE setor IS NOT NULL;

-- Índice composto para paginação otimizada
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_safs_catalogo_pagination 
ON ctrl.safs_catalogo(id, master, updated_at DESC);

-- Índice para histórico por material (usado em findLastByMaterialIds)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hist_ctrl_empenho_material_created 
ON ctrl.hist_ctrl_empenho(material_id, created_at DESC);

-- Índice para histórico por usuário
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hist_ctrl_empenho_usuario 
ON ctrl.hist_ctrl_empenho(usuario_id, created_at DESC);

-- Índice para autenticação de usuários
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_active 
ON ctrl.users(email, active) WHERE active = true;

-- ========== SCHEMA PUBLIC ==========

-- Índice composto para empenhos pendentes (query crítica)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_empenho_material_registro_status 
ON public.empenho(material, nu_registro_licitacao, status_item, fl_evento) 
WHERE status_item IN ('Emitido', 'Atend. parcial') AND fl_evento = 'Empenho';

-- Índice para busca por documento SIAFI
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_empenho_documento_siafi 
ON public.empenho(nu_documento_siafi) WHERE nu_documento_siafi IS NOT NULL;

-- Índice para vigência de empenhos
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_empenho_vigencia 
ON public.empenho(dt_fim_vigencia) WHERE dt_fim_vigencia IS NOT NULL;

-- Índice para status de empenhos
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_empenho_status_pedido 
ON public.empenho(status_pedido, status_item);

-- ========== VIEWS DO DATA WAREHOUSE ==========
-- Nota: Índices nas views devem ser criados nas tabelas base
-- Assumindo que as views são baseadas em tabelas reais

-- Comentários para criação manual nos schemas do DW:
/*
-- Para v_df_movimento (assumindo tabela base tb_movimento):
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_movimento_material_mesano 
ON gad_dlih_safs.tb_movimento(
  TRIM(SPLIT_PART(mat_cod_antigo::text, '-', 1)),
  (EXTRACT(YEAR FROM mesano)::int * 100 + EXTRACT(MONTH FROM mesano)::int)
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_movimento_almoxarifado_data 
ON gad_dlih_safs.tb_movimento(alm_nome, dt_geracao DESC);

-- Para v_df_consumo_estoque (assumindo tabela base tb_consumo_estoque):
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consumo_material_vigencia 
ON gad_dlih_safs.tb_consumo_estoque(
  TRIM(SPLIT_PART(codigo_padronizado::text, '-', 1)),
  fim_vigencia
) WHERE fim_vigencia >= CURRENT_DATE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consumo_registro_ativo 
ON gad_dlih_safs.tb_consumo_estoque(registro_ativo, codigo_padronizado) 
WHERE UPPER(TRIM(registro_ativo)) = 'SIM';
*/

-- ========== ESTATÍSTICAS ==========
-- Atualizar estatísticas após criação dos índices
ANALYZE ctrl.safs_catalogo;
ANALYZE ctrl.hist_ctrl_empenho;
ANALYZE ctrl.users;
ANALYZE public.empenho;

-- ========== CONFIGURAÇÕES DE PERFORMANCE ==========
-- Para ambiente INTRANET com poucos usuários simultâneos
-- Configurações otimizadas para consultas complexas

/*
-- Configurações recomendadas para postgresql.conf:
-- shared_buffers = 256MB (ou 25% da RAM disponível)
-- effective_cache_size = 1GB (ou 75% da RAM disponível)
-- work_mem = 16MB (para queries complexas)
-- maintenance_work_mem = 256MB
-- checkpoint_completion_target = 0.9
-- wal_buffers = 16MB
-- default_statistics_target = 100
-- random_page_cost = 1.1 (para SSDs)
-- effective_io_concurrency = 200 (para SSDs)
*/