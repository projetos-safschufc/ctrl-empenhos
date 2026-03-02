import { z } from 'zod';

export const loginBodySchema = z.object({
  email: z.string().min(1, 'Email é obrigatório').email('Email inválido').transform((s: string) => s.trim()),
  password: z.string().min(1, 'Senha é obrigatória'),
});

export const registerBodySchema = z.object({
  email: z.string().min(1, 'Email é obrigatório').email('Email inválido').transform((s: string) => s.trim()),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  name: z.string().optional().transform((s: string | undefined) => (s != null ? String(s).trim() : undefined)),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
export type RegisterBody = z.infer<typeof registerBodySchema>;
