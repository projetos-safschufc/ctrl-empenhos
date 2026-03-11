import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

/** Opções de página: A4 em orientação horizontal para exibir tabela e textos por completo. */
const PDF_OPTS = { size: 'A4' as const, layout: 'landscape' as const, margin: 30 };
/** Largura útil em landscape A4 (842 - 80 margens). */
const PAGE_WIDTH = 762;
/** Altura útil em landscape A4 (595 - 80 margens). Limite para quebra de página. */
const PAGE_HEIGHT = 515;
const START_Y = 50;
const RIGHT_EDGE = 50 + PAGE_WIDTH;

/** Posições e larguras das colunas da tabela consolidada (orientação horizontal, fonte 8). */
const COLS_CONSOL = {
  consumo1: 50,
  consumo2: 78,
  consumo3: 106,
  consumo4: 134,
  consumo5: 162,
  consumo6: 190,
  consumo7: 218,
  mediaConsumo: 246,
  estoqueAlmox: 286,
  cobertura: 326,
  registro: 361,
  saldoRegistro: 401,
  vigencia: 441,
  valorUnit: 491,
  qtdePedida: 531,
  valorTotal: 566,
  observacao: 611,
  observacaoWidth: RIGHT_EDGE - 611,
};

/** Largura de cada coluna para quebra de linha nos cabeçalhos (em pontos). */
const COLS_CONSOL_HEADER_WIDTHS: {
  consumo1: number;
  consumo2: number;
  consumo3: number;
  consumo4: number;
  consumo5: number;
  consumo6: number;
  consumo7: number;
  mediaConsumo: number;
  estoqueAlmox: number;
  cobertura: number;
  registro: number;
  saldoRegistro: number;
  vigencia: number;
  valorUnit: number;
  qtdePedida: number;
  valorTotal: number;
  observacao: number;
} = {
  consumo1: 26,
  consumo2: 26,
  consumo3: 26,
  consumo4: 26,
  consumo5: 26,
  consumo6: 26,
  consumo7: 26,
  mediaConsumo: 38,
  estoqueAlmox: 38,
  cobertura: 33,
  registro: 38,
  saldoRegistro: 38,
  vigencia: 48,
  valorUnit: 38,
  qtdePedida: 33,
  valorTotal: 43,
  observacao: COLS_CONSOL.observacaoWidth,
};

/** Posições para PDF simples (um material) - mantido para compatibilidade. */
const COLS = {
  registro: 50,
  mediaConsumo: 127,
  vigencia: 210,
  valorUnit: 303,
  qtdePedida: 380,
  valorTotal: 457,
  observacao: 540,
  observacaoWidth: RIGHT_EDGE - 540,
};

/** Retorna os 7 rótulos de consumo (mês-6 … mês atual) para o PDF. Ano em 2 dígitos (YY), ex.: Set/25, Atual (Mar/26). */
function getConsumoHeadersPdf(): string[] {
  const now = new Date();
  const labels: string[] = [];
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mes = d.getMonth();
    const anoYY = String(d.getFullYear()).slice(-2);
    labels.push(`${meses[mes]}/${anoYY}`);
  }
  if (labels.length >= 7) labels[6] = `Atual (${labels[6]})`;
  return labels;
}

/** Converte data ISO (YYYY-MM-DD) para exibição DD/MM/YYYY. Retorna '-' se inválido ou vazio. */
function formatarDataDDMMYYYY(v: string | null | undefined): string {
  if (v == null || String(v).trim() === '') return '-';
  const s = String(v).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return s;
}

/** Formata valor monetário para exibição no PDF: R$ ##.###,00 (locale pt-BR). */
function formatarMoedaBRL(valor: number | null | undefined): string {
  if (valor == null || Number.isNaN(valor)) return '-';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Formata número inteiro com separador de milhares pt-BR: ##.### */
function formatarInteiroPTBR(valor: number | null | undefined): string {
  if (valor == null || Number.isNaN(valor)) return '-';
  return Math.round(valor).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

export interface LinhaProvisionamentoPDF {
  numero_registro?: string;
  vigencia?: string;
  valor_unitario?: number;
  qtde_pedida: number;
  observacao?: string;
  valor_total: number;
  saldo_registro?: number | null;
}

export interface DadosPDF {
  codigoMaterial: string;
  descricao?: string | null;
  dataGeracao: string;
  linhas: LinhaProvisionamentoPDF[];
  /** Média de consumo dos últimos 6 meses (opcional). */
  mediaConsumo6Meses?: number;
}

/**
 * Gera um PDF de provisionamento (um material) em orientação horizontal.
 */
export function gerarPDFProvisionamento(dados: DadosPDF): Readable {
  const doc = new PDFDocument(PDF_OPTS);
  const stream = new Readable();
  stream._read = () => {};

  doc.on('data', (chunk) => stream.push(chunk));
  doc.on('end', () => stream.push(null));
  doc.on('error', (err) => stream.destroy(err));

  doc.fontSize(18).text('Provisionamento - Pedido de Material', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  const materialTexto = dados.descricao
    ? `${dados.codigoMaterial} - ${dados.descricao}`
    : dados.codigoMaterial;
  const materialLabel = `Material: ${materialTexto}`;
  const materialH = doc.heightOfString(materialLabel, { width: PAGE_WIDTH });
  doc.text(materialLabel, 50, doc.y, { width: PAGE_WIDTH, align: 'left' });
  doc.y += materialH + 8;
  doc.text(`Data de geração: ${dados.dataGeracao}`);
  doc.moveDown(1);

  doc.fontSize(8).font('Helvetica-Bold').text('Itens solicitados', { underline: true });
  doc.moveDown(0.5);

  let y = doc.y;
  const headerY = y;
  doc.fontSize(8).font('Helvetica-Bold');
  doc.text('Registro', COLS.registro, headerY);
  doc.text('Média 6 m', COLS.mediaConsumo, headerY);
  doc.text('Vigência', COLS.vigencia, headerY);
  doc.text('Valor unit.', COLS.valorUnit, headerY);
  doc.text('Qtde pedida', COLS.qtdePedida, headerY);
  doc.text('Valor total', COLS.valorTotal, headerY);
  doc.text('Observação', COLS.observacao, headerY);
  y += 14;
  doc.moveTo(50, y).lineTo(RIGHT_EDGE, y).stroke();
  y += 12;

  doc.fontSize(8).font('Helvetica');
  const mediaStr =
    dados.mediaConsumo6Meses != null
      ? dados.mediaConsumo6Meses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '-';
  for (const linha of dados.linhas) {
    if (y > PAGE_HEIGHT - 40) {
      doc.addPage(PDF_OPTS);
      y = START_Y;
    }
    doc.text(linha.numero_registro ?? '-', COLS.registro, y);
    doc.text(mediaStr, COLS.mediaConsumo, y);
    doc.text(linha.vigencia ?? '/-/-', COLS.vigencia, y);/*formatado para dd/mm/yyyy*/
    doc.text(linha.valor_unitario != null ? linha.valor_unitario.toFixed(2) : '-', COLS.valorUnit, y);
    doc.text(String(linha.qtde_pedida), COLS.qtdePedida, y);
    doc.text(linha.valor_total.toFixed(2), COLS.valorTotal, y);
    const obsLines = doc.heightOfString(linha.observacao ?? '-', { width: COLS.observacaoWidth });
    doc.text(linha.observacao ?? '-', COLS.observacao, y, { width: COLS.observacaoWidth });
    y += Math.max(16, obsLines + 4);
    doc.y = y;
  }

  doc.moveDown(1);
  const totalGeral = dados.linhas.reduce((s, l) => s + l.valor_total, 0);
  doc.fontSize(11).font('Helvetica-Bold');
  doc.text(`Total geral: ${formatarMoedaBRL(totalGeral)}`, 50, doc.y, { width: PAGE_WIDTH, align: 'right' });

  doc.end();
  return stream;
}

export interface MaterialProvisionamentoPDF {
  codigoMaterial: string;
  descricao?: string | null;
  /** Média de consumo dos últimos 6 meses (exibida na tabela). */
  mediaConsumo6Meses?: number;
  /** Consumo por mês [mês-6 … mês atual] (7 valores). */
  consumosPorMes?: number[];
  /** Estoque em almoxarifados. */
  estoqueAlmoxarifados?: number;
  /** Cobertura de estoque em meses. */
  coberturaEstoque?: number | null;
  linhas: LinhaProvisionamentoPDF[];
}

export interface DadosPDFConsolidado {
  dataGeracao: string;
  materiais: MaterialProvisionamentoPDF[];
}

/**
 * Gera um PDF consolidado em orientação horizontal; tabela com consumos mensais, média, estoque, cobertura, registro, saldo, vigência, valor, qtde e observação.
 */
export function gerarPDFProvisionamentoConsolidado(dados: DadosPDFConsolidado): Readable {
  const doc = new PDFDocument(PDF_OPTS);
  const stream = new Readable();
  stream._read = () => {};

  doc.on('data', (chunk) => stream.push(chunk));
  doc.on('end', () => stream.push(null));
  doc.on('error', (err) => stream.destroy(err));

  const consumoHeaders = getConsumoHeadersPdf();
  const C = COLS_CONSOL;

  doc.fontSize(18).font('Helvetica-Bold').text('Provisionamento Consolidado - Pedido de Materiais', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica').text(`Data de geração: ${dados.dataGeracao}`);
  doc.moveDown(1.5);

  let y = doc.y;

  for (let i = 0; i < dados.materiais.length; i++) {
    const material = dados.materiais[i];

    if (y > PAGE_HEIGHT - 120) {
      doc.addPage(PDF_OPTS);
      y = START_Y;
    }

    doc.fontSize(10).font('Helvetica-Bold');
    const materialLabel = `Material: ${material.codigoMaterial}`;
    const materialHeight = doc.heightOfString(materialLabel, { width: PAGE_WIDTH });
    doc.text(materialLabel, 50, y, { width: PAGE_WIDTH });
    y += materialHeight + 6;
    if (material.descricao) {
      doc.fontSize(9).font('Helvetica');
      const descH = doc.heightOfString(material.descricao, { width: PAGE_WIDTH });
      doc.text(material.descricao, 50, y, { width: PAGE_WIDTH });
      y += descH + 6;
    }
    y += 8;

    // Cabeçalho da tabela com quebra de linha por coluna (fonte 8)
    doc.fontSize(7).font('Helvetica-Bold');
    const headerStartY = y;
    const colSpecs: { x: number; width: number; label: string }[] = [
      { x: C.consumo1, width: COLS_CONSOL_HEADER_WIDTHS.consumo1, label: consumoHeaders[0] ?? 'M-6' },
      { x: C.consumo2, width: COLS_CONSOL_HEADER_WIDTHS.consumo2, label: consumoHeaders[1] ?? 'M-5' },
      { x: C.consumo3, width: COLS_CONSOL_HEADER_WIDTHS.consumo3, label: consumoHeaders[2] ?? 'M-4' },
      { x: C.consumo4, width: COLS_CONSOL_HEADER_WIDTHS.consumo4, label: consumoHeaders[3] ?? 'M-3' },
      { x: C.consumo5, width: COLS_CONSOL_HEADER_WIDTHS.consumo5, label: consumoHeaders[4] ?? 'M-2' },
      { x: C.consumo6, width: COLS_CONSOL_HEADER_WIDTHS.consumo6, label: consumoHeaders[5] ?? 'M-1' },
      { x: C.consumo7, width: COLS_CONSOL_HEADER_WIDTHS.consumo7, label: consumoHeaders[6] ?? 'Atual' },
      { x: C.mediaConsumo, width: COLS_CONSOL_HEADER_WIDTHS.mediaConsumo, label: 'Média 6m' },
      { x: C.estoqueAlmox, width: COLS_CONSOL_HEADER_WIDTHS.estoqueAlmox, label: 'Est. Alm.' },
      { x: C.cobertura, width: COLS_CONSOL_HEADER_WIDTHS.cobertura, label: 'Cob.' },
      { x: C.registro, width: COLS_CONSOL_HEADER_WIDTHS.registro, label: 'Registro' },
      { x: C.saldoRegistro, width: COLS_CONSOL_HEADER_WIDTHS.saldoRegistro, label: 'Saldo reg.' },
      { x: C.vigencia, width: COLS_CONSOL_HEADER_WIDTHS.vigencia, label: 'Vigência' },
      { x: C.valorUnit, width: COLS_CONSOL_HEADER_WIDTHS.valorUnit, label: 'Val. unit.' },
      { x: C.qtdePedida, width: COLS_CONSOL_HEADER_WIDTHS.qtdePedida, label: 'Qtde' },
      { x: C.valorTotal, width: COLS_CONSOL_HEADER_WIDTHS.valorTotal, label: 'Val. total' },
      { x: C.observacao, width: COLS_CONSOL_HEADER_WIDTHS.observacao, label: 'Observação' },
    ];
    let headerRowHeight = 0;
    for (const spec of colSpecs) {
      const cellHeight = doc.heightOfString(spec.label, { width: spec.width });
      if (cellHeight > headerRowHeight) headerRowHeight = cellHeight;
    }
    for (const spec of colSpecs) {
      doc.y = headerStartY;
      doc.text(spec.label, spec.x, headerStartY, { width: spec.width });
    }
    y = headerStartY + headerRowHeight + 4;
    doc.moveTo(50, y).lineTo(RIGHT_EDGE, y).stroke();
    y += 10;

    const consumos = material.consumosPorMes ?? [];
    const mediaStr =
      material.mediaConsumo6Meses != null
        ? material.mediaConsumo6Meses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '-';
    const estoqueStr = formatarInteiroPTBR(material.estoqueAlmoxarifados);
    const coberturaStr =
      material.coberturaEstoque != null
        ? material.coberturaEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
        : '-';

    doc.fontSize(7).font('Helvetica');
    for (const linha of material.linhas) {
      if (y > PAGE_HEIGHT - 50) {
        doc.addPage(PDF_OPTS);
        y = START_Y;
      }
      const consumoColWidth = COLS_CONSOL_HEADER_WIDTHS.consumo1;
      for (let c = 0; c < 7; c++) {
        const val = consumos[c] ?? 0;
        const x = [C.consumo1, C.consumo2, C.consumo3, C.consumo4, C.consumo5, C.consumo6, C.consumo7][c];
        doc.text(String(val), x, y, { width: consumoColWidth, align: 'center' });
      }
      doc.text(mediaStr, C.mediaConsumo, y);
      doc.text(estoqueStr, C.estoqueAlmox, y);
      doc.text(coberturaStr, C.cobertura, y);
      doc.text(linha.numero_registro ?? '-', C.registro, y);
      doc.text(formatarInteiroPTBR(linha.saldo_registro), C.saldoRegistro, y);
      doc.text(formatarDataDDMMYYYY(linha.vigencia), C.vigencia, y);
      doc.text(formatarMoedaBRL(linha.valor_unitario), C.valorUnit, y);
      doc.text(String(linha.qtde_pedida), C.qtdePedida, y);
      doc.text(formatarMoedaBRL(linha.valor_total), C.valorTotal, y);
      const obsText = linha.observacao ?? '-';
      const obsHeight = doc.heightOfString(obsText, { width: C.observacaoWidth });
      doc.text(obsText, C.observacao, y, { width: C.observacaoWidth });
      y += Math.max(12, obsHeight + 2);
      doc.y = y;
    }

    const totalMaterial = material.linhas.reduce((s, l) => s + l.valor_total, 0);
    y += 6;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`Total do material: ${formatarMoedaBRL(totalMaterial)}`, C.valorTotal, y, { width: PAGE_WIDTH - (C.valorTotal - 50), align: 'right' });
    y += 22;

    if (i < dados.materiais.length - 1) y += 8;
  }

  doc.moveDown(1);
  const totalGeral = dados.materiais.reduce(
    (s, m) => s + m.linhas.reduce((s2, l) => s2 + l.valor_total, 0),
    0
  );
  doc.fontSize(12).font('Helvetica-Bold');
  doc.text(`Total geral: ${formatarMoedaBRL(totalGeral)}`, 50, doc.y, { width: PAGE_WIDTH, align: 'right' });

  doc.end();
  return stream;
}
