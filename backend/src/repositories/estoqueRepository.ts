import { getDwPool, getDwSchema } from '../utils/dwPool';

/** Coluna de material na v_df_estoque (plano: nome_do_material_padronizado, extrair antes de "-"). */
const ESTOQUE_MATERIAL_COL =
  process.env.DW_ESTOQUE_MATERIAL_COLUMN || process.env.DW_MATERIAL_COLUMN || 'mat_cod_antigo';
const ESTOQUE_MATERIAL_PREFIX_EXPR = `TRIM(SPLIT_PART(${ESTOQUE_MATERIAL_COL}::text, '-', 1))`;

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
 * Estoque geral (complexo) - soma da coluna "saldo" por material.
 * View: v_df_estoque (saldo; material: nome_do_material_padronizado ou mat_cod_antigo). Match por código antes de "-".
 */
export async function getEstoqueGeralPorMaterial(materialCodigo: string): Promise<number> {
  const pool = getDwPool();
  const schema = getDwSchema();
  const view = `${schema}v_df_estoque`;
  const variantes = variantesCodigoMaterial(materialCodigo);
  const placeholders = variantes.map((_, i) => `$${i + 1}`).join(', ');
  const query = `
    SELECT COALESCE(SUM(saldo::numeric), 0) AS total
    FROM ${view}
    WHERE ${ESTOQUE_MATERIAL_PREFIX_EXPR} IN (${placeholders})
  `;
  try {
    const res = await pool.query(query, variantes);
    const row = res.rows[0];
    return row ? Number(row.total) || 0 : 0;
  } catch {
    return 0;
  }
}

/** Estoque geral para vários masters em uma consulta. */
export async function getEstoqueGeralPorMasters(masters: string[]): Promise<Map<string, number>> {
  if (masters.length === 0) return new Map();
  const pool = getDwPool();
  const schema = getDwSchema();
  const view = `${schema}v_df_estoque`;
  const variantesList = masters.map((m) => variantesCodigoMaterial(m));
  const allVariantes = [...new Set(variantesList.flat())];
  const placeholders = allVariantes.map((_, i) => `$${i + 1}`).join(', ');
  const query = `
    SELECT ${ESTOQUE_MATERIAL_PREFIX_EXPR} AS master_code, COALESCE(SUM(saldo::numeric), 0) AS total
    FROM ${view}
    WHERE ${ESTOQUE_MATERIAL_PREFIX_EXPR} IN (${placeholders})
    GROUP BY ${ESTOQUE_MATERIAL_PREFIX_EXPR}
  `;
  try {
    const res = await pool.query(query, allVariantes);
    const map = new Map<string, number>();
    for (const r of res.rows as { master_code: string; total: string }[]) {
      const master = String(r.master_code ?? '').trim();
      if (!master) continue;
      map.set(master, Number(r.total) || 0);
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
