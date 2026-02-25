import { Response } from 'express';

/** Códigos de erro padronizados da API */
export const ErrorCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  BAD_REQUEST: 'BAD_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Formato padrão de resposta de erro: { code, message }. Mantém "error" para compatibilidade com clientes que leem .error */
export function sendError(
  res: Response,
  status: number,
  code: ErrorCodeType,
  message: string,
  details?: unknown
) {
  const body: { code: string; message: string; error?: string; details?: unknown } = {
    code,
    message,
    error: message,
  };
  if (details !== undefined) body.details = details;
  res.status(status).json(body);
}
