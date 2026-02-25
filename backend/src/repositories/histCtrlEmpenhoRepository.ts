import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

/**
 * Persistência em ctrl.hist_ctrl_empenho (schema ctrl, banco safs).
 * O Prisma usa DATABASE_URL e o model HistCtrlEmpenho com @@schema("ctrl") e @@map("hist_ctrl_empenho").
 * Campos Decimal devem ser enviados como Prisma.Decimal para evitar erro PostgreSQL 22P03 (invalid sign in external numeric value).
 */
export interface CreateHistPayload {
  material_id: number;
  usuario_id: number;
  classificacao?: string;
  resp_controle?: string;
  setor_controle?: string;
  master_descritivo?: string;
  numero_registro?: string;
  valor_unit_registro?: number;
  saldo_registro?: number;
  qtde_por_embalagem?: number;
  tipo_armazenamento?: string;
  capacidade_estocagem?: string;
  observacao?: string;
}

function toDecimalValue(value: number | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export const histCtrlEmpenhoRepository = {
  create(data: CreateHistPayload) {
    const payload: Parameters<typeof prisma.histCtrlEmpenho.create>[0]['data'] = {
      materialId: data.material_id,
      usuarioId: data.usuario_id,
    };
    if (data.classificacao !== undefined) payload.classificacao = data.classificacao;
    if (data.resp_controle !== undefined) payload.respControle = data.resp_controle;
    if (data.setor_controle !== undefined) payload.setorControle = data.setor_controle;
    if (data.master_descritivo !== undefined) payload.masterDescritivo = data.master_descritivo;
    if (data.numero_registro !== undefined) payload.numeroRegistro = data.numero_registro;
    const vUnit = toDecimalValue(data.valor_unit_registro);
    if (vUnit !== undefined) payload.valorUnitRegistro = new Prisma.Decimal(vUnit);
    const saldo = toDecimalValue(data.saldo_registro);
    if (saldo !== undefined) payload.saldoRegistro = new Prisma.Decimal(saldo);
    const qtde = toDecimalValue(data.qtde_por_embalagem);
    if (qtde !== undefined) payload.qtdePorEmbalagem = new Prisma.Decimal(qtde);
    if (data.tipo_armazenamento !== undefined) payload.tipoArmazenamento = data.tipo_armazenamento;
    if (data.capacidade_estocagem !== undefined) payload.capacidadeEstocagem = data.capacidade_estocagem;
    if (data.observacao !== undefined) payload.observacao = data.observacao;

    return prisma.histCtrlEmpenho.create({ data: payload });
  },

  async findLastByMaterialId(materialId: number | string) {
    const row = await prisma.histCtrlEmpenho.findFirst({
      where: { materialId: String(materialId) },
      orderBy: { id: 'desc' },
    });
    return row;
  },

  /** Último registro de histórico por material para vários ids em uma consulta. */
  async findLastByMaterialIds(
    materialIds: (number | string)[]
  ): Promise<Map<string, Awaited<ReturnType<typeof this.findLastByMaterialId>>>> {
    if (materialIds.length === 0) return new Map();
    const ids = [...new Set(materialIds.map(id => String(id)))];
    const rows = await prisma.histCtrlEmpenho.findMany({
      where: { materialId: { in: ids } },
      orderBy: { id: 'desc' },
    });
    const map = new Map<string, Awaited<ReturnType<typeof this.findLastByMaterialId>>>();
    for (const row of rows) {
      if (!map.has(row.materialId)) map.set(row.materialId, row);
    }
    return map;
  },
};
