import { Request, Response } from 'express';
import { nfEmpenhoService } from '../services/nfEmpenhoService';
import { sendError, ErrorCode } from '../utils/errorResponse';
import type { RegistrarRecebimentoBody } from '../validators/registrarRecebimentoSchemas';

function parsePage(s: unknown): number {
  const n = parseInt(String(s), 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function parsePageSize(s: unknown): number {
  const n = parseInt(String(s), 10);
  if (!Number.isFinite(n) || n < 1) return 20;
  return Math.min(n, 100);
}

function parsePageSizeLista(s: unknown): number {
  const n = parseInt(String(s), 10);
  if (!Number.isFinite(n) || n < 1) return 100;
  return Math.min(n, 500);
}

export const nfEmpenhoController = {
  /**
   * GET /nf-empenho — Lista public.nf_empenho com filtros (empenho, codigo) e paginação.
   * Usado pela tela "Editar Recebimento". Retorna itens no formato esperado pelo frontend.
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const empenho = (req.query.empenho as string)?.trim();
      const codigo = (req.query.codigo as string)?.trim();
      if (!empenho && !codigo) {
        sendError(
          res,
          400,
          ErrorCode.BAD_REQUEST,
          'É obrigatório informar ao menos um filtro: Empenho ou Código (Master).'
        );
        return;
      }
      const filters = {
        empenho,
        codigo,
        page: parsePage(req.query.page),
        pageSize: parsePageSize(req.query.pageSize),
      };
      const { itens, total } = await nfEmpenhoService.list(filters);
      res.json({
        itens: itens.map((r) => ({
          id: r.id,
          data: r.data ? r.data.toISOString().slice(0, 10) : '',
          empenho: r.empenho,
          codigo: r.codigo ?? '',
          item: r.item ?? '',
          material: r.material ?? '',
          saldo_emp: r.saldo_emp ?? 0,
          qtde_receb: r.qtde_receb ?? 0,
          obs: r.obs ?? '',
        })),
        total,
        page: filters.page,
        pageSize: filters.pageSize,
      });
    } catch (err) {
      console.error('[nf-empenho] list error:', err);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao listar NF empenho');
    }
  },

  /**
   * GET /nf-empenho/lista — Lista public.nf_empenho para a tela "Lista de Recebimentos".
   * Filtros opcionais (fornecedor, empenho, codigo). Sem obrigação de filtro; paginação padrão.
   */
  async listLista(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        fornecedor: (req.query.fornecedor as string)?.trim(),
        empenho: (req.query.empenho as string)?.trim(),
        codigo: (req.query.codigo as string)?.trim(),
        page: parsePage(req.query.page),
        pageSize: parsePageSizeLista(req.query.pageSize),
      };
      const { itens, total } = await nfEmpenhoService.listLista(filters);
      res.json({
        itens: itens.map((r) => ({
          id: r.id,
          fornecedor_nome: r.fornecedor ?? '',
          data_recebimento: r.data ? r.data.toISOString().slice(0, 10) : '',
          numero_nf: r.empenho,
          item: r.item ?? '',
          codigo: r.codigo ?? '',
          material: r.material ?? '',
          valor_total: r.saldo_emp ?? 0,
          qtde_receb: r.qtde_receb ?? 0,
          status: r.situacao ?? '',
          usuario: r.usuario ?? '',
        })),
        total,
        page: filters.page,
        pageSize: filters.pageSize,
      });
    } catch (err) {
      console.error('[nf-empenho/lista] listLista error:', err);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao listar NF empenho (lista)');
    }
  },

  /**
   * POST /nf-empenho/registrar-recebimento — Insere itens em public.nf_empenho (Lista de Empenhos).
   */
  async registrarRecebimento(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as RegistrarRecebimentoBody;
      const usuario = req.user?.userId != null ? String(req.user.userId) : req.user?.email ?? null;
      const { criados } = await nfEmpenhoService.registrarRecebimento(body.itens, usuario);
      res.status(201).json({ criados });
    } catch (err) {
      console.error('[nf-empenho] registrarRecebimento error:', err);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao registrar recebimento');
    }
  },

  /**
   * PATCH /nf-empenho/:id — Atualiza qtde_receb e/ou grava observação em nf_obs.
   * :id = id_emp (PK de public.nf_empenho).
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id) || id < 1) {
        sendError(res, 400, ErrorCode.BAD_REQUEST, 'ID inválido');
        return;
      }
      const body = req.body as { valor_total?: number; qtde_receb?: number; observacao?: string };
      const valorTotal = body.valor_total ?? body.qtde_receb;
      const usuario = req.user?.userId != null ? String(req.user.userId) : null;
      await nfEmpenhoService.update(
        id,
        {
          qtde_receb: valorTotal !== undefined ? Number(valorTotal) : undefined,
          observacao: body.observacao,
        },
        usuario
      );
      res.status(204).send();
    } catch (err) {
      console.error('[nf-empenho] update error:', err);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao atualizar NF empenho');
    }
  },
};
