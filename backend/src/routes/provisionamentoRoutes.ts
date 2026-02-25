import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { provisionamentoController } from '../controllers/provisionamentoController';

const router = Router();

router.use(authenticate);

router.get('/registros-ativos', provisionamentoController.getRegistrosAtivos.bind(provisionamentoController));
router.get('/:codigoMaterial', provisionamentoController.getPorCodigo.bind(provisionamentoController));
router.post('/gerar-pdf', provisionamentoController.gerarPdf.bind(provisionamentoController));
router.post('/gerar-pdf-consolidado', provisionamentoController.gerarPdfConsolidado.bind(provisionamentoController));

export default router;
