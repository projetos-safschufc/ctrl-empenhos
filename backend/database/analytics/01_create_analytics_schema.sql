-- =============================================
-- SCHEMA DE ANALYTICS E AUDITORIA AVANÇADA
-- Sistema de Controle de Empenhos e Estoque
-- Ambiente: INTRANET (Enterprise Level)
-- =============================================

-- ========== TABELAS DE AUDITORIA ==========

-- Tabela principal de auditoria
CREATE TABLE IF NOT EXISTS ctrl.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES ctrl.users(id),
    session_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    endpoint VARCHAR(500),
    http_method VARCHAR(10),
    status_code INTEGER,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices para auditoria
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON ctrl.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON ctrl.audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON ctrl.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session ON ctrl.audit_logs(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON ctrl.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata_gin ON ctrl.audit_logs USING GIN(metadata);

-- ========== TABELAS DE MÉTRICAS ==========

-- Métricas de performance do sistema
CREATE TABLE IF NOT EXISTS ctrl.system_metrics (
    id BIGSERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC(15,4) NOT NULL,
    metric_unit VARCHAR(20),
    tags JSONB DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para métricas
CREATE INDEX IF NOT EXISTS idx_system_metrics_name_recorded ON ctrl.system_metrics(metric_name, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_recorded_at ON ctrl.system_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_tags_gin ON ctrl.system_metrics USING GIN(tags);

-- Métricas de uso por usuário
CREATE TABLE IF NOT EXISTS ctrl.user_activity_metrics (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES ctrl.users(id),
    activity_type VARCHAR(100) NOT NULL,
    activity_count INTEGER DEFAULT 1,
    activity_date DATE DEFAULT CURRENT_DATE,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(user_id, activity_type, activity_date)
);

-- Índices para atividade de usuários
CREATE INDEX IF NOT EXISTS idx_user_activity_user_date ON ctrl.user_activity_metrics(user_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_type_date ON ctrl.user_activity_metrics(activity_type, activity_date DESC);

-- ========== VIEWS ANALÍTICAS ==========

-- View para dashboard de auditoria
CREATE OR REPLACE VIEW ctrl.v_audit_summary AS
SELECT 
    DATE(created_at) as audit_date,
    action,
    entity_type,
    COUNT(*) as action_count,
    COUNT(DISTINCT user_id) as unique_users,
    AVG(execution_time_ms) as avg_execution_time,
    MAX(execution_time_ms) as max_execution_time,
    COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
FROM ctrl.audit_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), action, entity_type
ORDER BY audit_date DESC, action_count DESC;

-- View para métricas de performance
CREATE OR REPLACE VIEW ctrl.v_performance_metrics AS
SELECT 
    DATE(recorded_at) as metric_date,
    metric_name,
    AVG(metric_value) as avg_value,
    MIN(metric_value) as min_value,
    MAX(metric_value) as max_value,
    COUNT(*) as sample_count
FROM ctrl.system_metrics
WHERE recorded_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(recorded_at), metric_name
ORDER BY metric_date DESC, metric_name;

-- View para atividade de usuários
CREATE OR REPLACE VIEW ctrl.v_user_activity_summary AS
SELECT 
    u.email,
    u.name,
    uam.activity_date,
    SUM(CASE WHEN uam.activity_type = 'login' THEN uam.activity_count ELSE 0 END) as login_count,
    SUM(CASE WHEN uam.activity_type = 'dashboard_view' THEN uam.activity_count ELSE 0 END) as dashboard_views,
    SUM(CASE WHEN uam.activity_type = 'controle_empenhos_view' THEN uam.activity_count ELSE 0 END) as controle_views,
    SUM(CASE WHEN uam.activity_type = 'movimentacao_view' THEN uam.activity_count ELSE 0 END) as movimentacao_views,
    SUM(CASE WHEN uam.activity_type = 'data_export' THEN uam.activity_count ELSE 0 END) as exports_count,
    MAX(uam.last_activity) as last_activity
FROM ctrl.users u
LEFT JOIN ctrl.user_activity_metrics uam ON u.id = uam.user_id
WHERE uam.activity_date >= CURRENT_DATE - INTERVAL '30 days' OR uam.activity_date IS NULL
GROUP BY u.id, u.email, u.name, uam.activity_date
ORDER BY uam.activity_date DESC NULLS LAST, u.name;

-- ========== FUNÇÕES ANALÍTICAS ==========

-- Função para registrar métricas de sistema
CREATE OR REPLACE FUNCTION ctrl.record_system_metric(
    p_metric_name VARCHAR(100),
    p_metric_value NUMERIC(15,4),
    p_metric_unit VARCHAR(20) DEFAULT NULL,
    p_tags JSONB DEFAULT '{}'::jsonb
) RETURNS VOID AS $$
BEGIN
    INSERT INTO ctrl.system_metrics (metric_name, metric_value, metric_unit, tags)
    VALUES (p_metric_name, p_metric_value, p_metric_unit, p_tags);
END;
$$ LANGUAGE plpgsql;

-- Função para incrementar atividade de usuário
CREATE OR REPLACE FUNCTION ctrl.increment_user_activity(
    p_user_id INTEGER,
    p_activity_type VARCHAR(100),
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS VOID AS $$
BEGIN
    INSERT INTO ctrl.user_activity_metrics (user_id, activity_type, activity_count, metadata)
    VALUES (p_user_id, p_activity_type, 1, p_metadata)
    ON CONFLICT (user_id, activity_type, activity_date)
    DO UPDATE SET 
        activity_count = ctrl.user_activity_metrics.activity_count + 1,
        last_activity = CURRENT_TIMESTAMP,
        metadata = p_metadata;
END;
$$ LANGUAGE plpgsql;

-- Função para limpeza automática de logs antigos
CREATE OR REPLACE FUNCTION ctrl.cleanup_old_audit_logs(p_days_to_keep INTEGER DEFAULT 90) 
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM ctrl.audit_logs 
    WHERE created_at < CURRENT_DATE - INTERVAL '1 day' * p_days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Registrar a limpeza como métrica
    PERFORM ctrl.record_system_metric('audit_cleanup_deleted_records', deleted_count, 'count');
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ========== TRIGGERS DE AUDITORIA ==========

-- Função genérica para auditoria
CREATE OR REPLACE FUNCTION ctrl.audit_trigger_function() RETURNS TRIGGER AS $$
DECLARE
    old_data JSONB;
    new_data JSONB;
    action_type VARCHAR(10);
BEGIN
    -- Determinar tipo de ação
    IF TG_OP = 'DELETE' THEN
        old_data = to_jsonb(OLD);
        new_data = NULL;
        action_type = 'DELETE';
    ELSIF TG_OP = 'UPDATE' THEN
        old_data = to_jsonb(OLD);
        new_data = to_jsonb(NEW);
        action_type = 'UPDATE';
    ELSIF TG_OP = 'INSERT' THEN
        old_data = NULL;
        new_data = to_jsonb(NEW);
        action_type = 'INSERT';
    END IF;
    
    -- Inserir log de auditoria (user_id será preenchido pela aplicação)
    INSERT INTO ctrl.audit_logs (
        action, 
        entity_type, 
        entity_id, 
        old_values, 
        new_values,
        metadata
    ) VALUES (
        action_type,
        TG_TABLE_NAME,
        COALESCE(NEW.id::TEXT, OLD.id::TEXT),
        old_data,
        new_data,
        jsonb_build_object('trigger', true, 'table', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME)
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers nas tabelas principais
DROP TRIGGER IF EXISTS audit_hist_ctrl_empenho ON ctrl.hist_ctrl_empenho;
CREATE TRIGGER audit_hist_ctrl_empenho
    AFTER INSERT OR UPDATE OR DELETE ON ctrl.hist_ctrl_empenho
    FOR EACH ROW EXECUTE FUNCTION ctrl.audit_trigger_function();

DROP TRIGGER IF EXISTS audit_users ON ctrl.users;
CREATE TRIGGER audit_users
    AFTER INSERT OR UPDATE OR DELETE ON ctrl.users
    FOR EACH ROW EXECUTE FUNCTION ctrl.audit_trigger_function();

-- ========== CONFIGURAÇÕES DE RETENÇÃO ==========

-- Comentário para job de limpeza automática (configurar no cron ou scheduler)
/*
-- Executar diariamente às 2h da manhã para limpeza de logs antigos
-- SELECT ctrl.cleanup_old_audit_logs(90); -- manter 90 dias
*/

-- Atualizar estatísticas
ANALYZE ctrl.audit_logs;
ANALYZE ctrl.system_metrics;
ANALYZE ctrl.user_activity_metrics;