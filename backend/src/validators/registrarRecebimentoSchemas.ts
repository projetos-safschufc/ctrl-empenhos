import { z } from 'zod';

const itemSchema = z.object({
  fornecedor: z.string().optional().nullable().transform((s) => s?.trim() ?? null),
  empenho: z.string().min(1, 'empenho é obrigatório').max(255).transform((s) => s.trim()),
  item: z.string().optional().nullable().transform((s) => s?.trim() ?? null),
  codigo: z.string().optional().nullable().transform((s) => s?.trim() ?? null),
  material: z.string().optional().nullable().transform((s) => s?.trim() ?? null),
  saldo_emp: z.number().optional().nullable(),
  qtde_receb: z.number().int('qtde_receb deve ser inteiro').positive('qtde_receb deve ser maior que 0'),
  observacao: z.string().optional().nullable().transform((s) => s?.trim() || null),
});

export const registrarRecebimentoBodySchema = z.object({
  itens: z.array(itemSchema).min(1, 'Ao menos um item é obrigatório'),
});

export type RegistrarRecebimentoBody = z.infer<typeof registrarRecebimentoBodySchema>;
