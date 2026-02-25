import { Router } from 'express';
import { movimentacaoDiariaController } from '../controllers/movimentacaoDiariaController';
import { authenticate } from '../middlewares/authenticate';

const router = Router();
router.use(authenticate);

router.get('/filtros-opcoes', movimentacaoDiariaController.getFiltrosOpcoes.bind(movimentacaoDiariaController));
router.get('/', movimentacaoDiariaController.getMovimentacoes.bind(movimentacaoDiariaController));

export default router;
