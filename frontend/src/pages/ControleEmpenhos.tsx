import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Heading,
  SimpleGrid,
  Card,
  CardBody,
  Text,
  HStack,
  Input,
  Select,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Checkbox,
  TableContainer,
  useToast,
  Spinner,
  Flex,
} from '@chakra-ui/react';
import {
  controleEmpenhosApi,
  ItemControleEmpenho,
  DashboardControleResponse,
  formatMesanoMMYYYY,
  getConsumoHeaders,
  ControleEmpenhosResponse,
} from '../api/client';
import { formatDate } from '../utils/date';
import { useAppCache, CacheKeys } from '../contexts/AppCacheContext';
import {
  formatarIntThousands,
  formatarDecimal,
  formatarMesano,
  renderizarColunasControle,
  DadosColunasControleRender,
} from '../utils/columnRenderers';

const PAGE_SIZE_OPTIONS = [30, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 30;

const DASHBOARD_KEY = CacheKeys.controleDashboard();

function buildItensParams(
  filtroCodigo: string,
  filtroResponsavel: string,
  filtroStatus: string,
  filtroComRegistro: string,
  page: number,
  pageSize: number
) {
  return {
    page,
    pageSize,
    codigo: filtroCodigo || undefined,
    responsavel: filtroResponsavel || undefined,
    status: filtroStatus || undefined,
    comRegistro:
      filtroComRegistro === 'true' ? true : filtroComRegistro === 'false' ? false : undefined,
  };
}

export function ControleEmpenhos() {
  const { getCached, setCached, invalidateControleEmpenhos } = useAppCache();
  const [dashboard, setDashboard] = useState<DashboardControleResponse | null>(() =>
    getCached<DashboardControleResponse>(DASHBOARD_KEY)
  );
  const [itens, setItens] = useState<ItemControleEmpenho[]>([]);
  const [mesesConsumo, setMesesConsumo] = useState<number[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(!getCached<DashboardControleResponse>(DASHBOARD_KEY));

  const [filtroCodigo, setFiltroCodigo] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('');
  const [filtroComRegistro, setFiltroComRegistro] = useState<string>('');

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Record<number, { qtde_por_embalagem?: number; tipo_armazenamento?: string; capacidade_estocagem?: string; observacao?: string }>>({});
  const [saving, setSaving] = useState(false);

  const toast = useToast();

  const loadDashboard = useCallback(
    async (skipCache = false) => {
      if (!skipCache) {
        const cached = getCached<DashboardControleResponse>(DASHBOARD_KEY);
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
      if (next) setCached(DASHBOARD_KEY, next);
      setLoadingDashboard(false);
    },
    [toast, getCached, setCached]
  );

  const loadItens = useCallback(
    async (skipCache = false) => {
      const params = buildItensParams(
        filtroCodigo,
        filtroResponsavel,
        filtroStatus,
        filtroComRegistro,
        page,
        pageSize
      );
      const itensKey = CacheKeys.controleItens(params);
      if (!skipCache) {
        const cached = getCached<ControleEmpenhosResponse>(itensKey);
        if (cached) {
          setItens(Array.isArray(cached.itens) ? cached.itens : []);
          setMesesConsumo(Array.isArray(cached.mesesConsumo) ? cached.mesesConsumo : []);
          setTotal(typeof cached.total === 'number' ? cached.total : 0);
          setLoading(false);
          return;
        }
      }
      setLoading(true);
      const { data, error } = await controleEmpenhosApi.getItens(params);
      if (error) toast({ title: error, status: 'error' });
      const itensList = Array.isArray(data?.itens) ? data.itens : [];
      const meses = Array.isArray(data?.mesesConsumo) ? data.mesesConsumo : [];
      const tot = typeof data?.total === 'number' ? data.total : 0;
      setItens(itensList);
      setMesesConsumo(meses);
      setTotal(tot);
      setCached(itensKey, { itens: itensList, total: tot, mesesConsumo: meses });
      setLoading(false);
    },
    [
      filtroCodigo,
      filtroResponsavel,
      filtroStatus,
      filtroComRegistro,
      page,
      pageSize,
      toast,
      getCached,
      setCached,
    ]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    loadItens();
  }, [loadItens]);

  const aplicarFiltros = () => {
    setPage(1);
    loadItens();
  };

  const atualizarTudo = useCallback(() => {
    invalidateControleEmpenhos();
    loadDashboard(true);
    loadItens(true);
  }, [invalidateControleEmpenhos, loadDashboard, loadItens]);

  const handleSave = async () => {
    if (selectedId == null) return;
    const vals = editValues[selectedId];
    if (!vals) return;
    const item = itens.find((i) => i.id === selectedId);
    if (!item) return;
    setSaving(true);
    const toNum = (v: number | undefined | null): number | undefined => {
      if (v == null) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const toStr = (v: string | undefined | null): string | undefined => {
      const s = v != null ? String(v).trim() : '';
      return s === '' ? undefined : s;
    };
    const { error, status } = await controleEmpenhosApi.salvarHistorico({
      material_id: item.id,
      classificacao: toStr(item.classificacao ?? null),
      resp_controle: toStr(item.respControle ?? null),
      setor_controle: toStr(item.setorControle ?? null),
      master_descritivo: toStr(item.masterDescritivo ?? null),
      numero_registro: toStr(item.registroMaster ?? null),
      valor_unit_registro: toNum(item.valorUnitRegistro),
      saldo_registro: toNum(item.saldoRegistro),
      qtde_por_embalagem: toNum(vals.qtde_por_embalagem),
      tipo_armazenamento: toStr(vals.tipo_armazenamento),
      capacidade_estocagem: toStr(vals.capacidade_estocagem),
      observacao: toStr(vals.observacao),
    });
    setSaving(false);
    if (status === 401) {
      toast({ title: 'Sessão expirada', status: 'error' });
      return;
    }
    if (error) {
      toast({ title: error, status: 'error' });
      return;
    }
    toast({ title: 'Histórico salvo', status: 'success' });
    setSelectedId(null);
    setEditValues((prev) => {
      const next = { ...prev };
      delete next[selectedId];
      return next;
    });
    invalidateControleEmpenhos();
    loadItens(true);
  };

  const toggleSelect = (item: ItemControleEmpenho) => {
    if (selectedId === item.id) {
      setSelectedId(null);
      setEditValues((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } else {
      setSelectedId(item.id);
      setEditValues((prev) => ({
        ...prev,
        [item.id]: {
          qtde_por_embalagem: item.qtdePorEmbalagem != null ? Number(item.qtdePorEmbalagem) : undefined,
          tipo_armazenamento: item.tipoArmazenamento ?? '',
          capacidade_estocagem: item.capacidadeEstocagem ?? '',
          observacao: item.observacao ?? '',
        },
      }));
    }
  };

  const updateEdit = (id: number, field: string, value: string | number | undefined) => {
    setEditValues((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value === '' ? undefined : value },
    }));
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasDirty = selectedId != null && editValues[selectedId];

  const consumoHeaders = useMemo(() => getConsumoHeaders(mesesConsumo), [mesesConsumo]);
  const consumoValues = (item: ItemControleEmpenho) => [
    item.consumoMesMinus6,
    item.consumoMesMinus5,
    item.consumoMesMinus4,
    item.consumoMesMinus3,
    item.consumoMesMinus2,
    item.consumoMesMinus1,
    item.consumoMesAtual,
  ];

  return (
    <Box>
      <Heading size="lg" color="brand.darkGreen" mb={4}>
        Controle de Empenhos
      </Heading>

      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        {loadingDashboard ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} bg="white" borderLeft="4px" borderColor="gray.200">
                <CardBody>
                  <Text fontSize="sm" color="gray.500">Carregando...</Text>
                  <Flex align="center" gap={2} mt={1}>
                    <Spinner size="sm" color="brand.darkGreen" />
                  </Flex>
                </CardBody>
              </Card>
            ))}
          </>
        ) : dashboard ? (
          <>
            <Card bg="white" borderLeft="4px" borderColor="brand.green">
              <CardBody>
                <Text fontSize="sm" color="gray.600">Materiais</Text>
                <Text fontSize="2xl" fontWeight="bold" color="brand.darkGreen">{dashboard.totalMateriais}</Text>
              </CardBody>
            </Card>
            <Card bg="white" borderLeft="4px" borderColor="orange.400">
              <CardBody>
                <Text fontSize="sm" color="gray.600">Pendências</Text>
                <Text fontSize="2xl" fontWeight="bold">{dashboard.totalPendencias}</Text>
              </CardBody>
            </Card>
            <Card bg="white" borderLeft="4px" borderColor="yellow.400">
              <CardBody>
                <Text fontSize="sm" color="gray.600">Atenção</Text>
                <Text fontSize="2xl" fontWeight="bold">{dashboard.totalAtencao}</Text>
              </CardBody>
            </Card>
            <Card bg="white" borderLeft="4px" borderColor="red.500">
              <CardBody>
                <Text fontSize="sm" color="gray.600">Crítico</Text>
                <Text fontSize="2xl" fontWeight="bold">{dashboard.totalCritico}</Text>
              </CardBody>
            </Card>
          </>
        ) : (
          <>
            {['Materiais', 'Pendências', 'Atenção', 'Crítico'].map((label) => (
              <Card key={label} bg="white" borderLeft="4px" borderColor="gray.200">
                <CardBody>
                  <Text fontSize="sm" color="gray.600">{label}</Text>
                  <Text fontSize="2xl" fontWeight="bold" color="gray.400">—</Text>
                </CardBody>
              </Card>
            ))}
          </>
        )}
      </SimpleGrid>

      <Card bg="white" mb={4}>
        <CardBody>
          <Heading size="sm" mb={3} color="brand.darkGreen">Filtros</Heading>
          <HStack flexWrap="wrap" gap={3} mb={3}>
            <Input
              placeholder="Código"
              size="sm"
              w="120px"
              value={filtroCodigo}
              onChange={(e) => setFiltroCodigo(e.target.value)}
            />
            <Input
              placeholder="Responsável"
              size="sm"
              w="140px"
              value={filtroResponsavel}
              onChange={(e) => setFiltroResponsavel(e.target.value)}
            />
            <Select
              size="sm"
              w="120px"
              placeholder="Status"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="Normal">Normal</option>
              <option value="Atenção">Atenção</option>
              <option value="Crítico">Crítico</option>
            </Select>
            <Select
              size="sm"
              w="140px"
              placeholder="Com registro"
              value={filtroComRegistro}
              onChange={(e) => setFiltroComRegistro(e.target.value)}
            >
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </Select>
            <Button size="sm" colorScheme="green" onClick={aplicarFiltros}>
              Aplicar
            </Button>
            <Button
              size="sm"
              variant="outline"
              colorScheme="green"
              onClick={atualizarTudo}
              isLoading={loadingDashboard || loading}
            >
              Atualizar
            </Button>
          </HStack>
        </CardBody>
      </Card>

      {hasDirty && (
        <HStack mb={3}>
          <Button
            size="sm"
            colorScheme="green"
            onClick={handleSave}
            isLoading={saving}
          >
            Salvar alterações
          </Button>
        </HStack>
      )}

      <Card bg="white">
        <TableContainer overflowX="auto">
          {loading ? (
            <Flex justify="center" py={8}>
              <Spinner color="brand.darkGreen" />
            </Flex>
          ) : (
            <Table size="sm" whiteSpace="nowrap">
              <Thead bg="gray.50">
                <Tr>
                  <Th title="Habilita edição">✓</Th>
                  <Th>Classificação</Th>
                  <Th>Resp ctrl</Th>
                  <Th>Master/Descritivo</Th>
                  <Th>Apres</Th>
                  {consumoHeaders.map((h, i) => (
                    <Th key={i} isNumeric fontSize="xs">{h}</Th>
                  ))}
                  <Th isNumeric>Média 6 meses</Th>
                  <Th>Mês últ consumo</Th>
                  <Th isNumeric>Qtde últ consumo</Th>
                  <Th isNumeric>Estoque almox.</Th>
                  <Th isNumeric>Estoque geral</Th>
                  <Th isNumeric>Saldo empenhos</Th>
                  <Th>Pré-empenho</Th>
                  <Th>Cobertura estoque</Th>
                  <Th>Registro</Th>
                  <Th>Vigência</Th>
                  <Th isNumeric>Saldo registro</Th>
                  <Th isNumeric>Valor unit. registro</Th>
                  <Th>Qtde/emb.</Th>
                  <Th>Class. XYZ</Th>
                  <Th>Tipo armazen.</Th>
                  <Th>Cap. estocagem</Th>
                  <Th>Status</Th>
                  <Th>Observação</Th>
                </Tr>
              </Thead>
              <Tbody>
                {loading && (
                  <Tr>
                    <Td colSpan={20} textAlign="center" py={8}>
                      <Spinner size="lg" />
                      <Text mt={2}>Carregando dados...</Text>
                    </Td>
                  </Tr>
                )}
                {!loading && itens.length === 0 && (
                  <Tr>
                    <Td colSpan={20} textAlign="center" py={8}>
                      <Text color="gray.500">Nenhum item encontrado</Text>
                      <Text fontSize="sm" color="gray.400" mt={1}>
                        Total: {total} | Página: {page}
                      </Text>
                    </Td>
                  </Tr>
                )}
                {!loading && itens.map((item) => {
                  const isSelected = selectedId === item.id;
                  const edits = editValues[item.id] ?? {};
                  const consumos = consumoValues(item);
                  
                  // Preparar dados para renderizadores de colunas 6-12
                  const dadosColunasRender: DadosColunasControleRender = {
                    consumoMesMinus6: Number(item.consumoMesMinus6) || 0,
                    consumoMesMinus5: Number(item.consumoMesMinus5) || 0,
                    consumoMesMinus4: Number(item.consumoMesMinus4) || 0,
                    consumoMesMinus3: Number(item.consumoMesMinus3) || 0,
                    consumoMesMinus2: Number(item.consumoMesMinus2) || 0,
                    consumoMesMinus1: Number(item.consumoMesMinus1) || 0,
                    consumoMesAtual: Number(item.consumoMesAtual) || 0,
                    mediaConsumo6Meses: Number(item.mediaConsumo6Meses) || 0,
                    mesUltimoConsumo: item.mesUltimoConsumo,
                    qtdeUltimoConsumo: Number(item.qtdeUltimoConsumo) || 0,
                    estoqueAlmoxarifados: Number(item.estoqueAlmoxarifados) || 0,
                    estoqueGeral: Number(item.estoqueGeral) || 0,
                    saldoEmpenhos: Number(item.saldoEmpenhos) || 0,
                    coberturaEstoque: item.coberturaEstoque ? Number(item.coberturaEstoque) : null,
                  };
                  
                  const colunasRenderizadas = renderizarColunasControle(dadosColunasRender);
                  
                  return (
                    <Tr key={item.rowKey ?? item.id} bg={isSelected ? 'green.50' : undefined}>
                      <Td>
                        <Checkbox
                          isChecked={isSelected}
                          onChange={() => toggleSelect(item)}
                        />
                      </Td>
                      <Td maxW="200px" overflow="hidden" textOverflow="ellipsis">{item.classificacao ?? '-'}</Td>
                      <Td maxW="80px" overflow="hidden" textOverflow="ellipsis">{item.respControle ?? '-'}</Td>
                      <Td maxW="600px" overflow="hidden" textOverflow="ellipsis">{item.masterDescritivo ?? '-'}</Td>
                      <Td>{item.apres ?? '-'}</Td>
                      
                      {/* Colunas 6-12: Renderizadas com formatação e cores */}
                      {colunasRenderizadas}
                      
                      {/* Colunas após as colunas de consumo/indicadores (19 em diante) */}
                      <Td>{item.numeroPreEmpenho ?? '-'}</Td>
                      <Td>{item.registroMaster ?? '-'}</Td>
                      <Td style={{ textAlign: 'center' }}>{item.vigenciaRegistro ? formatDate(new Date(item.vigenciaRegistro), 'dd/mm/yyyy') : '-'}</Td> 
                      <Td isNumeric>{formatarDecimal(item.saldoRegistro)}</Td>
                      <Td isNumeric>{formatarDecimal(item.valorUnitRegistro)}</Td>
                      {/* Qtde/emb.: editável quando checkbox selecionado */}
                      <Td isNumeric>
                        {isSelected ? (
                          <Input
                            size="xs"
                            type="number"
                            placeholder="Qtde/emb."
                            w="80px"
                            value={edits.qtde_por_embalagem != null ? String(edits.qtde_por_embalagem) : ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateEdit(item.id, 'qtde_por_embalagem', v === '' ? undefined : (Number(v) || undefined));
                            }}
                          />
                        ) : (
                          item.qtdePorEmbalagem != null ? formatarDecimal(item.qtdePorEmbalagem) : '-'
                        )}
                      </Td>
                      {/* Class. XYZ: valor do banco, somente leitura */}
                      <Td>{item.classificacaoXYZ ?? '-'}</Td>
                      {/* Tipo armazen.: editável quando checkbox selecionado */}
                      <Td>
                        {isSelected ? (
                          <Input
                            size="xs"
                            placeholder="Tipo"
                            minW="80px"
                            value={edits.tipo_armazenamento ?? ''}
                            onChange={(e) => updateEdit(item.id, 'tipo_armazenamento', e.target.value)}
                          />
                        ) : (
                          item.tipoArmazenamento ?? '-'
                        )}
                      </Td>
                      {/* Cap. estocagem: editável quando checkbox selecionado */}
                      <Td>
                        {isSelected ? (
                          <Input
                            size="xs"
                            placeholder="Capacidade"
                            minW="80px"
                            value={edits.capacidade_estocagem ?? ''}
                            onChange={(e) => updateEdit(item.id, 'capacidade_estocagem', e.target.value)}
                          />
                        ) : (
                          item.capacidadeEstocagem ?? '-'
                        )}
                      </Td>
                      {/* Status: calculado [Normal, Atenção, Crítico], somente leitura */}
                      <Td style={{ textAlign: 'center' }}>
                        <Text
                          as="span"
                          fontSize="xs"
                          px={2}
                          py={1}
                          borderRadius="md"
                          bg={
                            item.status === 'Crítico' ? 'red.100' :
                            item.status === 'Atenção' ? 'yellow.100' : 'green.100'
                          }
                        >
                          {item.status ?? '-'}
                        </Text>
                      </Td>
                      {/* Observação: editável quando checkbox selecionado */}
                      <Td maxW="300px">
                        {isSelected ? (
                          <Input
                            size="xs"
                            placeholder="Obs."
                            minW="280px"
                            value={edits.observacao ?? ''}
                            onChange={(e) => updateEdit(item.id, 'observacao', e.target.value)}
                          />
                        ) : (
                          (item.observacao ?? '-').toString()
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          )}
        </TableContainer>
        {total > 0 && (
          <Flex justify="space-between" align="center" p={3} borderTopWidth="1px" flexWrap="wrap" gap={2}>
            <Text fontSize="sm">
              {total} itens – página {page} de {totalPages}
            </Text>
            <HStack gap={2} flexWrap="wrap">
              <Text fontSize="sm" whiteSpace="nowrap">Itens por página:</Text>
              <Select
                size="sm"
                w="70px"
                value={pageSize}
                onChange={(e) => {
                  const newSize = Number(e.target.value) as typeof PAGE_SIZE_OPTIONS[number];
                  setPageSize(newSize);
                  setPage(1);
                }}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </Select>
              <Button
                size="sm"
                isDisabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                isDisabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </HStack>
          </Flex>
        )}
      </Card>
    </Box>
  );
}
