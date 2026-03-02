/**
 * Configuração de CORS por ambiente.
 * ALLOWED_ORIGINS: origens permitidas separadas por vírgula (ex: https://app.empresa.gov.br,https://localhost:5173).
 * Se vazio ou não definido em desenvolvimento, permite qualquer origem (comportamento anterior).
 * Em produção, definir ALLOWED_ORIGINS para restringir.
 */
export function getCorsOptions(): { origin: boolean | string | string[]; credentials?: boolean } {
  const raw = process.env.ALLOWED_ORIGINS ?? '';
  const origins = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    // Desenvolvimento ou intranet: permitir qualquer origem (comportamento legado)
    return { origin: true };
  }

  return {
    origin: origins,
    credentials: true,
  };
}
