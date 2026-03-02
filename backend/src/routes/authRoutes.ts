import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticate } from '../middlewares/authenticate';
import { validateBody } from '../middlewares/validate';
import { loginBodySchema, registerBodySchema } from '../validators/authSchemas';

const router = Router();

router.post('/login', validateBody(loginBodySchema), authController.login.bind(authController));
router.post('/register', validateBody(registerBodySchema), authController.register.bind(authController));

router.get('/me', authenticate, authController.me.bind(authController));

export default router;
