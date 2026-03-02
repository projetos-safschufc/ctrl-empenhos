import { Request, Response } from 'express';
import { authService } from '../services/authService';
import { userRepository } from '../repositories/userRepository';
import { sendError, ErrorCode } from '../utils/errorResponse';

export const authController = {
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body as { email: string; password: string };
      const result = await authService.login(email, password);
      if (!result) {
        sendError(res, 401, ErrorCode.UNAUTHORIZED, 'Credenciais inválidas');
        return;
      }
      res.json(result);
    } catch (err) {
      console.error('[auth/login]', err);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao processar login. Verifique os logs do servidor.');
    }
  },

  async register(req: Request, res: Response) {
    const { email, password, name } = req.body as { email: string; password: string; name?: string };
    const result = await authService.register(email, password, name);
    if (!result) {
      sendError(res, 409, ErrorCode.CONFLICT, 'Email já cadastrado');
      return;
    }
    res.status(201).json(result);
  },

  async me(req: Request, res: Response) {
    const userId = (req as Request & { user?: { userId: number } }).user?.userId;
    if (!userId) {
      sendError(res, 401, ErrorCode.UNAUTHORIZED, 'Não autenticado');
      return;
    }

    const user = await userRepository.findById(userId);
    if (!user || !user.active) {
      sendError(res, 404, ErrorCode.NOT_FOUND, 'Usuário não encontrado');
      return;
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      profileId: user.profileId,
      profileName: user.profile.name,
    });
  },
};
