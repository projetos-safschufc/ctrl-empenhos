import { Router } from 'express';
import authRoutes from './authRoutes';
import controleEmpenhoRoutes from './controleEmpenhoRoutes';
import provisionamentoRoutes from './provisionamentoRoutes';
import movimentacaoDiariaRoutes from './movimentacaoDiariaRoutes';
import empenhosPendentesRoutes from './empenhosPendentesRoutes';
import cacheRoutes from './cacheRoutes';
import analyticsRoutes from './analyticsRoutes';
import auditRoutes from './auditRoutes';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ message: 'API Controle de Empenhos e Estoque' });
});

router.use('/auth', authRoutes);
router.use('/controle-empenhos', controleEmpenhoRoutes);
router.use('/provisionamento', provisionamentoRoutes);
router.use('/movimentacao-diaria', movimentacaoDiariaRoutes);
router.use('/empenhos-pendentes', empenhosPendentesRoutes);
router.use('/cache', cacheRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/audit', auditRoutes);

export default router;
