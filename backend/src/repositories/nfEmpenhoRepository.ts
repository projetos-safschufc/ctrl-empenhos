/**
 * Repositório para public.nf_empenho (e observações em public.nf_obs).
 * Usado pela tela "Editar Recebimento" para listar e atualizar dados de NF por empenho.
 */

import { prisma } from '../utils/prisma';

export interface NfEmpenhoListItem {
  id: number;
  empenho: string;
  codigo: string | null;
  item: string | null;
  material: string | null;
  data: Date | null;
  saldo_emp: number | null;
  v_unit: number | null;
  qtde_receb: number | null;
  obs: string | null;
}

export interface ListNfEmpenhoFilters {
  empenho?: string;
  codigo?: string;
  page?: number;
  pageSize?: number;
}

export interface NfEmpenhoListaItem {
  id: number;
  fornecedor: string | null;
  data: Date | null;
  empenho: string;
  item: string | null;
  codigo: string | null;
  material: string | null;
  saldo_emp: number | null;
  qtde_receb: number | null;
  situacao: string | null;
  usuario: string | null;
}

export interface ListNfEmpenhoListaFilters {
  fornecedor?: string;
  empenho?: string;
  codigo?: string;
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const LISTA_MAX_PAGE_SIZE = 500;

/**
 * Lista registros de public.nf_empenho com filtros e paginação.
 * Inclui a última observação do empenho (nf_obs) quando existir.
 * Requer ao menos um filtro (empenho ou codigo) — validado na camada de controller.
 */
export async function listNfEmpenho(
  filters: ListNfEmpenhoFilters = {}
): Promise<{ itens: NfEmpenhoListItem[]; total: number }> {
  const page = Math.max(1, filters.page ?? DEFAULT_PAGE);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;
  const empenhoFilter = filters.empenho?.trim();
  const codigoFilter = filters.codigo?.trim();

  const whereEmpenho: { empenho?: { contains: string; mode: 'insensitive' }; codigo?: { contains: string; mode: 'insensitive' } } = {};
  if (empenhoFilter) whereEmpenho.empenho = { contains: empenhoFilter, mode: 'insensitive' };
  if (codigoFilter) whereEmpenho.codigo = { contains: codigoFilter, mode: 'insensitive' };

  if (!whereEmpenho.empenho && !whereEmpenho.codigo) {
    return { itens: [], total: 0 };
  }

  const [total, rows] = await Promise.all([
    prisma.nf_empenho.count({ where: whereEmpenho }),
    prisma.nf_empenho.findMany({
      where: whereEmpenho,
      orderBy: [{ data: 'desc' }, { id_emp: 'asc' }],
      skip: offset,
      take: pageSize,
      select: {
        id_emp: true,
        empenho: true,
        codigo: true,
        item: true,
        material: true,
        data: true,
        saldo_emp: true,
        v_unit: true,
        qtde_receb: true,
      },
    }),
  ]);

  if (rows.length === 0) {
    return { itens: [], total };
  }

  const empenhos = [...new Set(rows.map((r) => r.empenho).filter(Boolean))] as string[];
  const obsByEmpenho = await getUltimaObservacaoPorEmpenho(empenhos);

  const itens: NfEmpenhoListItem[] = rows.map((r) => ({
    id: r.id_emp,
    empenho: r.empenho ?? '',
    codigo: r.codigo ?? null,
    item: r.item ?? null,
    material: r.material ?? null,
    data: r.data ?? null,
    saldo_emp: r.saldo_emp != null ? Number(r.saldo_emp) : null,
    v_unit: r.v_unit != null ? Number(r.v_unit) : null,
    qtde_receb: r.qtde_receb != null ? Number(r.qtde_receb) : null,
    obs: obsByEmpenho.get(r.empenho ?? '') ?? null,
  }));

  return { itens, total };
}

/**
 * Lista registros de public.nf_empenho para a tela "Lista de Recebimentos".
 * Filtros opcionais (fornecedor, empenho, codigo). Sem slice/limite artificial na API.
 */
export async function listNfEmpenhoParaLista(
  filters: ListNfEmpenhoListaFilters = {}
): Promise<{ itens: NfEmpenhoListaItem[]; total: number }> {
  const page = Math.max(1, filters.page ?? DEFAULT_PAGE);
  const pageSize = Math.min(LISTA_MAX_PAGE_SIZE, Math.max(1, filters.pageSize ?? 100));
  const offset = (page - 1) * pageSize;
  const fornecedorFilter = filters.fornecedor?.trim();
  const empenhoFilter = filters.empenho?.trim();
  const codigoFilter = filters.codigo?.trim();

  const where: {
    fornecedor?: { contains: string; mode: 'insensitive' };
    empenho?: { contains: string; mode: 'insensitive' };
    codigo?: { contains: string; mode: 'insensitive' };
  } = {};
  if (fornecedorFilter) where.fornecedor = { contains: fornecedorFilter, mode: 'insensitive' };
  if (empenhoFilter) where.empenho = { contains: empenhoFilter, mode: 'insensitive' };
  if (codigoFilter) where.codigo = { contains: codigoFilter, mode: 'insensitive' };

  const hasWhere = Object.keys(where).length > 0;

  const [total, rows] = await Promise.all([
    prisma.nf_empenho.count({ where: hasWhere ? where : undefined }),
    prisma.nf_empenho.findMany({
      where: hasWhere ? where : undefined,
      orderBy: [{ data: 'desc' }, { id_emp: 'asc' }],
      skip: offset,
      take: pageSize,
      select: {
        id_emp: true,
        fornecedor: true,
        data: true,
        empenho: true,
        item: true,
        codigo: true,
        material: true,
        saldo_emp: true,
        qtde_receb: true,
        situacao: true,
        usuario: true,
      },
    }),
  ]);

  const itens: NfEmpenhoListaItem[] = rows.map((r) => ({
    id: r.id_emp,
    fornecedor: r.fornecedor ?? null,
    data: r.data,
    empenho: r.empenho ?? '',
    item: r.item ?? null,
    codigo: r.codigo ?? null,
    material: r.material ?? null,
    saldo_emp: r.saldo_emp != null ? Number(r.saldo_emp) : null,
    qtde_receb: r.qtde_receb != null ? Number(r.qtde_receb) : null,
    situacao: r.situacao ?? null,
    usuario: r.usuario ?? null,
  }));

  return { itens, total };
}

/** Busca a última observação (por date) de cada empenho em public.nf_obs. */
async function getUltimaObservacaoPorEmpenho(empenhos: string[]): Promise<Map<string, string>> {
  if (empenhos.length === 0) return new Map();
  const obs = await prisma.nf_obs.findMany({
    where: { empenho_id: { in: empenhos } },
    orderBy: { date: 'desc' },
    select: { empenho_id: true, observacao: true },
  });
  const map = new Map<string, string>();
  for (const r of obs) {
    if (r.empenho_id && r.observacao != null && !map.has(r.empenho_id)) {
      map.set(r.empenho_id, r.observacao);
    }
  }
  return map;
}

export interface UpdateNfEmpenhoInput {
  qtde_receb?: number;
  observacao?: string;
}

/**
 * Atualiza um registro em public.nf_empenho pelo id_emp.
 * Se observacao for informada, insere um novo registro em public.nf_obs.
 */
export async function updateNfEmpenho(
  idEmp: number,
  input: UpdateNfEmpenhoInput,
  usuario?: string | null
): Promise<boolean> {
  if (input.qtde_receb !== undefined) {
    await prisma.nf_empenho.update({
      where: { id_emp: idEmp },
      data: { qtde_receb: input.qtde_receb },
    });
  }
  if (input.observacao != null && input.observacao.trim() !== '') {
    const row = await prisma.nf_empenho.findUnique({
      where: { id_emp: idEmp },
      select: { empenho: true },
    });
    if (row?.empenho) {
      await prisma.nf_obs.create({
        data: {
          empenho_id: row.empenho,
          observacao: input.observacao.trim(),
          usuario: usuario ?? null,
        },
      });
    }
  }
  return true;
}

export interface RegistrarRecebimentoItem {
  fornecedor?: string | null;
  empenho: string;
  item?: string | null;
  codigo?: string | null;
  material?: string | null;
  saldo_emp?: number | null;
  qtde_receb: number;
  observacao?: string | null;
}

/**
 * Insere registros em public.nf_empenho a partir da Lista de Empenhos (registrar recebimento).
 * Para cada item com observação não vazia, insere também em public.nf_obs.
 */
export async function createNfEmpenhoFromLista(
  itens: RegistrarRecebimentoItem[],
  usuario?: string | null
): Promise<{ criados: number }> {
  if (itens.length === 0) return { criados: 0 };
  let criados = 0;
  for (const item of itens) {
    const qtdeReceb = Number(item.qtde_receb);
    if (!Number.isInteger(qtdeReceb) || qtdeReceb <= 0) continue;
    const row = await prisma.nf_empenho.create({
      data: {
        fornecedor: item.fornecedor?.trim().slice(0, 255) ?? null,
        empenho: item.empenho.trim().slice(0, 255),
        item: item.item?.trim().slice(0, 255) ?? null,
        codigo: item.codigo?.trim().slice(0, 255) ?? null,
        material: item.material?.trim().slice(0, 255) ?? null,
        saldo_emp: item.saldo_emp != null ? item.saldo_emp : null,
        v_unit: null,
        v_total: null,
        qtde_receb: qtdeReceb,
        situacao: 'Pendente',
        usuario: usuario ?? null,
      },
      select: { id_emp: true, empenho: true },
    });
    criados++;
    if (item.observacao?.trim()) {
      await prisma.nf_obs.create({
        data: {
          empenho_id: row.empenho,
          observacao: item.observacao.trim(),
          usuario: usuario ?? null,
        },
      });
    }
  }
  return { criados };
}
