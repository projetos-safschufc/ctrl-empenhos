import { z } from 'zod';

const OBSERVACAO_MIN = 10;
const OBSERVACAO_MAX = 200;

export const createNfObsBodySchema = z.object({
  empenho_id: z
    .string()
    .min(1, 'empenho_id é obrigatório')
    .max(255)
    .transform((s) => s.trim()),
  observacao: z
    .string()
    .min(OBSERVACAO_MIN, `observacao deve ter no mínimo ${OBSERVACAO_MIN} caracteres`)
    .max(OBSERVACAO_MAX, `observacao deve ter no máximo ${OBSERVACAO_MAX} caracteres`)
    .transform((s) => s.trim()),
});

export type CreateNfObsBody = z.infer<typeof createNfObsBodySchema>;
