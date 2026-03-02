import { normalizePassword } from './database';

export interface DwConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  /** Schema onde estão as views (ex: gad_dlih_safs ou public) */
  schema: string;
}

export function getDwConfig(): DwConfig {
  return {
    host: (process.env.DW_HOST ?? process.env.DB_HOST ?? 'localhost').trim(),
    port: parseInt(process.env.DW_PORT ?? process.env.DB_PORT ?? '5432', 10),
    database: (process.env.DW_DATABASE ?? process.env.DB_DATABASE ?? 'postgres').trim(),
    user: (process.env.DW_USER ?? process.env.DB_USER ?? 'postgres').trim(),
    password: normalizePassword(process.env.DW_PASSWORD ?? process.env.DB_PASSWORD ?? ''),
    schema: (process.env.DW_SCHEMA ?? 'public').trim(),
  };
}
