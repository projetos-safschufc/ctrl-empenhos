import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { sendError, ErrorCode } from '../utils/errorResponse';

export interface AuthUser {
  userId: number;
  profileId: number;
  email: string;
  profileName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Middleware que valida o JWT no header Authorization (Bearer <token>)
 * e anexa os dados do usuário em req.user.
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    sendError(res, 401, ErrorCode.UNAUTHORIZED, 'Token não informado');
    return;
  }

  const payload = authService.verifyToken(token);
  if (!payload) {
    sendError(res, 401, ErrorCode.UNAUTHORIZED, 'Token inválido ou expirado');
    return;
  }

  req.user = {
    userId: payload.userId,
    profileId: payload.profileId,
    email: payload.email,
    profileName: payload.profileName,
  };
  next();
}
