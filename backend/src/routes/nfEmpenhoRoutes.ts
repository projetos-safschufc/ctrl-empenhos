import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { validateBody } from '../middlewares/validate';
import { nfEmpenhoController } from '../controllers/nfEmpenhoController';
import { registrarRecebimentoBodySchema } from '../validators/registrarRecebimentoSchemas';

const router = Router();
router.use(authenticate);

router.get('/lista', nfEmpenhoController.listLista.bind(nfEmpenhoController));
router.post('/registrar-recebimento', validateBody(registrarRecebimentoBodySchema), nfEmpenhoController.registrarRecebimento.bind(nfEmpenhoController));
router.get('/', nfEmpenhoController.list.bind(nfEmpenhoController));
router.patch('/:id', nfEmpenhoController.update.bind(nfEmpenhoController));

export default router;
