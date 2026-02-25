import { Request, Response } from 'express';
import { provisionamentoService } from '../services/provisionamentoService';
import {
  gerarPDFProvisionamento,
  gerarPDFProvisionamentoConsolidado,
  LinhaProvisionamentoPDF,
  MaterialProvisionamentoPDF,
} from '../services/pdfProvisionamentoService';
import { sendError, ErrorCode } from '../utils/errorResponse';

export const provisionamentoController = {
  /** Lista todos os materiais com Registro Ativo = sim para a tabela de provisionamento. */
  async getRegistrosAtivos(req: Request, res: Response) {
    try {
      const linhas = await provisionamentoService.getTodosRegistrosAtivosParaTabela();
      res.json(linhas);
    } catch (err) {
      console.error(err);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao buscar registros ativos');
    }
  },

  async getPorCodigo(req: Request, res: Response) {
    const codigo = req.params.codigoMaterial as string;
    if (!codigo?.trim()) {
      sendError(res, 400, ErrorCode.BAD_REQUEST, 'Código do material é obrigatório');
      return;
    }

    try {
      const dados = await provisionamentoService.getDadosPorMaterial(codigo);
      if (!dados) {
        sendError(res, 404, ErrorCode.NOT_FOUND, 'Material não encontrado');
        return;
      }
      res.json(dados);
    } catch (err) {
      console.error(err);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao buscar dados do material');
    }
  },

  async gerarPdf(req: Request, res: Response) {
    const body = req.body as {
      codigoMaterial?: string;
      descricao?: string | null;
      mediaConsumo6Meses?: number;
      linhas?: Array<{
        numero_registro?: string;
        vigencia?: string;
        valor_unitario?: number;
        qtde_pedida: number;
        observacao?: string;
      }>;
    };

    if (!body.codigoMaterial?.trim()) {
      sendError(res, 400, ErrorCode.BAD_REQUEST, 'codigoMaterial é obrigatório');
      return;
    }
    if (!Array.isArray(body.linhas) || body.linhas.length === 0) {
      sendError(res, 400, ErrorCode.BAD_REQUEST, 'É necessário pelo menos uma linha com qtde_pedida');
      return;
    }

    const linhas: LinhaProvisionamentoPDF[] = body.linhas.map((l) => ({
      numero_registro: l.numero_registro,
      vigencia: l.vigencia,
      valor_unitario: l.valor_unitario,
      qtde_pedida: Number(l.qtde_pedida) || 0,
      observacao: l.observacao,
      valor_total: (Number(l.valor_unitario) || 0) * (Number(l.qtde_pedida) || 0),
    }));

    const dados = {
      codigoMaterial: body.codigoMaterial.trim(),
      descricao: body.descricao ?? null,
      dataGeracao: new Date().toLocaleString('pt-BR'),
      linhas,
      mediaConsumo6Meses: body.mediaConsumo6Meses,
    };

    try {
      const stream = gerarPDFProvisionamento(dados);
      const filename = `provisionamento_${body.codigoMaterial.trim()}_${Date.now()}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      stream.pipe(res);
    } catch (err) {
      console.error(err);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao gerar PDF');
    }
  },

  async gerarPdfConsolidado(req: Request, res: Response) {
    const body = req.body as {
      materiais?: Array<{
        codigoMaterial?: string;
        descricao?: string | null;
        mediaConsumo6Meses?: number;
        linhas?: Array<{
          numero_registro?: string;
          vigencia?: string;
          valor_unitario?: number;
          qtde_pedida: number;
          observacao?: string;
        }>;
      }>;
    };

    if (!Array.isArray(body.materiais) || body.materiais.length === 0) {
      sendError(res, 400, ErrorCode.BAD_REQUEST, 'É necessário pelo menos um material');
      return;
    }

    const materiais: MaterialProvisionamentoPDF[] = body.materiais
      .filter((m) => m.codigoMaterial?.trim())
      .map((m) => ({
        codigoMaterial: m.codigoMaterial!.trim(),
        descricao: m.descricao ?? null,
        mediaConsumo6Meses: m.mediaConsumo6Meses,
        linhas: (m.linhas || [])
          .filter((l) => Number(l.qtde_pedida) > 0)
          .map((l) => ({
            numero_registro: l.numero_registro,
            vigencia: l.vigencia,
            valor_unitario: l.valor_unitario,
            qtde_pedida: Number(l.qtde_pedida) || 0,
            observacao: l.observacao,
            valor_total: (Number(l.valor_unitario) || 0) * (Number(l.qtde_pedida) || 0),
          })),
      }))
      .filter((m) => m.linhas.length > 0);

    if (materiais.length === 0) {
      sendError(res, 400, ErrorCode.BAD_REQUEST, 'Nenhum material com quantidade pedida válida');
      return;
    }

    const dados = {
      dataGeracao: new Date().toLocaleString('pt-BR'),
      materiais,
    };

    try {
      const stream = gerarPDFProvisionamentoConsolidado(dados);
      const filename = `provisionamento-consolidado_${Date.now()}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      stream.pipe(res);
    } catch (err) {
      console.error(err);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao gerar PDF consolidado');
    }
  },
};
