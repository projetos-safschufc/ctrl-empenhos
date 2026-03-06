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

  /** Métricas de gestão de estoque (visão macro). Opcional para retrocompatibilidade. */
  gestaoEstoque?: GestaoEstoqueMetrics;

  /** Diagnóstico geral ou filtrado sobre os materiais. Opcional para retrocompatibilidade. */
  diagnostico?: DiagnosticoMateriais;
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

/** Métricas agregadas de gestão de estoque para o dashboard analítico. */
export interface GestaoEstoqueMetrics {
  totalMateriais: number;
  totalPendencias: number;
  totalAtencao: number;
  totalCritico: number;
  totalEstoqueAlmoxarifados: number;
  totalEstoqueVirtual: number;
  totalSaldoEmpenhos: number;
  materiaisComRegistroAtivo: number;
  totalRegistrosAtivos: number;
}

/** Diagnóstico narrativo sobre os materiais (resumo + alertas). */
export interface DiagnosticoMateriais {
  resumo: string[];
  alertas: string[];
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

/** Filtros opcionais para métricas de gestão de estoque (query params do dashboard). */
export interface GestaoEstoqueFilters {
  responsavel?: string;
  setor?: string;
  classificacao?: string;
}

/**
 * Gera diagnóstico (resumo + alertas) a partir das métricas de gestão de estoque.
 * Usado na seção "Diagnóstico dos Materiais" do dashboard.
 */
function buildDiagnostico(metrics: GestaoEstoqueMetrics): DiagnosticoMateriais {
  const resumo: string[] = [];
  const alertas: string[] = [];
  const {
    totalMateriais,
    totalPendencias,
    totalAtencao,
    totalCritico,
    totalEstoqueAlmoxarifados,
    totalSaldoEmpenhos,
    materiaisComRegistroAtivo,
    totalRegistrosAtivos,
  } = metrics;

  resumo.push(`Total de materiais: ${totalMateriais.toLocaleString('pt-BR')}.`);
  resumo.push(`Materiais em situação crítica: ${totalCritico}; em atenção: ${totalAtencao}.`);
  resumo.push(`Materiais com registro ativo: ${materiaisComRegistroAtivo}; total de registros ativos: ${totalRegistrosAtivos}.`);
  resumo.push(`Pendências (sem registro ativo): ${totalPendencias}.`);
  resumo.push(`Estoque em almoxarifados: ${totalEstoqueAlmoxarifados.toLocaleString('pt-BR')} unidades.`);
  resumo.push(`Qtde a receber (empenhos): ${totalSaldoEmpenhos.toLocaleString('pt-BR')} unidades.`);

  if (totalCritico > 0) {
    alertas.push(
      `${totalCritico} material(is) em situação crítica. Recomenda-se revisão de reposição e verificação de empenhos/registros.`
    );
  }
  if (totalAtencao > 50) {
    alertas.push(
      `${totalAtencao} materiais em atenção. Monitorar estoque e empenhos nos próximos 15–30 dias.`
    );
  } else if (totalAtencao > 0) {
    alertas.push(`${totalAtencao} material(is) em atenção. Acompanhar evolução.`);
  }
  if (totalMateriais > 0 && totalPendencias / totalMateriais > 0.5) {
    alertas.push(
      `Mais de 50% dos materiais sem registro ativo (${totalPendencias} de ${totalMateriais}). Avaliar cadastro de registros.`
    );
  }
  if (totalRegistrosAtivos === 0 && totalMateriais > 0) {
    alertas.push('Nenhum registro ativo encontrado. Verificar vigências e saldo a empenhar.');
  }

  return { resumo, alertas };
}

// ========== CORE SERVICE ==========

export const analyticsService = {
  /**
   * Dashboard analítico principal com métricas avançadas.
   * Aceita filtros opcionais (responsavel, setor, classificacao) para gestaoEstoque e diagnostico.
   * Query params: responsavel?, setor?, classificacao?
   */
  async getDashboardAnalytics(filters?: GestaoEstoqueFilters): Promise<DashboardAnalytics> {
    const cacheKey =
      !filters || Object.keys(filters).length === 0
        ? 'analytics:dashboard:main'
        : `analytics:dashboard:${JSON.stringify(filters)}`;
    const cached = memoryCache.get<DashboardAnalytics>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const [
        basicMetrics,
        performanceMetrics,
        userMetrics,
        trends,
        distributions,
        gestaoEstoque,
      ] = await Promise.all([
        this.getBasicMetrics(),
        this.getPerformanceMetrics(),
        this.getUserMetrics(),
        this.getTrends(),
        this.getDistributions(),
        this.getGestaoEstoqueMetrics(filters),
      ]);

      const diagnostico = buildDiagnostico(gestaoEstoque);

      const hasFilters = filters && Object.keys(filters).length > 0;
      const analytics: DashboardAnalytics = {
        ...basicMetrics,
        ...(hasFilters
          ? {
              totalMateriais: gestaoEstoque.totalMateriais,
              totalPendencias: gestaoEstoque.totalPendencias,
              totalAtencao: gestaoEstoque.totalAtencao,
              totalCritico: gestaoEstoque.totalCritico,
            }
          : {}),
        ...performanceMetrics,
        ...userMetrics,
        tendencias: trends,
        distribuicoes: distributions,
        gestaoEstoque,
        diagnostico,
      };

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
   * Métricas agregadas de gestão de estoque (visão macro).
   * Sem filtros: usa getBasicMetrics() para totais e percorre catálogo em lotes para estoque/registros.
   * Com filtros: percorre catálogo filtrado em lotes e calcula status por linha para os 4 contadores.
   */
  async getGestaoEstoqueMetrics(filters?: GestaoEstoqueFilters): Promise<GestaoEstoqueMetrics> {
    const { catalogoRepository } = await import('../repositories/catalogoRepository');
    const {
      getTotaisEstoqueSaldoPorMasters,
      getEstoqueESaldoPorMasters,
    } = await import('../repositories/consumoEstoqueRepository');
    const { getConsumosPorMastersEMeses } = await import('../repositories/movimentoRepository');
    const {
      getMesesParaColunasConsumo,
      calcularMediaConsumo6MesesAnteriores,
      calcularCoberturaEstoqueVirtual,
      calculateStatus,
      consumoPorMesano,
      filtrarRegistrosParaExibicao,
    } = await import('./controleEmpenho/calculos');

    const BATCH_SIZE = 500;
    const catalogFilters: { responsavel?: string; setor?: string; classificacao?: string } = {};
    if (filters?.responsavel?.trim()) catalogFilters.responsavel = filters.responsavel.trim();
    if (filters?.setor?.trim()) catalogFilters.setor = filters.setor.trim().toUpperCase();
    if (filters?.classificacao?.trim()) catalogFilters.classificacao = filters.classificacao.trim();

    let totalMateriais: number;
    let totalPendencias: number;
    let totalAtencao: number;
    let totalCritico: number;
    let totalEstoqueAlmoxarifados = 0;
    let totalSaldoEmpenhos = 0;
    let materiaisComRegistroAtivo = 0;
    let totalRegistrosAtivos = 0;

    if (Object.keys(catalogFilters).length === 0) {
      const basic = await this.getBasicMetrics();
      totalMateriais = basic.totalMateriais;
      totalPendencias = basic.totalPendencias;
      totalAtencao = basic.totalAtencao;
      totalCritico = basic.totalCritico;
    } else {
      totalMateriais = await catalogoRepository.count(catalogFilters);
      totalPendencias = 0;
      totalAtencao = 0;
      totalCritico = 0;
    }

    const meses = getMesesParaColunasConsumo();
    const mesanoAtual = meses[6];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const { items } = await catalogoRepository.findMany(catalogFilters, page, BATCH_SIZE);
      hasMore = items.length === BATCH_SIZE;
      page++;
      if (items.length === 0) break;

      const masters = items.map((c) => c.master).filter((m): m is string => m != null && m !== '');
      if (masters.length === 0) continue;

      const [totaisPorMaster, registrosPorMaster, consumosPorMaster] = await Promise.all([
        getTotaisEstoqueSaldoPorMasters(masters),
        getEstoqueESaldoPorMasters(masters),
        getConsumosPorMastersEMeses(masters, meses),
      ]);

      for (const cat of items) {
        const master = cat.master;
        if (!master) continue;
        const totais = totaisPorMaster.get(master) ?? { estoqueAlmoxarifados: 0, saldoEmpenhos: 0 };
        const registros = registrosPorMaster.get(master) ?? [];
        const registrosExibir = filtrarRegistrosParaExibicao(registros);
        const estoqueAlmox = totais.estoqueAlmoxarifados;
        const saldoEmp = totais.saldoEmpenhos;
        const estoqueVirtual = estoqueAlmox + saldoEmp;

        totalEstoqueAlmoxarifados += estoqueAlmox;
        totalSaldoEmpenhos += saldoEmp;
        if (registrosExibir.length > 0) {
          materiaisComRegistroAtivo += 1;
          totalRegistrosAtivos += registrosExibir.length;
        }

        if (Object.keys(catalogFilters).length > 0) {
          const consumos = consumosPorMaster.get(master) ?? [];
          const porMes = consumoPorMesano(consumos);
          const media = calcularMediaConsumo6MesesAnteriores(consumos, mesanoAtual);
          const cobertura = calcularCoberturaEstoqueVirtual(estoqueVirtual, media);
          const consumoMesAtual = porMes[mesanoAtual] ?? 0;
          const consumos6Meses = [meses[0], meses[1], meses[2], meses[3], meses[4], meses[5]].map(
            (m) => porMes[m] ?? 0
          );

          if (registrosExibir.length === 0) {
            totalPendencias += 1;
            const statusInput: Parameters<typeof calculateStatus>[0] = {
              estoqueAlmoxarifados: estoqueAlmox,
              estoqueGeral: 0,
              saldoEmpenhos: saldoEmp,
              estoqueVirtual,
              coberturaEstoque: cobertura,
              mediaConsumo6Meses: media,
              consumoMesAtual,
              consumos6Meses,
              mesUltimoConsumo: null,
              vigenciaRegistro: null,
              saldoRegistro: null,
              comRegistro: false,
              numeroPreEmpenho: null,
            };
            const status = calculateStatus(statusInput);
            if (status === 'Crítico') totalCritico += 1;
            else if (status === 'Atenção') totalAtencao += 1;
          } else {
            for (const reg of registrosExibir) {
              const statusInput: Parameters<typeof calculateStatus>[0] = {
                estoqueAlmoxarifados: estoqueAlmox,
                estoqueGeral: 0,
                saldoEmpenhos: saldoEmp,
                estoqueVirtual,
                coberturaEstoque: cobertura,
                mediaConsumo6Meses: media,
                consumoMesAtual,
                consumos6Meses,
                mesUltimoConsumo: null,
                vigenciaRegistro: reg.vigencia ?? null,
                saldoRegistro: reg.saldo_registro ?? null,
                comRegistro: true,
                numeroPreEmpenho: null,
              };
              const status = calculateStatus(statusInput);
              if (status === 'Crítico') totalCritico += 1;
              else if (status === 'Atenção') totalAtencao += 1;
            }
          }
        }
      }
    }

    return {
      totalMateriais,
      totalPendencias,
      totalAtencao,
      totalCritico,
      totalEstoqueAlmoxarifados,
      totalEstoqueVirtual: totalEstoqueAlmoxarifados + totalSaldoEmpenhos,
      totalSaldoEmpenhos,
      materiaisComRegistroAtivo,
      totalRegistrosAtivos,
    };
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
            AND activity_date = ${today}::date
        `,
        // Exports de hoje
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COALESCE(SUM(activity_count), 0) as count
          FROM ctrl.user_activity_metrics 
          WHERE activity_type = 'data_export' 
            AND activity_date = ${today}::date
        `
      ]);

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