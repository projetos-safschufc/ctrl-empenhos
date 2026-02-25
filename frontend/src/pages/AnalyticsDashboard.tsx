/**
 * Analytics Dashboard - Dashboard Analítico Enterprise
 * 
 * Dashboard com métricas avançadas, gráficos e insights
 * Visualizações interativas para análise de dados
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Heading,
  Text,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Badge,
  Button,
  Select,
  HStack,
  VStack,
  Spinner,
  Alert,
  AlertIcon,
  Icon,
} from '@chakra-ui/react';
import {
  MdDashboard,
  MdPeople,
  MdSpeed,
  MdCheckCircle,
  MdError,
  MdRefresh,
} from 'react-icons/md';
import { formatDate } from '../utils/date';

// ========== INTERFACES ==========

interface AnalyticsData {
  totalMateriais: number;
  totalPendencias: number;
  totalAtencao: number;
  totalCritico: number;
  avgResponseTime: number;
  systemUptime: number;
  cacheHitRate: number;
  activeUsers: number;
  dailyLogins: number;
  totalExports: number;
  tendencias: {
    materiais: TrendData[];
    usuarios: TrendData[];
    performance: TrendData[];
    atividades: TrendData[];
  };
  distribuicoes: {
    statusMateriais: DistributionData[];
    atividadesPorUsuario: DistributionData[];
    acessosPorHora: DistributionData[];
    errosPorEndpoint: DistributionData[];
  };
}

interface TrendData {
  date: string;
  value: number;
  label?: string;
}

interface DistributionData {
  label: string;
  value: number;
  percentage: number;
  color?: string;
}

// ========== COMPONENTES ==========

function MetricCard({ 
  title, 
  value, 
  unit = '', 
  trend, 
  icon, 
  color = 'brand',
  isLoading = false 
}: {
  title: string;
  value: number | string;
  unit?: string;
  trend?: { value: number; isPositive: boolean };
  icon: any;
  color?: string;
  isLoading?: boolean;
}) {
  const cardBg = 'white';
  const borderColor = 'gray.200';
  const textSecondary = 'gray.600';

  return (
    <Card bg={cardBg} borderColor={borderColor} borderWidth="1px">
      <CardBody>
        <Flex align="center" justify="space-between">
          <Box>
            <Text fontSize="sm" color={textSecondary} mb={1}>
              {title}
            </Text>
            {isLoading ? (
              <Spinner size="sm" />
            ) : (
              <Text fontSize="2xl" fontWeight="bold">
                {typeof value === 'number' ? value.toLocaleString() : value}
                {unit && <Text as="span" fontSize="sm" color={textSecondary} ml={1}>{unit}</Text>}
              </Text>
            )}
            {trend && (
              <HStack spacing={1} mt={1}>
                {trend.isPositive ? '↗' : '↘'}
                <Text fontSize="sm" color={trend.isPositive ? 'green.500' : 'red.500'}>
                  {Math.abs(trend.value)}%
                </Text>
              </HStack>
            )}
          </Box>
          <Icon as={icon} boxSize={8} color={`${color}.500`} />
        </Flex>
      </CardBody>
    </Card>
  );
}

function SimpleChart({ 
  data, 
  title, 
  type = 'bar',
  height = 200 
}: {
  data: DistributionData[];
  title: string;
  type?: 'bar' | 'pie';
  height?: number;
}) {
  const cardBg = 'white';
  const borderColor = 'gray.200';

  if (type === 'bar') {
    const maxValue = Math.max(...data.map(d => d.value));

    return (
      <Card bg={cardBg} borderColor={borderColor} borderWidth="1px" h={`${height + 80}px`}>
        <CardHeader pb={2}>
          <Text fontWeight="bold">{title}</Text>
        </CardHeader>
        <CardBody pt={0}>
          <VStack spacing={3} align="stretch">
            {data.slice(0, 5).map((item, index) => (
              <Box key={index}>
                <Flex justify="space-between" mb={1}>
                  <Text fontSize="sm" noOfLines={1}>{item.label}</Text>
                  <Text fontSize="sm" fontWeight="bold">{item.value}</Text>
                </Flex>
                <Box bg="gray.200" h="6px" borderRadius="full" overflow="hidden">
                  <Box
                    bg={item.color || 'brand.500'}
                    h="full"
                    w={`${(item.value / maxValue) * 100}%`}
                    transition="width 0.5s ease"
                  />
                </Box>
              </Box>
            ))}
          </VStack>
        </CardBody>
      </Card>
    );
  }

  // Gráfico de pizza simples
  return (
    <Card bg={cardBg} borderColor={borderColor} borderWidth="1px" h={`${height + 80}px`}>
      <CardHeader pb={2}>
        <Text fontWeight="bold">{title}</Text>
      </CardHeader>
      <CardBody pt={0}>
        <VStack spacing={2} align="stretch">
          {data.slice(0, 4).map((item, index) => (
            <Flex key={index} justify="space-between" align="center">
              <HStack>
                <Box
                  w="12px"
                  h="12px"
                  borderRadius="full"
                  bg={item.color || `brand.${(index + 3) * 100}`}
                />
                <Text fontSize="sm" noOfLines={1}>{item.label}</Text>
              </HStack>
              <HStack spacing={2}>
                <Text fontSize="sm" fontWeight="bold">{item.value}</Text>
                <Badge colorScheme="gray" fontSize="xs">
                  {item.percentage}%
                </Badge>
              </HStack>
            </Flex>
          ))}
        </VStack>
      </CardBody>
    </Card>
  );
}

function TrendChart({ 
  data, 
  title, 
  height = 150 
}: {
  data: TrendData[];
  title: string;
  height?: number;
}) {
  const cardBg = 'white';
  const borderColor = 'gray.200';
  const textSecondary = 'gray.600';
  
  if (data.length === 0) {
    return (
      <Card bg={cardBg} borderColor={borderColor} borderWidth="1px" h={`${height + 80}px`}>
        <CardHeader pb={2}>
          <Text fontWeight="bold">{title}</Text>
        </CardHeader>
        <CardBody pt={0}>
          <Flex align="center" justify="center" h={`${height}px`}>
            <Text color={textSecondary}>Sem dados disponíveis</Text>
          </Flex>
        </CardBody>
      </Card>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;

  return (
    <Card bg={cardBg} borderColor={borderColor} borderWidth="1px" h={`${height + 80}px`}>
      <CardHeader pb={2}>
        <Text fontWeight="bold">{title}</Text>
      </CardHeader>
      <CardBody pt={0}>
        <Box position="relative" h={`${height}px`}>
          {/* Linha de tendência simples */}
          <svg width="100%" height="100%" style={{ position: 'absolute' }}>
            <polyline
              fill="none"
              stroke="var(--chakra-colors-brand-500)"
              strokeWidth="2"
              points={data.map((point, index) => {
                const x = (index / (data.length - 1)) * 100;
                const y = 100 - ((point.value - minValue) / range) * 80;
                return `${x}%,${y}%`;
              }).join(' ')}
            />
            {/* Pontos */}
            {data.map((point, index) => {
              const x = (index / (data.length - 1)) * 100;
              const y = 100 - ((point.value - minValue) / range) * 80;
              return (
                <circle
                  key={index}
                  cx={`${x}%`}
                  cy={`${y}%`}
                  r="3"
                  fill="var(--chakra-colors-brand-500)"
                />
              );
            })}
          </svg>
          
          {/* Labels do eixo X */}
          <Flex position="absolute" bottom="0" w="full" justify="space-between">
            {data.map((point, index) => (
              <Text key={index} fontSize="xs" color={textSecondary}>
                {point.label || new Date(point.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </Text>
            ))}
          </Flex>
        </Box>
      </CardBody>
    </Card>
  );
}

// ========== COMPONENTE PRINCIPAL ==========

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('7');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const cardBg = 'white';
  const borderColor = 'gray.200';
  const textSecondary = 'gray.600';

  // Simular carregamento de dados (em produção, usar API real)
  const loadAnalytics = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Simular delay de API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Dados simulados (em produção, buscar de /api/analytics/dashboard)
      const mockData: AnalyticsData = {
        totalMateriais: 1247,
        totalPendencias: 23,
        totalAtencao: 45,
        totalCritico: 12,
        avgResponseTime: 245,
        systemUptime: 99.8,
        cacheHitRate: 87.3,
        activeUsers: 8,
        dailyLogins: 15,
        totalExports: 6,
        tendencias: {
          materiais: [
            { date: '2026-02-07', value: 120 },
            { date: '2026-02-08', value: 135 },
            { date: '2026-02-09', value: 128 },
            { date: '2026-02-10', value: 142 },
            { date: '2026-02-11', value: 138 },
            { date: '2026-02-12', value: 155 },
            { date: '2026-02-13', value: 147 },
          ],
          usuarios: [
            { date: '2026-02-07', value: 5 },
            { date: '2026-02-08', value: 8 },
            { date: '2026-02-09', value: 6 },
            { date: '2026-02-10', value: 9 },
            { date: '2026-02-11', value: 7 },
            { date: '2026-02-12', value: 8 },
            { date: '2026-02-13', value: 8 },
          ],
          performance: [
            { date: '2026-02-07', value: 320 },
            { date: '2026-02-08', value: 280 },
            { date: '2026-02-09', value: 295 },
            { date: '2026-02-10', value: 260 },
            { date: '2026-02-11', value: 275 },
            { date: '2026-02-12', value: 250 },
            { date: '2026-02-13', value: 245 },
          ],
          atividades: [
            { date: '2026-02-07', value: 45 },
            { date: '2026-02-08', value: 62 },
            { date: '2026-02-09', value: 38 },
            { date: '2026-02-10', value: 71 },
            { date: '2026-02-11', value: 55 },
            { date: '2026-02-12', value: 68 },
            { date: '2026-02-13', value: 59 },
          ],
        },
        distribuicoes: {
          statusMateriais: [
            { label: 'Normal', value: 1167, percentage: 94, color: '#48BB78' },
            { label: 'Atenção', value: 45, percentage: 4, color: '#ED8936' },
            { label: 'Crítico', value: 12, percentage: 1, color: '#F56565' },
            { label: 'Pendências', value: 23, percentage: 2, color: '#9F7AEA' },
          ],
          atividadesPorUsuario: [
            { label: 'Dashboard', value: 125, percentage: 35 },
            { label: 'Controle Empenhos', value: 89, percentage: 25 },
            { label: 'Movimentação', value: 67, percentage: 19 },
            { label: 'Exportações', value: 45, percentage: 13 },
            { label: 'Outros', value: 28, percentage: 8 },
          ],
          acessosPorHora: [
            { label: '8h', value: 15, percentage: 12 },
            { label: '9h', value: 28, percentage: 22 },
            { label: '10h', value: 35, percentage: 28 },
            { label: '11h', value: 22, percentage: 17 },
            { label: '14h', value: 18, percentage: 14 },
            { label: '15h', value: 9, percentage: 7 },
          ],
          errosPorEndpoint: [
            { label: '/api/controle-empenhos', value: 3, percentage: 43, color: '#F56565' },
            { label: '/api/movimentacao', value: 2, percentage: 29, color: '#F56565' },
            { label: '/api/auth/login', value: 1, percentage: 14, color: '#F56565' },
            { label: '/api/cache', value: 1, percentage: 14, color: '#F56565' },
          ],
        },
      };
      
      setData(mockData);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Erro ao carregar dados analíticos');
      console.error('Erro ao carregar analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  if (error) {
    return (
      <Box p={6}>
        <Alert status="error">
          <AlertIcon />
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box p={6}>
      {/* Header */}
      <Flex justify="space-between" align="center" mb={6}>
        <Box>
          <Heading size="lg" mb={2}>
            <Icon as={MdDashboard} mr={3} />
            Dashboard Analítico
          </Heading>
          <Text color={textSecondary}>
            Última atualização: {formatDate(lastUpdate, 'dd/MM/yyyy HH:mm')}
          </Text>
        </Box>
        <HStack spacing={3}>
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} w="150px">
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </Select>
          <Button
            leftIcon={<MdRefresh />}
            onClick={loadAnalytics}
            isLoading={isLoading}
            variant="outline"
          >
            Atualizar
          </Button>
        </HStack>
      </Flex>

      {/* Métricas Principais */}
      <Grid templateColumns="repeat(auto-fit, minmax(250px, 1fr))" gap={4} mb={6}>
        <MetricCard
          title="Total de Materiais"
          value={data?.totalMateriais || 0}
          icon={MdCheckCircle}
          color="brand"
          trend={{ value: 2.3, isPositive: true }}
          isLoading={isLoading}
        />
        <MetricCard
          title="Itens Críticos"
          value={data?.totalCritico || 0}
          icon={MdError}
          color="red"
          trend={{ value: 1.2, isPositive: false }}
          isLoading={isLoading}
        />
        <MetricCard
          title="Usuários Ativos"
          value={data?.activeUsers || 0}
          icon={MdPeople}
          color="green"
          trend={{ value: 15.8, isPositive: true }}
          isLoading={isLoading}
        />
        <MetricCard
          title="Tempo de Resposta"
          value={data?.avgResponseTime || 0}
          unit="ms"
          icon={MdSpeed}
          color="blue"
          trend={{ value: 8.5, isPositive: false }}
          isLoading={isLoading}
        />
      </Grid>

      {/* Gráficos de Tendência */}
      <Grid templateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap={4} mb={6}>
        <TrendChart
          data={data?.tendencias.materiais || []}
          title="Tendência de Materiais Críticos"
        />
        <TrendChart
          data={data?.tendencias.usuarios || []}
          title="Usuários Ativos por Dia"
        />
        <TrendChart
          data={data?.tendencias.performance || []}
          title="Performance do Sistema (ms)"
        />
        <TrendChart
          data={data?.tendencias.atividades || []}
          title="Atividades por Dia"
        />
      </Grid>

      {/* Distribuições */}
      <Grid templateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap={4} mb={6}>
        <SimpleChart
          data={data?.distribuicoes.statusMateriais || []}
          title="Distribuição por Status"
          type="pie"
        />
        <SimpleChart
          data={data?.distribuicoes.atividadesPorUsuario || []}
          title="Atividades por Módulo"
          type="bar"
        />
        <SimpleChart
          data={data?.distribuicoes.acessosPorHora || []}
          title="Acessos por Horário"
          type="bar"
        />
        <SimpleChart
          data={data?.distribuicoes.errosPorEndpoint || []}
          title="Erros por Endpoint"
          type="bar"
        />
      </Grid>

      {/* Métricas de Sistema */}
      <Card bg={cardBg} borderColor={borderColor} borderWidth="1px">
        <CardHeader>
          <Text fontWeight="bold">Métricas do Sistema</Text>
        </CardHeader>
        <CardBody pt={0}>
          <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={4}>
            <Box p={4} borderWidth={1} borderRadius="md">
              <Text fontSize="sm" color={textSecondary}>Uptime do Sistema</Text>
              <Text fontSize="2xl" fontWeight="bold">{data?.systemUptime || 99}%</Text>
              <Text fontSize="sm" color="green.500">↗ Últimas 24h</Text>
            </Box>
            <Box p={4} borderWidth={1} borderRadius="md">
              <Text fontSize="sm" color={textSecondary}>Cache Hit Rate</Text>
              <Text fontSize="2xl" fontWeight="bold">{data?.cacheHitRate || 95}%</Text>
              <Text fontSize="sm" color="green.500">↗ Performance otimizada</Text>
            </Box>
            <Box p={4} borderWidth={1} borderRadius="md">
              <Text fontSize="sm" color={textSecondary}>Logins Hoje</Text>
              <Text fontSize="2xl" fontWeight="bold">{data?.dailyLogins || 24}</Text>
              <Text fontSize="sm" color="green.500">↗ Usuários únicos</Text>
            </Box>
            <Box p={4} borderWidth={1} borderRadius="md">
              <Text fontSize="sm" color={textSecondary}>Exportações</Text>
              <Text fontSize="2xl" fontWeight="bold">{data?.totalExports || 12}</Text>
              <Text fontSize="sm" color="green.500">↗ Hoje</Text>
            </Box>
          </Grid>
        </CardBody>
      </Card>
    </Box>
  );
}