import { getDwPool, getDwSchema } from '../utils/dwPool';

/** Coluna de material na v_df_movimento (dw, schema gad_dlih_safs). Se a view usar cd_material, defina DW_MOV_MATERIAL_COLUMN=cd_material. */
const MOV_MATERIAL_COL = process.env.DW_MOV_MATERIAL_COLUMN || process.env.DW_MATERIAL_COLUMN || 'mat_cod_antigo';
/** Coluna de data do movimento (para ordenação decrescente). Padrão dt_geracao conforme v_df_movimento. */
const MOV_DATA_COL = process.env.DW_MOV_DATA_COLUMN || 'dt_geracao';
/** Relacionamento: código antes de "-" para match (ex.: 562.898-01 → 562.898). */
const MOV_MATERIAL_PREFIX_EXPR = `TRIM(SPLIT_PART(${MOV_MATERIAL_COL}::text, '-', 1))`;
/** Converte mesano (DATE ou timestamp na view) para inteiro YYYYMM. Evita "cannot cast type date to integer". */
const MESANO_YYYYMM = `(EXTRACT(YEAR FROM mesano)::int * 100 + EXTRACT(MONTH FROM mesano)::int)`;

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

/** Consumo por mês (mesano = YYYYMM, qtde = soma) */
export interface ConsumoMes {
  mesano: number;
  total: number;
}

/**
 * Retorna soma de consumo por mês para um material.
 * View: v_df_movimento (mat_cod_antigo, mesano, qtde_orig, movimento_cd). Match por código antes de "-".
 */
export async function getConsumosPorMaterialEMeses(
  materialCodigo: string,
  meses: number[]
): Promise<ConsumoMes[]> {
  if (meses.length === 0) return [];
  const pool = getDwPool();
  const schema = getDwSchema();
  const view = `${schema}v_df_movimento`;
  const variantes = variantesCodigoMaterial(materialCodigo);
  const phVariantes = variantes.map((_, i) => `$${i + 1}`).join(', ');
  const phMeses = meses.map((_, i) => `$${variantes.length + i + 1}`).join(', ');
  const query = `
    SELECT ${MESANO_YYYYMM} AS mesano, COALESCE(SUM(qtde_orig::numeric), 0) AS total
    FROM ${view}
    WHERE ${MOV_MATERIAL_PREFIX_EXPR} IN (${phVariantes}) AND ${MESANO_YYYYMM} IN (${phMeses}) AND movimento_cd = 'RM' AND qtde_orig::numeric > 0
    GROUP BY ${MESANO_YYYYMM}
  `;
  try {
    const res = await pool.query(query, [...variantes, ...meses]);
    return res.rows.map((r: { mesano: string; total: string }) => ({
      mesano: parseInt(r.mesano, 10),
      total: parseFloat(r.total) || 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Retorna consumos por mês para vários masters em uma única consulta (otimização para listagem).
 */
export async function getConsumosPorMastersEMeses(
  masters: string[],
  meses: number[]
): Promise<Map<string, ConsumoMes[]>> {
  if (masters.length === 0 || meses.length === 0) return new Map();
  const pool = getDwPool();
  const schema = getDwSchema();
  const view = `${schema}v_df_movimento`;
  const variantesList = masters.map((m) => variantesCodigoMaterial(m));
  const allVariantes = [...new Set(variantesList.flat())];
  const phVariantes = allVariantes.map((_, i) => `$${i + 1}`).join(', ');
  const phMeses = meses.map((_, i) => `$${allVariantes.length + i + 1}`).join(', ');
  const query = `
    SELECT ${MOV_MATERIAL_PREFIX_EXPR} AS master_code, ${MESANO_YYYYMM} AS mesano, COALESCE(SUM(qtde_orig::numeric), 0) AS total
    FROM ${view}
    WHERE ${MOV_MATERIAL_PREFIX_EXPR} IN (${phVariantes}) AND ${MESANO_YYYYMM} IN (${phMeses}) AND movimento_cd = 'RM' AND qtde_orig::numeric > 0
    GROUP BY ${MOV_MATERIAL_PREFIX_EXPR}, ${MESANO_YYYYMM}
  `;
  try {
    const res = await pool.query(query, [...allVariantes, ...meses]);
    const map = new Map<string, ConsumoMes[]>();
    for (const r of res.rows as { master_code: string; mesano: string; total: string }[]) {
      const master = String(r.master_code ?? '').trim();
      if (!master) continue;
      const mesano = parseInt(r.mesano, 10);
      const total = parseFloat(r.total) || 0;
      const arr = map.get(master) ?? [];
      arr.push({ mesano, total });
      map.set(master, arr);
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

/**
 * Último consumo (mês e quantidade) para o material. Match por código antes de "-".
 */
export async function getUltimoConsumo(materialCodigo: string): Promise<{ mesano: number; qtde: number } | null> {
  const pool = getDwPool();
  const schema = getDwSchema();
  const view = `${schema}v_df_movimento`;
  const variantes = variantesCodigoMaterial(materialCodigo);
  const ph = variantes.map((_, i) => `$${i + 1}`).join(', ');
  const query = `
    SELECT ${MESANO_YYYYMM} AS mesano, SUM(qtde_orig::numeric) AS qtde
    FROM ${view}
    WHERE ${MOV_MATERIAL_PREFIX_EXPR} IN (${ph}) AND movimento_cd = 'RM' AND qtde_orig::numeric > 0
    GROUP BY ${MESANO_YYYYMM}
    ORDER BY ${MESANO_YYYYMM} DESC
    LIMIT 1
  `;
  try {
    const res = await pool.query(query, variantes);
    const row = res.rows[0];
    if (!row) return null;
    return {
      mesano: parseInt(row.mesano, 10),
      qtde: parseFloat(row.qtde) || 0,
    };
  } catch {
    return null;
  }
}

/** Último consumo excluindo o mês atual (para "Mês último consumo" / "Qtde último consumo"). Match por código antes de "-". */
export async function getUltimoConsumoExcluindoMesAtual(
  materialCodigo: string,
  mesanoAtual: number
): Promise<{ mesano: number; qtde: number } | null> {
  const pool = getDwPool();
  const schema = getDwSchema();
  const view = `${schema}v_df_movimento`;
  const variantes = variantesCodigoMaterial(materialCodigo);
  const ph = variantes.map((_, i) => `$${i + 1}`).join(', ');
  const query = `
    SELECT ${MESANO_YYYYMM} AS mesano, SUM(qtde_orig::numeric) AS qtde
    FROM ${view}
    WHERE ${MOV_MATERIAL_PREFIX_EXPR} IN (${ph}) AND movimento_cd = 'RM' AND qtde_orig::numeric > 0 AND ${MESANO_YYYYMM} < $${variantes.length + 1}
    GROUP BY ${MESANO_YYYYMM}
    ORDER BY ${MESANO_YYYYMM} DESC
    LIMIT 1
  `;
  try {
    const res = await pool.query(query, [...variantes, mesanoAtual]);
    const row = res.rows[0];
    if (!row) return null;
    return {
      mesano: parseInt(row.mesano, 10),
      qtde: parseFloat(row.qtde) || 0,
    };
  } catch {
    return null;
  }
}

/**
 * Último consumo (excl. mês atual) para vários masters em uma consulta.
 * Fonte: banco dw, schema (ex. gad_dlih_safs), view v_df_movimento – mesano (mais recente < mesanoAtual), qtde_orig (soma).
 * Retorna, por material: mesano do último mês com consumo e soma(qtde_orig) daquele mês.
 * A coluna mesano na view pode ser DATE; converte-se para YYYYMM (inteiro) na query.
 */
export async function getUltimoConsumoExcluindoMesAtualPorMasters(
  masters: string[],
  mesanoAtual: number
): Promise<Map<string, { mesano: number; qtde: number } | null>> {
  if (masters.length === 0) return new Map();
  const pool = getDwPool();
  const schema = getDwSchema();
  const view = `${schema}v_df_movimento`;
  const variantesList = masters.map((m) => variantesCodigoMaterial(m));
  const allVariantes = [...new Set(variantesList.flat())];
  const ph = allVariantes.map((_, i) => `$${i + 1}`).join(', ');
  const query = `
    SELECT DISTINCT ON (${MOV_MATERIAL_PREFIX_EXPR})
      ${MOV_MATERIAL_PREFIX_EXPR} AS master_code,
      ${MESANO_YYYYMM} AS mesano,
      COALESCE(SUM(qtde_orig::numeric), 0) AS qtde
    FROM ${view}
    WHERE ${MOV_MATERIAL_PREFIX_EXPR} IN (${ph})
      AND COALESCE(TRIM(movimento_cd::text), '') = 'RM'
      AND COALESCE(qtde_orig::numeric, 0) > 0
      AND ${MESANO_YYYYMM} < $${allVariantes.length + 1}
    GROUP BY ${MOV_MATERIAL_PREFIX_EXPR}, ${MESANO_YYYYMM}
    ORDER BY ${MOV_MATERIAL_PREFIX_EXPR}, ${MESANO_YYYYMM} DESC
  `;
  try {
    const res = await pool.query(query, [...allVariantes, mesanoAtual]);
    const map = new Map<string, { mesano: number; qtde: number } | null>();
    for (const r of res.rows as { master_code: string; mesano: string; qtde: string }[]) {
      const master = String(r.master_code ?? '').trim();
      if (!master) continue;
      if (!map.has(master)) {
        map.set(master, {
          mesano: parseInt(r.mesano, 10),
          qtde: parseFloat(r.qtde) || 0,
        });
      }
    }
    for (const m of masters) {
      const variantes = variantesCodigoMaterial(m);
      const existing = variantes.map((v) => map.get(v)).find((x) => x != null);
      if (existing !== undefined && !map.has(m)) map.set(m, existing);
    }
    return map;
  } catch (err) {
    console.warn('[movimento] getUltimoConsumoExcluindoMesAtualPorMasters falhou:', (err as Error).message);
    return new Map();
  }
}

/** Registro de movimentação para relatório diário (linha detalhada da v_df_movimento). */
export interface MovimentacaoRegistro {
  data: string | null;
  mesano: number | null;
  mat_cod_antigo: string;
  umd_codigo: string | null;
  quantidade: number;
  valor: number | null;
  movimento_cd: string;
  tipo: string;
  alm_nome: string | null;
  setor_controle: string | null;
  centro_atividade: string | null;
  grupo: string | null;
  ser_nome: string | null;
}

/** Almoxarifados permitidos na tela Movimentação Diária (plano). Setor UACE ou ULOG para Setor controle virtual. */
const ALMOX_UACE = [
  '3-UACE HUWC - OPME',
  '4-UACE SATÉLITE - HUWC',
  '18-UNIDADE DE ALMOXARIFADO E CONTROLE DE ESTOQUE - ANEXO',
  '1-UNIDADE DE ALMOXARIFADO E CONTROLE DE ESTOQUE HUWC',
  '36-UACE - MATERIAIS GERAIS - SATÉLITE HUWC',
  '50-UACE QUARENTENA',
  '3-UACE MEAC - SATÉLITE',
  '1-UNIDADE DE ALMOXARIFADO E CONTROLE DE ESTOQUE MEAC',
  '2-(INATIVO) UACE SATÉLITE - MATERIAIS GERAIS MEAC',
  '16-CENTRAL DE CONSIGNADOS - UACE',
] as const;
const ALMOX_ULOG = ['2-UNIDADE DE LOGÍSTICA', '34-UNIDADE DE LOGÍSTICA (ANEXO)'] as const;
const ALMOX_PERMITIDOS = [...ALMOX_UACE, ...ALMOX_ULOG];

/** Lista de almoxarifados permitidos para os SELECTs da tela (exportada para uso no controller/API). */
export function getAlmoxarifadosPermitidos(): string[] {
  return [...ALMOX_PERMITIDOS];
}
const SETOR_UACE = 'UACE';
const SETOR_ULOG = 'ULOG';

function setorControleFromAlmNome(almNome: string | null): string | null {
  if (almNome == null || almNome === '') return null;
  const t = almNome.trim();
  if (ALMOX_UACE.some((a) => a === t)) return SETOR_UACE;
  if (ALMOX_ULOG.some((a) => a === t)) return SETOR_ULOG;
  return null;
}

export interface MovimentacaoDiariaFilters {
  almoxarifado?: string;
  setor_controle?: string;
  movimento?: string;
  material?: string;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Movimentações por MESANO (detalhadas). Filtra por mesano (YYYYMM) e alm_nome na lista permitida; ordenação decrescente por dt_geracao.
 * Suporta filtros (almoxarifado, setor_controle, movimento, material) e paginação.
 * View: v_df_movimento (dt_geracao, mesano, mat_cod_antigo, ...). Ordenação por coluna dt_geracao.
 */
export async function getMovimentacoesPorData(
  mesano: string,
  opts?: { filters?: MovimentacaoDiariaFilters; page?: number; pageSize?: number }
): Promise<{ itens: MovimentacaoRegistro[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, opts?.pageSize ?? DEFAULT_PAGE_SIZE));
  const filters = opts?.filters ?? {};
  const emptyResult = () => ({ itens: [], total: 0, page, pageSize });

  const mesanoNorm = (mesano ?? '').replace(/\D/g, '').slice(0, 6);
  if (!/^\d{6}$/.test(mesanoNorm)) return emptyResult();
  const mesanoInt = parseInt(mesanoNorm, 10);

  const pool = getDwPool();
  const schema = getDwSchema();
  const view = `${schema}v_df_movimento`;

  const params: unknown[] = [mesanoInt, ...ALMOX_PERMITIDOS];
  const phAlm = ALMOX_PERMITIDOS.map((_, i) => `$${i + 2}`).join(', ');
  let paramIdx = params.length;
  const conditions: string[] = [
    `(EXTRACT(YEAR FROM mesano)::int * 100 + EXTRACT(MONTH FROM mesano)::int) = $1`,
    `TRIM(COALESCE(alm_nome::text, '')) IN (${phAlm})`,
  ];
  if (filters.setor_controle?.trim()) {
    const setor = filters.setor_controle.trim().toUpperCase();
    if (setor === 'UACE') {
      conditions.push(`TRIM(COALESCE(alm_nome::text, '')) IN (${ALMOX_UACE.map((a) => {
        paramIdx++;
        params.push(a);
        return `$${paramIdx}`;
      }).join(', ')})`);
    } else if (setor === 'ULOG') {
      conditions.push(`TRIM(COALESCE(alm_nome::text, '')) IN (${ALMOX_ULOG.map((a) => {
        paramIdx++;
        params.push(a);
        return `$${paramIdx}`;
      }).join(', ')})`);
    }
  }
  if (filters.almoxarifado?.trim()) {
    paramIdx++;
    params.push(`%${filters.almoxarifado.trim()}%`);
    conditions.push(`alm_nome::text ILIKE $${paramIdx}`);
  }
  if (filters.movimento?.trim()) {
    paramIdx++;
    params.push(`%${filters.movimento.trim()}%`);
    conditions.push(`movimento_cd::text ILIKE $${paramIdx}`);
  }
  if (filters.material?.trim()) {
    paramIdx++;
    params.push(`%${filters.material.trim()}%`);
    conditions.push(`${MOV_MATERIAL_COL}::text ILIKE $${paramIdx}`);
  }

  const whereSql = conditions.join(' AND ');
  const baseQuery = `
    SELECT
      ${MOV_DATA_COL}::text AS data,
      (EXTRACT(YEAR FROM mesano)::int * 100 + EXTRACT(MONTH FROM mesano)::int) AS mesano,
      COALESCE(${MOV_MATERIAL_COL}::text, '') AS mat_cod_antigo,
      COALESCE(umd_codigo::text, '') AS umd_codigo,
      COALESCE(qtde_orig::numeric, 0) AS quantidade,
      valor_orig::numeric AS valor,
      COALESCE(movimento_cd::text, '') AS movimento_cd,
      alm_nome::text AS alm_nome,
      centro_atividade::text AS centro_atividade,
      grupo::text AS grupo,
      ser_nome::text AS ser_nome
    FROM ${view}
    WHERE ${whereSql}
    ORDER BY ${MOV_DATA_COL} DESC NULLS LAST, ${MOV_MATERIAL_COL} ASC NULLS LAST
  `;
  try {
    const countParams = [...params];
    const countQuery = `SELECT COUNT(*)::int AS total FROM (${baseQuery}) t`;
    const countRes = await pool.query(countQuery, countParams);
    const total = Number(countRes.rows[0]?.total ?? 0) || 0;

    paramIdx = params.length;
    const limitParam = `$${paramIdx + 1}`;
    const offsetParam = `$${paramIdx + 2}`;
    const dataQuery = `SELECT * FROM (${baseQuery}) sub LIMIT ${limitParam} OFFSET ${offsetParam}`;
    const dataRes = await pool.query(dataQuery, [...params, pageSize, (page - 1) * pageSize]);

    const itens = dataRes.rows.map((r: Record<string, unknown>) => {
      const alm = r.alm_nome != null ? String(r.alm_nome).trim() : null;
      return {
        data: r.data != null ? String(r.data) : null,
        mesano: r.mesano != null ? Number(r.mesano) : null,
        mat_cod_antigo: String(r.mat_cod_antigo ?? ''),
        umd_codigo: r.umd_codigo != null ? String(r.umd_codigo) : null,
        quantidade: Number(r.quantidade) || 0,
        valor: r.valor != null ? Number(r.valor) : null,
        movimento_cd: String(r.movimento_cd ?? ''),
        tipo: String(r.movimento_cd ?? ''),
        alm_nome: alm,
        setor_controle: setorControleFromAlmNome(alm),
        centro_atividade: r.centro_atividade != null ? String(r.centro_atividade) : null,
        grupo: r.grupo != null ? String(r.grupo) : null,
        ser_nome: r.ser_nome != null ? String(r.ser_nome) : null,
      };
    });
    return { itens, total, page, pageSize };
  } catch {
    try {
      const fallbackQuery = `
        SELECT
          ${MOV_MATERIAL_COL}::text AS mat_cod_antigo,
          COALESCE(movimento_cd::text, '') AS movimento_cd,
          COALESCE(SUM(qtde_orig::numeric), 0) AS quantidade,
          $1::int AS mesano
        FROM ${view}
        WHERE (EXTRACT(YEAR FROM mesano)::int * 100 + EXTRACT(MONTH FROM mesano)::int) = $1
        GROUP BY ${MOV_MATERIAL_COL}, movimento_cd
        ORDER BY ${MOV_MATERIAL_COL}, movimento_cd
        LIMIT $2 OFFSET $3
      `;
      const fallbackRes = await pool.query(fallbackQuery, [mesanoInt, pageSize, (page - 1) * pageSize]);
      const itens = fallbackRes.rows.map((r: Record<string, unknown>) => ({
        data: null,
        mesano: Number(r.mesano) || null,
        mat_cod_antigo: String(r.mat_cod_antigo ?? ''),
        umd_codigo: null,
        quantidade: Number(r.quantidade) || 0,
        valor: null,
        movimento_cd: String(r.movimento_cd ?? ''),
        tipo: String(r.movimento_cd ?? ''),
        alm_nome: null,
        setor_controle: null,
        centro_atividade: null,
        grupo: null,
        ser_nome: null,
      }));
      const countFallback = await pool.query(
        `SELECT COUNT(*)::int AS total FROM (SELECT 1 FROM ${view} WHERE (EXTRACT(YEAR FROM mesano)::int * 100 + EXTRACT(MONTH FROM mesano)::int) = $1 GROUP BY ${MOV_MATERIAL_COL}, movimento_cd) t`,
        [mesanoInt]
      );
      const total = Number(countFallback.rows[0]?.total ?? 0) || 0;
      return { itens, total, page, pageSize };
    } catch {
      return emptyResult();
    }
  }
}

const MAX_OPCOES_MATERIAL = 2000;
const MAX_MESANOS_LISTA = 36;

/**
 * Lista de MESANOs (YYYYMM) disponíveis na view para o SELECT da tela Movimentação Diária (ordem decrescente, últimos 36 meses).
 */
export async function getMesanosDisponiveis(): Promise<string[]> {
  const pool = getDwPool();
  const schema = getDwSchema();
  const view = `${schema}v_df_movimento`;
  const phAlm = ALMOX_PERMITIDOS.map((_, i) => `$${i + 1}`).join(', ');
  try {
    const res = await pool.query<{ m: string }>(
      `SELECT DISTINCT (EXTRACT(YEAR FROM mesano)::int * 100 + EXTRACT(MONTH FROM mesano)::int)::text AS m
       FROM ${view}
       WHERE TRIM(COALESCE(alm_nome::text, '')) IN (${phAlm})
       ORDER BY m DESC
       LIMIT ${MAX_MESANOS_LISTA}`,
      [...ALMOX_PERMITIDOS]
    );
    return res.rows.map((r) => r.m).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Retorna opções para os SELECTs da tela Movimentação Diária: mesanos, almoxarifados, movimentos e materiais.
 * @param mesano MESANO no formato YYYYMM (ex.: 202602).
 */
export async function getMovimentacaoFiltrosOpcoes(mesano: string): Promise<{
  mesanos: string[];
  almoxarifados: string[];
  movimentos: string[];
  materiais: string[];
}> {
  const almoxarifados = getAlmoxarifadosPermitidos();
  const movimentos: string[] = [];
  const materiais: string[] = [];
  const mesanoNorm = (mesano ?? '').replace(/\D/g, '').slice(0, 6);

  const pool = getDwPool();
  const schema = getDwSchema();
  const view = `${schema}v_df_movimento`;

  const mesanosPromise = getMesanosDisponiveis();

  if (!/^\d{6}$/.test(mesanoNorm)) {
    const mesanos = await mesanosPromise;
    return { mesanos, almoxarifados, movimentos, materiais };
  }

  const mesanoInt = parseInt(mesanoNorm, 10);
  const phAlm = ALMOX_PERMITIDOS.map((_, i) => `$${i + 2}`).join(', ');
  const whereBase = `(EXTRACT(YEAR FROM mesano)::int * 100 + EXTRACT(MONTH FROM mesano)::int) = $1 AND TRIM(COALESCE(alm_nome::text, '')) IN (${phAlm})`;

  try {
    const [mesanos, movRes, matRes] = await Promise.all([
      mesanosPromise,
      pool.query<{ movimento_cd: string }>(
        `SELECT DISTINCT COALESCE(TRIM(movimento_cd::text), '') AS movimento_cd FROM ${view} WHERE ${whereBase} ORDER BY movimento_cd`,
        [mesanoInt, ...ALMOX_PERMITIDOS]
      ),
      pool.query<{ mat_cod_antigo: string }>(
        `SELECT DISTINCT COALESCE(TRIM(${MOV_MATERIAL_COL}::text), '') AS mat_cod_antigo FROM ${view} WHERE ${whereBase} ORDER BY mat_cod_antigo LIMIT ${MAX_OPCOES_MATERIAL}`,
        [mesanoInt, ...ALMOX_PERMITIDOS]
      ),
    ]);
    for (const r of movRes.rows) if (r.movimento_cd != null && r.movimento_cd !== '') movimentos.push(r.movimento_cd);
    for (const r of matRes.rows) if (r.mat_cod_antigo != null && r.mat_cod_antigo !== '') materiais.push(r.mat_cod_antigo);
    return { mesanos, almoxarifados, movimentos, materiais };
  } catch {
    const mesanos = await mesanosPromise;
    return { mesanos, almoxarifados, movimentos, materiais };
  }
}
