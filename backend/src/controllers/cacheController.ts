/**
 * Controller para Gerenciamento de Cache
 * 
 * Endpoints para monitoramento e controle do cache em memória
 * Útil para ambiente INTRANET onde administradores podem monitorar performance
 */

import { Request, Response } from 'express';
import { memoryCache, CacheInvalidation } from '../utils/memoryCache';
import { sendError, ErrorCode } from '../utils/errorResponse';

export const cacheController = {
  /**
   * Retorna estatísticas do cache
   */
  async getStats(req: Request, res: Response) {
    try {
      const stats = memoryCache.getStats();
      
      res.json({
        ...stats,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      });
    } catch (error) {
      console.error('[Cache] Erro ao obter estatísticas:', error);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao obter estatísticas do cache');
    }
  },

  /**
   * Limpa todo o cache
   */
  async clearAll(req: Request, res: Response) {
    try {
      memoryCache.clear();
      
      res.json({
        message: 'Cache limpo com sucesso',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Cache] Erro ao limpar cache:', error);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao limpar cache');
    }
  },

  /**
   * Invalida cache específico por padrão
   */
  async invalidatePattern(req: Request, res: Response) {
    try {
      const { pattern } = req.body;
      
      if (!pattern || typeof pattern !== 'string') {
        sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Padrão é obrigatório');
        return;
      }

      const deleted = memoryCache.deletePattern(pattern);
      
      res.json({
        message: `Cache invalidado com sucesso`,
        pattern,
        deletedCount: deleted,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Cache] Erro ao invalidar cache por padrão:', error);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao invalidar cache');
    }
  },

  /**
   * Invalida cache por categoria
   */
  async invalidateCategory(req: Request, res: Response) {
    try {
      const { category } = req.params;
      
      switch (category) {
        case 'controle-empenhos':
          CacheInvalidation.controleEmpenhos();
          break;
        case 'movimentacao':
          CacheInvalidation.movimentacao();
          break;
        case 'consumos':
          CacheInvalidation.consumos();
          break;
        case 'totais-estoque':
          CacheInvalidation.totaisEstoque();
          break;
        default:
          sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Categoria inválida');
          return;
      }
      
      res.json({
        message: `Cache da categoria '${category}' invalidado com sucesso`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Cache] Erro ao invalidar cache por categoria:', error);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao invalidar cache');
    }
  },

  /**
   * Verifica se uma chave específica existe no cache
   */
  async checkKey(req: Request, res: Response) {
    try {
      const { key } = req.params;
      
      if (!key) {
        sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Chave é obrigatória');
        return;
      }

      const exists = memoryCache.has(key);
      const data = exists ? memoryCache.get(key) : null;
      
      res.json({
        key,
        exists,
        hasData: data !== null,
        dataType: data ? typeof data : null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Cache] Erro ao verificar chave:', error);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao verificar chave do cache');
    }
  },

  /**
   * Aquecimento do cache (pre-load de dados frequentes)
   */
  async warmup(req: Request, res: Response) {
    try {
      // Importar services apenas quando necessário para evitar dependências circulares
      const { controleEmpenhoService } = await import('../services/controleEmpenhoService');
      const { movimentacaoDiariaService } = await import('../services/movimentacaoDiariaService');
      
      const startTime = Date.now();
      const results = [];
      
      // Aquecer cache do dashboard
      try {
        await controleEmpenhoService.getDashboard();
        results.push({ service: 'dashboard', status: 'success' });
      } catch (error) {
        results.push({ service: 'dashboard', status: 'error', error: (error as Error).message });
      }
      
      // Aquecer cache de filtros de movimentação (mês atual)
      try {
        await movimentacaoDiariaService.getFiltrosOpcoes();
        results.push({ service: 'movimentacao-filtros', status: 'success' });
      } catch (error) {
        results.push({ service: 'movimentacao-filtros', status: 'error', error: (error as Error).message });
      }
      
      // Aquecer cache de controle de empenhos (primeira página)
      try {
        await controleEmpenhoService.getItens({}, 1, 30);
        results.push({ service: 'controle-empenhos', status: 'success' });
      } catch (error) {
        results.push({ service: 'controle-empenhos', status: 'error', error: (error as Error).message });
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      res.json({
        message: 'Aquecimento do cache concluído',
        duration: `${duration}ms`,
        results,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Cache] Erro durante aquecimento:', error);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro durante aquecimento do cache');
    }
  },
};