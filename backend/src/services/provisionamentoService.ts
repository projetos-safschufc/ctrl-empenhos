import { catalogoRepository } from '../repositories/catalogoRepository';
import {
  getConsumosPorMaterialEMeses,
  getConsumosPorMastersEMeses,
} from '../repositories/movimentoRepository';
import {
  getTotaisEstoqueSaldo,
  getEstoqueESaldoPorMaterial,
  getTodosRegistrosAtivos,
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
    if (!material) return null;

    const meses = getMesesUltimos6();
    const [consumos, totais, registros] = await Promise.all([
      getConsumosPorMaterialEMeses(material.master, meses),
      getTotaisEstoqueSaldo(material.master),
      getEstoqueESaldoPorMaterial(material.master),
    ]);

    const mediaConsumo = calcularMedia(consumos);
    const estoqueVirtual = totais.estoqueAlmoxarifados + totais.saldoEmpenhos;
    const tempoAbastecimento =
      mediaConsumo > 0 ? totais.estoqueAlmoxarifados / mediaConsumo : null;

    const registrosFiltrados = filtrarRegistrosProvisionamento(registros);

    return {
      codigo: material.master,
      descricao: material.descricao,
      mediaConsumo,
      estoqueAlmoxarifados: totais.estoqueAlmoxarifados,
      estoqueVirtual,
      tempoAbastecimento,
      registros: registrosFiltrados,
    };
  },

  /**
   * Retorna todas as linhas para a tabela de provisionamento: materiais com Registro Ativo = sim.
   * "ESTOQUE (ALMOXARIFADO)" = qtde_em_estoque da view v_df_consumo_estoque (por linha).
   * "Média consumo (6 meses)" = media_mensal_dos_ultimos_6_meses da view.
   */
  async getTodosRegistrosAtivosParaTabela(): Promise<LinhaProvisionamentoRegistroAtivo[]> {
    const meses = getMesesUltimos6();
    const rows = await getTodosRegistrosAtivos();
    if (rows.length === 0) return [];

    const materials = [...new Set(rows.map((r) => r.material))];
    const [descricoesMap, consumosByMaterial] = await Promise.all([
      catalogoRepository.findDescricoesByMasters(materials),
      getConsumosPorMastersEMeses(materials, meses),
    ]);

    const result: LinhaProvisionamentoRegistroAtivo[] = [];
    let idx = 0;
    for (const r of rows) {
      const consumos = consumosByMaterial.get(r.material) ?? [];
      const mediaConsumo =
        r.media_consumo_6m != null ? r.media_consumo_6m : calcularMedia(consumos);
      const estoqueAlmoxarifados = r.estoque_almoxarifados;
      const estoqueVirtual = r.estoque_almoxarifados + r.saldo_empenhos;
      const tempoAbastecimento =
        mediaConsumo > 0 ? r.estoque_almoxarifados / mediaConsumo : null;

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
      });
      idx++;
    }
    return result;
  },
};
