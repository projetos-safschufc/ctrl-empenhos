/**
 * Cálculos e regras de negócio reutilizáveis do Controle de Empenhos.
 * Regras de STATUS e storytelling (tooltip) conforme especificação do usuário.
 */

import {
  validarConsumo,
  calcularMediaConsumoValidos,
  validarEstoque,
  parseData,
} from '../../utils/columnFormatters';
import type { RegistroConsumoEstoque } from '../../repositories/consumoEstoqueRepository';

export type StatusItem = 'Normal' | 'Atenção' | 'Crítico';

/** Entrada para cálculo do status e geração do texto explicativo (tooltip). */
export interface StatusInput {
  estoqueAlmoxarifados: number;
  estoqueGeral: number;
  /** Qtde a receber = Saldo empenhos */
  saldoEmpenhos: number;
  estoqueVirtual: number;
  /** Cobertura = estoque virtual / média 6 meses (null = infinita quando média = 0) */
  coberturaEstoque: number | null;
  mediaConsumo6Meses: number;
  /** Valor do campo "Mês Atual" (ex.: Mar/2026) para projeção */
  consumoMesAtual: number;
  consumos6Meses: number[];
  mesUltimoConsumo: number | null;
  vigenciaRegistro: string | null;
  /** Saldo registro (campo "Saldo registro") */
  saldoRegistro: number | null;
  comRegistro: boolean;
  numeroPreEmpenho: string | null;
}

/** Resultado do cálculo de status com texto para tooltip. */
export interface StatusComDetalhes {
  status: StatusItem;
  statusDetails: string;
}

/** Retorna o mesano atual no formato YYYYMM (data do servidor). */
function getMesanoAtual(): number {
  const d = new Date();
  return d.getFullYear() * 100 + (d.getMonth() + 1);
}

/** Dia atual do mês (1-31) para projeção do consumo do mês. */
function getDiaAtualDoMes(): number {
  return new Date().getDate();
}

/** Quantidade de meses entre um mesano e o mês atual. */
function mesesAteHoje(mesano: number | null): number | null {
  if (mesano == null) return null;
  const now = getMesanoAtual();
  const anoMes = Math.floor(mesano / 100) * 12 + (mesano % 100);
  const nowAnoMes = Math.floor(now / 100) * 12 + (now % 100);
  return nowAnoMes - anoMes;
}

/** Formata mesano (YYYYMM) para exibição "Mês/Ano". */
function formatMesanoLabel(mesano: number): string {
  const s = String(mesano).padStart(6, '0');
  const ano = s.slice(0, 4);
  const mes = parseInt(s.slice(4, 6), 10);
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${nomes[mes - 1]}/${ano}`;
}

function vigenciaVencida(vigenciaStr: string | null): boolean {
  if (!vigenciaStr) return true;
  const d = parseData(vigenciaStr);
  if (!d) return true;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d <= hoje;
}

/** Vigência em meses a partir de hoje. */
function vigenciaEmMeses(vigenciaStr: string | null): number | null {
  if (!vigenciaStr) return null;
  const d = parseData(vigenciaStr);
  if (!d) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diffMs = d.getTime() - hoje.getTime();
  return Math.floor(diffMs / (30.44 * 24 * 60 * 60 * 1000));
}

// ========== Cobertura ==========
// Cobertura de estoque = estoque virtual / média 6 meses.
// Se média 6 meses = 0 → cobertura infinita (null), exceto: estoque = 0 e consumo recente > 0 → tratar como sem cobertura.

/**
 * Cobertura baseada em estoque virtual (estoque almox + saldo empenhos) / média 6 meses.
 * Retorna null quando média = 0 (cobertura infinita).
 */
export function calcularCoberturaEstoqueVirtual(
  estoqueVirtual: number,
  mediaConsumo: number
): number | null {
  const ev = validarEstoque(estoqueVirtual);
  const media = validarConsumo(mediaConsumo);
  if (media <= 0) return null;
  return ev / media;
}

/** Mantida para compatibilidade (ex.: coluna histórica). Usar estoque virtual no controle de empenho. */
export function calcularCobertura(estoqueAlmox: number, mediaConsumo: number): number | null {
  const estoqueAlmoxValidado = validarEstoque(estoqueAlmox);
  const mediaValidada = validarConsumo(mediaConsumo);
  if (mediaValidada <= 0) return null;
  const cobertura = estoqueAlmoxValidado / mediaValidada;
  if (cobertura === estoqueAlmoxValidado && estoqueAlmoxValidado > 0) {
    console.warn(
      `[Cobertura] Possível erro: estoque=${estoqueAlmoxValidado}, media=${mediaValidada}, cobertura=${cobertura}`
    );
  }
  return cobertura;
}

// ========== Regras exatas de STATUS (avaliar na ordem) ==========
// 1. CRÍTICO: cobertura < 1 E qtde a receber = 0 E saldo registro = 0 (todas as 3).
// 2. ATENÇÃO: não crítico E pelo menos uma das 6 combinações.
// 3. NORMAL: resto.

/** Efetivamente < 1 (ou sem cobertura quando média=0 e estoque=0 e consumo>0). */
function coberturaMenorQueUm(
  cobertura: number | null,
  estoqueVirtual: number,
  consumoMesAtual: number,
  media: number
): boolean {
  if (cobertura != null) return cobertura < 1;
  // Média = 0 → cobertura infinita → não é < 1, exceto: estoque = 0 e consumo recente > 0
  if (media === 0 && estoqueVirtual === 0 && consumoMesAtual > 0) return true;
  return false;
}

/** Efetivamente >= 1 e < 3. Cobertura null (infinita) não está nesse intervalo. */
function coberturaEntreUmETres(cobertura: number | null): boolean {
  return cobertura != null && cobertura >= 1 && cobertura < 3;
}

/**
 * Calcula apenas o status conforme as regras exatas (para dashboard e filtros).
 * Não gera o texto do tooltip.
 */
export function calculateStatus(input: StatusInput): StatusItem {
  const qtdeReceber = input.saldoEmpenhos;
  const saldoReg = input.saldoRegistro ?? 0;
  const cobertura = input.coberturaEstoque;
  const media = input.mediaConsumo6Meses;
  const cobMenorUm = coberturaMenorQueUm(
    cobertura,
    input.estoqueVirtual,
    input.consumoMesAtual,
    media
  );

  // 1. CRÍTICO: apenas se TODAS as três condições
  if (cobMenorUm && qtdeReceber === 0 && saldoReg === 0) return 'Crítico';

  // 2. ATENÇÃO: não crítico e pelo menos uma das combinações
  const cobEntreUmETres = coberturaEntreUmETres(cobertura);

  if (cobMenorUm && qtdeReceber > 0 && saldoReg === 0) return 'Atenção';
  if (cobMenorUm && qtdeReceber === 0 && saldoReg > 0) return 'Atenção';
  if (cobMenorUm && qtdeReceber > 0 && saldoReg > 0) return 'Atenção';
  if (cobEntreUmETres && qtdeReceber > 0 && saldoReg === 0) return 'Atenção';
  if (cobEntreUmETres && qtdeReceber === 0 && saldoReg > 0) return 'Atenção';
  if (cobEntreUmETres && qtdeReceber > 0 && saldoReg > 0) return 'Atenção';

  // 3. NORMAL
  return 'Normal';
}

// ========== Storytelling (tooltip) ==========

function buildStatusDetails(input: StatusInput, status: StatusItem): string {
  const media = input.mediaConsumo6Meses;
  const qtdeReceber = input.saldoEmpenhos;
  const saldoReg = input.saldoRegistro ?? 0;
  const consumoMesAtual = input.consumoMesAtual;
  const cobertura = input.coberturaEstoque;

  const linhas: string[] = [];

  // 1. Linha 1: Situação (em negrito via markdown/caps)
  linhas.push(`Situação: ${status.toUpperCase()}`);
  linhas.push('');

  // 2. Cobertura: X.X meses (valor exato 1 casa decimal)
  const coberturaExibir =
    cobertura != null
      ? cobertura.toFixed(1)
      : media === 0 && input.estoqueVirtual === 0 && consumoMesAtual > 0
        ? '0.0'
        : '—';
  linhas.push(`Cobertura de estoque: ${coberturaExibir} meses`);

  // 3. Qtde a receber e Saldo registro
  linhas.push(`Qtde a receber (empenhos): ${qtdeReceber} unidades`);
  linhas.push(`Saldo de registro disponível: ${saldoReg} unidades`);
  linhas.push('');

  // 4. Detecção de Consumo Abrupto
  linhas.push('Detecção de Consumo Abrupto:');
  const diaAtual = getDiaAtualDoMes();
  const projecaoMesAtual = diaAtual > 0 ? (consumoMesAtual / diaAtual) * 30 : consumoMesAtual;
  const mediaDiariaAprox = media / 30;
  linhas.push(`Projeção de consumo do mês atual: ${Math.round(projecaoMesAtual)} un/mês`);
  linhas.push(`Média diária aproximada: ${mediaDiariaAprox.toFixed(2)} un/dia`);

  let alertaTexto: string;
  if (media > 0) {
    const variacaoPct =
      projecaoMesAtual > media
        ? ((projecaoMesAtual - media) / media) * 100
        : projecaoMesAtual < media
          ? ((media - projecaoMesAtual) / media) * 100
          : 0;
    const variacaoArred = Math.round(variacaoPct);
    if (projecaoMesAtual > media) {
      linhas.push(`Crescimento no consumo em: ${variacaoArred}%`);
    } else if (projecaoMesAtual < media) {
      linhas.push(`Redução no consumo em: ${variacaoArred}%`);
    } else {
      linhas.push('Neutro (sem variação)');
    }

    const absVar = Math.abs(variacaoPct);
    if (absVar > 50) alertaTexto = 'ALERTA DE CONSUMO ABRUPTO';
    else if (absVar > 30 && absVar <= 50) alertaTexto = 'ALERTA DE CONSUMO MODERADO';
    else alertaTexto = 'Variação dentro do esperado';
  } else {
    linhas.push('Neutro (sem variação)');
    alertaTexto = 'Variação dentro do esperado';
  }
  linhas.push(alertaTexto);
  linhas.push('');

  // 5. Frase final de recomendação
  if (status === 'Crítico') linhas.push('Ação urgente: iniciar reposição imediata.');
  else if (status === 'Atenção') linhas.push('Monitorar estoque e empenhos nos próximos 15–30 dias.');
  else linhas.push('Situação controlada no momento.');

  return linhas.join('\n');
}

/**
 * Calcula o status e gera o texto completo para o tooltip (storytelling).
 * Regras exatas: CRÍTICO só quando cobertura < 1 E qtde a receber = 0 E saldo registro = 0;
 * ATENÇÃO pelas 6 combinações; NORMAL caso contrário.
 */
export function calcularStatusComDetalhes(input: StatusInput): StatusComDetalhes {
  const status = calculateStatus(input);
  const statusDetails = buildStatusDetails(input, status);
  return { status, statusDetails };
}

/** Alias para compatibilidade com código que chama calculateStatusAndDetails. */
export function calculateStatusAndDetails(input: StatusInput): StatusComDetalhes {
  return calcularStatusComDetalhes(input);
}

/** Meses para colunas de consumo: [mês atual -6, ..., mês atual -1, mês atual] */
export function getMesesParaColunasConsumo(): number[] {
  const now = new Date();
  const meses: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    meses.push(d.getFullYear() * 100 + (d.getMonth() + 1));
  }
  return meses;
}

/** Média apenas dos 6 meses anteriores (mês atual -6 a -1), só meses com consumo > 0 */
export function calcularMediaConsumo6MesesAnteriores(
  consumosPorMes: { mesano: number; total: number }[],
  mesanoAtual: number
): number {
  const anteriores = consumosPorMes
    .filter((c) => c.mesano < mesanoAtual)
    .map((c) => validarConsumo(c.total))
    .filter((total) => total > 0);
  if (anteriores.length === 0) return 0;
  return calcularMediaConsumoValidos(anteriores);
}

export function consumoPorMesano(consumos: { mesano: number; total: number }[]): Record<number, number> {
  const map: Record<number, number> = {};
  for (const c of consumos) map[c.mesano] = c.total;
  return map;
}

/**
 * Status simplificado para dashboard/contagem (usa mesma regra que calculateStatus).
 * Mantido para compatibilidade onde só se precisa do status sem details.
 */
export function definirStatus(cobertura: number | null, comRegistro: boolean): StatusItem {
  if (!comRegistro) return 'Crítico';
  if (cobertura == null) return 'Normal';
  if (cobertura < 1) return 'Crítico';
  if (cobertura < 3) return 'Atenção';
  return 'Normal';
}

/**
 * Regra de exibição: exibir registro apenas quando numero_do_registro != "-"
 * AND fim_vigência > TODAY() AND qtde_a_empenhar > 0.
 */
export function filtrarRegistrosParaExibicao(registros: RegistroConsumoEstoque[]): RegistroConsumoEstoque[] {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return registros.filter((reg) => {
    const nr = reg.numero_registro != null ? String(reg.numero_registro).trim() : '';
    if (nr === '' || nr === '-') return false;
    const vigencia = reg.vigencia != null ? String(reg.vigencia).trim() : '';
    if (vigencia === '') return false;
    const fimVigencia = parseData(vigencia);
    if (!fimVigencia || fimVigencia <= hoje) return false;
    const qtdeAEmpenhar = reg.saldo_registro ?? 0;
    if (qtdeAEmpenhar <= 0) return false;
    return true;
  });
}
