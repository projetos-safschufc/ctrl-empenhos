import { Pool } from 'pg';
import { getDwConfig } from '../config/dw';

let pool: Pool | null = null;

/**
 * Pool de conexões com o banco DW (views de movimento, estoque, etc.).
 * Senha passada como parâmetro explícito (password=...), não na URI, para evitar problema com #.
 * Use getDwSchema() para prefixar tabelas nas queries.
 */
export function getDwPool(): Pool {
  if (!pool) {
    const c = getDwConfig();
    pool = new Pool({
      host: c.host,
      port: c.port,
      database: c.database,
      user: c.user,
      password: c.password,
      max: 5,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export function getDwSchema(): string {
  const schema = getDwConfig().schema;
  return schema === 'public' ? '' : `"${schema}".`;
}
