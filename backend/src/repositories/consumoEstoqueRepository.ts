import { getDwPool, getDwSchema } from '../utils/dwPool';

/** Coluna de material na view v_df_consumo_estoque (ex.: codigo_padronizado). Exibida integralmente. */
const MATERIAL_COL = process.env.DW_MATERIAL_COLUMN || 'codigo_padronizado';

/** Identificador SQL seguro: se contém caracteres especiais (ex.: º, ç, ão), usa aspas duplas. */
function quoteIdentifier(name: string): string {
  const n = name.trim().replace(/^"|"$/g, '');
  if (/^[a-z_][a-z0-9_]*$/i.test(n)) return n;
  return `"${n.replace(/"/g, '""')}"`;
}

/** Referência SQL à coluna de material (com aspas se tiver caracteres especiais). */
const MATERIAL_COL_REF = quoteIdentifier(MATERIAL_COL.trim());
/** Usado apenas em WHERE ao filtrar por material: permite match por "parte antes de '-'" (ex.: 586243 encontra 586243-01). */
const MATERIAL_PREFIX_EXPR = `TRIM(SPLIT_PART(${MATERIAL_COL_REF}::text, '-', 1))`;
/** Colunas do schema gad_dlih_safs: qtde_a_receber (Saldo empenhos), numero_do_registro, fim_vigencia, qtde_a_empenhar. */
const _dwSchema = (process.env.DW_SCHEMA || 'public').toLowerCase();
const USE_SPEC =
  process.env.DW_USE_SPEC_COLUMNS === 'true' || _dwSchema === 'gad_dlih_safs';
/** Coluna "registro_ativo" na view (ex.: 'Sim'/'Não'). Quando definida, lista todos usa apenas este filtro. */
const REGISTRO_ATIVO_COL = process.env.DW_REGISTRO_ATIVO_COLUMN || 'registro_ativo';
const USE_REGISTRO_ATIVO_COL = process.env.DW_USE_REGISTRO_ATIVO_COLUMN !== 'false';

/** Colunas de consumo dos últimos 6 meses e mês atual na v_df_consumo_estoque (ex.: z_6º_mes … z_1º_mes, consumo_mes_atual). */
const CONSUMO_Z6 = process.env.DW_CONSUMO_Z6_COL || 'z_6º_mes';
const CONSUMO_Z5 = process.env.DW_CONSUMO_Z5_COL || 'z_5º_mes';
const CONSUMO_Z4 = process.env.DW_CONSUMO_Z4_COL || 'z_4º_mes';
const CONSUMO_Z3 = process.env.DW_CONSUMO_Z3_COL || 'z_3º_mes';
const CONSUMO_Z2 = process.env.DW_CONSUMO_Z2_COL || 'z_2º_mes';
const CONSUMO_Z1 = process.env.DW_CONSUMO_Z1_COL || 'z_1º_mes';
const CONSUMO_MES_ATUAL = process.env.DW_CONSUMO_MES_ATUAL_COL || 'consumo_mes_atual';

/** Registro ativo: estoque almoxarifados, saldo empenhos, dados do registro */
export interface RegistroConsumoEstoque {
  estoque_almoxarifados: number;
  saldo_empenhos: number;
  numero_registro?: string;
  vigencia?: string;
  valor_unitario?: number;
  saldo_registro?: number;
}

/**
 * Tenta normalizar código do material para o formato do DW (ex.: 586243 -> 586.243).
 * O DW pode armazenar com ponto (XXX.YYY); o catálogo pode estar sem ponto.
 */
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

/**
 * Estoque e saldo de empenhos por material (uma linha por registro ativo).
 * Com DW_USE_SPEC_COLUMNS=true usa: qtde_a_receber, numero_do_registro, fim_vigencia, qtde_a_empenhar (schema gad_dlih_safs).
 * Retorna itens com saldo de registro e vigência ainda em vigor (fim_vigencia >= hoje).
 */
export async function getEstoqueESaldoPorMaterial(
  materialCodigo: string
): Promise<RegistroConsumoEstoque[]> {
  const pool = getDwPool();
  const schema = getDwSchema();
  const view = `${schema}v_df_consumo_estoque`;
  const saldoCol = USE_SPEC ? 'qtde_a_receber' : 'saldo_empenhos';
  const nrCol = USE_SPEC ? 'numero_do_registro' : 'numero_registro';
  const vigCol = 'fim_vigencia'; // Sempre usar fim_vigencia conforme especificação
  // Registros ainda vigentes: fim da vigência >= hoje; quando USE_SPEC exige saldo de registro > 0
  const vigenciaCond = `((${vigCol}::date >= CURRENT_DATE) OR (${vigCol} IS NULL))`;
  const saldoRegistroCond = USE_SPEC
    ? 'AND (COALESCE(qtde_a_empenhar::numeric, 0) > 0)'
    : '';
  const variantes = variantesCodigoMaterial(materialCodigo);
  const placeholders = variantes.map((_, i) => `$${i + 1}`).join(', ');
  const query = `
    SELECT
      COALESCE(qtde_em_estoque::numeric, 0) AS estoque_almoxarifados,
      COALESCE(${saldoCol}::numeric, 0) AS saldo_empenhos,
      ${nrCol}::text AS numero_registro,
      ${vigCol}::text AS vigencia,
      valor_unitario::numeric AS valor_unitario
      ${USE_SPEC ? ', COALESCE(qtde_a_empenhar::numeric, 0) AS saldo_registro' : ''}
    FROM ${view}
    WHERE ${MATERIAL_PREFIX_EXPR} IN (${placeholders})
      AND ${vigenciaCond}
      ${saldoRegistroCond}
  `;
  try {
    const res = await pool.query(query, variantes);
    return res.rows.map((r: Record<string, unknown>) => ({
      estoque_almoxarifados: Number(r.estoque_almoxarifados) || 0,
      saldo_empenhos: Number(r.saldo_empenhos) || 0,
      numero_registro: r.numero_registro as string | undefined,
      vigencia: r.vigencia as string | undefined,
      valor_unitario: r.valor_unitario != null ? Number(r.valor_unitario) : undefined,
      saldo_registro: r.saldo_registro != null ? Number(r.saldo_registro) : undefined,
    }));
  } catch {
    return [];
  }
}

/** Uma linha de registro ativo na view (sem filtro por material). */
export interface RegistroAtivoRow {
  material: string;
  estoque_almoxarifados: number;
  saldo_empenhos: number;
  numero_registro: string | null;
  vigencia: string | null;
  valor_unitario: number | null;
  saldo_registro: number | null;
  /** Média mensal dos últimos 6 meses (coluna media_mensal_dos_ultimos_6_meses da view). */
  media_consumo_6m: number | null;
}

/**
 * Retorna todos os registros da view onde registro_ativo = 'Sim' (ou todos se não houver filtro).
 * Prioridade: se a view tiver coluna registro_ativo, filtra por UPPER(TRIM(registro_ativo)) = 'SIM'.
 * Caso contrário (DW_USE_REGISTRO_ATIVO_COLUMN=false), retorna todos os registros da view, sem filtro de vigência/saldo.
 */
export async function getTodosRegistrosAtivos(): Promise<RegistroAtivoRow[]> {
  const pool = getDwPool();
  const schema = getDwSchema();
  const view = `${schema}v_df_consumo_estoque`;
  const saldoCol = USE_SPEC ? 'qtde_a_receber' : 'saldo_empenhos';
  const nrCol = USE_SPEC ? 'numero_do_registro' : 'numero_registro';
  const vigCol = 'fim_vigencia'; // Sempre usar fim_vigencia conforme especificação
  const registroAtivoColRef =
    /^[a-z_][a-z0-9_]*$/i.test(REGISTRO_ATIVO_COL.trim()) ? REGISTRO_ATIVO_COL.trim() : `"${REGISTRO_ATIVO_COL.replace(/"/g, '').trim()}"`;
  const whereRegistroAtivo =
    `UPPER(TRIM(COALESCE(${registroAtivoColRef}::text, ''))) = 'SIM'`;
  const whereClause = USE_REGISTRO_ATIVO_COL ? `WHERE ${whereRegistroAtivo}` : '';
  const buildQuery = (where: string) => `
    SELECT
      ${MATERIAL_COL_REF}::text AS material,
      COALESCE(qtde_em_estoque::numeric, 0) AS estoque_almoxarifados,
      COALESCE(${saldoCol}::numeric, 0) AS saldo_empenhos,
      ${nrCol}::text AS numero_registro,
      ${vigCol}::text AS vigencia,
      valor_unitario::numeric AS valor_unitario
      ${USE_SPEC ? ', COALESCE(qtde_a_empenhar::numeric, 0) AS saldo_registro' : ', NULL::numeric AS saldo_registro'},
      media_mensal_dos_ultimos_6_meses::numeric * (-1) AS media_consumo_6m
    FROM ${view}
    ${where}
    ORDER BY ${MATERIAL_COL_REF}, ${nrCol}
  `;
  const mapRows = (rows: Record<string, unknown>[]) =>
    rows.map((r: Record<string, unknown>) => ({
      material: String(r.material ?? '').trim(),
      estoque_almoxarifados: Number(r.estoque_almoxarifados) || 0,
      saldo_empenhos: Number(r.saldo_empenhos) || 0,
      numero_registro: r.numero_registro != null ? String(r.numero_registro) : null,
      vigencia: r.vigencia != null ? String(r.vigencia) : null,
      valor_unitario: r.valor_unitario != null ? Number(r.valor_unitario) : null,
      saldo_registro: r.saldo_registro != null ? Number(r.saldo_registro) : null,
      media_consumo_6m: r.media_consumo_6m != null ? Number(r.media_consumo_6m) : null,
    }));

  try {
    let res = await pool.query(buildQuery(whereClause));
    if (res.rows.length === 0 && USE_REGISTRO_ATIVO_COL) {
      try {
        const fallbackWhere = '';
        res = await pool.query(buildQuery(fallbackWhere));
      } catch (fallbackErr) {
        console.warn('[provisionamento] Fallback WHERE 1=1 falhou:', (fallbackErr as Error).message);
      }
    }
    return mapRows(res.rows);
  } catch (err) {
    const msg = (err as Error).message || String(err);
    console.error('[provisionamento] getTodosRegistrosAtivos falhou:', msg);
    if (msg.indexOf('does not exist') !== -1 || msg.indexOf('não existe') !== -1) {
      const viewQualified = schema ? `${schema}v_df_consumo_estoque` : 'v_df_consumo_estoque (schema: public ou search_path)';
      console.error(
        '[provisionamento] View consultada:', viewQualified,
        '| Defina DW_SCHEMA no .env para o schema onde a view existe (ex.: DW_SCHEMA=gad_dlih_safs).'
      );
    }
    if (USE_REGISTRO_ATIVO_COL) {
      try {
        const fallbackWhere = '';
        const res = await pool.query(buildQuery(fallbackWhere));
        console.warn('[provisionamento] Retornando todos os registros (sem filtro registro_ativo).');
        return mapRows(res.rows);
      } catch (fallbackErr) {
        console.error('[provisionamento] Fallback WHERE 1=1 também falhou:', (fallbackErr as Error).message);
        return [];
      }
    }
    return [];
  }
}

/**
 * Retorna mapa master (código antes de '-') -> codigo_padronizado (primeiro encontrado na view).
 * Usado para exibir "Master/Descritivo" na tela Controle de Empenhos conforme plano (v_df_consumo_estoque.codigo_padronizado).
 */
export async function getCodigosPadronizadosByMasters(
  masters: string[]
): Promise<Map<string, string>> {
  if (masters.length === 0) return new Map();
  const pool = getDwPool();
  const schema = getDwSchema();
  const view = `${schema}v_df_consumo_estoque`;
  const variantesList = masters.map((m) => variantesCodigoMaterial(m));
  const allVariantes = [...new Set(variantesList.flat())];
  const placeholders = allVariantes.map((_, i) => `$${i + 1}`).join(', ');
  const query = `
    SELECT DISTINCT ON (${MATERIAL_PREFIX_EXPR}) ${MATERIAL_PREFIX_EXPR} AS master_code, ${MATERIAL_COL_REF}::text AS codigo_padronizado
    FROM ${view}
    WHERE ${MATERIAL_PREFIX_EXPR} IN (${placeholders})
    ORDER BY ${MATERIAL_PREFIX_EXPR}, ${MATERIAL_COL_REF}
  `;
  try {
    const res = await pool.query(query, allVariantes);
    const map = new Map<string, string>();
    for (const r of res.rows as { master_code: string; codigo_padronizado: string }[]) {
      const masterKey = r.master_code?.trim();
      const codigo = r.codigo_padronizado?.trim() ?? masterKey;
      if (!masterKey) continue;
      const variantes = variantesCodigoMaterial(masterKey);
      for (const v of variantes) {
        if (!map.has(v)) map.set(v, codigo);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Consumos dos últimos 6 meses e mês atual por material, conforme colunas da view v_df_consumo_estoque.
 * Ordem: z_6º_mes (mais antigo) … z_1º_mes, consumo_mes_atual. Valores negativos na view são exibidos em módulo no front.
 */
export interface Consumos6MesesView {
  consumoMesMinus6: number;
  consumoMesMinus5: number;
  consumoMesMinus4: number;
  consumoMesMinus3: number;
  consumoMesMinus2: number;
  consumoMesMinus1: number;
  consumoMesAtual: number;
  mediaConsumo6Meses: number;
}

/**
 * Retorna consumos dos últimos 6 meses e mês atual da view v_df_consumo_estoque, por master (código antes de '-').
 * Cada coluna da tela "Controle de Empenho" corresponde à coluna da view: z_6º_mes … z_1º_mes, consumo_mes_atual.
 * Os valores se repetem por registro na view; usa-se apenas a primeira incidência por material (DISTINCT ON), sem somar.
 * Em caso de erro (ex.: colunas inexistentes), retorna Map vazio e o serviço usa fallback (v_df_movimento).
 */
export async function getConsumos6MesesPorMasters(
  masters: string[]
): Promise<Map<string, Consumos6MesesView>> {
  if (masters.length === 0) return new Map();
  const pool = getDwPool();
  const schema = getDwSchema();
  const view = `${schema}v_df_consumo_estoque`;
  const variantesList = masters.map((m) => variantesCodigoMaterial(m));
  const allVariantes = [...new Set(variantesList.flat())];
  const placeholders = allVariantes.map((_, i) => `$${i + 1}`).join(', ');
  const z6 = quoteIdentifier(CONSUMO_Z6);
  const z5 = quoteIdentifier(CONSUMO_Z5);
  const z4 = quoteIdentifier(CONSUMO_Z4);
  const z3 = quoteIdentifier(CONSUMO_Z3);
  const z2 = quoteIdentifier(CONSUMO_Z2);
  const z1 = quoteIdentifier(CONSUMO_Z1);
  const mesAtual = quoteIdentifier(CONSUMO_MES_ATUAL);
  const query = `
    SELECT DISTINCT ON (${MATERIAL_PREFIX_EXPR})
      ${MATERIAL_PREFIX_EXPR} AS master_code,
      COALESCE(${z6}::numeric, 0) AS c6,
      COALESCE(${z5}::numeric, 0) AS c5,
      COALESCE(${z4}::numeric, 0) AS c4,
      COALESCE(${z3}::numeric, 0) AS c3,
      COALESCE(${z2}::numeric, 0) AS c2,
      COALESCE(${z1}::numeric, 0) AS c1,
      COALESCE(${mesAtual}::numeric, 0) AS c_atual,
      (COALESCE(media_mensal_dos_ultimos_6_meses::numeric, 0) * (-1)) AS media_6m
    FROM ${view}
    WHERE ${MATERIAL_PREFIX_EXPR} IN (${placeholders})
    ORDER BY ${MATERIAL_PREFIX_EXPR}
  `;
  try {
    const res = await pool.query(query, allVariantes);
    const map = new Map<string, Consumos6MesesView>();
    for (const r of res.rows as Record<string, unknown>[]) {
      const masterKey = String(r.master_code ?? '').trim();
      if (!masterKey) continue;
      const toNum = (v: unknown) => (v != null ? Number(v) : 0);
      const media = toNum(r.media_6m);
      const row: Consumos6MesesView = {
        consumoMesMinus6: toNum(r.c6),
        consumoMesMinus5: toNum(r.c5),
        consumoMesMinus4: toNum(r.c4),
        consumoMesMinus3: toNum(r.c3),
        consumoMesMinus2: toNum(r.c2),
        consumoMesMinus1: toNum(r.c1),
        consumoMesAtual: toNum(r.c_atual),
        mediaConsumo6Meses: media >= 0 ? media : -media,
      };
      map.set(masterKey, row);
      const variantes = variantesCodigoMaterial(masterKey);
      for (const v of variantes) {
        if (!map.has(v)) map.set(v, row);
      }
    }
    return map;
  } catch (err) {
    const msg = (err as Error).message || String(err);
    console.warn('[consumoEstoque] getConsumos6MesesPorMasters falhou (use fallback v_df_movimento):', msg);
    return new Map();
  }
}

/** Totais de estoque almoxarifados e saldo de empenhos para o material */
export async function getTotaisEstoqueSaldo(materialCodigo: string): Promise<{
  estoqueAlmoxarifados: number;
  saldoEmpenhos: number;
}> {
  const pool = getDwPool();
  const schema = getDwSchema();
  const view = `${schema}v_df_consumo_estoque`;
  const saldoCol = USE_SPEC ? 'qtde_a_receber' : 'saldo_empenhos';
  const variantes = variantesCodigoMaterial(materialCodigo);
  const placeholders = variantes.map((_, i) => `$${i + 1}`).join(', ');
  const query = `
    SELECT
      COALESCE(SUM(qtde_em_estoque::numeric), 0) AS estoque_almoxarifados,
      COALESCE(SUM(${saldoCol}::numeric), 0) AS saldo_empenhos
    FROM ${view}
    WHERE ${MATERIAL_PREFIX_EXPR} IN (${placeholders})
  `;
  try {
    const res = await pool.query(query, variantes);
    const r = res.rows[0];
    return {
      estoqueAlmoxarifados: r ? Number(r.estoque_almoxarifados) || 0 : 0,
      saldoEmpenhos: r ? Number(r.saldo_empenhos) || 0 : 0,
    };
  } catch {
    return { estoqueAlmoxarifados: 0, saldoEmpenhos: 0 };
  }
}

/** Totais estoque/saldo para vários masters em uma consulta. */
export async function getTotaisEstoqueSaldoPorMasters(
  masters: string[]
): Promise<Map<string, { estoqueAlmoxarifados: number; saldoEmpenhos: number }>> {
  if (masters.length === 0) return new Map();
  const pool = getDwPool();
  const schema = getDwSchema();
  const view = `${schema}v_df_consumo_estoque`;
  const saldoCol = USE_SPEC ? 'qtde_a_receber' : 'saldo_empenhos';
  const variantesList = masters.map((m) => variantesCodigoMaterial(m));
  const allVariantes = [...new Set(variantesList.flat())];
  const placeholders = allVariantes.map((_, i) => `$${i + 1}`).join(', ');
  const query = `
    SELECT ${MATERIAL_PREFIX_EXPR} AS master_code,
      COALESCE(SUM(qtde_em_estoque::numeric), 0) AS estoque_almoxarifados,
      COALESCE(SUM(${saldoCol}::numeric), 0) AS saldo_empenhos
    FROM ${view}
    WHERE ${MATERIAL_PREFIX_EXPR} IN (${placeholders})
    GROUP BY ${MATERIAL_PREFIX_EXPR}
  `;
  try {
    const res = await pool.query(query, allVariantes);
    const map = new Map<string, { estoqueAlmoxarifados: number; saldoEmpenhos: number }>();
    for (const r of res.rows as Record<string, unknown>[]) {
      const master = String(r.master_code ?? '').trim();
      if (!master) continue;
      map.set(master, {
        estoqueAlmoxarifados: Number(r.estoque_almoxarifados) || 0,
        saldoEmpenhos: Number(r.saldo_empenhos) || 0,
      });
    }
    for (const m of masters) {
      const variantes = variantesCodigoMaterial(m);
      const existing = variantes.map((v) => map.get(v)).find(Boolean);
      if (existing && !map.has(m)) map.set(m, existing);
    }
    return map;
  } catch {
    return new Map();
  }
}

/** Estoque e saldo (registros ativos) para vários masters em uma consulta. */
export async function getEstoqueESaldoPorMasters(
  masters: string[]
): Promise<Map<string, RegistroConsumoEstoque[]>> {
  if (masters.length === 0) return new Map();
  const pool = getDwPool();
  const schema = getDwSchema();
  const view = `${schema}v_df_consumo_estoque`;
  const saldoCol = USE_SPEC ? 'qtde_a_receber' : 'saldo_empenhos';
  const nrCol = USE_SPEC ? 'numero_do_registro' : 'numero_registro';
  const vigCol = 'fim_vigencia'; // Sempre usar fim_vigencia conforme especificação
  const vigenciaCond = `((${vigCol}::date >= CURRENT_DATE) OR (${vigCol} IS NULL))`;
  const saldoRegistroCond = USE_SPEC ? 'AND (COALESCE(qtde_a_empenhar::numeric, 0) > 0)' : '';
  const variantesList = masters.map((m) => variantesCodigoMaterial(m));
  const allVariantes = [...new Set(variantesList.flat())];
  const placeholders = allVariantes.map((_, i) => `$${i + 1}`).join(', ');
  const query = `
    SELECT ${MATERIAL_PREFIX_EXPR} AS master_code,
      COALESCE(qtde_em_estoque::numeric, 0) AS estoque_almoxarifados,
      COALESCE(${saldoCol}::numeric, 0) AS saldo_empenhos,
      ${nrCol}::text AS numero_registro, ${vigCol}::text AS vigencia,
      valor_unitario::numeric AS valor_unitario
      ${USE_SPEC ? ', COALESCE(qtde_a_empenhar::numeric, 0) AS saldo_registro' : ''}
    FROM ${view}
    WHERE ${MATERIAL_PREFIX_EXPR} IN (${placeholders})
      AND ${vigenciaCond} ${saldoRegistroCond}
  `;
  try {
    const res = await pool.query(query, allVariantes);
    const map = new Map<string, RegistroConsumoEstoque[]>();
    for (const r of res.rows as Record<string, unknown>[]) {
      const master = String(r.master_code ?? '').trim();
      if (!master) continue;
      const row: RegistroConsumoEstoque = {
        estoque_almoxarifados: Number(r.estoque_almoxarifados) || 0,
        saldo_empenhos: Number(r.saldo_empenhos) || 0,
        numero_registro: r.numero_registro as string | undefined,
        vigencia: r.vigencia as string | undefined,
        valor_unitario: r.valor_unitario != null ? Number(r.valor_unitario) : undefined,
        saldo_registro: r.saldo_registro != null ? Number(r.saldo_registro) : undefined,
      };
      const arr = map.get(master) ?? [];
      arr.push(row);
      map.set(master, arr);
    }
    for (const m of masters) {
      const variantes = variantesCodigoMaterial(m);
      const existing = variantes.map((v) => map.get(v)).find((arr) => arr && arr.length > 0);
      if (existing && !map.has(m)) map.set(m, existing);
    }
    return map;
  } catch {
    return new Map();
  }
}
