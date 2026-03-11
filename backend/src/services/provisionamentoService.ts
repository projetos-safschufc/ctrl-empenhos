import { catalogoRepository } from '../repositories/catalogoRepository';
import {
  getConsumosPorMaterialEMeses,
  getConsumosPorMastersEMeses,
} from '../repositories/movimentoRepository';
import {
  getTotaisEstoqueSaldo,
  getEstoqueESaldoPorMaterial,
  getTodosRegistrosAtivos,
  getConsumos6MesesPorMasters,
  RegistroConsumoEstoque,
} from '../repositories/consumoEstoqueRepository';

export interface DadosProvisionamentoMaterial {
  codigo: string;
  descricao: string | null;
  mediaConsumo: number;
  estoqueAlmoxarifados: number;
  estoqueVirtual: number; // estoque + saldo empenhos
  tempoAbastecimento: number | null; // estoque / media (meses)
  registros: RegistroConsumoEstoque[];
  /** Consumo por mês [mês-6 … mês atual] (7 valores). */
  consumosPorMes: number[];
  /** Cobertura em meses (estoqueVirtual / mediaConsumo). */
  coberturaEstoque: number | null;
}

/** Linha da tabela de provisionamento (registro ativo) para listagem completa. */
export interface LinhaProvisionamentoRegistroAtivo {
  id: string;
  codigo: string;
  descricao: string | null;
  mediaConsumo: number;
  estoqueAlmoxarifados: number;
  estoqueVirtual: number;
  tempoAbastecimento: number | null;
  numeroRegistro: string | null;
  saldoRegistro: number | null;
  vigencia: string | null;
  valorUnitario: number | null;
  qtdePedida: number;
  valorTotal: number;
  observacao: string;
  /** Consumo por mês: [mês-6, mês-5, …, mês-1, mês atual] (7 valores), alinhado aos cabeçalhos da Gestão de Estoque. */
  consumosPorMes: number[];
  /** Cobertura de estoque em meses (estoqueVirtual / mediaConsumo). Null quando mediaConsumo = 0. */
  coberturaEstoque: number | null;
}

function getMesesUltimos6(): number[] {
  const now = new Date();
  const meses: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    meses.push(d.getFullYear() * 100 + (d.getMonth() + 1));
  }
  return meses;
}

function calcularMedia(consumos: { mesano: number; total: number }[]): number {
  const comConsumo = consumos.filter((c) => c.total > 0);
  if (comConsumo.length === 0) return 0;
  return comConsumo.reduce((s, c) => s + c.total, 0) / comConsumo.length;
}

/** Retorna true se vigência (fim) for >= hoje (registro ainda vigente) ou se vigência for nula. */
function vigenciaEmVigor(vigencia: string | undefined): boolean {
  if (vigencia == null || vigencia === '') return true;
  const d = new Date(vigencia);
  if (Number.isNaN(d.getTime())) return true;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d.getTime() >= hoje.getTime();
}

/** Filtra registros: com saldo de registro > 0 (quando existir) e vigência ainda em vigor (>= hoje). */
function filtrarRegistrosProvisionamento(registros: RegistroConsumoEstoque[]): RegistroConsumoEstoque[] {
  return registros.filter(
    (r) =>
      vigenciaEmVigor(r.vigencia) &&
      (r.saldo_registro === undefined || r.saldo_registro === null || r.saldo_registro > 0)
  );
}

export const provisionamentoService = {
  async getDadosPorMaterial(codigoMaterial: string): Promise<DadosProvisionamentoMaterial | null> {
    const material = await catalogoRepository.findByCodigoOuDescricao(codigoMaterial.trim());
    if (!material || material.master == null) return null;

    const master = material.master;
    const meses = getMesesUltimos6();
    const [consumos, totais, registros] = await Promise.all([
      getConsumosPorMaterialEMeses(master, meses),
      getTotaisEstoqueSaldo(master),
      getEstoqueESaldoPorMaterial(master),
    ]);

    const mediaConsumo = calcularMedia(consumos);
    const estoqueVirtual = totais.estoqueAlmoxarifados + totais.saldoEmpenhos;
    const tempoAbastecimento =
      mediaConsumo > 0 ? totais.estoqueAlmoxarifados / mediaConsumo : null;

    const registrosFiltrados = filtrarRegistrosProvisionamento(registros);
    const consumosPorMes = meses.map(
      (mesano) => consumos.find((c) => c.mesano === mesano)?.total ?? 0
    );
    const coberturaEstoque = mediaConsumo > 0 ? estoqueVirtual / mediaConsumo : null;

    return {
      codigo: master,
      descricao: material.descricao,
      mediaConsumo,
      estoqueAlmoxarifados: totais.estoqueAlmoxarifados,
      estoqueVirtual,
      tempoAbastecimento,
      registros: registrosFiltrados,
      consumosPorMes,
      coberturaEstoque,
    };
  },

  /**
   * Retorna todas as linhas para a tabela de provisionamento: materiais com Registro Ativo = sim.
   * "ESTOQUE (ALMOXARIFADO)" = qtde_em_estoque da view v_df_consumo_estoque (por linha).
   * "Média consumo (6 meses)" = media_mensal_dos_ultimos_6_meses da view.
   * Consumos mensais: preferência para colunas da própria v_df_consumo_estoque (z_6º_mes … consumo_mes_atual); fallback para v_df_movimento.
   */
  async getTodosRegistrosAtivosParaTabela(): Promise<LinhaProvisionamentoRegistroAtivo[]> {
    const meses = getMesesUltimos6();
    const rows = await getTodosRegistrosAtivos();
    if (rows.length === 0) return [];

    const materials = [...new Set(rows.map((r) => r.material).filter((m): m is string => m != null))];
    const masterKeys = [...new Set(materials.map((m) => (m.includes('-') ? m.split('-')[0].trim() : m)))];
    const [descricoesMap, consumosView, consumosByMaterial] = await Promise.all([
      catalogoRepository.findDescricoesByMasters(materials),
      getConsumos6MesesPorMasters(masterKeys),
      getConsumosPorMastersEMeses(masterKeys, meses),
    ]);

    const result: LinhaProvisionamentoRegistroAtivo[] = [];
    let idx = 0;
    for (const r of rows) {
      if (r.material == null) continue;
      const masterKey = r.material.includes('-') ? r.material.split('-')[0].trim() : r.material;
      const viewRow = consumosView.get(masterKey) ?? consumosView.get(r.material);
      const consumosMov = consumosByMaterial.get(r.material) ?? consumosByMaterial.get(masterKey) ?? [];
      const mediaConsumo =
        r.media_consumo_6m != null ? r.media_consumo_6m : calcularMedia(consumosMov);
      const estoqueAlmoxarifados = r.estoque_almoxarifados;
      const estoqueVirtual = r.estoque_almoxarifados + r.saldo_empenhos;
      const tempoAbastecimento =
        mediaConsumo > 0 ? r.estoque_almoxarifados / mediaConsumo : null;
      const consumosPorMes = viewRow
        ? [
            Math.abs(viewRow.consumoMesMinus6),
            Math.abs(viewRow.consumoMesMinus5),
            Math.abs(viewRow.consumoMesMinus4),
            Math.abs(viewRow.consumoMesMinus3),
            Math.abs(viewRow.consumoMesMinus2),
            Math.abs(viewRow.consumoMesMinus1),
            Math.abs(viewRow.consumoMesAtual),
          ]
        : meses.map((mesano) => consumosMov.find((c) => c.mesano === mesano)?.total ?? 0);
      const coberturaEstoque =
        mediaConsumo > 0 ? estoqueVirtual / mediaConsumo : null;

      result.push({
        id: `provisionamento-${r.material}-${r.numero_registro ?? idx}-${idx}`,
        codigo: r.material,
        descricao: descricoesMap.get(r.material) ?? null,
        mediaConsumo,
        estoqueAlmoxarifados,
        estoqueVirtual,
        tempoAbastecimento,
        numeroRegistro: r.numero_registro,
        saldoRegistro: r.saldo_registro,
        vigencia: r.vigencia,
        valorUnitario: r.valor_unitario,
        qtdePedida: 0,
        valorTotal: 0,
        observacao: '',
        consumosPorMes,
        coberturaEstoque,
      });
      idx++;
    }
    return result;
  },
};
