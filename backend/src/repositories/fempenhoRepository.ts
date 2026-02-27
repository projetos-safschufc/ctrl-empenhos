import { getDwPool, getDwSchema } from '../utils/dwPool';

/** Identificador SQL seguro: aspas duplas se tiver caracteres especiais (ex.: ó em código_pre_empenho). */
function quoteId(name: string): string {
  const n = String(name).trim().replace(/^"|"$/g, '');
  if (/^[a-z_][a-z0-9_]*$/i.test(n)) return n;
  return `"${n.replace(/"/g, '""')}"`;
}

const _dwSchema = (process.env.DW_SCHEMA || 'public').toLowerCase();
const _defaultFemMaterialCol = _dwSchema === 'gad_dlih_safs' ? 'cd_material' : 'mat_cod_antigo';
const FEM_MATERIAL_COL = process.env.DW_FEMPNUM_MATERIAL_COLUMN || process.env.DW_MATERIAL_COLUMN || _defaultFemMaterialCol;
const FEM_PRE_COL = process.env.DW_FEMPNUM_COLUMN || 'numero_pre_empenho';
const FEM_COD_PRE_COL = process.env.DW_FEMPNUM_CODIGO_PRE_COLUMN || 'cd_empenho';
/** Relacionamento: cd_material == codigo_padronizado (plano); match por código antes de "-". */
const FEM_MATERIAL_COL_REF = quoteId(FEM_MATERIAL_COL);
const FEM_COD_PRE_COL_REF = quoteId(FEM_COD_PRE_COL);
const FEM_MATERIAL_PREFIX_EXPR = `TRIM(SPLIT_PART(${FEM_MATERIAL_COL_REF}::text, '-', 1))`;

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
 * Código do pré-empenho para o material (view v_safs_fempenho). Plano: codigo_pre_empenho onde cd_material/numero_do_registro ligam a v_df_consumo_estoque. Match por código antes de "-".
 */
export async function getPreEmpenho(materialCodigo: string): Promise<string | null> {
  const pool = getDwPool();
  const schema = getDwSchema();
  const view = `${schema}v_safs_fempenho`;
  const variantes = variantesCodigoMaterial(materialCodigo);
  const ph = variantes.map((_, i) => `$${i + 1}`).join(', ');
  const query = `
    SELECT ${FEM_COD_PRE_COL_REF} AS numero
    FROM ${view}
    WHERE ${FEM_MATERIAL_PREFIX_EXPR} IN (${ph})
    LIMIT 1
  `;
  try {
    const res = await pool.query(query, variantes);
    const row = res.rows[0];
    return row?.numero != null ? String(row.numero) : null;
  } catch {
    return null;
  }
}

/** Pré-empenho para vários masters em uma consulta (sem considerar numero_do_registro). */
export async function getPreEmpenhoPorMasters(masters: string[]): Promise<Map<string, string | null>> {
  if (masters.length === 0) return new Map();
  const pool = getDwPool();
  const schema = getDwSchema();
  const view = `${schema}v_safs_fempenho`;
  const variantesList = masters.map((m) => variantesCodigoMaterial(m));
  const allVariantes = [...new Set(variantesList.flat())];
  const ph = allVariantes.map((_, i) => `$${i + 1}`).join(', ');
  const query = `
    SELECT DISTINCT ON (${FEM_MATERIAL_PREFIX_EXPR}) ${FEM_MATERIAL_PREFIX_EXPR} AS master_code, ${FEM_COD_PRE_COL_REF} AS numero
    FROM ${view}
    WHERE ${FEM_MATERIAL_PREFIX_EXPR} IN (${ph})
    ORDER BY ${FEM_MATERIAL_PREFIX_EXPR}
  `;
  try {
    const res = await pool.query(query, allVariantes);
    const map = new Map<string, string | null>();
    for (const r of res.rows as { master_code: string; numero: string | null }[]) {
      const master = String(r.master_code ?? '').trim();
      if (!master) continue;
      map.set(master, r.numero != null ? String(r.numero) : null);
    }
    for (const m of masters) {
      const variantes = variantesCodigoMaterial(m);
      const existing = variantes.map((v) => map.get(v)).find((x) => x !== undefined);
      if (existing !== undefined && !map.has(m)) map.set(m, existing);
    }
    return map;
  } catch {
    return new Map();
  }
}

const NR_COL = process.env.DW_FEMPNUM_REGISTRO_COLUMN || 'numero_do_registro';
const NR_COL_REF = quoteId(NR_COL);

/**
 * Pré-empenho (código_pre_empenho) por (material, numero_do_registro).
 * Regra: v_safs_fempenho.cd_material (antes de "-") == código_padronizado (antes de "-") AND
 *        v_safs_fempenho.numero_do_registro == v_df_consumo_estoque.numero_do_registro.
 * Chave no retorno: "master" quando numeroRegistro é null; "master|numeroRegistro" quando presente.
 */
export async function getPreEmpenhoPorMastersERegistros(
  pairs: { master: string; numeroRegistro: string | null }[]
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  if (pairs.length === 0) return result;

  const pool = getDwPool();
  const schema = getDwSchema();
  const view = `${schema}v_safs_fempenho`;

  const comRegistro = pairs.filter((p) => p.numeroRegistro != null && String(p.numeroRegistro).trim() !== '');
  const mastersSemRegistro = [...new Set(pairs.filter((p) => !p.numeroRegistro?.trim()).map((p) => p.master))];

  if (mastersSemRegistro.length > 0) {
    const fallback = await getPreEmpenhoPorMasters(mastersSemRegistro);
    for (const m of mastersSemRegistro) {
      const val = fallback.get(m) ?? null;
      result.set(m, val);
    }
  }

  if (comRegistro.length === 0) return result;

  const varianteToKey = new Map<string, string>();
  const allParams: string[] = [];
  const allRows: string[] = [];
  let pi = 0;
  const seen = new Set<string>();

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
      allRows.push(`($${pi * 2 - 1}::text, $${pi * 2}::text)`);
    }
  }

  if (allParams.length === 0) return result;

  const materialPrefixExpr = `TRIM(SPLIT_PART(f.${FEM_MATERIAL_COL_REF}::text, '-', 1))`;
  const valuesClause = allRows.join(', ');
  const query = `
    SELECT DISTINCT ON (master_code, numero_registro)
      ${materialPrefixExpr} AS master_code,
      f.${NR_COL_REF}::text AS numero_registro,
      f.${FEM_COD_PRE_COL_REF}::text AS codigo
    FROM ${view} f
    WHERE (${materialPrefixExpr}, COALESCE(f.${NR_COL_REF}::text, '')) IN (VALUES ${valuesClause})
    ORDER BY master_code, numero_registro
  `;

  try {
    const res = await pool.query(query, allParams);
    for (const r of res.rows as { master_code: string; numero_registro: string | null; codigo: string | null }[]) {
      const mc = String(r.master_code ?? '').trim();
      const nr = r.numero_registro != null ? String(r.numero_registro).trim() : '';
      const key = varianteToKey.get(`${mc}|${nr}`);
      if (key != null && r.codigo != null) result.set(key, String(r.codigo));
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

/**
 * Pré-empenho por material e número do registro (join com v_df_consumo_estoque). Match material por código antes de "-".
 */
export async function getPreEmpenhoPorRegistro(
  materialCodigo: string,
  numeroRegistro: string
): Promise<string | null> {
  if (!numeroRegistro?.trim()) return getPreEmpenho(materialCodigo);
  const pool = getDwPool();
  const schema = getDwSchema();
  const view = `${schema}v_safs_fempenho`;
  const variantes = variantesCodigoMaterial(materialCodigo);
  const ph = variantes.map((_, i) => `$${i + 1}`).join(', ');
  const query = `
    SELECT ${FEM_COD_PRE_COL_REF} AS numero
    FROM ${view}
    WHERE ${FEM_MATERIAL_PREFIX_EXPR} IN (${ph}) AND ${NR_COL_REF} = $${variantes.length + 1}
    LIMIT 1
  `;
  try {
    const res = await pool.query(query, [...variantes, numeroRegistro.trim()]);
    const row = res.rows[0];
    if (row?.numero != null) return String(row.numero);
    return getPreEmpenho(materialCodigo);
  } catch {
    return getPreEmpenho(materialCodigo);
  }
}

/** Registro de empenho pendente (view v_safs_fempenho) */
export interface EmpenhoPendente {
  mat_cod_antigo: string;
  numero_pre_empenho: string | null;
  descricao?: string | null;
  quantidade?: number | null;
  valor?: number | null;
  situacao?: string | null;
}

/**
 * Lista empenhos pendentes da view v_safs_fempenho.
 * Colunas obrigatórias: mat_cod_antigo, numero_pre_empenho. Demais colunas opcionais na view.
 */
export async function listEmpenhosPendentes(filtroMaterial?: string): Promise<EmpenhoPendente[]> {
  const pool = getDwPool();
  const schema = getDwSchema();
  const view = `${schema}v_safs_fempenho`;
  const hasFiltro = filtroMaterial != null && String(filtroMaterial).trim() !== '';
  const query = `
    SELECT mat_cod_antigo, numero_pre_empenho
    FROM ${view}
    ${hasFiltro ? 'WHERE mat_cod_antigo ILIKE $1' : ''}
    ORDER BY mat_cod_antigo, numero_pre_empenho
  `;
  try {
    const res = hasFiltro
      ? await pool.query(query, [`%${String(filtroMaterial).trim()}%`])
      : await pool.query(query);
    return res.rows.map((r: Record<string, unknown>) => ({
      mat_cod_antigo: String(r.mat_cod_antigo ?? ''),
      numero_pre_empenho: r.numero_pre_empenho != null ? String(r.numero_pre_empenho) : null,
    }));
  } catch {
    return [];
  }
}
