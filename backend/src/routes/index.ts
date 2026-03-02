import { Router } from 'express';
import authRoutes from './authRoutes';
import controleEmpenhoRoutes from './controleEmpenhoRoutes';
import provisionamentoRoutes from './provisionamentoRoutes';
import movimentacaoDiariaRoutes from './movimentacaoDiariaRoutes';
import empenhosPendentesRoutes from './empenhosPendentesRoutes';
import cacheRoutes from './cacheRoutes';
import analyticsRoutes from './analyticsRoutes';
import auditRoutes from './auditRoutes';
import recebimentoNotaFiscalRoutes from './recebimentoNotaFiscalRoutes';
import nfEmpenhoRoutes from './nfEmpenhoRoutes';
import nfObsRoutes from './nfObsRoutes';

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
router.use('/recebimento-notas-fiscais', recebimentoNotaFiscalRoutes);
router.use('/nf-empenho', nfEmpenhoRoutes);
router.use('/nf-obs', nfObsRoutes);

export default router;
