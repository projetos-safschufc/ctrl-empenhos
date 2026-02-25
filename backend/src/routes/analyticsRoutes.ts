/**
 * Rotas para Analytics - Dashboard Analítico
 * 
 * Endpoints para métricas avançadas, analytics e relatórios
 * Restrito a usuários autenticados (ambiente INTRANET)
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { analyticsController } from '../controllers/analyticsController';
import { auditMiddleware } from '../middlewares/auditMiddleware';

const router = Router();

// Aplicar autenticação e auditoria a todas as rotas
router.use(authenticate);
router.use(auditMiddleware);

// ========== DASHBOARD ANALÍTICO ==========

// Dashboard principal com todas as métricas
router.get('/dashboard', analyticsController.getDashboardAnalytics);

// Métricas específicas
router.get('/metrics/performance', analyticsController.getPerformanceMetrics);
router.get('/metrics/users', analyticsController.getUserMetrics);

// Dados para gráficos
router.get('/trends', analyticsController.getTrends);
router.get('/distributions', analyticsController.getDistributions);

// ========== RELATÓRIOS ==========

// Resumo de auditoria
router.get('/audit/summary', analyticsController.getAuditSummary);

// Relatório executivo consolidado
router.get('/reports/executive', analyticsController.getExecutiveReport);

// ========== MÉTRICAS CUSTOMIZADAS ==========

// Registrar métrica customizada
router.post('/metrics/record', analyticsController.recordMetric);

// ========== SISTEMA ==========

// Health check do sistema de analytics
router.get('/health', analyticsController.getHealthCheck);

export default router;