/**
 * Rotas para Gerenciamento de Cache
 * 
 * Endpoints administrativos para monitoramento e controle do cache
 * Restrito a usuários autenticados (ambiente INTRANET)
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { cacheController } from '../controllers/cacheController';

const router = Router();

// Aplicar autenticação a todas as rotas de cache
router.use(authenticate);

// Estatísticas do cache
router.get('/stats', cacheController.getStats);

// Limpeza completa do cache
router.delete('/clear', cacheController.clearAll);

// Invalidação por padrão
router.post('/invalidate/pattern', cacheController.invalidatePattern);

// Invalidação por categoria
router.delete('/invalidate/:category', cacheController.invalidateCategory);

// Verificar chave específica
router.get('/check/:key', cacheController.checkKey);

// Aquecimento do cache
router.post('/warmup', cacheController.warmup);

export default router;