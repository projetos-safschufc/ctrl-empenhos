import { Request, Response } from 'express';
import { nfObsService } from '../services/nfObsService';
import { sendError, ErrorCode } from '../utils/errorResponse';
import type { CreateNfObsBody } from '../validators/nfObsSchemas';

export const nfObsController = {
  /**
   * GET /nf-obs?empenhos=id1,id2,... — Retorna a última observação por empenho (para Lista de Empenhos).
   */
  async getByEmpenhos(req: Request, res: Response): Promise<void> {
    try {
      const raw = (req.query.empenhos as string) ?? '';
      const empenhoIds = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const observacoes = await nfObsService.getObservacoesByEmpenhos(empenhoIds);
      res.json({ observacoes });
    } catch (err) {
      console.error('[nf-obs] getByEmpenhos error:', err);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao buscar observações');
    }
  },

  /**
   * POST /nf-obs — Insere observação em public.nf_obs (tela Adicionar Observações).
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as CreateNfObsBody;
      const usuario = req.user?.userId != null ? String(req.user.userId) : req.user?.email ?? null;
      const created = await nfObsService.create(
        {
          empenho_id: body.empenho_id,
          observacao: body.observacao,
        },
        usuario
      );
      res.status(201).json(created);
    } catch (err) {
      console.error('[nf-obs] create error:', err);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao salvar observação');
    }
  },
};
