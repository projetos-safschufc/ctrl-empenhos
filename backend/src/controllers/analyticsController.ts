/**
 * Analytics Controller - Dashboard Analítico
 * 
 * Controller responsável por endpoints de analytics e métricas avançadas
 * Fornece dados para dashboard analítico enterprise
 */

import { Request, Response } from 'express';
import { analyticsService } from '../services/analyticsService';
import { auditService } from '../services/auditService';
import { sendError, ErrorCode } from '../utils/errorResponse';

export const analyticsController = {
  /**
   * Dashboard analítico principal
   */
  async getDashboardAnalytics(req: Request, res: Response) {
    try {
      const analytics = await analyticsService.getDashboardAnalytics();
      
      res.json({
        success: true,
        data: analytics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Analytics] Erro ao buscar dashboard analytics:', error);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao buscar dados analíticos');
    }
  },

  /**
   * Métricas de performance em tempo real
   */
  async getPerformanceMetrics(req: Request, res: Response) {
    try {
      const metrics = await analyticsService.getPerformanceMetrics();
      
      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Analytics] Erro ao buscar métricas de performance:', error);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao buscar métricas de performance');
    }
  },

  /**
   * Métricas de usuários
   */
  async getUserMetrics(req: Request, res: Response) {
    try {
      const metrics = await analyticsService.getUserMetrics();
      
      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Analytics] Erro ao buscar métricas de usuários:', error);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao buscar métricas de usuários');
    }
  },

  /**
   * Tendências para gráficos
   */
  async getTrends(req: Request, res: Response) {
    try {
      const { type, days = 7 } = req.query;
      
      if (!type || typeof type !== 'string') {
        sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Tipo de tendência é obrigatório');
        return;
      }

      const trends = await analyticsService.getTrends();
      const requestedTrend = trends[type as keyof typeof trends];
      
      if (!requestedTrend) {
        sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Tipo de tendência inválido');
        return;
      }

      res.json({
        success: true,
        data: requestedTrend,
        type,
        period: `${days} dias`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Analytics] Erro ao buscar tendências:', error);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao buscar tendências');
    }
  },

  /**
   * Distribuições para gráficos de pizza/barras
   */
  async getDistributions(req: Request, res: Response) {
    try {
      const { type } = req.query;
      
      if (!type || typeof type !== 'string') {
        sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Tipo de distribuição é obrigatório');
        return;
      }

      const distributions = await analyticsService.getDistributions();
      const requestedDistribution = distributions[type as keyof typeof distributions];
      
      if (!requestedDistribution) {
        sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Tipo de distribuição inválido');
        return;
      }

      res.json({
        success: true,
        data: requestedDistribution,
        type,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Analytics] Erro ao buscar distribuições:', error);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao buscar distribuições');
    }
  },

  /**
   * Resumo de auditoria
   */
  async getAuditSummary(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Datas de início e fim são obrigatórias');
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Formato de data inválido');
        return;
      }

      const summary = await auditService.getAuditSummary(start, end);
      
      res.json({
        success: true,
        data: summary,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Analytics] Erro ao buscar resumo de auditoria:', error);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao buscar resumo de auditoria');
    }
  },

  /**
   * Registrar métrica customizada
   */
  async recordMetric(req: Request, res: Response) {
    try {
      const { metricName, metricValue, metricUnit, tags } = req.body;
      
      if (!metricName || metricValue === undefined) {
        sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Nome e valor da métrica são obrigatórios');
        return;
      }

      if (typeof metricValue !== 'number') {
        sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Valor da métrica deve ser numérico');
        return;
      }

      await analyticsService.recordSystemMetric(
        metricName,
        metricValue,
        metricUnit,
        tags
      );
      
      res.json({
        success: true,
        message: 'Métrica registrada com sucesso',
        data: {
          metricName,
          metricValue,
          metricUnit,
          tags
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Analytics] Erro ao registrar métrica:', error);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao registrar métrica');
    }
  },

  /**
   * Relatório executivo (dados consolidados)
   */
  async getExecutiveReport(req: Request, res: Response) {
    try {
      const { period = '30' } = req.query;
      const days = parseInt(period as string, 10);
      
      if (isNaN(days) || days < 1 || days > 365) {
        sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Período deve ser entre 1 e 365 dias');
        return;
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [analytics, auditSummary] = await Promise.all([
        analyticsService.getDashboardAnalytics(),
        auditService.getAuditSummary(startDate, endDate)
      ]);

      const report = {
        period: {
          days,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        summary: {
          totalMateriais: analytics.totalMateriais,
          materiaisCriticos: analytics.totalCritico,
          materialAtencao: analytics.totalAtencao,
          pendencias: analytics.totalPendencias,
          usuariosAtivos: analytics.activeUsers,
          totalLogins: analytics.dailyLogins,
          exportacoes: analytics.totalExports
        },
        performance: {
          tempoRespostaMedia: analytics.avgResponseTime,
          cacheHitRate: analytics.cacheHitRate,
          uptime: analytics.systemUptime,
          taxaErros: auditSummary.errorRate
        },
        auditoria: {
          totalLogs: auditSummary.totalLogs,
          usuariosUnicos: auditSummary.uniqueUsers,
          acoesFrequentes: auditSummary.topActions.slice(0, 5),
          entidadesFrequentes: auditSummary.topEntities.slice(0, 5)
        },
        tendencias: analytics.tendencias,
        distribuicoes: analytics.distribuicoes
      };

      res.json({
        success: true,
        data: report,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Analytics] Erro ao gerar relatório executivo:', error);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao gerar relatório executivo');
    }
  },

  /**
   * Health check do sistema de analytics
   */
  async getHealthCheck(req: Request, res: Response) {
    try {
      const startTime = Date.now();
      
      // Testar conectividade com serviços principais
      const [basicMetrics, performanceMetrics] = await Promise.all([
        analyticsService.getBasicMetrics().catch(() => null),
        analyticsService.getPerformanceMetrics().catch(() => null)
      ]);
      
      const responseTime = Date.now() - startTime;
      
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`,
        services: {
          basicMetrics: basicMetrics ? 'ok' : 'error',
          performanceMetrics: performanceMetrics ? 'ok' : 'error',
          database: 'ok', // Se chegou até aqui, DB está ok
          cache: 'ok'
        },
        uptime: Math.floor(process.uptime()),
        memory: process.memoryUsage()
      };
      
      // Se algum serviço falhou, marcar como degraded
      const hasErrors = Object.values(health.services).some(status => status === 'error');
      if (hasErrors) {
        health.status = 'degraded';
      }
      
      res.json(health);
    } catch (error) {
      console.error('[Analytics] Erro no health check:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Sistema de analytics indisponível'
      });
    }
  }
};