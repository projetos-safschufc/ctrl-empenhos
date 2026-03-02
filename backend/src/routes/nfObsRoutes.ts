import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { validateBody } from '../middlewares/validate';
import { nfObsController } from '../controllers/nfObsController';
import { createNfObsBodySchema } from '../validators/nfObsSchemas';

const router = Router();
router.use(authenticate);

router.get('/', nfObsController.getByEmpenhos.bind(nfObsController));
router.post('/', validateBody(createNfObsBodySchema), nfObsController.create.bind(nfObsController));

export default router;
