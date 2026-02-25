import { Request, Response } from 'express';
import { listEmpenhosPendentesPublic } from '../repositories/empenhoRepository';
import { sendError, ErrorCode } from '../utils/errorResponse';

export const empenhosPendentesController = {
  /**
   * Lista empenhos pendentes da tabela public.empenho.
   * Critérios: status_item <> 'Atendido', fl_evento = 'Empenho'.
   * Query: codigo (material), empenho (nu_documento_siafi).
   */
  async list(req: Request, res: Response) {
    try {
      const codigo = (req.query.codigo as string) || (req.query.material as string) || undefined;
      const empenho = (req.query.empenho as string) || undefined;
      const page = req.query.page != null ? parseInt(String(req.query.page), 10) : undefined;
      const pageSize = req.query.pageSize != null ? parseInt(String(req.query.pageSize), 10) : undefined;
      const result = await listEmpenhosPendentesPublic({ codigo, empenho, page, pageSize });
      res.json(result);
    } catch (err) {
      console.error('[empenhosPendentesController.list]', err);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao listar empenhos pendentes');
    }
  },
};
