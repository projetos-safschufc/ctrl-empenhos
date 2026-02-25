/**
 * Middleware para Invalidação Automática de Cache
 * 
 * Invalida cache automaticamente quando dados são alterados
 * Otimizado para ambiente INTRANET com poucos usuários
 */

import { Request, Response, NextFunction } from 'express';
import { CacheInvalidation } from '../utils/memoryCache';

/**
 * Middleware que invalida cache relacionado a controle de empenhos
 * Usar em rotas que modificam dados do controle de empenhos
 */
export function invalidateControleEmpenhosCache(req: Request, res: Response, next: NextFunction) {
  // Executar a invalidação após a resposta ser enviada
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // Só invalida se a operação foi bem-sucedida
      CacheInvalidation.controleEmpenhos();
      console.log('[Cache] Invalidated controle-empenhos cache after successful operation');
    }
  });
  
  next();
}

/**
 * Middleware que invalida cache relacionado a movimentação diária
 * Usar em rotas que modificam dados de movimentação
 */
export function invalidateMovimentacaoCache(req: Request, res: Response, next: NextFunction) {
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // Tentar extrair mesano da requisição para invalidação específica
      const mesano = req.body?.mesano || req.query?.mesano || req.params?.mesano;
      CacheInvalidation.movimentacao(mesano as string);
      console.log(`[Cache] Invalidated movimentacao cache for mesano: ${mesano || 'all'}`);
    }
  });
  
  next();
}

/**
 * Middleware que invalida cache de consumos
 * Usar em rotas que modificam dados históricos de consumo
 */
export function invalidateConsumosCache(req: Request, res: Response, next: NextFunction) {
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      CacheInvalidation.consumos();
      console.log('[Cache] Invalidated consumos cache after successful operation');
    }
  });
  
  next();
}

/**
 * Middleware que invalida cache de totais de estoque
 * Usar em rotas que modificam dados de estoque
 */
export function invalidateTotaisEstoqueCache(req: Request, res: Response, next: NextFunction) {
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      CacheInvalidation.totaisEstoque();
      console.log('[Cache] Invalidated totais estoque cache after successful operation');
    }
  });
  
  next();
}

/**
 * Middleware genérico que invalida todo o cache
 * Usar com cuidado, apenas em operações que afetam muitos dados
 */
export function invalidateAllCache(req: Request, res: Response, next: NextFunction) {
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      CacheInvalidation.controleEmpenhos();
      CacheInvalidation.movimentacao();
      CacheInvalidation.consumos();
      CacheInvalidation.totaisEstoque();
      console.log('[Cache] Invalidated ALL cache after successful operation');
    }
  });
  
  next();
}