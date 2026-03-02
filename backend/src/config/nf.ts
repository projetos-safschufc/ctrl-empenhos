import { normalizePassword } from './database';

/**
 * Configuração do banco para o módulo Recebimento de Notas Fiscais.
 * Usa as mesmas variáveis DB_* da aplicação principal (mesmo banco, schema nf).
 * Senha via parâmetro explícito para suportar caracteres especiais (#, @, etc.).
 */
export interface NfConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  /** Schema das tabelas de NF (padrão: nf) */
  schema: string;
}

export function getNfConfig(): NfConfig {
  return {
    host: (process.env.NF_HOST ?? process.env.DB_HOST ?? 'localhost').trim(),
    port: parseInt(
      process.env.NF_PORT ?? process.env.DB_PORT ?? '5432',
      10
    ),
    database: (process.env.NF_DATABASE ?? process.env.DB_DATABASE ?? 'postgres').trim(),
    user: (process.env.NF_USER ?? process.env.DB_USER ?? 'postgres').trim(),
    password: normalizePassword(
      process.env.DB_PASSWORD ?? process.env.NF_PASSWORD ?? ''
    ),
    schema: (process.env.NF_SCHEMA ?? 'nf').trim(),
  };
}
