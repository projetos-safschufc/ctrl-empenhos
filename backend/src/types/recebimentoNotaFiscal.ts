/**
 * Tipos do módulo Recebimento de Notas Fiscais.
 * Alinhados às tabelas nf.recebimento_nota_fiscal e nf.item_recebimento_nf.
 */

export type StatusRecebimento = 'pendente' | 'recebido' | 'cancelado' | 'devolvido';

export interface RecebimentoNotaFiscal {
  id: number;
  numero_nf: string;
  serie_nf: string | null;
  fornecedor_nome: string | null;
  fornecedor_cnpj: string | null;
  data_emissao: string | null;
  data_recebimento: string;
  valor_total: string;
  status: StatusRecebimento;
  observacao: string | null;
  criado_em: string;
  atualizado_em: string;
  criado_por_user_id: number | null;
}

export interface ItemRecebimentoNf {
  id: number;
  recebimento_id: number;
  material_codigo: string | null;
  descricao: string | null;
  quantidade: string;
  unidade: string;
  valor_unitario: string;
  valor_total: string;
  criado_em: string;
}

export interface RecebimentoNotaFiscalComItens extends RecebimentoNotaFiscal {
  itens: ItemRecebimentoNf[];
}

export interface CreateRecebimentoInput {
  numero_nf: string;
  serie_nf?: string;
  fornecedor_nome?: string;
  fornecedor_cnpj?: string;
  data_emissao?: string;
  data_recebimento: string;
  valor_total?: number;
  status?: StatusRecebimento;
  observacao?: string;
  criado_por_user_id?: number;
  itens?: Array<{
    material_codigo?: string;
    descricao?: string;
    quantidade: number;
    unidade?: string;
    valor_unitario?: number;
    valor_total?: number;
  }>;
}

export interface UpdateRecebimentoInput {
  numero_nf?: string;
  serie_nf?: string;
  fornecedor_nome?: string;
  fornecedor_cnpj?: string;
  data_emissao?: string;
  data_recebimento?: string;
  valor_total?: number;
  status?: StatusRecebimento;
  observacao?: string;
}

export interface ListRecebimentoFilters {
  numero_nf?: string;
  fornecedor_cnpj?: string;
  status?: StatusRecebimento;
  data_recebimento_inicio?: string;
  data_recebimento_fim?: string;
  page?: number;
  pageSize?: number;
}
