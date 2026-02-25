import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Heading,
  Text,
  SimpleGrid,
  Card,
  CardBody,
  Link,
  Flex,
  Spinner,
  Button,
  useToast,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAppCache, CacheKeys } from '../contexts/AppCacheContext';
import { controleEmpenhosApi, DashboardControleResponse } from '../api/client';
import { formatDate } from '../utils/date';

const MODULOS = [
  { to: '/controle-empenhos', label: 'Controle de Empenhos', desc: 'Dashboard, itens e histórico' },
  { to: '/movimentacao-diaria', label: 'Movimentação Diária', desc: 'Movimentações por data/mês' },
  { to: '/empenhos-pendentes', label: 'Empenhos Pendentes', desc: 'Empenhos em aberto' },
  { to: '/provisionamento', label: 'Provisionamento', desc: 'Busca material e geração de PDF' },
];

const CACHE_KEY = CacheKeys.controleDashboard();

export function Dashboard() {
  const { user } = useAuth();
  const { getCached, setCached, invalidate } = useAppCache();
  const [dashboard, setDashboard] = useState<DashboardControleResponse | null>(() =>
    getCached<DashboardControleResponse>(CACHE_KEY)
  );
  const [loadingDashboard, setLoadingDashboard] = useState(!getCached<DashboardControleResponse>(CACHE_KEY));
  const toast = useToast();

  const loadDashboard = useCallback(
    async (skipCache = false) => {
      if (!skipCache) {
        const cached = getCached<DashboardControleResponse>(CACHE_KEY);
        if (cached) {
          setDashboard(cached);
          setLoadingDashboard(false);
          return;
        }
      }
      setLoadingDashboard(true);
      const { data, error } = await controleEmpenhosApi.getDashboard();
      if (error) toast({ title: error, status: 'error' });
      const next =
        data && typeof data === 'object' && 'totalMateriais' in data ? data : null;
      setDashboard(next);
      if (next) setCached(CACHE_KEY, next);
      setLoadingDashboard(false);
    },
    [toast, getCached, setCached]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const atualizar = useCallback(() => {
    invalidate(CACHE_KEY);
    loadDashboard(true);
  }, [invalidate, loadDashboard]);

  return (
    <Box>
      <Heading size="lg" color="brand.darkGreen" mb={2}>
        Olá, {user?.name ?? user?.email}
      </Heading>
      <Text color="gray.600" mb={6}>
        Perfil: <strong>{user?.profileName}</strong>
      </Text>
      <Text color="gray.600" mb={6}>
        {formatDate(new Date(), "dd/MM/yyyy HH:mm")} - {new Date().toLocaleDateString('pt-BR', { weekday: 'long' })}
      </Text>

      <Flex justify="space-between" align="center" mb={3} flexWrap="wrap" gap={2}>
        <Heading size="sm" color="brand.darkGreen">
          Resumo do Controle de Empenhos
        </Heading>
        <Button size="sm" variant="outline" colorScheme="green" onClick={atualizar} isLoading={loadingDashboard}>
          Atualizar
        </Button>
      </Flex>
      {loadingDashboard && !dashboard ? (
        <Flex justify="center" py={6}>
          <Spinner color="brand.darkGreen" />
        </Flex>
      ) : dashboard != null ? (
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={8}>
          <Card bg="white" borderLeft="4px" borderColor="brand.green">
            <CardBody>
              <Text fontSize="sm" color="gray.600">Materiais</Text>
              <Text fontSize="2xl" fontWeight="bold" color="brand.darkGreen">{dashboard.totalMateriais}</Text>
              <Text fontSize="xs" color="gray.500" mt={1}>Total de itens cadastrados no sistema</Text>
            </CardBody>
          </Card>
          <Card bg="white" borderLeft="4px" borderColor="orange.400">
            <CardBody>
              <Text fontSize="sm" color="gray.600">Pendências</Text>
              <Text fontSize="2xl" fontWeight="bold">{dashboard.totalPendencias}</Text>
              <Text fontSize="xs" color="gray.500" mt={1}>Itens com situações a resolver</Text>
            </CardBody>
          </Card>
          <Card bg="white" borderLeft="4px" borderColor="yellow.400">
            <CardBody>
              <Text fontSize="sm" color="gray.600">Atenção</Text>
              <Text fontSize="2xl" fontWeight="bold">{dashboard.totalAtencao}</Text>
              <Text fontSize="xs" color="gray.500" mt={1}>Itens que requerem acompanhamento</Text>
            </CardBody>
          </Card>
          <Card bg="white" borderLeft="4px" borderColor="red.500">
            <CardBody>
              <Text fontSize="sm" color="gray.600">Crítico</Text>
              <Text fontSize="2xl" fontWeight="bold">{dashboard.totalCritico}</Text>
              <Text fontSize="xs" color="gray.500" mt={1}>Itens com problemas urgentes</Text>
            </CardBody>
          </Card>
        </SimpleGrid>
      ) : (
        <Text color="gray.500" mb={6} fontSize="sm">
          Não foi possível carregar o resumo. Acesse Controle de Empenhos para mais detalhes.
        </Text>
      )}

      <Heading size="sm" color="brand.darkGreen" mb={3}>
        Acesso rápido aos módulos
      </Heading>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        {MODULOS.map((m) => (
          <Link key={m.to} as={RouterLink} to={m.to} _hover={{ textDecoration: 'none' }}>
            <Card _hover={{ shadow: 'md', borderColor: 'brand.darkGreen' }} borderWidth="1px" borderColor="transparent">
              <CardBody>
                <Heading size="sm" color="brand.darkGreen" mb={1}>
                  {m.label}
                </Heading>
                <Text fontSize="sm" color="gray.600">
                  {m.desc}
                </Text>
              </CardBody>
            </Card>
          </Link>
        ))}
      </SimpleGrid>
    </Box>
  );
}
