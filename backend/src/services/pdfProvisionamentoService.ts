import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

/** Opções de página: A4 em orientação horizontal para exibir tabela e textos por completo. */
const PDF_OPTS = { size: 'A4' as const, layout: 'landscape' as const, margin: 40 };
/** Largura útil em landscape A4 (842 - 80 margens). */
const PAGE_WIDTH = 762;
/** Altura útil em landscape A4 (595 - 80 margens). Limite para quebra de página. */
const PAGE_HEIGHT = 515;
const START_Y = 50;
const RIGHT_EDGE = 50 + PAGE_WIDTH;

/** Posições das colunas da tabela (orientação horizontal). */
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

export interface LinhaProvisionamentoPDF {
  numero_registro?: string;
  vigencia?: string;
  valor_unitario?: number;
  qtde_pedida: number;
  observacao?: string;
  valor_total: number;
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

  doc.fontSize(11).font('Helvetica-Bold').text('Itens solicitados', { underline: true });
  doc.moveDown(0.5);

  let y = doc.y;
  const headerY = y;
  doc.fontSize(9).font('Helvetica-Bold');
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

  doc.fontSize(9).font('Helvetica');
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
    doc.text(linha.vigencia ?? '-', COLS.vigencia, y);
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
  doc.text(`Total geral: R$ ${totalGeral.toFixed(2)}`, 50, doc.y, { width: PAGE_WIDTH, align: 'right' });

  doc.end();
  return stream;
}

export interface MaterialProvisionamentoPDF {
  codigoMaterial: string;
  descricao?: string | null;
  /** Média de consumo dos últimos 6 meses (exibida na tabela). */
  mediaConsumo6Meses?: number;
  linhas: LinhaProvisionamentoPDF[];
}

export interface DadosPDFConsolidado {
  dataGeracao: string;
  materiais: MaterialProvisionamentoPDF[];
}

/**
 * Gera um PDF consolidado em orientação horizontal; tabela com dados completos e coluna "Média consumo (6 meses)".
 */
export function gerarPDFProvisionamentoConsolidado(dados: DadosPDFConsolidado): Readable {
  const doc = new PDFDocument(PDF_OPTS);
  const stream = new Readable();
  stream._read = () => {};

  doc.on('data', (chunk) => stream.push(chunk));
  doc.on('end', () => stream.push(null));
  doc.on('error', (err) => stream.destroy(err));

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

    // Nome do material: fonte menor e espaço reservado pela altura real do texto (evita sobreposição)
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

    // Cabeçalho da tabela
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Registro', COLS.registro, y);
    doc.text('Média 6 m', COLS.mediaConsumo, y);
    doc.text('Vigência', COLS.vigencia, y);
    doc.text('Valor unit.', COLS.valorUnit, y);
    doc.text('Qtde pedida', COLS.qtdePedida, y);
    doc.text('Valor total', COLS.valorTotal, y);
    doc.text('Observação', COLS.observacao, y);
    y += 14;
    doc.moveTo(50, y).lineTo(RIGHT_EDGE, y).stroke();
    y += 12;

    const mediaStr =
      material.mediaConsumo6Meses != null
        ? material.mediaConsumo6Meses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '-';

    doc.fontSize(9).font('Helvetica');
    for (const linha of material.linhas) {
      if (y > PAGE_HEIGHT - 50) {
        doc.addPage(PDF_OPTS);
        y = START_Y;
      }
      doc.text(linha.numero_registro ?? '-', COLS.registro, y);
      doc.text(mediaStr, COLS.mediaConsumo, y);
      doc.text(linha.vigencia ?? '-', COLS.vigencia, y);
      doc.text(linha.valor_unitario != null ? linha.valor_unitario.toFixed(2) : '-', COLS.valorUnit, y);
      doc.text(String(linha.qtde_pedida), COLS.qtdePedida, y);
      doc.text(linha.valor_total.toFixed(2), COLS.valorTotal, y);
      const obsText = linha.observacao ?? '-';
      const obsHeight = doc.heightOfString(obsText, { width: COLS.observacaoWidth });
      doc.text(obsText, COLS.observacao, y, { width: COLS.observacaoWidth });
      y += Math.max(14, obsHeight + 2);
      doc.y = y;
    }

    const totalMaterial = material.linhas.reduce((s, l) => s + l.valor_total, 0);
    y += 6;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`Total do material: R$ ${totalMaterial.toFixed(2)}`, COLS.valorTotal, y, { width: PAGE_WIDTH - (COLS.valorTotal - 50), align: 'right' });
    y += 22;

    if (i < dados.materiais.length - 1) y += 8;
  }

  doc.moveDown(1);
  const totalGeral = dados.materiais.reduce(
    (s, m) => s + m.linhas.reduce((s2, l) => s2 + l.valor_total, 0),
    0
  );
  doc.fontSize(12).font('Helvetica-Bold');
  doc.text(`Total geral: R$ ${totalGeral.toFixed(2)}`, 50, doc.y, { width: PAGE_WIDTH, align: 'right' });

  doc.end();
  return stream;
}
