import { Request, Response, NextFunction } from 'express';
import { sendError, ErrorCode } from '../utils/errorResponse';

/**
 * Middleware que exige perfil de administrador (profileName === 'admin', case-insensitive).
 * Deve ser usado após authenticate. Retorna 403 se o usuário não for admin.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const profileName = (req as Request & { user?: { profileName?: string } }).user?.profileName;
  if (!profileName || profileName.toLowerCase() !== 'admin') {
    sendError(res, 403, ErrorCode.UNAUTHORIZED, 'Acesso restrito a administradores');
    return;
  }
  next();
}
