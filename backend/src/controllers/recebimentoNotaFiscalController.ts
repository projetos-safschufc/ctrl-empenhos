import { Request, Response } from 'express';
import { recebimentoNotaFiscalService } from '../services/recebimentoNotaFiscalService';
import { sendError, ErrorCode } from '../utils/errorResponse';
import type { CreateRecebimentoInput, UpdateRecebimentoInput, StatusRecebimento } from '../types/recebimentoNotaFiscal';
import type { CreateRecebimentoBody, UpdateRecebimentoBody } from '../validators/recebimentoSchemas';

function parsePage(s: unknown): number {
  const n = parseInt(String(s), 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function parsePageSize(s: unknown): number {
  const n = parseInt(String(s), 10);
  if (!Number.isFinite(n) || n < 1) return 20;
  return Math.min(n, 100);
}

const STATUS_VALUES: StatusRecebimento[] = ['pendente', 'recebido', 'cancelado', 'devolvido'];

export const recebimentoNotaFiscalController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        numero_nf: (req.query.numero_nf as string)?.trim(),
        fornecedor_cnpj: (req.query.fornecedor_cnpj as string)?.trim(),
        status: STATUS_VALUES.includes(req.query.status as StatusRecebimento)
          ? (req.query.status as StatusRecebimento)
          : undefined,
        data_recebimento_inicio: (req.query.data_recebimento_inicio as string)?.trim(),
        data_recebimento_fim: (req.query.data_recebimento_fim as string)?.trim(),
        page: parsePage(req.query.page),
        pageSize: parsePageSize(req.query.pageSize),
      };
      const { itens, total } = await recebimentoNotaFiscalService.list(filters);
      res.json({ itens, total, page: filters.page, pageSize: filters.pageSize });
    } catch (err: unknown) {
      const pgCode = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';
      if (pgCode === '42P01') {
        sendError(
          res,
          503,
          ErrorCode.INTERNAL_ERROR,
          'Módulo de recebimento de NF não inicializado. Na pasta backend execute: npm run db:init-nf'
        );
        return;
      }
      console.error('[recebimento-nota-fiscal] list error:', err);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao listar recebimentos de notas fiscais');
    }
  },

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id) || id < 1) {
        sendError(res, 400, ErrorCode.BAD_REQUEST, 'ID inválido');
        return;
      }
      const recebimento = await recebimentoNotaFiscalService.getById(id);
      if (!recebimento) {
        sendError(res, 404, ErrorCode.NOT_FOUND, 'Recebimento não encontrado');
        return;
      }
      res.json(recebimento);
    } catch (err: unknown) {
      const pgCode = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';
      if (pgCode === '42P01') {
        sendError(res, 503, ErrorCode.INTERNAL_ERROR, 'Módulo de recebimento de NF não inicializado. Na pasta backend execute: npm run db:init-nf');
        return;
      }
      console.error('[recebimento-nota-fiscal] getById', err);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao buscar recebimento');
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as CreateRecebimentoBody;
      const userId = req.user?.userId;
      const input: CreateRecebimentoInput = {
        numero_nf: body.numero_nf,
        serie_nf: body.serie_nf,
        fornecedor_nome: body.fornecedor_nome,
        fornecedor_cnpj: body.fornecedor_cnpj,
        data_emissao: body.data_emissao,
        data_recebimento: body.data_recebimento,
        valor_total: body.valor_total,
        status: body.status,
        observacao: body.observacao,
        criado_por_user_id: userId,
        itens: body.itens,
      };
      const created = await recebimentoNotaFiscalService.create(input);
      res.status(201).json(created);
    } catch (err: unknown) {
      const pgCode = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';
      if (pgCode === '42P01') {
        sendError(res, 503, ErrorCode.INTERNAL_ERROR, 'Módulo de recebimento de NF não inicializado. Na pasta backend execute: npm run db:init-nf');
        return;
      }
      console.error('[recebimento-nota-fiscal] create', err);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao criar recebimento de nota fiscal');
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id) || id < 1) {
        sendError(res, 400, ErrorCode.BAD_REQUEST, 'ID inválido');
        return;
      }
      const body = req.body as UpdateRecebimentoBody;
      const input: UpdateRecebimentoInput = {};
      if (body.numero_nf !== undefined) input.numero_nf = body.numero_nf;
      if (body.serie_nf !== undefined) input.serie_nf = body.serie_nf;
      if (body.fornecedor_nome !== undefined) input.fornecedor_nome = body.fornecedor_nome;
      if (body.fornecedor_cnpj !== undefined) input.fornecedor_cnpj = body.fornecedor_cnpj;
      if (body.data_emissao !== undefined) input.data_emissao = body.data_emissao;
      if (body.data_recebimento !== undefined) input.data_recebimento = body.data_recebimento;
      if (body.valor_total !== undefined) input.valor_total = body.valor_total;
      if (body.status !== undefined) input.status = body.status;
      if (body.observacao !== undefined) input.observacao = body.observacao;

      const updated = await recebimentoNotaFiscalService.update(id, input);
      if (!updated) {
        sendError(res, 404, ErrorCode.NOT_FOUND, 'Recebimento não encontrado');
        return;
      }
      res.json(updated);
    } catch (err: unknown) {
      const pgCode = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';
      if (pgCode === '42P01') {
        sendError(res, 503, ErrorCode.INTERNAL_ERROR, 'Módulo de recebimento de NF não inicializado. Na pasta backend execute: npm run db:init-nf');
        return;
      }
      console.error('[recebimento-nota-fiscal] update', err);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao atualizar recebimento');
    }
  },

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id) || id < 1) {
        sendError(res, 400, ErrorCode.BAD_REQUEST, 'ID inválido');
        return;
      }
      const deleted = await recebimentoNotaFiscalService.delete(id);
      if (!deleted) {
        sendError(res, 404, ErrorCode.NOT_FOUND, 'Recebimento não encontrado');
        return;
      }
      res.status(204).send();
    } catch (err: unknown) {
      const pgCode = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';
      if (pgCode === '42P01') {
        sendError(res, 503, ErrorCode.INTERNAL_ERROR, 'Módulo de recebimento de NF não inicializado. Na pasta backend execute: npm run db:init-nf');
        return;
      }
      console.error('[recebimento-nota-fiscal] delete', err);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao excluir recebimento');
    }
  },
};
