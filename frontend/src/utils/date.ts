/**
 * Formata uma data conforme o padrão (ex.: 'dd/MM/yyyy HH:mm').
 * Suporta: dd (dia), MM (mês), yyyy (ano), HH (hora), mm (minuto)
 */
export function formatDate(date: Date, pattern: string): string {
  const d = date.getDate();
  const month = date.getMonth() + 1;
  const y = date.getFullYear();
  const h = date.getHours();
  const min = date.getMinutes();
  const pad = (n: number) => String(n).padStart(2, '0');
  
  return pattern
    .replace(/yyyy/g, String(y))
    .replace(/MM/g, pad(month))
    .replace(/dd/g, pad(d))
    .replace(/HH/g, pad(h))
    .replace(/mm/g, pad(min));
}

/**
 * Parseia data em formato DD/MM/YYYY ou ISO (YYYY-MM-DD).
 * Se mês for 0, trata como janeiro (mês 1).
 */
export function parseDate(str: string): Date | null {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (!trimmed) return null;

  // Tenta DD/MM/YYYY
  const dmY = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmY) {
    const day = parseInt(dmY[1], 10);
    let month = parseInt(dmY[2], 10) - 1;
    const year = parseInt(dmY[3], 10);
    if (month === -1) month = 0; // Se mês 0, trata como janeiro
    const d = new Date(year, month, day);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // Tenta ISO
  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) return d;

  return null;
}
