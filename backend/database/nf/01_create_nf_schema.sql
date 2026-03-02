-- =============================================
-- SCHEMA: Cadastro de Recebimento de Notas Fiscais
-- Sistema de Controle de Empenhos e Estoque
-- Uso: Pool PostgreSQL (sem ORM)
-- =============================================

CREATE SCHEMA IF NOT EXISTS nf;

-- Tabela principal: recebimento de nota fiscal
CREATE TABLE IF NOT EXISTS public.nf_empenho(
    id BIGSERIAL PRIMARY KEY,
    numero VARCHAR(50) NOT NULL,
    data DATE NOT NULL,
    empenho VARCHAR(255) NOT NULL,
    item VARCHAR(255) NOT NULL,
    codigo VARCHAR(255) NOT NULL,
    material VARCHAR(255) NOT NULL,
    saldo_emp DECIMAL(15, 2) NOT NULL,
    v_unit DECIMAL(15, 2) NOT NULL,
    v_total DECIMAL(15, 2) NOT NULL,
    qtde_receb DECIMAL(15, 2) NOT NULL,
    situacao VARCHAR(20) NOT NULL DEFAULT 'recebido',
    usuario VARCHAR(255) NOT NULL,
    id_emp INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_nf_empenho_id_emp FOREIGN KEY (id_emp) REFERENCES public.empenho(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_nf_empenho_numero ON public.nf_empenho(numero);
CREATE INDEX IF NOT EXISTS idx_nf_empenho_data ON public.nf_empenho(data DESC);
CREATE INDEX IF NOT EXISTS idx_nf_empenho_empenho ON public.nf_empenho(empenho);
CREATE INDEX IF NOT EXISTS idx_nf_empenho_item ON public.nf_empenho(item);
CREATE INDEX IF NOT EXISTS idx_nf_empenho_codigo ON public.nf_empenho(codigo);
CREATE INDEX IF NOT EXISTS idx_nf_empenho_material ON public.nf_empenho(material);
CREATE INDEX IF NOT EXISTS idx_nf_empenho_qtde_receb ON public.nf_empenho(qtde_receb);
CREATE INDEX IF NOT EXISTS idx_nf_empenho_situacao ON public.nf_empenho(situacao);
CREATE INDEX IF NOT EXISTS idx_nf_empenho_usuario ON public.nf_empenho(usuario);
CREATE INDEX IF NOT EXISTS idx_nf_empenho_id_emp ON public.nf_empenho(id_emp);
CREATE INDEX IF NOT EXISTS idx_nf_empenho_created_at ON public.nf_empenho(created_at);
CREATE INDEX IF NOT EXISTS idx_nf_empenho_updated_at ON public.nf_empenho(updated_at);

ANALYZE public.nf_empenho;

-- =============================================
-- Tabela: Observações por empenho (NF)
-- Uso: histórico de observações vinculadas a empenho_id (nu_documento_siafi).
-- Performance: índices em empenho_id e date evitam full scan em listagens/filtros.
-- =============================================
CREATE SEQUENCE IF NOT EXISTS public.nf_obs_new_id_seq;

CREATE TABLE IF NOT EXISTS public.nf_obs (
    id         INT4         NOT NULL DEFAULT nextval('public.nf_obs_new_id_seq'::regclass),
    empenho_id VARCHAR(255) NULL,
    observacao TEXT         NULL,
    usuario    VARCHAR(255) NULL,
    "date"     TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT nf_obs_new_pkey PRIMARY KEY (id)
);

ALTER SEQUENCE IF EXISTS public.nf_obs_new_id_seq OWNED BY public.nf_obs.id;

-- Índices para performance (evitar full table scan em filtros por empenho e ordenação por data)
CREATE INDEX IF NOT EXISTS idx_nf_obs_empenho_id ON public.nf_obs(empenho_id);
CREATE INDEX IF NOT EXISTS idx_nf_obs_date_desc ON public.nf_obs("date" DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_nf_obs_empenho_date ON public.nf_obs(empenho_id, "date" DESC NULLS LAST);

ANALYZE public.nf_obs;
