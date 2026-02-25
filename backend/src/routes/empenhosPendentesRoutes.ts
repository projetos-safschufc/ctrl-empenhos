import { Router } from 'express';
import { empenhosPendentesController } from '../controllers/empenhosPendentesController';
import { authenticate } from '../middlewares/authenticate';

const router = Router();
router.use(authenticate);

router.get('/', empenhosPendentesController.list.bind(empenhosPendentesController));

export default router;
