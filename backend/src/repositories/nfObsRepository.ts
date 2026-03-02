/**
 * Repositório para public.nf_obs (observações por empenho).
 * Usado pela tela "Adicionar Observações" e pelo PATCH de nf_empenho.
 */

import { prisma } from '../utils/prisma';

export interface CreateNfObsInput {
  empenho_id: string;
  observacao: string;
  usuario?: string | null;
}

export interface NfObsCreated {
  id: number;
  empenho_id: string | null;
  observacao: string | null;
  usuario: string | null;
  date: Date | null;
}

/**
 * Insere um registro em public.nf_obs.
 */
export async function createNfObs(input: CreateNfObsInput): Promise<NfObsCreated> {
  const row = await prisma.nf_obs.create({
    data: {
      empenho_id: input.empenho_id.trim(),
      observacao: input.observacao.trim(),
      usuario: input.usuario?.trim() ?? null,
    },
    select: {
      id: true,
      empenho_id: true,
      observacao: true,
      usuario: true,
      date: true,
    },
  });
  return {
    id: row.id,
    empenho_id: row.empenho_id,
    observacao: row.observacao,
    usuario: row.usuario,
    date: row.date,
  };
}

/**
 * Retorna a última observação (por date) de cada empenho em public.nf_obs.
 * Usado pela Lista de Empenhos para exibir observações cadastradas por empenho.
 */
export async function getUltimaObservacaoPorEmpenhos(
  empenhoIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(empenhoIds.map((id) => id?.trim()).filter(Boolean))];
  if (unique.length === 0) return new Map();
  const rows = await prisma.nf_obs.findMany({
    where: { empenho_id: { in: unique } },
    orderBy: { date: 'desc' },
    select: { empenho_id: true, observacao: true },
  });
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.empenho_id != null && r.observacao != null && !map.has(r.empenho_id)) {
      map.set(r.empenho_id, r.observacao);
    }
  }
  return map;
}
