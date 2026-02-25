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
    host: process.env.DW_HOST ?? process.env.DB_HOST ?? '10.28.0.159',
    port: parseInt(process.env.DW_PORT ?? process.env.DB_PORT ?? '5432', 10),
    database: process.env.DW_DATABASE ?? 'dw',
    user: process.env.DW_USER ?? process.env.DB_USER ?? 'abimael',
    password: normalizePassword(process.env.DW_PASSWORD ?? process.env.DB_PASSWORD ?? ''),
    schema: process.env.DW_SCHEMA ?? 'public',
  };
}
