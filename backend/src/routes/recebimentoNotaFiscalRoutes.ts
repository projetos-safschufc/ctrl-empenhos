import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { validateBody } from '../middlewares/validate';
import { recebimentoNotaFiscalController } from '../controllers/recebimentoNotaFiscalController';
import { createRecebimentoBodySchema, updateRecebimentoBodySchema } from '../validators/recebimentoSchemas';

const router = Router();
router.use(authenticate);

router.get('/', recebimentoNotaFiscalController.list.bind(recebimentoNotaFiscalController));
router.get('/:id', recebimentoNotaFiscalController.getById.bind(recebimentoNotaFiscalController));
router.post('/', validateBody(createRecebimentoBodySchema), recebimentoNotaFiscalController.create.bind(recebimentoNotaFiscalController));
router.patch('/:id', validateBody(updateRecebimentoBodySchema), recebimentoNotaFiscalController.update.bind(recebimentoNotaFiscalController));
router.delete('/:id', recebimentoNotaFiscalController.delete.bind(recebimentoNotaFiscalController));

export default router;
