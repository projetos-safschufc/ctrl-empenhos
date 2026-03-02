import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, type ZodIssue } from 'zod';
import { sendError, ErrorCode } from '../utils/errorResponse';

/**
 * Middleware que valida req.body contra um schema Zod e anexa o resultado em req.body (parsed).
 * Em caso de erro de validação, responde 400 com mensagens do Zod.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.body) as T;
      (req as Request & { body: T }).body = parsed;
      next();
    } catch (e: unknown) {
      if (e instanceof ZodError) {
        const messages = e.errors.map((err: ZodIssue) => `${err.path.join('.')}: ${err.message}`).join('; ');
        sendError(res, 400, ErrorCode.BAD_REQUEST, messages, e.errors);
        return;
      }
      throw e;
    }
  };
}

/**
 * Valida req.query contra um schema Zod e anexa o resultado em req.query (parsed).
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.query) as T;
      (req as Request & { query: T }).query = parsed as T & typeof req.query;
      next();
    } catch (e: unknown) {
      if (e instanceof ZodError) {
        const messages = e.errors.map((err: ZodIssue) => `${err.path.join('.')}: ${err.message}`).join('; ');
        sendError(res, 400, ErrorCode.BAD_REQUEST, messages, e.errors);
        return;
      }
      throw e;
    }
  };
}
