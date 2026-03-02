import ExcelJS from 'exceljs';
import { PLATAFORMA_COLORS } from '../constants/plataforma';

/** Número máximo de linhas permitidas em uma exportação Excel/PDF (evita travamento do navegador). */
export const MAX_EXPORT_ROWS = 5000;

/**
 * Se a quantidade de linhas exceder o limite, pergunta ao usuário se deseja exportar apenas as primeiras N linhas.
 * Retorna true para prosseguir (usar rows.slice(0, maxRows)), false para cancelar.
 */
export function confirmExportLimit(currentRows: number, maxRows: number = MAX_EXPORT_ROWS): Promise<boolean> {
  if (currentRows <= maxRows) return Promise.resolve(true);
  const msg = `Há ${currentRows} registro(s). Exportar no máximo ${maxRows} linhas?`;
  return Promise.resolve(window.confirm(msg));
}
export async function exportarExcelListaEmpenhos(
  rows: Array<Record<string, unknown>>,
  columns: { key: string; label: string }[],
  filenameBase: string
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Dados', { views: [{ state: 'frozen', ySplit: 1 }] });

  const headerRow = ws.addRow(columns.map((c) => c.label));
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF' + PLATAFORMA_COLORS.detalheSecundario.replace('#', '') },
  };
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

  for (const row of rows) {
    const values = columns.map((c) => row[c.key] ?? '');
    ws.addRow(values);
  }

  columns.forEach((_, i) => {
    ws.getColumn(i + 1).width = 18;
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenameBase}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Gera e faz download de um Excel formatado (lista de recebimentos). */
export async function exportarExcelListaRecebimentos(
  rows: Array<Record<string, unknown>>,
  columns: { key: string; label: string }[],
  filenameBase: string
): Promise<void> {
  return exportarExcelListaEmpenhos(rows, columns, filenameBase);
}

/** Abre janela de impressão em orientação horizontal (usuário pode "Salvar como PDF"). */
export function exportarPdfHorizontal(
  title: string,
  tableRef: HTMLTableElement | null,
  options?: { beforePrint?: () => void; afterPrint?: () => void }
): void {
  if (!tableRef) return;
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
          th { background: #145D50; color: #fff; }
          @media print { @page { size: landscape; } }
        </style>
      </head>
      <body>
        <h2>${title}</h2>
        <p>Gerado em ${new Date().toLocaleString('pt-BR')}</p>
        ${tableRef.outerHTML}
      </body>
    </html>
  `);
  win.document.close();
  options?.beforePrint?.();
  win.onload = () => {
    win.print();
    win.onafterprint = () => {
      options?.afterPrint?.();
      win.close();
    };
  };
}
