import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticate } from '../middlewares/authenticate';

const router = Router();

router.post('/login', authController.login.bind(authController));
router.post('/register', authController.register.bind(authController));

router.get('/me', authenticate, authController.me.bind(authController));

export default router;
