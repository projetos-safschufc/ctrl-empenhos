import { Request, Response } from 'express';
import { controleEmpenhoService } from '../services/controleEmpenhoService';
import { histCtrlEmpenhoRepository } from '../repositories/histCtrlEmpenhoRepository';
import { catalogoRepository, CatalogoFilters } from '../repositories/catalogoRepository';
import { sendError, ErrorCode } from '../utils/errorResponse';

function parsePage(s: unknown): number {
  const n = parseInt(String(s), 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** pageSize máximo para listagem paginada. */
const MAX_PAGE_SIZE = 100;
/** pageSize máximo quando export=true (exportação Excel de todos os registros filtrados). */
const MAX_PAGE_SIZE_EXPORT = 5000;

function parsePageSize(s: unknown, isExport = false): number {
  const n = parseInt(String(s), 10);
  if (!Number.isFinite(n) || n < 1) return 20;
  const cap = isExport ? MAX_PAGE_SIZE_EXPORT : MAX_PAGE_SIZE;
  return Math.min(n, cap);
}

export const controleEmpenhoController = {
  async getItens(req: Request, res: Response) {
    const codigo = req.query.codigo as string | undefined;
    const responsavel = req.query.responsavel as string | undefined;
    const classificacao = req.query.classificacao as string | undefined;
    const setor = req.query.setor as string | undefined;
    const status = req.query.status as string | undefined;
    const comRegistro = req.query.comRegistro as string | undefined;
    const page = parsePage(req.query.page);
    const isExport = req.query.export === 'true';
    const pageSize = parsePageSize(req.query.pageSize, isExport);

    const filters: CatalogoFilters & { status?: string; comRegistro?: boolean } = {};
    if (codigo) filters.codigo = codigo;
    if (responsavel) filters.responsavel = responsavel;
    if (classificacao) filters.classificacao = classificacao;
    if (setor) filters.setor = setor;
    if (status) filters.status = status;
    if (comRegistro !== undefined) filters.comRegistro = comRegistro === 'true';

    try {
      const { itens, total, mesesConsumo } = await controleEmpenhoService.getItens(filters, page, pageSize);
      res.json({ itens, total, page, pageSize, mesesConsumo: mesesConsumo ?? [] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[controle-empenhos] getItens falhou:', msg);
      if (err instanceof Error && err.stack) console.error(err.stack);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao buscar itens de controle');
    }
  },

  async getDashboard(req: Request, res: Response) {
    try {
      const dashboard = await controleEmpenhoService.getDashboard();
      res.json(dashboard);
    } catch (err) {
      console.error(err);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao buscar dashboard');
    }
  },

  /** Retorna opções para filtros da tela (classificações e responsáveis distintos do catálogo). */
  async getOpcoesFiltros(req: Request, res: Response) {
    try {
      const [classificacoes, responsaveis] = await Promise.all([
        catalogoRepository.findDistinctClassificacoes(),
        catalogoRepository.findDistinctResponsaveis(),
      ]);
      res.json({ classificacoes, responsaveis });
    } catch (err) {
      console.error(err);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao buscar opções de filtros');
    }
  },

  async salvarHistorico(req: Request, res: Response) {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 401, ErrorCode.UNAUTHORIZED, 'Não autenticado');
      return;
    }

    const raw = (req.body || {}) as Record<string, unknown>;

    const materialId =
      raw.material_id != null ? parseInt(String(raw.material_id), 10) : NaN;
    if (!Number.isFinite(materialId) || materialId < 1) {
      sendError(res, 400, ErrorCode.BAD_REQUEST, 'material_id é obrigatório e deve ser um número válido');
      return;
    }

    const toNum = (v: unknown): number | undefined => {
      if (v == null) return undefined;
      const n = typeof v === 'number' ? v : parseFloat(String(v));
      return Number.isFinite(n) ? n : undefined;
    };
    const toStr = (v: unknown, maxLen?: number): string | undefined => {
      if (v == null) return undefined;
      const s = String(v).trim();
      if (s === '') return undefined;
      return maxLen ? s.slice(0, maxLen) : s;
    };

    try {
      const created = await histCtrlEmpenhoRepository.create({
        material_id: materialId,
        usuario_id: userId,
        classificacao: toStr(raw.classificacao, 100),
        resp_controle: toStr(raw.resp_controle, 200),
        setor_controle: toStr(raw.setor_controle, 100),
        master_descritivo: toStr(raw.master_descritivo, 100),
        numero_registro: toStr(raw.numero_registro, 50),
        valor_unit_registro: toNum(raw.valor_unit_registro),
        saldo_registro: toNum(raw.saldo_registro),
        qtde_por_embalagem: toNum(raw.qtde_por_embalagem),
        tipo_armazenamento: toStr(raw.tipo_armazenamento, 100),
        capacidade_estocagem: toStr(raw.capacidade_estocagem, 100),
        observacao: toStr(raw.observacao),
      });
      res.status(201).json(created);
    } catch (err) {
      const prismaErr = err as { code?: string; meta?: unknown };
      console.error('[salvarHistorico]', prismaErr);
      if (prismaErr.code === 'P2003') {
        sendError(
          res,
          400,
          ErrorCode.BAD_REQUEST,
          'Material ou usuário não encontrado. Verifique se o registro ainda existe.'
        );
        return;
      }
      if (prismaErr.code === 'P2002') {
        sendError(res, 409, ErrorCode.CONFLICT, 'Registro duplicado.');
        return;
      }
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao salvar histórico');
    }
  },
};
