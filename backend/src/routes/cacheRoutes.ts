/**
 * Rotas para Gerenciamento de Cache
 * Restrito a usuários autenticados com perfil admin (ambiente INTRANET).
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { requireAdmin } from '../middlewares/requireAdmin';
import { cacheController } from '../controllers/cacheController';

const router = Router();

router.use(authenticate, requireAdmin);

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