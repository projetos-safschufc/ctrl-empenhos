/**
 * Tratamento de senha com caractere especial "#" (e outros: @, !, %).
 *
 * Resumo (conforme doc técnico):
 * - Leitura no .env: usar aspas (ex: DB_PASSWORD="abi123!@#qwe"); linha não pode começar com #.
 * - Normalização: normalizePassword mantém # (só remove BOM/controle/não imprimíveis e aspas do parser).
 * - Conexão principal: quando o cliente permite, passar senha como parâmetro explícito (password=...), não na URI.
 * - Se usar URI (ex: Prisma DATABASE_URL): senha codificada (# → %23, @ → %40) para a URL continuar válida.
 */
/**
 * Normalização de senha (conforme doc: manter #, remover controle/BOM/não imprimíveis).
 * - Remove BOM (U+FEFF) e aspas duplas que alguns parsers de .env deixam no valor.
 * - Remove caracteres de controle; mantém #, @, ! e demais imprimíveis.
 */
export function normalizePassword(value: string): string {
  let s = String(value ?? '');
  if (s.startsWith('\uFEFF')) s = s.slice(1);
  s = s.trim();
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
  return s.replace(/[\x00-\x1F\x7F]/g, '');
}

/** @deprecated Preferir normalizePassword. Mantido para compatibilidade. */
export function stripSurroundingQuotes(value: string): string {
  const s = String(value ?? '').trim();
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  return s;
}

/**
 * Codifica senha para uso na URL (# → %23, @ → %40, etc.).
 * Evita que # seja interpretado como fragmento na URI. Usar apenas quando a senha entra na connection string.
 * Na conexão principal com pg/Prisma: preferir passar senha como parâmetro explícito (password=...) quando o cliente permitir.
 */
function encodePasswordForUrl(password: string): string {
  return encodeURIComponent(normalizePassword(password));
}

/**
 * Parâmetros de pool/timeout para reduzir ConnectionReset (10054) e conexões ociosas fechadas pelo host remoto.
 * Prisma/PostgreSQL aceita: connection_limit, connect_timeout, pool_timeout.
 * Opcional: DB_CONNECTION_LIMIT, DB_CONNECT_TIMEOUT, DB_POOL_TIMEOUT no .env.
 */
function getPoolParams(): string {
  const limit = process.env.DB_CONNECTION_LIMIT ?? '10';
  const connectTimeout = process.env.DB_CONNECT_TIMEOUT ?? '10';
  const poolTimeout = process.env.DB_POOL_TIMEOUT ?? '20';
  return `connection_limit=${limit}&connect_timeout=${connectTimeout}&pool_timeout=${poolTimeout}`;
}

/**
 * Anexa parâmetros de pool à URL se ainda não existirem (evita conexões órfãs e reset pelo host remoto).
 */
function appendPoolParamsIfMissing(url: string): string {
  const u = url.trim();
  const params = getPoolParams();
  if (u.includes('connection_limit=') || u.includes('pool_timeout=')) return u;
  const sep = u.includes('?') ? '&' : '?';
  return `${u}${sep}${params}`;
}

/**
 * Monta a URL de conexão PostgreSQL para o Prisma.
 * Quando DB_PASSWORD está definido, sempre monta a URL a partir de DB_* (senha normalizada e codificada),
 * para evitar DATABASE_URL do .env com senha mal interpretada (#, aspas, etc.).
 * Inclui parâmetros de pool/timeout para maior resiliência a ConnectionReset (cód. 10054).
 */
export function getDatabaseUrl(): string {
  const hasDbPassword = process.env.DB_PASSWORD !== undefined && process.env.DB_PASSWORD !== '';
  let url: string;
  if (hasDbPassword) {
    const host = (process.env.DB_HOST ?? '10.28.0.159').trim();
    const port = (process.env.DB_PORT ?? '5432').trim();
    const database = (process.env.DB_DATABASE ?? 'safs').trim();
    const user = (process.env.DB_USER ?? 'abimael').trim();
    const password = normalizePassword(process.env.DB_PASSWORD ?? '');
    const encodedPassword = encodePasswordForUrl(password);
    url = `postgresql://${user}:${encodedPassword}@${host}:${port}/${database}`;
  } else {
    const fromEnv = process.env.DATABASE_URL;
    if (fromEnv && fromEnv.trim()) {
      url = fromEnv.trim();
    } else {
      const host = (process.env.DB_HOST ?? '10.28.0.159').trim();
      const port = (process.env.DB_PORT ?? '5432').trim();
      const database = (process.env.DB_DATABASE ?? 'safs').trim();
      const user = (process.env.DB_USER ?? 'abimael').trim();
      const password = normalizePassword(process.env.DB_PASSWORD ?? '');
      const encodedPassword = encodePasswordForUrl(password);
      url = `postgresql://${user}:${encodedPassword}@${host}:${port}/${database}`;
    }
  }
  return appendPoolParamsIfMissing(url);
}
