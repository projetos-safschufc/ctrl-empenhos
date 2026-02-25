/**
 * Audit Service - Sistema de Auditoria Avançada
 * 
 * Serviço responsável por rastreabilidade completa de ações
 * Logs detalhados, compliance e investigação de incidentes
 */

import { Request } from 'express';
import { prisma } from '../utils/prisma';
import { memoryCache } from '../utils/memoryCache';

// ========== INTERFACES ==========

export interface AuditLogEntry {
  id: number;
  userId: number | null;
  userName: string | null;
  userEmail: string | null;
  sessionId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  endpoint: string | null;
  httpMethod: string | null;
  statusCode: number | null;
  executionTimeMs: number | null;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

export interface AuditSearchFilters {
  userId?: number;
  action?: string;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  statusCode?: number;
  page?: number;
  pageSize?: number;
}

export interface AuditSearchResult {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuditSummary {
  totalLogs: number;
  uniqueUsers: number;
  topActions: Array<{ action: string; count: number }>;
  topEntities: Array<{ entityType: string; count: number }>;
  errorRate: number;
  avgExecutionTime: number;
  timeRange: {
    start: Date;
    end: Date;
  };
}

export interface SecurityAlert {
  id: string;
  type: 'SUSPICIOUS_ACTIVITY' | 'MULTIPLE_FAILED_LOGINS' | 'UNUSUAL_ACCESS_PATTERN' | 'DATA_BREACH_ATTEMPT';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId: number | null;
  description: string;
  details: Record<string, unknown>;
  createdAt: Date;
  resolved: boolean;
}

// ========== CORE SERVICE ==========

export const auditService = {
  /**
   * Registrar log de auditoria completo
   */
  async logAction(
    req: Request,
    action: string,
    entityType: string,
    entityId?: string | number,
    oldValues?: Record<string, unknown>,
    newValues?: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      const userId = (req as any).user?.userId || null;
      const sessionId = this.extractSessionId(req);
      const ipAddress = this.extractIpAddress(req);
      const userAgent = req.get('User-Agent') || null;
      const endpoint = req.originalUrl || req.url;
      const httpMethod = req.method;

      await prisma.auditLogs.create({
        data: {
          userId,
          sessionId,
          action: action.toUpperCase(),
          entityType: entityType.toLowerCase(),
          entityId: entityId?.toString() || null,
          oldValues: oldValues ? JSON.parse(JSON.stringify(oldValues)) : null,
          newValues: newValues ? JSON.parse(JSON.stringify(newValues)) : null,
          ipAddress,
          userAgent,
          endpoint,
          httpMethod,
          statusCode: null, // Será atualizado pelo middleware
          executionTimeMs: null, // Será atualizado pelo middleware
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : {}
        }
      });

      // Detectar atividades suspeitas em tempo real
      await this.detectSuspiciousActivity(userId, action, ipAddress, userAgent);

    } catch (error) {
      console.error('[Audit] Erro ao registrar log:', error);
      // Não propagar erro para não afetar operação principal
    }
  },

  /**
   * Atualizar log com informações de resposta
   */
  async updateLogWithResponse(
    req: Request,
    statusCode: number,
    executionTimeMs: number
  ): Promise<void> {
    try {
      const userId = (req as any).user?.userId || null;
      const endpoint = req.originalUrl || req.url;
      
      // Buscar o log mais recente para este usuário/endpoint
      await prisma.$executeRaw`
        UPDATE ctrl.audit_logs 
        SET 
          status_code = ${statusCode},
          execution_time_ms = ${executionTimeMs}
        WHERE id = (
          SELECT id FROM ctrl.audit_logs 
          WHERE (user_id = ${userId} OR (user_id IS NULL AND ${userId} IS NULL))
            AND endpoint = ${endpoint}
            AND created_at >= NOW() - INTERVAL '1 minute'
          ORDER BY created_at DESC 
          LIMIT 1
        )
      `;

      // Registrar métrica de performance
      const { analyticsService } = await import('./analyticsService');
      await analyticsService.recordSystemMetric('response_time_ms', executionTimeMs);

      // Alertar sobre erros ou tempos de resposta altos
      if (statusCode >= 400) {
        await this.handleErrorAlert(req, statusCode, executionTimeMs);
      } else if (executionTimeMs > 5000) { // > 5 segundos
        await this.handlePerformanceAlert(req, executionTimeMs);
      }

    } catch (error) {
      console.error('[Audit] Erro ao atualizar log com resposta:', error);
    }
  },

  /**
   * Buscar logs de auditoria com filtros avançados
   */
  async searchLogs(filters: AuditSearchFilters): Promise<AuditSearchResult> {
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(100, Math.max(10, filters.pageSize || 50));
    const offset = (page - 1) * pageSize;

    try {
      // Construir WHERE clause dinamicamente
      const whereConditions: string[] = ['1=1'];
      const params: any[] = [];
      let paramIndex = 1;

      if (filters.userId) {
        whereConditions.push(`user_id = $${paramIndex++}`);
        params.push(filters.userId);
      }

      if (filters.action) {
        whereConditions.push(`action ILIKE $${paramIndex++}`);
        params.push(`%${filters.action}%`);
      }

      if (filters.entityType) {
        whereConditions.push(`entity_type ILIKE $${paramIndex++}`);
        params.push(`%${filters.entityType}%`);
      }

      if (filters.entityId) {
        whereConditions.push(`entity_id = $${paramIndex++}`);
        params.push(filters.entityId);
      }

      if (filters.startDate) {
        whereConditions.push(`created_at >= $${paramIndex++}`);
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        whereConditions.push(`created_at <= $${paramIndex++}`);
        params.push(filters.endDate);
      }

      if (filters.ipAddress) {
        whereConditions.push(`ip_address = $${paramIndex++}`);
        params.push(filters.ipAddress);
      }

      if (filters.statusCode) {
        whereConditions.push(`status_code = $${paramIndex++}`);
        params.push(filters.statusCode);
      }

      const whereClause = whereConditions.join(' AND ');

      // Query principal com JOIN para dados do usuário
      const logsQuery = `
        SELECT 
          al.*,
          u.name as user_name,
          u.email as user_email
        FROM ctrl.audit_logs al
        LEFT JOIN ctrl.users u ON al.user_id = u.id
        WHERE ${whereClause}
        ORDER BY al.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      // Query de contagem
      const countQuery = `
        SELECT COUNT(*) as total
        FROM ctrl.audit_logs al
        WHERE ${whereClause}
      `;

      const [logsResult, countResult] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>(logsQuery, ...params, pageSize, offset),
        prisma.$queryRawUnsafe<[{ total: bigint }]>(countQuery, ...params)
      ]);

      const total = Number(countResult[0]?.total || 0);
      const totalPages = Math.ceil(total / pageSize);

      const logs: AuditLogEntry[] = logsResult.map(row => ({
        id: Number(row.id),
        userId: row.user_id,
        userName: row.user_name,
        userEmail: row.user_email,
        sessionId: row.session_id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        oldValues: row.old_values,
        newValues: row.new_values,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        endpoint: row.endpoint,
        httpMethod: row.http_method,
        statusCode: row.status_code,
        executionTimeMs: row.execution_time_ms,
        createdAt: new Date(row.created_at),
        metadata: row.metadata || {}
      }));

      return {
        logs,
        total,
        page,
        pageSize,
        totalPages
      };

    } catch (error) {
      console.error('[Audit] Erro ao buscar logs:', error);
      return {
        logs: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0
      };
    }
  },

  /**
   * Obter resumo de auditoria para período
   */
  async getAuditSummary(startDate: Date, endDate: Date): Promise<AuditSummary> {
    const cacheKey = `audit:summary:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = memoryCache.get<AuditSummary>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const [statsResult, actionsResult, entitiesResult] = await Promise.all([
        // Estatísticas gerais
        prisma.$queryRaw<[{
          total_logs: bigint;
          unique_users: bigint;
          error_count: bigint;
          avg_execution_time: number;
        }]>`
          SELECT 
            COUNT(*) as total_logs,
            COUNT(DISTINCT user_id) as unique_users,
            COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
            AVG(execution_time_ms) as avg_execution_time
          FROM ctrl.audit_logs 
          WHERE created_at BETWEEN ${startDate} AND ${endDate}
        `,

        // Top ações
        prisma.$queryRaw<Array<{ action: string; count: bigint }>>`
          SELECT action, COUNT(*) as count
          FROM ctrl.audit_logs 
          WHERE created_at BETWEEN ${startDate} AND ${endDate}
          GROUP BY action
          ORDER BY count DESC
          LIMIT 10
        `,

        // Top entidades
        prisma.$queryRaw<Array<{ entity_type: string; count: bigint }>>`
          SELECT entity_type, COUNT(*) as count
          FROM ctrl.audit_logs 
          WHERE created_at BETWEEN ${startDate} AND ${endDate}
          GROUP BY entity_type
          ORDER BY count DESC
          LIMIT 10
        `
      ]);

      const stats = statsResult[0];
      const totalLogs = Number(stats?.total_logs || 0);
      const errorCount = Number(stats?.error_count || 0);

      const summary: AuditSummary = {
        totalLogs,
        uniqueUsers: Number(stats?.unique_users || 0),
        topActions: actionsResult.map(row => ({
          action: row.action,
          count: Number(row.count)
        })),
        topEntities: entitiesResult.map(row => ({
          entityType: row.entity_type,
          count: Number(row.count)
        })),
        errorRate: totalLogs > 0 ? (errorCount / totalLogs) * 100 : 0,
        avgExecutionTime: Math.round(stats?.avg_execution_time || 0),
        timeRange: {
          start: startDate,
          end: endDate
        }
      };

      // Cache por 10 minutos
      memoryCache.set(cacheKey, summary, 10 * 60 * 1000);
      
      return summary;

    } catch (error) {
      console.error('[Audit] Erro ao gerar resumo:', error);
      throw error;
    }
  },

  /**
   * Detectar atividades suspeitas
   */
  async detectSuspiciousActivity(
    userId: number | null,
    action: string,
    ipAddress: string | null,
    userAgent: string | null
  ): Promise<void> {
    if (!userId || !ipAddress) return;

    try {
      // Verificar múltiplos logins falhados
      if (action === 'LOGIN_FAILED') {
        const recentFailures = await prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count
          FROM ctrl.audit_logs 
          WHERE user_id = ${userId}
            AND action = 'LOGIN_FAILED'
            AND created_at >= NOW() - INTERVAL '15 minutes'
        `;

        const failureCount = Number(recentFailures[0]?.count || 0);
        if (failureCount >= 5) {
          await this.createSecurityAlert({
            type: 'MULTIPLE_FAILED_LOGINS',
            severity: 'HIGH',
            userId,
            description: `${failureCount} tentativas de login falhadas em 15 minutos`,
            details: { ipAddress, userAgent, failureCount }
          });
        }
      }

      // Verificar acessos de IPs diferentes
      if (action === 'LOGIN') {
        const recentIps = await prisma.$queryRaw<Array<{ ip_address: string }>>`
          SELECT DISTINCT ip_address
          FROM ctrl.audit_logs 
          WHERE user_id = ${userId}
            AND action = 'LOGIN'
            AND created_at >= NOW() - INTERVAL '1 hour'
            AND ip_address IS NOT NULL
        `;

        if (recentIps.length > 3) {
          await this.createSecurityAlert({
            type: 'UNUSUAL_ACCESS_PATTERN',
            severity: 'MEDIUM',
            userId,
            description: `Login de ${recentIps.length} IPs diferentes em 1 hora`,
            details: { ips: recentIps.map(r => r.ip_address), userAgent }
          });
        }
      }

      // Verificar atividade fora do horário normal (ambiente INTRANET)
      const hour = new Date().getHours();
      if ((hour < 7 || hour > 18) && ['LOGIN', 'DATA_EXPORT', 'DELETE'].includes(action)) {
        await this.createSecurityAlert({
          type: 'SUSPICIOUS_ACTIVITY',
          severity: 'LOW',
          userId,
          description: `Atividade ${action} fora do horário comercial (${hour}h)`,
          details: { action, hour, ipAddress, userAgent }
        });
      }

    } catch (error) {
      console.error('[Audit] Erro ao detectar atividade suspeita:', error);
    }
  },

  /**
   * Criar alerta de segurança
   */
  async createSecurityAlert(alert: Omit<SecurityAlert, 'id' | 'createdAt' | 'resolved'>): Promise<void> {
    try {
      const alertId = `${alert.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Em um sistema real, isso seria salvo em uma tabela de alertas
      // Por ora, vamos logar e notificar via console
      console.warn(`[SECURITY ALERT] ${alert.severity}: ${alert.description}`, {
        id: alertId,
        type: alert.type,
        userId: alert.userId,
        details: alert.details,
        timestamp: new Date().toISOString()
      });

      // Registrar como log de auditoria especial
      await prisma.auditLogs.create({
        data: {
          userId: alert.userId,
          sessionId: null,
          action: 'SECURITY_ALERT',
          entityType: 'security_alert',
          entityId: alertId,
          oldValues: null,
          newValues: null,
          ipAddress: alert.details.ipAddress as string || null,
          userAgent: alert.details.userAgent as string || null,
          endpoint: null,
          httpMethod: null,
          statusCode: null,
          executionTimeMs: null,
          metadata: {
            alertType: alert.type,
            severity: alert.severity,
            description: alert.description,
            details: alert.details
          }
        }
      });

    } catch (error) {
      console.error('[Audit] Erro ao criar alerta de segurança:', error);
    }
  },

  /**
   * Lidar com alertas de erro
   */
  async handleErrorAlert(req: Request, statusCode: number, executionTimeMs: number): Promise<void> {
    const userId = (req as any).user?.userId || null;
    const endpoint = req.originalUrl || req.url;

    // Contar erros recentes neste endpoint
    const recentErrors = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM ctrl.audit_logs 
      WHERE endpoint = ${endpoint}
        AND status_code >= 400
        AND created_at >= NOW() - INTERVAL '10 minutes'
    `;

    const errorCount = Number(recentErrors[0]?.count || 0);
    
    if (errorCount >= 10) {
      await this.createSecurityAlert({
        type: 'SUSPICIOUS_ACTIVITY',
        severity: 'MEDIUM',
        userId,
        description: `${errorCount} erros em ${endpoint} nos últimos 10 minutos`,
        details: { endpoint, statusCode, errorCount, executionTimeMs }
      });
    }
  },

  /**
   * Lidar com alertas de performance
   */
  async handlePerformanceAlert(req: Request, executionTimeMs: number): Promise<void> {
    const endpoint = req.originalUrl || req.url;
    
    console.warn(`[PERFORMANCE ALERT] Endpoint lento detectado: ${endpoint} (${executionTimeMs}ms)`, {
      endpoint,
      executionTimeMs,
      timestamp: new Date().toISOString(),
      method: req.method
    });

    // Registrar métrica de alerta de performance
    const { analyticsService } = await import('./analyticsService');
    await analyticsService.recordSystemMetric('slow_endpoint_alert', 1, 'count', {
      endpoint,
      executionTimeMs,
      method: req.method
    });
  },

  // ========== UTILITÁRIOS ==========

  extractSessionId(req: Request): string | null {
    // Extrair session ID do token JWT ou header
    const authHeader = req.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        // Em um sistema real, decodificar o JWT para extrair session ID
        return `session_${Buffer.from(token.substring(0, 10)).toString('hex')}`;
      } catch {
        return null;
      }
    }
    return null;
  },

  extractIpAddress(req: Request): string | null {
    // Extrair IP real considerando proxies (comum em ambiente INTRANET)
    return (
      req.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
      req.get('X-Real-IP') ||
      req.get('X-Client-IP') ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      null
    );
  },

  /**
   * Limpar logs antigos (para manutenção)
   */
  async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    try {
      const result = await prisma.$executeRaw`
        DELETE FROM ctrl.audit_logs 
        WHERE created_at < CURRENT_DATE - INTERVAL '${daysToKeep} days'
      `;

      console.log(`[Audit] Limpeza concluída: ${result} logs removidos`);
      return Number(result);
    } catch (error) {
      console.error('[Audit] Erro na limpeza de logs:', error);
      return 0;
    }
  }
};