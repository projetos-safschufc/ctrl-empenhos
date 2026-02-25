import { Request, Response } from 'express';
import { movimentacaoDiariaService } from '../services/movimentacaoDiariaService';
import { sendError, ErrorCode } from '../utils/errorResponse';
import { getCurrentMesano } from '../utils/dateHelpers';

export const movimentacaoDiariaController = {
  async getMovimentacoes(req: Request, res: Response) {
    try {
      const mesanoRaw = (req.query.mesano as string)?.trim() ?? '';
      const mesano = /^\d{6}$/.test(mesanoRaw.replace(/\D/g, '')) ? mesanoRaw.replace(/\D/g, '').slice(0, 6) : getCurrentMesano();
      const page = req.query.page != null ? parseInt(String(req.query.page), 10) : undefined;
      const pageSize = req.query.pageSize != null ? parseInt(String(req.query.pageSize), 10) : undefined;
      const almoxarifado = (req.query.almoxarifado as string)?.trim() || undefined;
      const setor_controle = (req.query.setor_controle as string)?.trim() || undefined;
      const movimento = (req.query.movimento as string)?.trim() || undefined;
      const material = (req.query.material as string)?.trim() || undefined;
      const result = await movimentacaoDiariaService.getMovimentacoes({
        mesano,
        page,
        pageSize,
        almoxarifado,
        setor_controle,
        movimento,
        material,
      });
      res.json(result);
    } catch (err) {
      console.error('[movimentacaoDiariaController.getMovimentacoes]', err);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao buscar movimentações');
    }
  },

  async getFiltrosOpcoes(req: Request, res: Response) {
    try {
      const mesanoRaw = (req.query.mesano as string)?.trim() ?? '';
      const mesano = /^\d{6}$/.test(mesanoRaw.replace(/\D/g, '')) ? mesanoRaw.replace(/\D/g, '').slice(0, 6) : getCurrentMesano();
      const result = await movimentacaoDiariaService.getFiltrosOpcoes(mesano);
      res.json(result);
    } catch (err) {
      console.error('[movimentacaoDiariaController.getFiltrosOpcoes]', err);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao buscar opções dos filtros');
    }
  },
};
