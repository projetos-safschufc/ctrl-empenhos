/**
 * Analytics Dashboard - Dashboard Analítico Enterprise
 *
 * Foco em gestão de estoque. Gráficos de coluna, barras e rosca com dados reais.
 */

import { useState, useEffect, useCallback } from 'react';
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
  List,
  ListItem,
  ListIcon,
  UnorderedList,
  Collapse,
  useDisclosure,
} from '@chakra-ui/react';
import {
  MdDashboard,
  MdCheckCircle,
  MdError,
  MdRefresh,
  MdWarning,
  MdInventory,
  MdExpandMore,
  MdExpandLess,
} from 'react-icons/md';
import { formatDate } from '../utils/date';
import { analyticsApi, controleEmpenhosApi } from '../api/client';
import type {
  AnalyticsDashboardData,
  AnalyticsTrendData,
  AnalyticsDistributionData,
  GestaoEstoqueMetrics,
} from '../api/client';

// ========== GRÁFICOS ==========

/** Gráfico de coluna (barras verticais) para indicadores de estoque */
function ColumnChart({
  data,
  title,
  height = 220,
}: {
  data: { label: string; value: number; color?: string }[];
  title: string;
  height?: number;
}) {
  if (!data.length) {
    return (
      <Card bg="white" borderColor="gray.200" borderWidth="1px" h={`${height + 60}px`}>
        <CardHeader pb={2}>
          <Text fontWeight="bold">{title}</Text>
        </CardHeader>
        <CardBody pt={0}>
          <Flex align="center" justify="center" h={`${height}px`}>
            <Text color="gray.500" fontSize="sm">Sem dados disponíveis</Text>
          </Flex>
        </CardBody>
      </Card>
    );
  }
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const colors = ['#2F855A', '#3182CE', '#805AD5', '#DD6B20', '#E53E3E', '#38A169'];

  return (
    <Card bg="white" borderColor="gray.200" borderWidth="1px" h={`${height + 60}px`}>
      <CardHeader pb={2}>
        <Text fontWeight="bold">{title}</Text>
      </CardHeader>
      <CardBody pt={0}>
        <Flex h={`${height}px`} align="flex-end" justify="space-around" gap={2}>
          {data.map((item, i) => (
            <VStack key={i} flex={1} spacing={1}>
              <Text fontSize="xs" fontWeight="bold" noOfLines={1} title={String(item.value)}>
                {item.value >= 1000 ? `${(item.value / 1000).toFixed(1)}k` : item.value}
              </Text>
              <Box
                w="full"
                minH="8px"
                bg={item.color || colors[i % colors.length]}
                borderRadius="md"
                style={{
                  height: `${Math.max((item.value / maxVal) * 100, 4)}%`,
                  minHeight: '20px',
                }}
                title={`${item.label}: ${item.value.toLocaleString('pt-BR')}`}
              />
              <Text fontSize="xs" noOfLines={2} textAlign="center" lineHeight="tight">
                {item.label}
              </Text>
            </VStack>
          ))}
        </Flex>
      </CardBody>
    </Card>
  );
}

/** Gráfico de rosca (donut) para distribuição por status */
function DonutChart({
  data,
  title,
  size = 200,
}: {
  data: AnalyticsDistributionData[];
  title: string;
  size?: number;
}) {
  if (!data.length) {
    return (
      <Card bg="white" borderColor="gray.200" borderWidth="1px">
        <CardHeader pb={2}>
          <Text fontWeight="bold">{title}</Text>
        </CardHeader>
        <CardBody pt={0}>
          <Flex align="center" justify="center" h={`${size}px`}>
            <Text color="gray.500" fontSize="sm">Sem dados disponíveis</Text>
          </Flex>
        </CardBody>
      </Card>
    );
  }
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const colors = data.map((d) => d.color || '#718096');
  let acc = 0;
  const segments = data.map((d, i) => {
    const pct = (d.value / total) * 100;
    const start = acc;
    acc += pct;
    return { ...d, start: (start / 100) * 360, length: (pct / 100) * 360, color: colors[i] };
  });

  const r = 40;
  const cx = 50;
  const cy = 50;
  const strokeWidth = 18;

  return (
    <Card bg="white" borderColor="gray.200" borderWidth="1px">
      <CardHeader pb={2}>
        <Text fontWeight="bold">{title}</Text>
      </CardHeader>
      <CardBody pt={0}>
        <Flex direction="column" align="center">
          <Box w={`${size}px`} h={`${size}px`} position="relative">
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
              {segments.map((seg, i) => (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${(seg.length / 360) * 2 * Math.PI * r} ${2 * Math.PI * r}`}
                  strokeDashoffset={-(seg.start / 360) * 2 * Math.PI * r}
                  transform={`rotate(-90 ${cx} ${cy})`}
                />
              ))}
              <circle
                cx={cx}
                cy={cy}
                r={r - strokeWidth / 2}
                fill="white"
              />
            </svg>
          </Box>
          <VStack spacing={1} mt={2} align="stretch" w="full">
            {data.map((item, i) => (
              <Flex key={i} justify="space-between" align="center" fontSize="sm">
                <HStack spacing={2}>
                  <Box w="3" h="3" borderRadius="sm" bg={colors[i]} />
                  <Text noOfLines={1}>{item.label}</Text>
                </HStack>
                <Badge fontSize="xs">{item.value} ({item.percentage}%)</Badge>
              </Flex>
            ))}
          </VStack>
        </Flex>
      </CardBody>
    </Card>
  );
}

/** Gráfico de barras horizontais (reutilizável) */
function BarChart({
  data,
  title,
  height = 220,
}: {
  data: AnalyticsDistributionData[];
  title: string;
  height?: number;
}) {
  if (!data.length) {
    return (
      <Card bg="white" borderColor="gray.200" borderWidth="1px" h={`${height + 60}px`}>
        <CardHeader pb={2}>
          <Text fontWeight="bold">{title}</Text>
        </CardHeader>
        <CardBody pt={0}>
          <Flex align="center" justify="center" h={`${height}px`}>
            <Text color="gray.500" fontSize="sm">Sem dados disponíveis</Text>
          </Flex>
        </CardBody>
      </Card>
    );
  }
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  return (
    <Card bg="white" borderColor="gray.200" borderWidth="1px" h={`${height + 60}px`}>
      <CardHeader pb={2}>
        <Text fontWeight="bold">{title}</Text>
      </CardHeader>
      <CardBody pt={0}>
        <VStack spacing={3} align="stretch">
          {data.slice(0, 6).map((item, index) => (
            <Box key={index}>
              <Flex justify="space-between" mb={1}>
                <Text fontSize="sm" noOfLines={1}>{item.label}</Text>
                <Text fontSize="sm" fontWeight="bold">{item.value.toLocaleString('pt-BR')}</Text>
              </Flex>
              <Box bg="gray.200" h="8px" borderRadius="full" overflow="hidden">
                <Box
                  bg={item.color || 'brand.500'}
                  h="full"
                  w={`${(item.value / maxValue) * 100}%`}
                  transition="width 0.5s ease"
                  borderRadius="full"
                />
              </Box>
            </Box>
          ))}
        </VStack>
      </CardBody>
    </Card>
  );
}

// ========== COMPONENTES AUXILIARES ==========

function MetricCard({
  title,
  value,
  unit = '',
  trend,
  icon,
  color = 'brand',
  isLoading = false,
}: {
  title: string;
  value: number | string;
  unit?: string;
  trend?: { value: number; isPositive: boolean };
  icon: React.ElementType;
  color?: string;
  isLoading?: boolean;
}) {
  const textSecondary = 'gray.600';
  const displayValue =
    typeof value === 'number' ? value.toLocaleString('pt-BR') : value ?? '–';

  return (
    <Card bg="white" borderColor="gray.200" borderWidth="1px">
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
                {displayValue}
                {unit && (
                  <Text as="span" fontSize="sm" color={textSecondary} ml={1}>
                    {unit}
                  </Text>
                )}
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

/** Converte gestaoEstoque em dados para gráfico de colunas */
function buildColumnDataFromGestao(ge: GestaoEstoqueMetrics | null | undefined) {
  if (!ge) return [];
  return [
    { label: 'Estoque Almox.', value: ge.totalEstoqueAlmoxarifados ?? 0, color: '#3182CE' },
    { label: 'Estoque Virtual', value: ge.totalEstoqueVirtual ?? 0, color: '#38A169' },
    { label: 'Qtde a Receber', value: ge.totalSaldoEmpenhos ?? 0, color: '#805AD5' },
    { label: 'Registros Ativos', value: ge.totalRegistrosAtivos ?? 0, color: '#DD6B20' },
    { label: 'Crítico', value: ge.totalCritico ?? 0, color: '#E53E3E' },
    { label: 'Atenção', value: ge.totalAtencao ?? 0, color: '#D69E2E' },
  ];
}

/** Converte totais de status em dados para donut (distribuição por status) */
function buildDonutDataFromGestao(ge: GestaoEstoqueMetrics | null | undefined): AnalyticsDistributionData[] {
  if (!ge) return [];
  const total = (ge.totalMateriais ?? 0) || 1;
  const normal = Math.max(0, (ge.totalMateriais ?? 0) - (ge.totalCritico ?? 0) - (ge.totalAtencao ?? 0) - (ge.totalPendencias ?? 0));
  const items = [
    { label: 'Normal', value: Math.max(0, normal), color: '#38A169' },
    { label: 'Atenção', value: ge.totalAtencao ?? 0, color: '#DD6B20' },
    { label: 'Crítico', value: ge.totalCritico ?? 0, color: '#E53E3E' },
    { label: 'Pendências', value: ge.totalPendencias ?? 0, color: '#805AD5' },
  ].filter((d) => d.value > 0);
  return items.map((d) => ({
    ...d,
    percentage: Math.round((d.value / total) * 100),
  }));
}

function TrendChart({
  data,
  title,
  height = 150,
}: {
  data: AnalyticsTrendData[];
  title: string;
  height?: number;
}) {
  const textSecondary = 'gray.600';
  if (data.length === 0) {
    return (
      <Card bg="white" borderColor="gray.200" borderWidth="1px" h={`${height + 80}px`}>
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
  const maxValue = Math.max(...data.map((d) => d.value));
  const minValue = Math.min(...data.map((d) => d.value));
  const range = maxValue - minValue || 1;

  return (
    <Card bg="white" borderColor="gray.200" borderWidth="1px" h={`${height + 80}px`}>
      <CardHeader pb={2}>
        <Text fontWeight="bold">{title}</Text>
      </CardHeader>
      <CardBody pt={0}>
        <Box position="relative" h={`${height}px`}>
          <svg width="100%" height="100%" style={{ position: 'absolute' }}>
            <polyline
              fill="none"
              stroke="var(--chakra-colors-brand-500)"
              strokeWidth="2"
              points={data
                .map((point, index) => {
                  const x = (index / (data.length - 1)) * 100;
                  const y = 100 - ((point.value - minValue) / range) * 80;
                  return `${x}%,${y}%`;
                })
                .join(' ')}
            />
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
          <Flex position="absolute" bottom="0" w="full" justify="space-between">
            {data.map((point, index) => (
              <Text key={index} fontSize="xs" color={textSecondary}>
                {point.label ||
                  new Date(point.date).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                  })}
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
  const [data, setData] = useState<AnalyticsDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('7');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [filtroSetor, setFiltroSetor] = useState('');
  const [filtroClassificacao, setFiltroClassificacao] = useState('');
  const [opcoesResponsavel, setOpcoesResponsavel] = useState<string[]>([]);
  const [opcoesClassificacao, setOpcoesClassificacao] = useState<string[]>([]);
  const systemMetricsOpen = useDisclosure({ defaultIsOpen: false });

  const textSecondary = 'gray.600';

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const filters =
        filtroResponsavel || filtroSetor || filtroClassificacao
          ? {
              ...(filtroResponsavel ? { responsavel: filtroResponsavel } : {}),
              ...(filtroSetor ? { setor: filtroSetor } : {}),
              ...(filtroClassificacao ? { classificacao: filtroClassificacao } : {}),
            }
          : undefined;
      const res = await analyticsApi.getDashboard(filters);
      if (res.error || !res.data) {
        setError(res.error ?? 'Erro ao carregar dados analíticos');
        return;
      }
      const body = res.data as { data?: AnalyticsDashboardData };
      setData(body.data ?? null);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Erro ao carregar dados analíticos');
      console.error('Erro ao carregar analytics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filtroResponsavel, filtroSetor, filtroClassificacao]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    controleEmpenhosApi.getOpcoesFiltros().then((res) => {
      if (res.data && 'classificacoes' in res.data && 'responsaveis' in res.data) {
        const d = res.data as { classificacoes: string[]; responsaveis: string[] };
        setOpcoesClassificacao(d.classificacoes ?? []);
        setOpcoesResponsavel(d.responsaveis ?? []);
      }
    });
  }, []);

  const hasFilters = !!(filtroResponsavel || filtroSetor || filtroClassificacao);
  const ge = data?.gestaoEstoque;

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
      <Flex justify="space-between" align="center" flexWrap="wrap" gap={4} mb={6}>
        <Box>
          <Heading size="lg" mb={2}>
            <Icon as={MdDashboard} mr={3} />
            Dashboard Analítico
          </Heading>
          <Text color={textSecondary}>
            Última atualização: {formatDate(lastUpdate, 'dd/MM/yyyy HH:mm')}
          </Text>
        </Box>
        <HStack spacing={3} flexWrap="wrap">
          <Select
            placeholder="Responsável"
            value={filtroResponsavel}
            onChange={(e) => setFiltroResponsavel(e.target.value)}
            w="160px"
            size="sm"
          >
            {opcoesResponsavel.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <Select
            placeholder="Setor"
            value={filtroSetor}
            onChange={(e) => setFiltroSetor(e.target.value)}
            w="120px"
            size="sm"
          >
            <option value="UACE">UACE</option>
            <option value="ULOG">ULOG</option>
          </Select>
          <Select
            placeholder="Classificação"
            value={filtroClassificacao}
            onChange={(e) => setFiltroClassificacao(e.target.value)}
            w="180px"
            size="sm"
          >
            {opcoesClassificacao.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} w="150px" size="sm">
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </Select>
          <Button
            leftIcon={<MdRefresh />}
            onClick={loadAnalytics}
            isLoading={isLoading}
            variant="outline"
            size="sm"
          >
            Atualizar
          </Button>
        </HStack>
      </Flex>

      {/* Visão Gestão de Estoque */}
      <Heading size="md" mb={3} color="brand.darkGreen">
        Visão Gestão de Estoque
      </Heading>
      <Grid templateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap={3} mb={6}>
        <MetricCard
          title="Total de Materiais"
          value={ge?.totalMateriais ?? data?.totalMateriais ?? 0}
          icon={MdInventory}
          color="brand"
          isLoading={isLoading}
        />
        <MetricCard
          title="Estoque Almoxarifados"
          value={ge?.totalEstoqueAlmoxarifados ?? 0}
          icon={MdInventory}
          color="blue"
          isLoading={isLoading}
        />
        <MetricCard
          title="Estoque Virtual"
          value={ge?.totalEstoqueVirtual ?? 0}
          icon={MdInventory}
          color="teal"
          isLoading={isLoading}
        />
        <MetricCard
          title="Qtde a Receber (Empenhos)"
          value={ge?.totalSaldoEmpenhos ?? 0}
          icon={MdCheckCircle}
          color="purple"
          isLoading={isLoading}
        />
        <MetricCard
          title="Com Registro Ativo"
          value={ge?.materiaisComRegistroAtivo ?? 0}
          icon={MdCheckCircle}
          color="green"
          isLoading={isLoading}
        />
        <MetricCard
          title="Registros Ativos"
          value={ge?.totalRegistrosAtivos ?? 0}
          icon={MdCheckCircle}
          color="cyan"
          isLoading={isLoading}
        />
        <MetricCard
          title="Pendências"
          value={ge?.totalPendencias ?? data?.totalPendencias ?? 0}
          icon={MdWarning}
          color="purple"
          isLoading={isLoading}
        />
        <MetricCard
          title="Crítico"
          value={ge?.totalCritico ?? data?.totalCritico ?? 0}
          icon={MdError}
          color="red"
          isLoading={isLoading}
        />
        <MetricCard
          title="Atenção"
          value={ge?.totalAtencao ?? data?.totalAtencao ?? 0}
          icon={MdWarning}
          color="orange"
          isLoading={isLoading}
        />
      </Grid>

      {/* Gráficos de Gestão de Estoque: coluna, rosca e barras */}
      <Heading size="md" mb={3} color="brand.darkGreen">
        Gráficos de Gestão de Estoque
      </Heading>
      <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }} gap={4} mb={6}>
        <ColumnChart
          data={buildColumnDataFromGestao(ge)}
          title="Indicadores de Estoque (valores)"
          height={220}
        />
        <DonutChart
          data={
            (data?.distribuicoes?.statusMateriais?.length
              ? data.distribuicoes.statusMateriais
              : buildDonutDataFromGestao(ge)) as AnalyticsDistributionData[]
          }
          title="Distribuição por Status (rosça)"
          size={200}
        />
        <BarChart
          data={
            (data?.distribuicoes?.statusMateriais?.length
              ? data.distribuicoes.statusMateriais
              : buildDonutDataFromGestao(ge)) as AnalyticsDistributionData[]
          }
          title="Status dos Materiais (barras)"
          height={220}
        />
      </Grid>

      {/* Gráfico de tendência de materiais críticos (quando houver dados) */}
      {(data?.tendencias?.materiais?.length ?? 0) > 0 && (
        <Box mb={6}>
          <Heading size="md" mb={3} color="brand.darkGreen">
            Tendência
          </Heading>
          <Grid templateColumns={{ base: '1fr', md: '1fr' }} gap={4}>
            <TrendChart
              data={data!.tendencias!.materiais}
              title="Tendência de Materiais Críticos"
            />
          </Grid>
        </Box>
      )}

      {/* Outras distribuições (barras) quando disponíveis */}
      {((data?.distribuicoes?.atividadesPorUsuario?.length ?? 0) > 0 ||
        (data?.distribuicoes?.acessosPorHora?.length ?? 0) > 0) && (
        <Box mb={6}>
          <Heading size="md" mb={3} color="brand.darkGreen">
            Outras distribuições
          </Heading>
          <Grid templateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap={4}>
            {data!.distribuicoes!.atividadesPorUsuario!.length > 0 && (
              <BarChart
                data={data!.distribuicoes!.atividadesPorUsuario!}
                title="Atividades por Módulo"
              />
            )}
            {data!.distribuicoes!.acessosPorHora!.length > 0 && (
              <BarChart
                data={data!.distribuicoes!.acessosPorHora!}
                title="Acessos por Horário"
              />
            )}
          </Grid>
        </Box>
      )}

      {/* Métricas do Sistema (secundárias, colapsáveis) */}
      <Box mb={6}>
        <Button
          size="sm"
          variant="ghost"
          rightIcon={systemMetricsOpen.isOpen ? <Icon as={MdExpandLess} /> : <Icon as={MdExpandMore} />}
          onClick={systemMetricsOpen.onToggle}
          color={textSecondary}
        >
          Métricas do sistema (opcional)
        </Button>
        <Collapse in={systemMetricsOpen.isOpen}>
          <Card bg="gray.50" borderColor="gray.200" borderWidth="1px" mt={2}>
            <CardBody pt={4}>
              <Grid templateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap={4}>
                <Box p={3} bg="white" borderRadius="md" borderWidth="1px">
                  <Text fontSize="sm" color={textSecondary}>Uptime</Text>
                  <Text fontSize="xl" fontWeight="bold">{data?.systemUptime ?? 99}%</Text>
                </Box>
                <Box p={3} bg="white" borderRadius="md" borderWidth="1px">
                  <Text fontSize="sm" color={textSecondary}>Cache Hit Rate</Text>
                  <Text fontSize="xl" fontWeight="bold">{data?.cacheHitRate ?? 95}%</Text>
                </Box>
                <Box p={3} bg="white" borderRadius="md" borderWidth="1px">
                  <Text fontSize="sm" color={textSecondary}>Logins Hoje</Text>
                  <Text fontSize="xl" fontWeight="bold">{data?.dailyLogins ?? 0}</Text>
                </Box>
                <Box p={3} bg="white" borderRadius="md" borderWidth="1px">
                  <Text fontSize="sm" color={textSecondary}>Exportações</Text>
                  <Text fontSize="xl" fontWeight="bold">{data?.totalExports ?? 0}</Text>
                </Box>
              </Grid>
            </CardBody>
          </Card>
        </Collapse>
      </Box>

      {/* Diagnóstico dos Materiais */}
      <Card bg="white" borderColor="gray.200" borderWidth="1px">
        <CardHeader>
          <Flex align="center" justify="space-between" flexWrap="wrap" gap={2}>
            <Text fontWeight="bold">Diagnóstico dos Materiais</Text>
            {hasFilters && (
              <Badge colorScheme="blue">Diagnóstico específico (filtros aplicados)</Badge>
            )}
            {!hasFilters && (
              <Badge colorScheme="gray">Diagnóstico geral</Badge>
            )}
          </Flex>
        </CardHeader>
        <CardBody pt={0}>
          {data?.diagnostico ? (
            <VStack align="stretch" spacing={4}>
              <Box>
                <Text fontSize="sm" fontWeight="semibold" mb={2}>
                  Resumo
                </Text>
                <UnorderedList spacing={1} style={{ paddingLeft: '1.2rem' }}>
                  {data.diagnostico.resumo.map((item, i) => (
                    <ListItem key={i} fontSize="sm">
                      {item}
                    </ListItem>
                  ))}
                </UnorderedList>
              </Box>
              {data.diagnostico.alertas.length > 0 && (
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb={2} color="orange.600">
                    <Icon as={MdWarning} mr={2} />
                    Alertas
                  </Text>
                  <List spacing={2}>
                    {data.diagnostico.alertas.map((item, i) => (
                      <ListItem key={i} fontSize="sm" color="orange.700" display="flex" alignItems="flex-start">
                        <ListIcon as={MdWarning} color="orange.500" mt={0.5} />
                        {item}
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </VStack>
          ) : (
            <Text fontSize="sm" color={textSecondary}>
              Diagnóstico não disponível para o período selecionado.
            </Text>
          )}
        </CardBody>
      </Card>
    </Box>
  );
}
