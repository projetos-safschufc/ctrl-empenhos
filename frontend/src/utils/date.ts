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
