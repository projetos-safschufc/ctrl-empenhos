/**
 * Repositório da tabela public.empenho.
 * Regras da tela Empenhos Pendentes:
 * - STATUS ITEM: IF(status_item == "Emitido" OR status_item == "Atend. parcial") --> exibir (listar e mostrar o valor na coluna).
 * - QT SALDO: IF(fl_evento == "Empenho" AND (status_item == "Atend. parcial" OR status_item == "Emitido");
 *              IF(status_item == "Atend. parcial"; qt_saldo_item; qt_de_embalagem); 0)
 * - Filtro de listagem: fl_evento = 'Empenho', status_item IN ('Emitido', 'Atend. parcial'), status_pedido != 'Gerado'.
 * - Exibição: somente registros com QT SALDO > 0 (Atend. parcial: qt_saldo_item > 0; Emitido: qt_de_embalagem > 0).
 *
 * Nº pré-empenho (Controle de Empenhos): cd_empenho/numero por (material, nu_registro_licitacao) com
 * fl_evento='Empenho', nu_documento_siafi IS NULL, nu_registro_licitacao IS NOT NULL e <> ''.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

/** Coluna de material na public.empenho (relaciona com split_part(codigo_padronizado,'-',1)). Muitos ambientes usam cd_material. */
const EMPENHO_MATERIAL_COL = process.env.EMPENHO_MATERIAL_COLUMN || 'cd_material';
/** Coluna retornada como Nº pré-empenho. Muitos ambientes usam cd_empenho. */
const EMPENHO_NUMERO_PRE_COL = process.env.EMPENHO_NUMERO_PRE_COLUMN || 'cd_empenho';

function variantesCodigoMaterial(codigo: string): string[] {
  const t = codigo.trim();
  const variantes = [t];
  if (/^\d{4,}$/.test(t)) {
    const comPonto = t.slice(0, -3) + '.' + t.slice(-3);
    if (comPonto !== t) variantes.push(comPonto);
  } else if (/^\d+\.\d+$/.test(t)) {
    const semPonto = t.replace('.', '');
    if (semPonto !== t) variantes.push(semPonto);
  }
  return [...new Set(variantes)];
}

/** Registro retornado pela query (raw ou Prisma). */
interface EmpenhoRow {
  id: number;
  nm_fornecedor: string | null;
  nu_registro_licitacao: string | null;
  nu_pregao: string | null;
  dt_fim_vigencia: Date | null;
  item: string | null;
  material: string | null;
  qt_saldo: unknown;
  qt_saldo_item?: unknown;
  qt_de_embalagem?: unknown;
  qt_saldo_calculado?: unknown;
  vl_saldo: unknown;
  vl_unidade?: unknown;
  fl_evento: string | null;
  nu_documento_siafi: string | null;
  status_item: string | null;
  status_pedido?: string | null;
}

/** Status que permitem exibir o registro (coluna STATUS ITEM). */
const STATUS_ITENS_EXIBIR = ['Emitido', 'Atend. parcial'] as const;

function statusItemAtendeRegra(status: string | null): boolean {
  const s = (status ?? '').trim();
  return s === 'Emitido' || s === 'Atend. parcial';
}

/** Calcula QT SALDO: se Empenho e (Atend. parcial ou Emitido), usa qt_saldo_item ou qt_de_embalagem; senão 0. */
function calcularQtSaldo(
  flEvento: string | null,
  statusItem: string | null,
  qtSaldoItem: number | null,
  qtDeEmbalagem: number | null
): number {
  const fl = String(flEvento ?? '').trim();
  const status = String(statusItem ?? '').trim();
  if (fl !== 'Empenho' || !(status === 'Atend. parcial' || status === 'Emitido')) return 0;
  if (status === 'Atend. parcial') {
    const n = qtSaldoItem != null ? Number(qtSaldoItem) : NaN;
    return Number.isFinite(n) ? n : 0;
  }
  const n = qtDeEmbalagem != null ? Number(qtDeEmbalagem) : NaN;
  return Number.isFinite(n) ? n : 0;
}

export interface EmpenhoPendentePublic {
  id: number;
  nm_fornecedor: string | null;
  nu_registro_licitacao: string | null;
  nu_pregao: string | null;
  dt_fim_vigencia: Date | null;
  item: string | null;
  material: string | null;
  qt_saldo: number | null;
  valor_numeric: number | null;
  vl_saldo: number | null;
  vl_unidade: number | null;
  fl_evento: string | null;
  nu_documento_siafi: string | null;
  status_item: string | null;
}

export interface ListEmpenhosPendentesPublicFilters {
  codigo?: string;
  empenho?: string;
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Lista empenhos pendentes: status_item "Emitido" ou "Atend. parcial", fl_evento = 'Empenho'.
 * Exibe somente registros com QT SALDO > 0 (Atend. parcial: qt_saldo_item > 0; Emitido: qt_de_embalagem > 0).
 */
export async function listEmpenhosPendentesPublic(
  filters: ListEmpenhosPendentesPublicFilters = {}
): Promise<{ itens: EmpenhoPendentePublic[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, filters.page ?? DEFAULT_PAGE);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));
  const skip = (page - 1) * pageSize;

  const where: {
    status_item?: { in: string[] };
    fl_evento?: string;
    status_pedido?: { not: string };
    OR?: Array<
      | { status_item: 'Atend. parcial'; qt_saldo_item: { gt: number } }
      | { status_item: 'Emitido'; qt_de_embalagem: { gt: number } }
    >;
    material?: { contains: string; mode: 'insensitive' };
    nu_documento_siafi?: { contains: string; mode: 'insensitive' };
  } = {
    status_item: { in: [...STATUS_ITENS_EXIBIR] },
    fl_evento: 'Empenho',
    status_pedido: { not: 'Gerado' },
    OR: [
      { status_item: 'Atend. parcial', qt_saldo_item: { gt: 0 } },
      { status_item: 'Emitido', qt_de_embalagem: { gt: 0 } },
    ],
  };

  if (filters.codigo?.trim()) {
    where.material = { contains: filters.codigo.trim(), mode: 'insensitive' };
  }
  if (filters.empenho?.trim()) {
    where.nu_documento_siafi = { contains: filters.empenho.trim(), mode: 'insensitive' };
  }

  const [total, rawRows] = await Promise.all([
    prisma.empenho.count({ where }),
    (async (): Promise<EmpenhoRow[]> => {
      const codigo = filters.codigo?.trim();
      const empenho = filters.empenho?.trim();
      const params: unknown[] = [];
      let paramIdx = 0;
      const addParam = (v: unknown) => {
        paramIdx++;
        params.push(v);
        return `$${paramIdx}`;
      };
      const conditions = [
        "status_item IN ('Atend. parcial', 'Emitido')",
        "fl_evento = 'Empenho'",
        "(status_pedido IS DISTINCT FROM 'Gerado')",
        "((TRIM(COALESCE(status_item::text, '')) = 'Atend. parcial' AND COALESCE(qt_saldo_item::numeric, 0) > 0) OR (TRIM(COALESCE(status_item::text, '')) = 'Emitido' AND COALESCE(qt_de_embalagem::numeric, 0) > 0))",
      ];
      if (codigo) {
        conditions.push(`material ILIKE ${addParam(`%${codigo}%`)}`);
      }
      if (empenho) {
        conditions.push(`nu_documento_siafi ILIKE ${addParam(`%${empenho}%`)}`);
      }
      const whereSql = conditions.join(' AND ');
      const sql = `
        SELECT id, nm_fornecedor, nu_registro_licitacao, nu_pregao, dt_fim_vigencia,
               item, material, qt_saldo, qt_saldo_item, qt_de_embalagem, vl_saldo, vl_unidade,
               fl_evento, nu_documento_siafi, status_item, status_pedido,
               (CASE
                 WHEN TRIM(COALESCE(fl_evento::text, '')) = 'Empenho'
                  AND TRIM(COALESCE(status_pedido::text, '')) <> 'Gerado'
                  AND (TRIM(COALESCE(status_item::text, '')) = 'Atend. parcial'
                       OR TRIM(COALESCE(status_item::text, '')) = 'Emitido')
                 THEN (CASE WHEN TRIM(COALESCE(status_item::text, '')) = 'Atend. parcial'
                           THEN COALESCE(qt_saldo_item::numeric, 0)
                           ELSE COALESCE(qt_de_embalagem::numeric, 0) END)
                 ELSE 0
               END) AS qt_saldo_calculado
        FROM public.empenho
        WHERE ${whereSql}
        ORDER BY material ASC NULLS LAST, nu_documento_siafi ASC NULLS LAST
        LIMIT ${addParam(pageSize)} OFFSET ${addParam(skip)}
      `;
      try {
        return await prisma.$queryRawUnsafe<EmpenhoRow[]>(sql.trim(), ...params);
      } catch {
        const fallback = await prisma.empenho.findMany({
          where,
          select: {
            id: true,
            nm_fornecedor: true,
            nu_registro_licitacao: true,
            nu_pregao: true,
            dt_fim_vigencia: true,
            item: true,
            material: true,
            qt_saldo: true,
            vl_saldo: true,
            fl_evento: true,
            nu_documento_siafi: true,
            status_item: true,
            status_pedido: true,
            vl_unidade: true,
          } as Prisma.EmpenhoSelect,
          orderBy: [{ material: 'asc' }, { nu_documento_siafi: 'asc' }] as Prisma.EmpenhoOrderByWithRelationInput[],
          skip,
          take: pageSize,
        });
        return fallback as unknown as EmpenhoRow[];
      }
    })(),
  ]);

  const rows = rawRows;

  const itens = rows.map((r) => {
    let qtSaldoExibicao: number;
    if (r.qt_saldo_calculado !== undefined && r.qt_saldo_calculado !== null) {
      const n = Number(r.qt_saldo_calculado);
      qtSaldoExibicao = Number.isFinite(n) ? n : 0;
    } else {
      const qtSaldoItem = r.qt_saldo_item != null ? Number(r.qt_saldo_item) : null;
      const qtDeEmbalagem = r.qt_de_embalagem != null ? Number(r.qt_de_embalagem) : null;
      qtSaldoExibicao = calcularQtSaldo(r.fl_evento, r.status_item, qtSaldoItem, qtDeEmbalagem);
      if (
        (r.qt_saldo_item == null && r.qt_de_embalagem == null) &&
        r.qt_saldo != null &&
        Number.isFinite(Number(r.qt_saldo))
      ) {
        qtSaldoExibicao = Number(r.qt_saldo);
      }
    }
    const statusTrim = (r.status_item ?? '').trim();
    const exibirStatus = statusItemAtendeRegra(r.status_item);
    const vlUnidade = r.vl_unidade != null && Number.isFinite(Number(r.vl_unidade)) ? Number(r.vl_unidade) : null;
    const vlSaldoCalculado = vlUnidade != null ? qtSaldoExibicao * vlUnidade : null;
    return {
      id: r.id,
      nm_fornecedor: r.nm_fornecedor,
      nu_registro_licitacao: r.nu_registro_licitacao,
      nu_pregao: r.nu_pregao,
      dt_fim_vigencia: r.dt_fim_vigencia,
      item: r.item,
      material: r.material,
      qt_saldo: qtSaldoExibicao,
      valor_numeric: null as number | null,
      vl_saldo: vlSaldoCalculado,
      vl_unidade: vlUnidade,
      fl_evento: r.fl_evento,
      nu_documento_siafi: r.nu_documento_siafi,
      status_item: exibirStatus ? statusTrim || null : null,
    };
  });

  return { itens, total, page, pageSize };
}

/**
 * Nº pré-empenho (coluna "Nº PRÉ-EMPENHO") a partir de public.empenho.
 * Regras: empenho.material = split_part(v_df_consumo_estoque.codigo_padronizado, '-', 1),
 *         empenho.nu_registro_licitacao = v_df_consumo_estoque.numero_do_registro.
 * Filtros obrigatórios: fl_evento = 'Empenho', nu_documento_siafi IS NULL,
 *                      nu_registro_licitacao IS NOT NULL e <> '', status_pedido = 'Gerado'.
 * Retorna Map: chave "master" (sem registro) ou "master|numeroRegistro"; valor = numero/cd_empenho.
 * Performance: predicados apenas na tabela empenho (sem funções no lado empenho).
 * Índice recomendado: (material, nu_registro_licitacao, fl_evento, nu_documento_siafi).
 */
export async function getNumeroPreEmpenhoPorMastersERegistros(
  pairs: { master: string; numeroRegistro: string | null }[]
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  if (pairs.length === 0) return result;

  const comRegistro = pairs.filter((p) => p.numeroRegistro != null && String(p.numeroRegistro).trim() !== '');
  const mastersSemRegistro = [...new Set(pairs.filter((p) => !p.numeroRegistro?.trim()).map((p) => p.master))];
  for (const m of mastersSemRegistro) {
    result.set(m, null);
  }

  if (comRegistro.length === 0) return result;

  const varianteToKey = new Map<string, string>();
  const allParams: string[] = [];
  const seen = new Set<string>();
  let pi = 0;

  for (const p of comRegistro) {
    const variantes = variantesCodigoMaterial(p.master);
    const nr = String(p.numeroRegistro ?? '').trim();
    const key = `${p.master}|${nr}`;
    for (const v of variantes) {
      varianteToKey.set(`${v}|${nr}`, key);
      const k = `${v}|${nr}`;
      if (seen.has(k)) continue;
      seen.add(k);
      pi++;
      allParams.push(v, nr);
    }
  }

  if (allParams.length === 0) return result;

  const valuesRows: string[] = [];
  for (let i = 0; i < allParams.length; i += 2) {
    valuesRows.push(`($${i + 1}::text, $${i + 2}::text)`);
  }
  const valuesClause = valuesRows.join(', ');

  const sql = `
    SELECT DISTINCT ON (e.${EMPENHO_MATERIAL_COL}, e.nu_registro_licitacao)
      e.${EMPENHO_MATERIAL_COL}::text AS material,
      e.nu_registro_licitacao::text AS numero_registro,
      e.${EMPENHO_NUMERO_PRE_COL}::text AS numero_pre_empenho
    FROM public.empenho e
    WHERE UPPER(TRIM(COALESCE(e.fl_evento, ''))) = 'EMPENHO'
      AND e.nu_documento_siafi IS NULL
      AND e.nu_registro_licitacao IS NOT NULL
      AND TRIM(e.nu_registro_licitacao) <> ''
      AND UPPER(TRIM(COALESCE(e.status_pedido, ''))) = 'GERADO'
      AND (e.${EMPENHO_MATERIAL_COL}::text, e.nu_registro_licitacao) IN (VALUES ${valuesClause})
    ORDER BY e.${EMPENHO_MATERIAL_COL}, e.nu_registro_licitacao
  `;

  try {
    const rows = await prisma.$queryRawUnsafe<
      { material: string; numero_registro: string; numero_pre_empenho: string | null }[]
    >(sql, ...allParams);
    for (const r of rows) {
      const mat = String(r.material ?? '').trim();
      const nr = String(r.numero_registro ?? '').trim();
      const key = varianteToKey.get(`${mat}|${nr}`);
      if (key != null && r.numero_pre_empenho != null) {
        result.set(key, String(r.numero_pre_empenho));
      }
    }
    for (const p of comRegistro) {
      const key = `${p.master}|${String(p.numeroRegistro ?? '').trim()}`;
      if (!result.has(key)) result.set(key, null);
    }
  } catch {
    for (const p of comRegistro) {
      result.set(`${p.master}|${String(p.numeroRegistro ?? '').trim()}`, null);
    }
  }
  return result;
}
