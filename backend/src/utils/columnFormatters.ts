/**
 * columnFormatters.ts
 * Formatadores e validadores para as colunas 6-12 da tela Controle de Empenhos.
 * 
 * Colunas 6-12:
 * 6. Consumo Mês-6 (7 colunas: mês-6, -5, -4, -3, -2, -1, atual)
 * 7-8. Média 6 meses; coluna "Última" (mês, qtde)
 * 9-12. Estoque almox., Estoque geral, Saldo empenhos
 */

/**
 * Valida e normaliza valor de consumo.
 * Consumo deve ser número >= 0.
 * Retorna 0 se null, undefined, ou valor não-numérico.
 */
export function validarConsumo(valor: unknown): number {
  if (valor === null || valor === undefined) return 0;
  const n = Number(valor);
  if (Number.isNaN(n) || n < 0) return 0;
  return Math.floor(n);
}

/**
 * Valida múltiplos consumos (ex.: 7 meses de consumo).
 * Retorna array com mesmo tamanho, zerando valores inválidos.
 */
export function validarConsumos(valores: unknown[]): number[] {
  return valores.map((v) => validarConsumo(v));
}

/**
 * Calcula média de consumo excluindo zeros.
 * Se todos os valores são 0, retorna 0.
 * Usado para cálculo da "Média 6 meses".
 * 
 * @param consumos Array com consumos (ex.: últimos 6 meses, com mês atual excluído)
 * @returns Média apenas dos meses com consumo > 0
 */
export function calcularMediaConsumoValidos(consumos: number[]): number {
  const validos = consumos.filter((c) => c > 0);
  if (validos.length === 0) return 0;
  const soma = validos.reduce((s, c) => s + c, 0);
  return soma / validos.length;
}

/**
 * Formata número inteiro como string com separador de milhares (ponto).
 * Ex.: 19534 → "19.534", 1000000 → "1.000.000"
 */
export function formatarInteiroPontosEspacos(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '-';
  const n = Number(valor);
  if (Number.isNaN(n)) return '-';
  const int = Math.round(Math.abs(n));
  return int.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Formata número decimal com N casas decimais, sempre exibindo positivo.
 * Ex.: -15.527 → "15.53" (com decimals=2)
 */
export function formatarDecimalPositivo(
  valor: number | null | undefined,
  decimals: number = 2
): string {
  if (valor === null || valor === undefined) return '-';
  const n = Number(valor);
  if (Number.isNaN(n)) return '-';
  const display = Math.abs(n);
  return display.toFixed(decimals);
}

/**
 * Formata MESANO (inteiro YYYYMM) em formato MM/YYYY.
 * Ex.: 202502 → "02/2025"
 */
export function formatarMesanoMMYYYY(mesano: number | null | undefined): string {
  if (mesano === null || mesano === undefined) return '-';
  const n = Number(mesano);
  if (Number.isNaN(n) || n <= 0) return '-';
  const str = String(n).padStart(6, '0');
  const mm = str.substring(2, 4);
  const yyyy = str.substring(0, 4);
  return `${mm}/${yyyy}`;
}

/**
 * Valida e normaliza estoque (saldo).
 * Estoque/saldo deve ser >= 0.
 */
export function validarEstoque(valor: unknown): number {
  if (valor === null || valor === undefined) return 0;
  const n = Number(valor);
  if (Number.isNaN(n) || n < 0) return 0;
  return n;
}

/**
 * Calcula cobertura de estoque: (Estoque Almox + Saldo Empenhos) / Média Consumo.
 * Retorna null se média consumo <= 0 (impossível calcular cobertura).
 */
export function calcularCoberturaBatch(
  estoqueAlmox: number,
  saldoEmpenhos: number,
  mediaConsumo: number
): number | null {
  if (mediaConsumo <= 0) return null;
  return (estoqueAlmox + saldoEmpenhos) / mediaConsumo;
}

/**
 * Valida data de vigência em formato string (DD/MM/YYYY ou ISO).
 * Retorna true se data é válida e >= hoje.
 */
export function validarVigencia(vigencia: string | null | undefined): boolean {
  if (!vigencia) return false;
  const d = parseData(vigencia);
  if (!d) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d >= hoje;
}

/**
 * Parseia data em formato DD/MM/YYYY ou ISO (YYYY-MM-DD).
 */
export function parseData(str: string): Date | null {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (!trimmed) return null;

  // Tenta DD/MM/YYYY
  const dmY = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmY) {
    const day = parseInt(dmY[1], 10);
    const month = parseInt(dmY[2], 10) - 1;
    const year = parseInt(dmY[3], 10);
    const d = new Date(year, month, day);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // Tenta ISO
  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) return d;

  return null;
}

/**
 * Interface para validação em batch das colunas 6-12.
 */
export interface DadosColunasControle {
  consumoMesMinus6: number;
  consumoMesMinus5: number;
  consumoMesMinus4: number;
  consumoMesMinus3: number;
  consumoMesMinus2: number;
  consumoMesMinus1: number;
  consumoMesAtual: number;
  mediaConsumo6Meses: number;
  mesUltimoConsumo: number | null;
  qtdeUltimoConsumo: number;
  estoqueAlmoxarifados: number;
  estoqueGeral: number;
  saldoEmpenhos: number;
}

/**
 * Valida todos os dados das colunas 6-12.
 * Normaliza valores, calcula média se necessário, valida ranges.
 */
export function validarDadosColunasControle(
  dados: Partial<DadosColunasControle> & {
    consumos?: number[];
    totalEstoque?: number;
  }
): DadosColunasControle {
  const consumos = [
    validarConsumo(dados.consumoMesMinus6),
    validarConsumo(dados.consumoMesMinus5),
    validarConsumo(dados.consumoMesMinus4),
    validarConsumo(dados.consumoMesMinus3),
    validarConsumo(dados.consumoMesMinus2),
    validarConsumo(dados.consumoMesMinus1),
    validarConsumo(dados.consumoMesAtual),
  ];

  // Média apenas dos 6 anteriores (excluindo mês atual)
  const consumos6Anteriores = consumos.slice(0, 6);
  const media = calcularMediaConsumoValidos(consumos6Anteriores);

  return {
    consumoMesMinus6: consumos[0],
    consumoMesMinus5: consumos[1],
    consumoMesMinus4: consumos[2],
    consumoMesMinus3: consumos[3],
    consumoMesMinus2: consumos[4],
    consumoMesMinus1: consumos[5],
    consumoMesAtual: consumos[6],
    mediaConsumo6Meses: media,
    mesUltimoConsumo: validarConsumo(dados.mesUltimoConsumo) > 0 ? dados.mesUltimoConsumo ?? null : null,
    qtdeUltimoConsumo: validarConsumo(dados.qtdeUltimoConsumo),
    estoqueAlmoxarifados: validarEstoque(dados.estoqueAlmoxarifados),
    estoqueGeral: validarEstoque(dados.estoqueGeral),
    saldoEmpenhos: validarEstoque(dados.saldoEmpenhos),
  };
}

/**
 * Log detalhado para debug das colunas 6-12 (apenas quando process.env.DEBUG=true).
 */
export function logColunasControle(
  materialId: number | string,
  master: string,
  dados: DadosColunasControle
): void {
  if (process.env.DEBUG !== 'true') return;
  console.log(
    `[ControleEmpenhos] Material ${materialId} (${master}):`,
    {
      consumos: [
        dados.consumoMesMinus6,
        dados.consumoMesMinus5,
        dados.consumoMesMinus4,
        dados.consumoMesMinus3,
        dados.consumoMesMinus2,
        dados.consumoMesMinus1,
        dados.consumoMesAtual,
      ],
      media: dados.mediaConsumo6Meses,
      estoques: {
        almox: dados.estoqueAlmoxarifados,
        geral: dados.estoqueGeral,
        saldo: dados.saldoEmpenhos,
      },
    }
  );
}
