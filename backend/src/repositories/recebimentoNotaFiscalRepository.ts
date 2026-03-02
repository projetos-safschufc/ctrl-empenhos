import { getNfPool, getNfSchema } from '../utils/nfPool';
import type {
  RecebimentoNotaFiscal,
  ItemRecebimentoNf,
  CreateRecebimentoInput,
  UpdateRecebimentoInput,
  ListRecebimentoFilters,
  StatusRecebimento,
} from '../types/recebimentoNotaFiscal';

const TABLE_RNF = 'recebimento_nota_fiscal';
const TABLE_IRNF = 'item_recebimento_nf';

function rowToRecebimento(r: Record<string, unknown>): RecebimentoNotaFiscal {
  return {
    id: Number(r.id),
    numero_nf: String(r.numero_nf ?? ''),
    serie_nf: r.serie_nf != null ? String(r.serie_nf) : null,
    fornecedor_nome: r.fornecedor_nome != null ? String(r.fornecedor_nome) : null,
    fornecedor_cnpj: r.fornecedor_cnpj != null ? String(r.fornecedor_cnpj) : null,
    data_emissao: r.data_emissao != null ? String(r.data_emissao) : null,
    data_recebimento: String(r.data_recebimento ?? ''),
    valor_total: String(r.valor_total ?? '0'),
    status: (r.status as StatusRecebimento) ?? 'recebido',
    observacao: r.observacao != null ? String(r.observacao) : null,
    criado_em: String(r.criado_em ?? ''),
    atualizado_em: String(r.atualizado_em ?? ''),
    criado_por_user_id: r.criado_por_user_id != null ? Number(r.criado_por_user_id) : null,
  };
}

function rowToItem(r: Record<string, unknown>): ItemRecebimentoNf {
  return {
    id: Number(r.id),
    recebimento_id: Number(r.recebimento_id),
    material_codigo: r.material_codigo != null ? String(r.material_codigo) : null,
    descricao: r.descricao != null ? String(r.descricao) : null,
    quantidade: String(r.quantidade ?? '0'),
    unidade: String(r.unidade ?? 'UN'),
    valor_unitario: String(r.valor_unitario ?? '0'),
    valor_total: String(r.valor_total ?? '0'),
    criado_em: String(r.criado_em ?? ''),
  };
}

export const recebimentoNotaFiscalRepository = {
  async list(filters: ListRecebimentoFilters): Promise<{ rows: RecebimentoNotaFiscal[]; total: number }> {
    const pool = getNfPool();
    const schema = getNfSchema();
    const table = `${schema}${TABLE_RNF}`;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.numero_nf?.trim()) {
      conditions.push(`numero_nf ILIKE $${paramIndex}`);
      params.push(`%${filters.numero_nf.trim()}%`);
      paramIndex++;
    }
    if (filters.fornecedor_cnpj?.trim()) {
      conditions.push(`fornecedor_cnpj = $${paramIndex}`);
      params.push(filters.fornecedor_cnpj.trim().replace(/\D/g, ''));
      paramIndex++;
    }
    if (filters.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }
    if (filters.data_recebimento_inicio) {
      conditions.push(`data_recebimento >= $${paramIndex}`);
      params.push(filters.data_recebimento_inicio);
      paramIndex++;
    }
    if (filters.data_recebimento_fim) {
      conditions.push(`data_recebimento <= $${paramIndex}`);
      params.push(filters.data_recebimento_fim);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countQuery = `SELECT COUNT(*)::int AS total FROM ${table} ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const total = Number(countResult.rows[0]?.total ?? 0);

    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const orderQuery = `SELECT * FROM ${table} ${whereClause} ORDER BY data_recebimento DESC, id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const orderParams = [...params, pageSize, offset];
    const listResult = await pool.query(orderQuery, orderParams);
    const rows = listResult.rows.map((r) => rowToRecebimento(r as Record<string, unknown>));

    return { rows, total };
  },

  async getById(id: number): Promise<RecebimentoNotaFiscal | null> {
    const pool = getNfPool();
    const schema = getNfSchema();
    const table = `${schema}${TABLE_RNF}`;
    const result = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    const row = result.rows[0];
    return row ? rowToRecebimento(row as Record<string, unknown>) : null;
  },

  async getItensByRecebimentoId(recebimentoId: number): Promise<ItemRecebimentoNf[]> {
    const pool = getNfPool();
    const schema = getNfSchema();
    const table = `${schema}${TABLE_IRNF}`;
    const result = await pool.query(
      `SELECT * FROM ${table} WHERE recebimento_id = $1 ORDER BY id`,
      [recebimentoId]
    );
    return result.rows.map((r) => rowToItem(r as Record<string, unknown>));
  },

  async create(input: CreateRecebimentoInput): Promise<RecebimentoNotaFiscal> {
    const pool = getNfPool();
    const schema = getNfSchema();
    const table = `${schema}${TABLE_RNF}`;
    const itensTable = `${schema}${TABLE_IRNF}`;

    const valorTotal = input.valor_total ?? 0;
    const status = input.status ?? 'recebido';

    const insertQuery = `
      INSERT INTO ${table} (
        numero_nf, serie_nf, fornecedor_nome, fornecedor_cnpj,
        data_emissao, data_recebimento, valor_total, status, observacao, criado_por_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const insertParams = [
      input.numero_nf.trim(),
      input.serie_nf?.trim() ?? null,
      input.fornecedor_nome?.trim() ?? null,
      input.fornecedor_cnpj?.trim().replace(/\D/g, '') || null,
      input.data_emissao?.trim() || null,
      input.data_recebimento.trim(),
      valorTotal,
      status,
      input.observacao?.trim() ?? null,
      input.criado_por_user_id ?? null,
    ];
    const insertResult = await pool.query(insertQuery, insertParams);
    const recebimento = rowToRecebimento(insertResult.rows[0] as Record<string, unknown>);

    if (input.itens?.length) {
      for (const item of input.itens) {
        const qty = Number(item.quantidade) || 0;
        const vUnit = Number(item.valor_unitario) ?? 0;
        const vTotal = Number(item.valor_total) ?? qty * vUnit;
        await pool.query(
          `INSERT INTO ${itensTable} (recebimento_id, material_codigo, descricao, quantidade, unidade, valor_unitario, valor_total)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            recebimento.id,
            item.material_codigo?.trim() ?? null,
            item.descricao?.trim() ?? null,
            qty,
            item.unidade?.trim() ?? 'UN',
            vUnit,
            vTotal,
          ]
        );
      }
    }

    return recebimento;
  },

  async update(id: number, input: UpdateRecebimentoInput): Promise<RecebimentoNotaFiscal | null> {
    const pool = getNfPool();
    const schema = getNfSchema();
    const table = `${schema}${TABLE_RNF}`;

    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (input.numero_nf !== undefined) {
      updates.push(`numero_nf = $${idx++}`);
      params.push(input.numero_nf.trim());
    }
    if (input.serie_nf !== undefined) {
      updates.push(`serie_nf = $${idx++}`);
      params.push(input.serie_nf?.trim() ?? null);
    }
    if (input.fornecedor_nome !== undefined) {
      updates.push(`fornecedor_nome = $${idx++}`);
      params.push(input.fornecedor_nome?.trim() ?? null);
    }
    if (input.fornecedor_cnpj !== undefined) {
      updates.push(`fornecedor_cnpj = $${idx++}`);
      params.push(input.fornecedor_cnpj?.trim().replace(/\D/g, '') || null);
    }
    if (input.data_emissao !== undefined) {
      updates.push(`data_emissao = $${idx++}`);
      params.push(input.data_emissao?.trim() || null);
    }
    if (input.data_recebimento !== undefined) {
      updates.push(`data_recebimento = $${idx++}`);
      params.push(input.data_recebimento.trim());
    }
    if (input.valor_total !== undefined) {
      updates.push(`valor_total = $${idx++}`);
      params.push(input.valor_total);
    }
    if (input.status !== undefined) {
      updates.push(`status = $${idx++}`);
      params.push(input.status);
    }
    if (input.observacao !== undefined) {
      updates.push(`observacao = $${idx++}`);
      params.push(input.observacao?.trim() ?? null);
    }

    if (updates.length === 0) {
      return this.getById(id);
    }
    params.push(id);
    const query = `UPDATE ${table} SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await pool.query(query, params);
    const row = result.rows[0];
    return row ? rowToRecebimento(row as Record<string, unknown>) : null;
  },

  async delete(id: number): Promise<boolean> {
    const pool = getNfPool();
    const schema = getNfSchema();
    const table = `${schema}${TABLE_RNF}`;
    const result = await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  },
};
