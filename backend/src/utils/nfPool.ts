import { Pool } from 'pg';
import { getNfConfig } from '../config/nf';

let pool: Pool | null = null;

/**
 * Pool de conexões para o módulo Recebimento de Notas Fiscais.
 * Usa configuração DB_* (ou NF_*), sem ORM.
 * Use getNfSchema() para prefixar tabelas nas queries.
 */
export function getNfPool(): Pool {
  if (!pool) {
    const c = getNfConfig();
    pool = new Pool({
      host: c.host,
      port: c.port,
      database: c.database,
      user: c.user,
      password: c.password,
      max: parseInt(process.env.NF_POOL_MAX ?? '5', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

/** Retorna o prefixo de schema para queries (ex: "nf".) */
export function getNfSchema(): string {
  const schema = getNfConfig().schema;
  return schema === 'public' ? '' : `"${schema}".`;
}
