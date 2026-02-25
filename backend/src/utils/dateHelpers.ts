/**
 * Normaliza string de data para o formato YYYY-MM-DD (usado em APIs e repositórios).
 * Aceita: YYYY-MM-DD, DD/MM/YYYY ou D/M/YYYY.
 * @returns YYYY-MM-DD ou string vazia se inválido.
 */
export function normalizeToYYYYMMDD(value: string | undefined | null): string {
  const s = (value ?? '').trim();
  if (!s) return '';
  // Já está em YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY ou D/M/YYYY
  const match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    const day = d!.padStart(2, '0');
    const month = m!.padStart(2, '0');
    const year = y!;
    const date = new Date(`${year}-${month}-${day}`);
    if (!Number.isNaN(date.getTime()) && date.getFullYear() === parseInt(year, 10)) {
      return `${year}-${month}-${day}`;
    }
  }
  return '';
}

/** Retorna o mês atual no formato YYYYMM (ex.: 202602). */
export function getCurrentMesano(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}
