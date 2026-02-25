/**
 * Rotas para Auditoria - Sistema de Auditoria Avançada
 * 
 * Endpoints para logs de auditoria, compliance e investigação
 * Restrito a usuários autenticados com permissões adequadas
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { auditController } from '../controllers/auditController';
import { auditMiddleware, criticalOperationAudit } from '../middlewares/auditMiddleware';

const router = Router();

// Aplicar autenticação e auditoria a todas as rotas
router.use(authenticate);
router.use(auditMiddleware);

// ========== CONSULTA DE LOGS ==========

// Buscar logs com filtros avançados
router.get('/logs', auditController.searchLogs);

// Detalhes de um log específico
router.get('/logs/:id', auditController.getLogDetails);

// Exportar logs (JSON/CSV)
router.get('/logs/export', auditController.exportLogs);

// ========== RESUMOS E RELATÓRIOS ==========

// Resumo de auditoria para período
router.get('/summary', auditController.getSummary);

// Atividades de usuário específico
router.get('/users/:userId/activity', auditController.getUserActivity);

// ========== INVESTIGAÇÃO DE SEGURANÇA ==========

// Investigar atividades suspeitas
router.get('/investigation/suspicious', auditController.investigateSuspiciousActivity);

// ========== OPERAÇÕES ADMINISTRATIVAS ==========

// Limpeza de logs antigos (operação crítica)
router.post('/cleanup', 
  criticalOperationAudit('AUDIT_CLEANUP', 'audit_logs'),
  auditController.cleanupOldLogs
);

export default router;