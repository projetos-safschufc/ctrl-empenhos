/**
 * Cálculos e regras de negócio reutilizáveis do Controle de Empenhos.
 * Extraído do controleEmpenhoService para facilitar testes e manutenção.
 */

import {
  validarConsumo,
  calcularMediaConsumoValidos,
  validarEstoque,
  parseData,
} from '../../utils/columnFormatters';
import type { RegistroConsumoEstoque } from '../../repositories/consumoEstoqueRepository';

export type StatusItem = 'Normal' | 'Atenção' | 'Crítico';

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

export function definirStatus(cobertura: number | null, comRegistro: boolean): StatusItem {
  if (!comRegistro) return 'Crítico';
  if (cobertura == null) return 'Normal';
  if (cobertura < 1) return 'Crítico';
  if (cobertura < 3) return 'Atenção';
  return 'Normal';
}

export function consumoPorMesano(consumos: { mesano: number; total: number }[]): Record<number, number> {
  const map: Record<number, number> = {};
  for (const c of consumos) map[c.mesano] = c.total;
  return map;
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
