/**
 * Audit Controller - Sistema de Auditoria Avançada
 * 
 * Controller responsável por endpoints de auditoria e compliance
 * Fornece acesso aos logs de auditoria e ferramentas de investigação
 */

import { Request, Response } from 'express';
import { auditService, AuditSearchFilters } from '../services/auditService';
import { sendError, ErrorCode } from '../utils/errorResponse';

export const auditController = {
  /**
   * Buscar logs de auditoria com filtros avançados
   */
  async searchLogs(req: Request, res: Response) {
    try {
      const {
        userId,
        action,
        entityType,
        entityId,
        startDate,
        endDate,
        ipAddress,
        statusCode,
        page = 1,
        pageSize = 50
      } = req.query;

      const filters: AuditSearchFilters = {
        page: parseInt(page as string, 10),
        pageSize: Math.min(100, parseInt(pageSize as string, 10))
      };

      // Aplicar filtros opcionais
      if (userId) filters.userId = parseInt(userId as string, 10);
      if (action) filters.action = action as string;
      if (entityType) filters.entityType = entityType as string;
      if (entityId) filters.entityId = entityId as string;
      if (ipAddress) filters.ipAddress = ipAddress as string;
      if (statusCode) filters.statusCode = parseInt(statusCode as string, 10);
      
      if (startDate) {
        const start = new Date(startDate as string);
        if (!isNaN(start.getTime())) {
          filters.startDate = start;
        }
      }
      
      if (endDate) {
        const end = new Date(endDate as string);
        if (!isNaN(end.getTime())) {
          filters.endDate = end;
        }
      }

      const result = await auditService.searchLogs(filters);
      
      res.json({
        success: true,
        data: result.logs,
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: result.totalPages
        },
        filters: filters,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Audit] Erro ao buscar logs:', error);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao buscar logs de auditoria');
    }
  },

  /**
   * Obter detalhes de um log específico
   */
  async getLogDetails(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id, 10))) {
        sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'ID do log inválido');
        return;
      }

      const logId = parseInt(id, 10);
      
      // Buscar log específico
      const result = await auditService.searchLogs({
        page: 1,
        pageSize: 1
      });
      
      const log = result.logs.find(l => l.id === logId);
      
      if (!log) {
        sendError(res, 404, ErrorCode.NOT_FOUND, 'Log de auditoria não encontrado');
        return;
      }

      // Buscar logs relacionados (mesmo usuário, mesma sessão, mesmo período)
      const relatedLogs = await auditService.searchLogs({
        userId: log.userId || undefined,
        startDate: new Date(log.createdAt.getTime() - 5 * 60 * 1000), // 5 min antes
        endDate: new Date(log.createdAt.getTime() + 5 * 60 * 1000),   // 5 min depois
        page: 1,
        pageSize: 10
      });

      res.json({
        success: true,
        data: {
          log,
          relatedLogs: relatedLogs.logs.filter(l => l.id !== logId)
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Audit] Erro ao buscar detalhes do log:', error);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao buscar detalhes do log');
    }
  },

  /**
   * Obter resumo de auditoria para período
   */
  async getSummary(req: Request, res: Response) {
    try {
      const { startDate, endDate, period = '7' } = req.query;
      
      let start: Date, end: Date;
      
      if (startDate && endDate) {
        start = new Date(startDate as string);
        end = new Date(endDate as string);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Formato de data inválido');
          return;
        }
      } else {
        // Usar período padrão
        const days = parseInt(period as string, 10);
        if (isNaN(days) || days < 1 || days > 365) {
          sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Período deve ser entre 1 e 365 dias');
          return;
        }
        
        end = new Date();
        start = new Date();
        start.setDate(start.getDate() - days);
      }

      const summary = await auditService.getAuditSummary(start, end);
      
      res.json({
        success: true,
        data: summary,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Audit] Erro ao gerar resumo:', error);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao gerar resumo de auditoria');
    }
  },

  /**
   * Buscar atividades de um usuário específico
   */
  async getUserActivity(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { days = '30', page = 1, pageSize = 50 } = req.query;
      
      if (!userId || isNaN(parseInt(userId, 10))) {
        sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'ID do usuário inválido');
        return;
      }

      const daysNum = parseInt(days as string, 10);
      if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
        sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Período deve ser entre 1 e 365 dias');
        return;
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);

      const result = await auditService.searchLogs({
        userId: parseInt(userId, 10),
        startDate,
        endDate,
        page: parseInt(page as string, 10),
        pageSize: Math.min(100, parseInt(pageSize as string, 10))
      });

      // Calcular estatísticas do usuário
      const userStats = {
        totalActions: result.total,
        uniqueDays: new Set(result.logs.map(log => 
          log.createdAt.toISOString().split('T')[0]
        )).size,
        topActions: result.logs.reduce((acc, log) => {
          acc[log.action] = (acc[log.action] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        errorCount: result.logs.filter(log => 
          log.statusCode && log.statusCode >= 400
        ).length,
        avgExecutionTime: result.logs
          .filter(log => log.executionTimeMs)
          .reduce((sum, log) => sum + (log.executionTimeMs || 0), 0) / 
          result.logs.filter(log => log.executionTimeMs).length || 0
      };

      res.json({
        success: true,
        data: {
          logs: result.logs,
          stats: userStats,
          pagination: {
            page: result.page,
            pageSize: result.pageSize,
            total: result.total,
            totalPages: result.totalPages
          }
        },
        period: {
          days: daysNum,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Audit] Erro ao buscar atividade do usuário:', error);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao buscar atividade do usuário');
    }
  },

  /**
   * Investigar atividades suspeitas
   */
  async investigateSuspiciousActivity(req: Request, res: Response) {
    try {
      const { type = 'all', severity = 'all', days = '7' } = req.query;
      
      const daysNum = parseInt(days as string, 10);
      if (isNaN(daysNum) || daysNum < 1 || daysNum > 90) {
        sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Período deve ser entre 1 e 90 dias');
        return;
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);

      // Buscar alertas de segurança
      const securityAlerts = await auditService.searchLogs({
        action: 'SECURITY_ALERT',
        startDate,
        endDate,
        page: 1,
        pageSize: 100
      });

      // Buscar tentativas de login falhadas
      const failedLogins = await auditService.searchLogs({
        action: 'LOGIN_FAILED',
        startDate,
        endDate,
        page: 1,
        pageSize: 50
      });

      // Buscar acessos fora do horário
      const afterHoursAccess = await auditService.searchLogs({
        startDate,
        endDate,
        page: 1,
        pageSize: 50
      });

      // Filtrar acessos fora do horário (antes das 7h ou depois das 18h)
      const suspiciousAccess = afterHoursAccess.logs.filter(log => {
        const hour = log.createdAt.getHours();
        return hour < 7 || hour > 18;
      });

      // Buscar múltiplos IPs por usuário
      const multipleIpUsers = await this.findMultipleIpUsers(startDate, endDate);

      const investigation = {
        period: {
          days: daysNum,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        summary: {
          securityAlerts: securityAlerts.total,
          failedLogins: failedLogins.total,
          afterHoursAccess: suspiciousAccess.length,
          multipleIpUsers: multipleIpUsers.length
        },
        details: {
          securityAlerts: securityAlerts.logs.slice(0, 10),
          failedLogins: failedLogins.logs.slice(0, 10),
          afterHoursAccess: suspiciousAccess.slice(0, 10),
          multipleIpUsers: multipleIpUsers.slice(0, 10)
        },
        recommendations: this.generateSecurityRecommendations({
          securityAlerts: securityAlerts.total,
          failedLogins: failedLogins.total,
          afterHoursAccess: suspiciousAccess.length,
          multipleIpUsers: multipleIpUsers.length
        })
      };

      res.json({
        success: true,
        data: investigation,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Audit] Erro na investigação de atividades suspeitas:', error);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro na investigação de atividades suspeitas');
    }
  },

  /**
   * Exportar logs de auditoria
   */
  async exportLogs(req: Request, res: Response) {
    try {
      const { format = 'json', ...filterParams } = req.query;
      
      if (!['json', 'csv'].includes(format as string)) {
        sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Formato deve ser json ou csv');
        return;
      }

      // Buscar logs com limite maior para exportação
      const filters: AuditSearchFilters = {
        page: 1,
        pageSize: 10000 // Limite para exportação
      };

      // Aplicar filtros da query
      Object.assign(filters, filterParams);

      const result = await auditService.searchLogs(filters);
      
      if (format === 'csv') {
        // Converter para CSV
        const csvHeaders = [
          'ID', 'Data/Hora', 'Usuário', 'Email', 'Ação', 'Tipo Entidade', 
          'ID Entidade', 'IP', 'Status', 'Tempo Execução (ms)', 'Endpoint'
        ];
        
        const csvRows = result.logs.map(log => [
          log.id,
          log.createdAt.toISOString(),
          log.userName || '',
          log.userEmail || '',
          log.action,
          log.entityType,
          log.entityId || '',
          log.ipAddress || '',
          log.statusCode || '',
          log.executionTimeMs || '',
          log.endpoint || ''
        ]);

        const csvContent = [
          csvHeaders.join(','),
          ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);
      } else {
        // Retornar JSON
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.json"`);
        res.json({
          exportedAt: new Date().toISOString(),
          totalRecords: result.total,
          filters: filters,
          data: result.logs
        });
      }
    } catch (error) {
      console.error('[Audit] Erro ao exportar logs:', error);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro ao exportar logs de auditoria');
    }
  },

  /**
   * Limpeza de logs antigos (operação administrativa)
   */
  async cleanupOldLogs(req: Request, res: Response) {
    try {
      const { daysToKeep = 90, confirm } = req.body;
      
      if (!confirm) {
        sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Confirmação é obrigatória para limpeza de logs');
        return;
      }

      if (typeof daysToKeep !== 'number' || daysToKeep < 30 || daysToKeep > 365) {
        sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Dias para manter deve ser entre 30 e 365');
        return;
      }

      const deletedCount = await auditService.cleanupOldLogs(daysToKeep);
      
      res.json({
        success: true,
        message: 'Limpeza de logs concluída',
        data: {
          deletedCount,
          daysToKeep,
          cleanupDate: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Audit] Erro na limpeza de logs:', error);
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro na limpeza de logs');
    }
  },

  // ========== MÉTODOS AUXILIARES ==========

  /**
   * Encontrar usuários com múltiplos IPs
   */
  async findMultipleIpUsers(startDate: Date, endDate: Date): Promise<any[]> {
    try {
      const result = await auditService.searchLogs({
        action: 'LOGIN',
        startDate,
        endDate,
        page: 1,
        pageSize: 1000
      });

      const userIps: Record<number, Set<string>> = {};
      
      result.logs.forEach(log => {
        if (log.userId && log.ipAddress) {
          if (!userIps[log.userId]) {
            userIps[log.userId] = new Set();
          }
          userIps[log.userId].add(log.ipAddress);
        }
      });

      return Object.entries(userIps)
        .filter(([_, ips]) => ips.size > 2)
        .map(([userId, ips]) => {
          const userLogs = result.logs.filter(log => log.userId === parseInt(userId));
          return {
            userId: parseInt(userId),
            userName: userLogs[0]?.userName,
            userEmail: userLogs[0]?.userEmail,
            ipCount: ips.size,
            ips: Array.from(ips),
            loginCount: userLogs.length
          };
        });
    } catch (error) {
      console.error('[Audit] Erro ao buscar usuários com múltiplos IPs:', error);
      return [];
    }
  },

  /**
   * Gerar recomendações de segurança
   */
  generateSecurityRecommendations(stats: {
    securityAlerts: number;
    failedLogins: number;
    afterHoursAccess: number;
    multipleIpUsers: number;
  }): string[] {
    const recommendations: string[] = [];

    if (stats.failedLogins > 50) {
      recommendations.push('Considere implementar bloqueio temporário após múltiplas tentativas de login falhadas');
    }

    if (stats.afterHoursAccess > 20) {
      recommendations.push('Revise a política de acesso fora do horário comercial');
    }

    if (stats.multipleIpUsers > 5) {
      recommendations.push('Implemente notificações de login de novos dispositivos/IPs');
    }

    if (stats.securityAlerts > 10) {
      recommendations.push('Revise e ajuste os parâmetros de detecção de atividades suspeitas');
    }

    if (recommendations.length === 0) {
      recommendations.push('Nenhuma recomendação específica. Continue monitorando regularmente.');
    }

    return recommendations;
  }
};