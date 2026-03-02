import { z } from 'zod';

const statusRecebimento = z.enum(['pendente', 'recebido', 'cancelado', 'devolvido']);

export const createRecebimentoBodySchema = z.object({
  numero_nf: z.string().min(1, 'numero_nf é obrigatório').transform((s: string) => s.trim()),
  serie_nf: z.string().optional().transform((s: string | undefined) => s?.trim()),
  fornecedor_nome: z.string().optional().transform((s: string | undefined) => s?.trim()),
  fornecedor_cnpj: z.string().optional().transform((s: string | undefined) => s?.trim().replace(/\D/g, '') || undefined),
  data_emissao: z.string().optional().transform((s: string | undefined) => s?.trim()),
  data_recebimento: z.string().min(1, 'data_recebimento é obrigatório').transform((s: string) => s.trim()),
  valor_total: z.number().optional(),
  status: statusRecebimento.optional(),
  observacao: z.string().optional().transform((s: string | undefined) => s?.trim()),
  itens: z
    .array(
      z.object({
        material_codigo: z.string().optional(),
        descricao: z.string().optional(),
        quantidade: z.number(),
        unidade: z.string().optional(),
        valor_unitario: z.number().optional(),
        valor_total: z.number().optional(),
      })
    )
    .optional(),
});

export const updateRecebimentoBodySchema = z.object({
  numero_nf: z.string().optional(),
  serie_nf: z.string().optional(),
  fornecedor_nome: z.string().optional(),
  fornecedor_cnpj: z.string().optional(),
  data_emissao: z.string().optional(),
  data_recebimento: z.string().optional(),
  valor_total: z.number().optional(),
  status: statusRecebimento.optional(),
  observacao: z.string().optional(),
});

export type CreateRecebimentoBody = z.infer<typeof createRecebimentoBodySchema>;
export type UpdateRecebimentoBody = z.infer<typeof updateRecebimentoBodySchema>;
