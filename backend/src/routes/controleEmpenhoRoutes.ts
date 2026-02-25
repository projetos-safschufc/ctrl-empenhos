import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { controleEmpenhoController } from '../controllers/controleEmpenhoController';
import { invalidateControleEmpenhosCache } from '../middlewares/cacheInvalidation';

const router = Router();

router.use(authenticate);

router.get('/dashboard', controleEmpenhoController.getDashboard.bind(controleEmpenhoController));
router.get('/', controleEmpenhoController.getItens.bind(controleEmpenhoController));
router.post('/historico', invalidateControleEmpenhosCache, controleEmpenhoController.salvarHistorico.bind(controleEmpenhoController));

export default router;
