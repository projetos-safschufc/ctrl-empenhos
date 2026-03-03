import ExcelJS from 'exceljs';
import { PLATAFORMA_COLORS } from '../constants/plataforma';
import type { ItemControleEmpenho } from '../api/client';
import { formatarDecimal, formatarMesano } from './columnRenderers';

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

/**
 * Exporta a tabela da tela Controle de Empenhos para Excel formatado.
 * Usa os dados já carregados (página atual), respeitando os filtros aplicados.
 */
export async function exportarExcelControleEmpenhos(
  itens: ItemControleEmpenho[],
  consumoHeaders: string[],
  filenameBase: string = 'controle-empenhos'
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Controle de Empenhos', {
    views: [{ state: 'frozen', ySplit: 1 }],
    pageSetup: { fitToPage: true, fitToWidth: 1, orientation: 'landscape' as const },
  });

  const headers = [
    'Classificação',
    'Resp ctrl',
    'Master/Descritivo',
    'Apres',
    ...consumoHeaders,
    'Média 6 meses',
    'Mês últ consumo',
    'Qtde últ consumo',
    'Estoque almox.',
    'Estoque geral',
    'Saldo empenhos',
    'Estoque virtual',
    'Cobertura estoque',
    'Pré-empenho',
    'Registro',
    'Vigência',
    'Saldo registro',
    'Valor unit. registro',
    'Qtde/emb.',
    'Class. XYZ',
    'Tipo armazen.',
    'Cap. estocagem',
    'Status',
    'Observação',
  ];

  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF' + (PLATAFORMA_COLORS.detalheSecundario?.replace('#', '') || '145D50') },
  };
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

  for (const item of itens) {
    const estoqueVirtual =
      item.estoqueVirtual != null && Number.isFinite(Number(item.estoqueVirtual))
        ? Number(item.estoqueVirtual)
        : (Number(item.estoqueAlmoxarifados) || 0) + (Number(item.saldoEmpenhos) || 0);
    const vigenciaStr =
      item.vigenciaRegistro != null && item.vigenciaRegistro !== ''
        ? (() => {
            const s = String(item.vigenciaRegistro).trim();
            const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (match) return `${match[3]}/${match[2]}/${match[1]}`;
            return s;
          })()
        : '-';

    const row = [
      item.classificacao ?? '-',
      item.respControle ?? '-',
      item.masterDescritivo ?? '-',
      item.apres ?? '-',
      Number(item.consumoMesMinus6) ?? 0,
      Number(item.consumoMesMinus5) ?? 0,
      Number(item.consumoMesMinus4) ?? 0,
      Number(item.consumoMesMinus3) ?? 0,
      Number(item.consumoMesMinus2) ?? 0,
      Number(item.consumoMesMinus1) ?? 0,
      Number(item.consumoMesAtual) ?? 0,
      formatarDecimal(item.mediaConsumo6Meses, 1) === '-' ? '' : formatarDecimal(item.mediaConsumo6Meses, 1),
      formatarMesano(item.mesUltimoConsumo),
      Number(item.qtdeUltimoConsumo) ?? 0,
      Number(item.estoqueAlmoxarifados) ?? 0,
      Number(item.estoqueGeral) ?? 0,
      Number(item.saldoEmpenhos) ?? 0,
      estoqueVirtual,
      item.coberturaEstoque != null ? formatarDecimal(item.coberturaEstoque, 1) : '-',
      item.numeroPreEmpenho ?? '-',
      item.registroMaster ?? '-',
      vigenciaStr,
      item.saldoRegistro != null ? formatarDecimal(item.saldoRegistro, 0) : '-',
      item.valorUnitRegistro != null ? 'R$ ' + formatarDecimal(item.valorUnitRegistro) : '-',
      item.qtdePorEmbalagem != null ? formatarDecimal(item.qtdePorEmbalagem) : '-',
      item.classificacaoXYZ ?? '-',
      item.tipoArmazenamento ?? '-',
      item.capacidadeEstocagem ?? '-',
      item.status ?? '-',
      (item.observacao ?? '-').toString(),
    ];
    ws.addRow(row);
  }

  const colCount = headers.length;
  for (let i = 1; i <= colCount; i++) {
    const col = ws.getColumn(i);
    if (col) col.width = i === 3 ? 50 : i <= 7 ? 14 : 16;
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenameBase}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
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
