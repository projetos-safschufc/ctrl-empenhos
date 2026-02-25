/**
 * Analytics Service - Dashboard Analítico Enterprise
 * 
 * Serviço responsável por métricas avançadas, auditoria e analytics
 * Otimizado para ambiente INTRANET com foco em insights de negócio
 */

import { prisma } from '../utils/prisma';
import { memoryCache, CacheKeys, CacheTTL } from '../utils/memoryCache';

// ========== INTERFACES ==========

export interface DashboardAnalytics {
  // Métricas principais
  totalMateriais: number;
  totalPendencias: number;
  totalAtencao: number;
  totalCritico: number;
  
  // Métricas de performance
  avgResponseTime: number;
  systemUptime: number;
  cacheHitRate: number;
  
  // Métricas de uso
  activeUsers: number;
  dailyLogins: number;
  totalExports: number;
  
  // Tendências (últimos 7 dias)
  tendencias: {
    materiais: TrendData[];
    usuarios: TrendData[];
    performance: TrendData[];
    atividades: TrendData[];
  };
  
  // Distribuições
  distribuicoes: {
    statusMateriais: DistributionData[];
    atividadesPorUsuario: DistributionData[];
    acessosPorHora: DistributionData[];
    errosPorEndpoint: DistributionData[];
  };
}

export interface TrendData {
  date: string;
  value: number;
  label?: string;
}

export interface DistributionData {
  label: string;
  value: number;
  percentage: number;
  color?: string;
}

export interface AuditLogEntry {
  id: number;
  userId: number | null;
  userName: string | null;
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

export interface SystemMetric {
  id: number;
  metricName: string;
  metricValue: number;
  metricUnit: string | null;
  tags: Record<string, unknown>;
  recordedAt: Date;
}

// ========== CORE SERVICE ==========

export const analyticsService = {
  /**
   * Dashboard analítico principal com métricas avançadas
   */
  async getDashboardAnalytics(): Promise<DashboardAnalytics> {
    const cacheKey = 'analytics:dashboard:main';
    const cached = memoryCache.get<DashboardAnalytics>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      // Executar queries em paralelo para performance
      const [
        basicMetrics,
        performanceMetrics,
        userMetrics,
        trends,
        distributions
      ] = await Promise.all([
        this.getBasicMetrics(),
        this.getPerformanceMetrics(),
        this.getUserMetrics(),
        this.getTrends(),
        this.getDistributions()
      ]);

      const analytics: DashboardAnalytics = {
        ...basicMetrics,
        ...performanceMetrics,
        ...userMetrics,
        tendencias: trends,
        distribuicoes: distributions
      };

      // Cache por 5 minutos
      memoryCache.set(cacheKey, analytics, 5 * 60 * 1000);
      
      return analytics;
    } catch (error) {
      console.error('[Analytics] Erro ao buscar dashboard analytics:', error);
      throw error;
    }
  },

  /**
   * Métricas básicas do sistema
   */
  async getBasicMetrics(): Promise<{
    totalMateriais: number;
    totalPendencias: number;
    totalAtencao: number;
    totalCritico: number;
  }> {
    const cacheKey = 'analytics:basic_metrics';
    const cached = memoryCache.get<any>(cacheKey);
    
    if (cached) {
      return cached;
    }

    // Reutilizar o service existente que já está otimizado
    const { controleEmpenhoService } = await import('./controleEmpenhoService');
    const metrics = await controleEmpenhoService.getDashboard();
    
    memoryCache.set(cacheKey, metrics, 10 * 60 * 1000); // 10 minutos
    return metrics;
  },

  /**
   * Métricas de performance do sistema
   */
  async getPerformanceMetrics(): Promise<{
    avgResponseTime: number;
    systemUptime: number;
    cacheHitRate: number;
  }> {
    try {
      // Buscar métricas dos últimos 30 minutos
      const recentMetrics = await prisma.$queryRaw<SystemMetric[]>`
        SELECT metric_name, AVG(metric_value) as avg_value
        FROM ctrl.system_metrics 
        WHERE recorded_at >= NOW() - INTERVAL '30 minutes'
          AND metric_name IN ('response_time_ms', 'cache_hit_rate')
        GROUP BY metric_name
      `;

      const responseTimeMetric = recentMetrics.find(m => m.metricName === 'response_time_ms');
      const cacheHitRateMetric = recentMetrics.find(m => m.metricName === 'cache_hit_rate');

      return {
        avgResponseTime: responseTimeMetric ? Number(responseTimeMetric.metricValue) : 0,
        systemUptime: Math.floor(process.uptime()),
        cacheHitRate: cacheHitRateMetric ? Number(cacheHitRateMetric.metricValue) : 0
      };
    } catch (error) {
      console.warn('[Analytics] Erro ao buscar métricas de performance:', error);
      return {
        avgResponseTime: 0,
        systemUptime: Math.floor(process.uptime()),
        cacheHitRate: 0
      };
    }
  },

  /**
   * Métricas de usuários e atividade
   */
  async getUserMetrics(): Promise<{
    activeUsers: number;
    dailyLogins: number;
    totalExports: number;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const [activeUsersResult, dailyLoginsResult, exportsResult] = await Promise.all([
        // Usuários ativos nas últimas 24h
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT user_id) as count
          FROM ctrl.audit_logs 
          WHERE created_at >= NOW() - INTERVAL '24 hours'
            AND user_id IS NOT NULL
        `,
        
        // Logins de hoje
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COALESCE(SUM(activity_count), 0) as count
          FROM ctrl.user_activity_metrics 
          WHERE activity_type = 'login' 
            AND activity_date = $1::date
        `,
        
        // Exports de hoje
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COALESCE(SUM(activity_count), 0) as count
          FROM ctrl.user_activity_metrics 
          WHERE activity_type = 'data_export' 
            AND activity_date = $1::date
        `
      ], [today, today]);

      return {
        activeUsers: Number(activeUsersResult[0]?.count || 0),
        dailyLogins: Number(dailyLoginsResult[0]?.count || 0),
        totalExports: Number(exportsResult[0]?.count || 0)
      };
    } catch (error) {
      console.warn('[Analytics] Erro ao buscar métricas de usuário:', error);
      return {
        activeUsers: 0,
        dailyLogins: 0,
        totalExports: 0
      };
    }
  },

  /**
   * Dados de tendências para gráficos
   */
  async getTrends(): Promise<{
    materiais: TrendData[];
    usuarios: TrendData[];
    performance: TrendData[];
    atividades: TrendData[];
  }> {
    try {
      const [materiaisTrend, usuariosTrend, performanceTrend, atividadesTrend] = await Promise.all([
        // Tendência de materiais críticos (últimos 7 dias)
        this.getMaterialTrend(),
        
        // Tendência de usuários ativos
        this.getUserTrend(),
        
        // Tendência de performance
        this.getPerformanceTrend(),
        
        // Tendência de atividades
        this.getActivityTrend()
      ]);

      return {
        materiais: materiaisTrend,
        usuarios: usuariosTrend,
        performance: performanceTrend,
        atividades: atividadesTrend
      };
    } catch (error) {
      console.warn('[Analytics] Erro ao buscar tendências:', error);
      return {
        materiais: [],
        usuarios: [],
        performance: [],
        atividades: []
      };
    }
  },

  /**
   * Dados de distribuição para gráficos de pizza/barras
   */
  async getDistributions(): Promise<{
    statusMateriais: DistributionData[];
    atividadesPorUsuario: DistributionData[];
    acessosPorHora: DistributionData[];
    errosPorEndpoint: DistributionData[];
  }> {
    try {
      const [statusDist, userActivityDist, hourlyAccessDist, errorDist] = await Promise.all([
        this.getStatusDistribution(),
        this.getUserActivityDistribution(),
        this.getHourlyAccessDistribution(),
        this.getErrorDistribution()
      ]);

      return {
        statusMateriais: statusDist,
        atividadesPorUsuario: userActivityDist,
        acessosPorHora: hourlyAccessDist,
        errosPorEndpoint: errorDist
      };
    } catch (error) {
      console.warn('[Analytics] Erro ao buscar distribuições:', error);
      return {
        statusMateriais: [],
        atividadesPorUsuario: [],
        acessosPorHora: [],
        errosPorEndpoint: []
      };
    }
  },

  // ========== MÉTODOS AUXILIARES ==========

  async getMaterialTrend(): Promise<TrendData[]> {
    // Simular dados de tendência - em produção, buscar do histórico real
    const days = 7;
    const trend: TrendData[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      trend.push({
        date: date.toISOString().split('T')[0],
        value: Math.floor(Math.random() * 50) + 100, // Simular entre 100-150
        label: date.toLocaleDateString('pt-BR', { weekday: 'short' })
      });
    }
    
    return trend;
  },

  async getUserTrend(): Promise<TrendData[]> {
    try {
      const result = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT 
          DATE(created_at) as date,
          COUNT(DISTINCT user_id) as count
        FROM ctrl.audit_logs 
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
          AND user_id IS NOT NULL
        GROUP BY DATE(created_at)
        ORDER BY date
      `;

      return result.map(row => ({
        date: row.date,
        value: Number(row.count)
      }));
    } catch (error) {
      console.warn('[Analytics] Erro ao buscar tendência de usuários:', error);
      return [];
    }
  },

  async getPerformanceTrend(): Promise<TrendData[]> {
    try {
      const result = await prisma.$queryRaw<Array<{ date: string; avg_time: number }>>`
        SELECT 
          DATE(recorded_at) as date,
          AVG(metric_value) as avg_time
        FROM ctrl.system_metrics 
        WHERE recorded_at >= CURRENT_DATE - INTERVAL '7 days'
          AND metric_name = 'response_time_ms'
        GROUP BY DATE(recorded_at)
        ORDER BY date
      `;

      return result.map(row => ({
        date: row.date,
        value: Math.round(row.avg_time)
      }));
    } catch (error) {
      console.warn('[Analytics] Erro ao buscar tendência de performance:', error);
      return [];
    }
  },

  async getActivityTrend(): Promise<TrendData[]> {
    try {
      const result = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT 
          activity_date as date,
          SUM(activity_count) as count
        FROM ctrl.user_activity_metrics 
        WHERE activity_date >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY activity_date
        ORDER BY activity_date
      `;

      return result.map(row => ({
        date: row.date,
        value: Number(row.count)
      }));
    } catch (error) {
      console.warn('[Analytics] Erro ao buscar tendência de atividades:', error);
      return [];
    }
  },

  async getStatusDistribution(): Promise<DistributionData[]> {
    // Reutilizar métricas básicas
    const basic = await this.getBasicMetrics();
    const total = basic.totalMateriais;
    
    if (total === 0) return [];

    const data = [
      {
        label: 'Normal',
        value: total - basic.totalPendencias - basic.totalAtencao - basic.totalCritico,
        percentage: 0,
        color: '#48BB78'
      },
      {
        label: 'Atenção',
        value: basic.totalAtencao,
        percentage: 0,
        color: '#ED8936'
      },
      {
        label: 'Crítico',
        value: basic.totalCritico,
        percentage: 0,
        color: '#F56565'
      },
      {
        label: 'Pendências',
        value: basic.totalPendencias,
        percentage: 0,
        color: '#9F7AEA'
      }
    ];

    // Calcular percentuais
    data.forEach(item => {
      item.percentage = Math.round((item.value / total) * 100);
    });

    return data.filter(item => item.value > 0);
  },

  async getUserActivityDistribution(): Promise<DistributionData[]> {
    try {
      const result = await prisma.$queryRaw<Array<{ activity_type: string; total_count: bigint }>>`
        SELECT 
          activity_type,
          SUM(activity_count) as total_count
        FROM ctrl.user_activity_metrics 
        WHERE activity_date >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY activity_type
        ORDER BY total_count DESC
        LIMIT 10
      `;

      const total = result.reduce((sum, row) => sum + Number(row.total_count), 0);
      
      if (total === 0) return [];

      return result.map(row => ({
        label: this.formatActivityType(row.activity_type),
        value: Number(row.total_count),
        percentage: Math.round((Number(row.total_count) / total) * 100)
      }));
    } catch (error) {
      console.warn('[Analytics] Erro ao buscar distribuição de atividades:', error);
      return [];
    }
  },

  async getHourlyAccessDistribution(): Promise<DistributionData[]> {
    try {
      const result = await prisma.$queryRaw<Array<{ hour: number; count: bigint }>>`
        SELECT 
          EXTRACT(HOUR FROM created_at) as hour,
          COUNT(*) as count
        FROM ctrl.audit_logs 
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
          AND action IN ('LOGIN', 'VIEW', 'EXPORT')
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour
      `;

      const total = result.reduce((sum, row) => sum + Number(row.count), 0);
      
      if (total === 0) return [];

      return result.map(row => ({
        label: `${row.hour}h`,
        value: Number(row.count),
        percentage: Math.round((Number(row.count) / total) * 100)
      }));
    } catch (error) {
      console.warn('[Analytics] Erro ao buscar distribuição por hora:', error);
      return [];
    }
  },

  async getErrorDistribution(): Promise<DistributionData[]> {
    try {
      const result = await prisma.$queryRaw<Array<{ endpoint: string; error_count: bigint }>>`
        SELECT 
          COALESCE(endpoint, 'Unknown') as endpoint,
          COUNT(*) as error_count
        FROM ctrl.audit_logs 
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
          AND status_code >= 400
        GROUP BY endpoint
        ORDER BY error_count DESC
        LIMIT 10
      `;

      const total = result.reduce((sum, row) => sum + Number(row.error_count), 0);
      
      if (total === 0) return [];

      return result.map(row => ({
        label: this.formatEndpoint(row.endpoint),
        value: Number(row.error_count),
        percentage: Math.round((Number(row.error_count) / total) * 100),
        color: '#F56565'
      }));
    } catch (error) {
      console.warn('[Analytics] Erro ao buscar distribuição de erros:', error);
      return [];
    }
  },

  // ========== UTILITÁRIOS ==========

  formatActivityType(activityType: string): string {
    const types: Record<string, string> = {
      'login': 'Login',
      'dashboard_view': 'Dashboard',
      'controle_empenhos_view': 'Controle Empenhos',
      'movimentacao_view': 'Movimentação',
      'data_export': 'Exportações',
      'user_management': 'Gestão Usuários'
    };
    
    return types[activityType] || activityType;
  },

  formatEndpoint(endpoint: string): string {
    if (!endpoint || endpoint === 'Unknown') return 'Desconhecido';
    
    // Extrair apenas a parte relevante do endpoint
    const parts = endpoint.split('/');
    return parts.slice(-2).join('/');
  },

  /**
   * Registrar métrica do sistema
   */
  async recordSystemMetric(
    metricName: string,
    metricValue: number,
    metricUnit?: string,
    tags?: Record<string, unknown>
  ): Promise<void> {
    try {
      await prisma.$executeRaw`
        SELECT ctrl.record_system_metric(${metricName}, ${metricValue}, ${metricUnit}, ${JSON.stringify(tags || {})})
      `;
    } catch (error) {
      console.warn('[Analytics] Erro ao registrar métrica:', error);
    }
  },

  /**
   * Incrementar atividade do usuário
   */
  async incrementUserActivity(
    userId: number,
    activityType: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      await prisma.$executeRaw`
        SELECT ctrl.increment_user_activity(${userId}, ${activityType}, ${JSON.stringify(metadata || {})})
      `;
    } catch (error) {
      console.warn('[Analytics] Erro ao incrementar atividade:', error);
    }
  }
};