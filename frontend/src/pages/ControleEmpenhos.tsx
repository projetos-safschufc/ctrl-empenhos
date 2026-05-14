import { useState, useCallback, useEffect, useMemo } from 'react';
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
  Spinner,
  Flex,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { useControleEmpenhos } from '../hooks/useControleEmpenhos';
import { formatDate, parseDate } from '../utils/date';
import {
  calcularCoberturaEstoqueFisica,
  formatarDecimal,
  renderizarColunasControle,
  DadosColunasControleRender,
  ColunaPreEmpenhoCell,
  StatusCell,
} from '../utils/columnRenderers';
import {
  exportarExcelControleEmpenhos,
  confirmExportLimit,
  MAX_EXPORT_ROWS,
} from '../utils/plataformaExport';

/** Opções fixas para o campo Tipo de Armazenamento (coluna TIPO ARMAZEN.). */
const TIPO_ARMAZEN_OPCOES = ['Geladeira', 'Estante', 'Pallet'] as const;

/**
 * Configuração individual das larguras das colunas fixas (em pixels).
 */
const STICKY_COL_WIDTHS = {
  /** Coluna ✓ (checkbox) */
  check: 60,
  /** Coluna Master/Descritivo */
  masterDescritivo: 550,
  /** Coluna Resp. ctrl */
  responsavel: 140,
  /** Coluna Apres (apresentação) */
  apres: 70,
  /** Coluna Classificação */
  classificacao: 280,
} as const;

/** Posições left (px) para colunas sticky à esquerda (apenas Master/Descritivo e Apres). */
const STICKY_LEFT = {
  masterDescritivo: 0,
  apres: STICKY_COL_WIDTHS.masterDescritivo,
} as const;

/** Cor de fundo do cabeçalho da tabela Gestão de Estoque */
const TABLE_HEADER_BG = '#8BC547';
const COLUMN_VISIBILITY_STORAGE_KEY = 'controleEmpenhos.visibleColumns.v1';

type SelectableColumnId =
  | 'classificacao'
  | 'responsavel'
  | 'consumoGrupo'
  | 'coberturaVirtual'
  | 'numeroPreEmpenho'
  | 'processoSeiEmp'
  | 'registro'
  | 'vigencia'
  | 'saldoRegistro'
  | 'valorUnitRegistro'
  | 'qtdeEmbalagem'
  | 'classificacaoXYZ'
  | 'tipoArmazenamento'
  | 'capacidadeEstocagem'
  | 'status'
  | 'observacao';

const SELECTABLE_COLUMNS: ReadonlyArray<{ id: SelectableColumnId; label: string; defaultVisible: boolean }> = [
  { id: 'classificacao', label: 'Classificação', defaultVisible: true },
  { id: 'responsavel', label: 'RESP. CTRL', defaultVisible: true },
  { id: 'consumoGrupo', label: 'Consumos e coberturas (grupo)', defaultVisible: true },
  { id: 'coberturaVirtual', label: 'Cobertura físico+emp', defaultVisible: true },
  { id: 'numeroPreEmpenho', label: 'Pré-Empenho', defaultVisible: true },
  { id: 'processoSeiEmp', label: 'PROC. SEI. EMP', defaultVisible: true },
  { id: 'registro', label: 'Registro', defaultVisible: true },
  { id: 'vigencia', label: 'Vigência', defaultVisible: true },
  { id: 'saldoRegistro', label: 'Saldo registro', defaultVisible: true },
  { id: 'valorUnitRegistro', label: 'Valor unit. registro', defaultVisible: true },
  { id: 'qtdeEmbalagem', label: 'Qtde/emb.', defaultVisible: true },
  { id: 'classificacaoXYZ', label: 'Class. XYZ', defaultVisible: true },
  { id: 'tipoArmazenamento', label: 'Tipo armazen.', defaultVisible: true },
  { id: 'capacidadeEstocagem', label: 'Cap. estocagem', defaultVisible: true },
  { id: 'status', label: 'Status', defaultVisible: true },
  { id: 'observacao', label: 'Observação', defaultVisible: true },
];

function getDefaultVisibleColumns(): Record<SelectableColumnId, boolean> {
  const base = {} as Record<SelectableColumnId, boolean>;
  for (const c of SELECTABLE_COLUMNS) base[c.id] = c.defaultVisible;
  return base;
}

/** Z-index hierarchy for sticky elements */
const Z_INDEX = {
  header: 20,
  headerSticky: 21,
  bodySticky: 2,
  bodySelected: 1,
} as const;

/** Renderiza cabeçalho com quebra de linha */
function ThQuebraLinha({
  linha1,
  linha2,
  isNumeric,
  ...rest
}: {
  linha1: string;
  linha2: string;
  isNumeric?: boolean;
  [key: string]: unknown;
}) {
  return (
    <Th isNumeric={isNumeric} whiteSpace="normal" fontSize="xs" title={`${linha1} ${linha2}`} {...rest}>
      <Box as="span" whiteSpace="normal" lineHeight="tight" fontSize="xs">
        {linha1}
        <br />
        {linha2}
      </Box>
    </Th>
  );
}

export function ControleEmpenhos() {
  const {
    dashboard,
    itens,
    total,
    page,
    setPage,
    pageSize,
    setPageSize,
    loading,
    loadingDashboard,
    filtroCodigo,
    setFiltroCodigo,
    filtroResponsavel,
    setFiltroResponsavel,
    filtroClassificacao,
    setFiltroClassificacao,
    filtroSetor,
    setFiltroSetor,
    filtroStatus,
    setFiltroStatus,
    filtroComRegistro,
    setFiltroComRegistro,
    filtroQtdeRegistros,
    setFiltroQtdeRegistros,
    opcoesClassificacao,
    opcoesResponsavel,
    selectedRowKey,
    editValues,
    saving,
    aplicarFiltros,
    atualizarTudo,
    handleSave,
    toggleSelect,
    updateEdit,
    totalPages,
    hasDirty,
    consumoHeaders,
    fetchItensForExport,
    PAGE_SIZE_OPTIONS,
    sortBy,
    sortDir,
    setSortBy,
    setSortDir,
    } = useControleEmpenhos();

  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<SelectableColumnId, boolean>>(() => {
    const defaults = getDefaultVisibleColumns();
    if (typeof window === 'undefined') return defaults;
    try {
      const raw = window.localStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as Partial<Record<SelectableColumnId, boolean>>;
      return { ...defaults, ...parsed };
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const isColVisible = useCallback(
    (id: SelectableColumnId) => visibleColumns[id] !== false,
    [visibleColumns]
  );

  const dynamicColSpan = useMemo(() => {
    const baseFixed = 3; // master/apres + checkbox sticky
    let totalCols = baseFixed;
    if (isColVisible('classificacao')) totalCols++;
    if (isColVisible('responsavel')) totalCols++;
    if (isColVisible('consumoGrupo')) totalCols += 15;
    if (isColVisible('coberturaVirtual')) totalCols++;
    if (isColVisible('numeroPreEmpenho')) totalCols++;
    if (isColVisible('processoSeiEmp')) totalCols++;
    if (isColVisible('registro')) totalCols++;
    if (isColVisible('vigencia')) totalCols++;
    if (isColVisible('saldoRegistro')) totalCols++;
    if (isColVisible('valorUnitRegistro')) totalCols++;
    if (isColVisible('qtdeEmbalagem')) totalCols++;
    if (isColVisible('classificacaoXYZ')) totalCols++;
    if (isColVisible('tipoArmazenamento')) totalCols++;
    if (isColVisible('capacidadeEstocagem')) totalCols++;
    if (isColVisible('status')) totalCols++;
    if (isColVisible('observacao')) totalCols++;
    return totalCols;
  }, [isColVisible]);

  const handleExportExcel = useCallback(async () => {
    if (total === 0) return;
    if (total > MAX_EXPORT_ROWS) {
      const ok = await confirmExportLimit(total, MAX_EXPORT_ROWS);
      if (!ok) return;
    }
    setExporting(true);
    try {
      const { itens: toExport, consumoHeaders: headers } = await fetchItensForExport();
      await exportarExcelControleEmpenhos(toExport, headers);
      toast({ title: 'Exportação concluída.', status: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao exportar';
      toast({ title: msg, status: 'error' });
    } finally {
      setExporting(false);
    }
  }, [total, fetchItensForExport, toast]);

  const getStickyStyles = (column: keyof typeof STICKY_LEFT, isHeader = false) => ({
    position: 'sticky' as const,
    left: STICKY_LEFT[column],
    zIndex: isHeader ? Z_INDEX.headerSticky : Z_INDEX.bodySticky,
    bg: isHeader ? TABLE_HEADER_BG : undefined,
    color: isHeader ? 'white' : undefined,
    borderRightWidth: '1px',
    borderColor: isHeader ? 'whiteAlpha.400' : 'gray.200',
  });

  /** Estilos para coluna fixa à direita (checkbox no final da tabela) */
  const getStickyRightStyles = (isHeader = false) => ({
    position: 'sticky' as const,
    right: 0,
    zIndex: isHeader ? Z_INDEX.headerSticky : Z_INDEX.bodySticky,
    bg: isHeader ? TABLE_HEADER_BG : undefined,
    color: isHeader ? 'white' : undefined,
    borderLeftWidth: '1px',
    borderColor: isHeader ? 'whiteAlpha.400' : 'gray.200',
  });

  const getCellBg = (isSelected: boolean, isHeader = false) => {
    if (isHeader) return 'gray.50';
    return isSelected ? 'green.50' : 'white';
  };

  const getResponsavel = (item: Record<string, unknown>, edits: Record<string, unknown>): string => {
    if (edits.responsavel !== undefined) return String(edits.responsavel);
    const responsavel =
      item.responsavel ??
      item.respControle ??
      item.resp_controle ??
      item.responsavelControle ??
      item.nomeResponsavel ??
      item.RESPONSAVEL ??
      '';
    return responsavel ? String(responsavel) : '-';
  };

  // Função auxiliar para formatar Master/Descritivo
  const formatMasterDescritivo = (item: any): string => {
    if (item.masterDescritivo) {
      return item.masterDescritivo;
    }
    const codigo = item.codigo ?? item.CODIGO ?? '';
    const descricao = item.descricao ?? item.DESCRICAO ?? '';
    if (codigo || descricao) {
      return `${codigo} - ${descricao}`.trim();
    }
    return '-';
  };

  // Função para obter a apresentação
  const getApresentacao = (item: any): string => {
    return item.apres ?? item.apresentacao ?? item.APRESENTACAO ?? '-';
  };

  // Função para obter a classificação
  const getClassificacao = (item: any): string => {
    return item.classificacao ?? item.CLASSIFICACAO ?? '-';
  };

  // Coluna virtual COBERTURA = (ESTOQUE ALMOX. + QTDE A RECEBER) / MÉDIA 6 MESES
  const formatCoberturaVirtual = (item: any): string => {
    const estoqueAlmox = Number(item.estoqueAlmoxarifados ?? 0);
    const qtdeAReceber = Number(item.saldoEmpenhos ?? 0);
    const media6 = Number(item.mediaConsumo6Meses ?? 0);
    if (!Number.isFinite(media6) || media6 <= 0) return '0,0';
    const valor = (estoqueAlmox + qtdeAReceber) / media6;
    if (!Number.isFinite(valor)) return '0,0';
    return valor.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  };

  const handleSort = (field: 'master' | 'cobertura' | 'vigencia') => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  const renderSortIndicator = (field: 'master' | 'cobertura' | 'vigencia') => {
    if (sortBy !== field) return null;
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <Box>
      <Heading size="lg" color="brand.darkGreen" mb={4}>
        Gestão de Estoque
      </Heading>

      <SimpleGrid columns={{ base: 2, md: 5 }} spacing={4} mb={6}>
        {/* Cards de dashboard - mantido igual */}
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
            <Card bg="white" borderLeft="4px" borderColor="brand.green" borderRadius="md" boxShadow="sm">
              <CardBody>
                <Text fontSize="sm" color="gray.600">Materiais</Text>
                <Text fontSize="2xl" fontWeight="bold" color="brand.darkGreen">{dashboard.totalMateriais}</Text>
              </CardBody>
            </Card>
            <Card bg="white" borderLeft="4px" borderColor="orange.400" borderRadius="md" boxShadow="sm">
              <CardBody>
                <Text fontSize="sm" color="gray.600">Pendências</Text>
                <Text fontSize="2xl" fontWeight="bold">{dashboard.totalPendencias}</Text>
              </CardBody>
            </Card>
            <Card bg="white" borderLeft="4px" borderColor="yellow.400" borderRadius="md" boxShadow="sm">
              <CardBody>
                <Text fontSize="sm" color="gray.600">Atenção</Text>
                <Text fontSize="2xl" fontWeight="bold">{dashboard.totalAtencao}</Text>
              </CardBody>
            </Card>
            <Card bg="white" borderLeft="4px" borderColor="red.500" borderRadius="md" boxShadow="sm">
              <CardBody>
                <Text fontSize="sm" color="gray.600">Crítico</Text>
                <Text fontSize="2xl" fontWeight="bold">{dashboard.totalCritico}</Text>
              </CardBody>
            </Card>
            <Card bg="white" borderLeft="4px" borderColor="orange.300" borderRadius="md" boxShadow="sm">
              <CardBody>
                <Text fontSize="sm" color="gray.600">Materiais com Consumo</Text>
                <Text fontSize="2xl" fontWeight="bold" color="orange.600">
                  {typeof dashboard.materiaisComConsumoSemRegistro === 'number'
                    ? dashboard.materiaisComConsumoSemRegistro
                    : 0}
                </Text>
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Materiais com consumo &gt; 0 e sem registro ativo
                </Text>
              </CardBody>
            </Card>
          </>
        ) : (
          <>
            {['Materiais', 'Pendências', 'Atenção', 'Crítico', 'Materiais com Consumo'].map((label) => (
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
              placeholder="Código ou Descritivo"
              size="sm"
              w="160px"
              value={filtroCodigo}
              onChange={(e) => setFiltroCodigo(e.target.value)}
            />
            <Select
              size="sm"
              w="140px"
              placeholder="Responsável"
              value={filtroResponsavel}
              onChange={(e) => setFiltroResponsavel(e.target.value)}
            >
              <option value="">Todos</option>
              {opcoesResponsavel.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
            <Select
              size="sm"
              w="180px"
              placeholder="Classificação"
              value={filtroClassificacao}
              onChange={(e) => setFiltroClassificacao(e.target.value)}
            >
              <option value="">Todas</option>
              {opcoesClassificacao.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select
              size="sm"
              w="110px"
              placeholder="Setor"
              value={filtroSetor}
              onChange={(e) => setFiltroSetor(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="UACE">UACE</option>
              <option value="ULOG">ULOG</option>
            </Select>
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
            <Select
              size="sm"
              w="160px"
              placeholder="Qtde registros"
              value={filtroQtdeRegistros}
              onChange={(e) => setFiltroQtdeRegistros(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="0">Itens s/ registro</option>
              <option value="1">Itens c/ 1 registro</option>
              <option value="2">Itens c/ 2 registros</option>
              <option value="3">Itens c/ 3 registros</option>
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
            <Box position="relative">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowColumnSelector((v) => !v)}
              >
                Colunas
              </Button>
              {showColumnSelector && (
                <Box
                  position="absolute"
                  zIndex={30}
                  mt={2}
                  p={3}
                  bg="white"
                  borderWidth="1px"
                  borderColor="gray.200"
                  borderRadius="md"
                  boxShadow="md"
                  minW="280px"
                >
                  <VStack align="start" spacing={2} maxH="280px" overflowY="auto">
                    {SELECTABLE_COLUMNS.map((col) => (
                      <Checkbox
                        key={col.id}
                        size="sm"
                        isChecked={isColVisible(col.id)}
                        onChange={(e) =>
                          setVisibleColumns((prev) => ({
                            ...prev,
                            [col.id]: e.target.checked,
                          }))
                        }
                      >
                        {col.label}
                      </Checkbox>
                    ))}
                  </VStack>
                </Box>
              )}
            </Box>
            {(() => {
              const msg =
                filtroQtdeRegistros === ''
                  ? `Total: ${total} materiais`
                  : filtroQtdeRegistros === '0'
                    ? `Há ${total} materiais sem registro ativo.`
                    : filtroQtdeRegistros === '1'
                      ? `Há ${total} materiais com 1 registro ativo.`
                      : `Há ${total} materiais com ${filtroQtdeRegistros} registros ativos.`;
              return (
                <Text fontSize="sm" color="gray.600" whiteSpace="nowrap">
                  {msg}
                </Text>
              );
            })()}
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
        <TableContainer overflowX="auto" overflowY="auto" maxHeight="calc(100vh - 300px)">
          {loading ? (
            <Flex justify="center" align="center" py={20}>
              <Spinner size="lg" color="brand.darkGreen" />
            </Flex>
          ) : (
            <Table size="sm" whiteSpace="nowrap" variant="simple">
              <colgroup>
                <col style={{ width: `${STICKY_COL_WIDTHS.masterDescritivo}px`, minWidth: `${STICKY_COL_WIDTHS.masterDescritivo}px` }} />
                <col style={{ width: `${STICKY_COL_WIDTHS.apres}px`, minWidth: `${STICKY_COL_WIDTHS.apres}px` }} />
                {isColVisible('classificacao') && (
                  <col style={{ width: `${STICKY_COL_WIDTHS.classificacao}px`, minWidth: `${STICKY_COL_WIDTHS.classificacao}px` }} />
                )}
                {isColVisible('responsavel') && (
                  <col style={{ width: `${STICKY_COL_WIDTHS.responsavel}px`, minWidth: `${STICKY_COL_WIDTHS.responsavel}px` }} />
                )}
              </colgroup>
              
              <Thead sx={{ '& th': { bg: TABLE_HEADER_BG, color: 'white' } }}>
                <Tr position="sticky" top={0} zIndex={Z_INDEX.header} bg={TABLE_HEADER_BG} color="white">
                  {/* Colunas fixas à esquerda no cabeçalho */}
                  <Th
                    {...getStickyStyles('masterDescritivo', true)}
                    w={`${STICKY_COL_WIDTHS.masterDescritivo}px`}
                    minW={`${STICKY_COL_WIDTHS.masterDescritivo}px`}
                    maxW={`${STICKY_COL_WIDTHS.masterDescritivo}px`}
                    textAlign="left"
                    cursor="pointer"
                    onClick={() => handleSort('master')}
                  >
                    Master/Descritivo{renderSortIndicator('master')}
                  </Th>
                  <Th
                    {...getStickyStyles('apres', true)}
                    w={`${STICKY_COL_WIDTHS.apres}px`}
                    minW={`${STICKY_COL_WIDTHS.apres}px`}
                    maxW={`${STICKY_COL_WIDTHS.apres}px`}
                    textAlign="center"
                  >
                    Apres
                  </Th>
                  {isColVisible('classificacao') && (
                    <Th
                      w={`${STICKY_COL_WIDTHS.classificacao}px`}
                      minW={`${STICKY_COL_WIDTHS.classificacao}px`}
                      maxW={`${STICKY_COL_WIDTHS.classificacao}px`}
                      textAlign="left"
                    >
                      Classificação
                    </Th>
                  )}
                  {isColVisible('responsavel') && (
                    <Th
                      w={`${STICKY_COL_WIDTHS.responsavel}px`}
                      minW={`${STICKY_COL_WIDTHS.responsavel}px`}
                      maxW={`${STICKY_COL_WIDTHS.responsavel}px`}
                      textAlign="left"
                      title="Responsável pelo controle"
                    >
                      RESP. CTRL
                    </Th>
                  )}

                  {/* Colunas de consumo mensal */}
                  {isColVisible('consumoGrupo') && consumoHeaders.map((h, i) => {
                    const isLast = i === consumoHeaders.length - 1;
                    const match = isLast && h.match(/^Mês Atual \((.+)\)$/);
                    if (match) {
                      return (
                        <Th key={i} whiteSpace="normal" fontSize="xs" textAlign="right">
                          <Box as="span" whiteSpace="normal" lineHeight="tight" fontSize="xs">
                            Mês Atual
                            <br />
                            ({match[1]})
                          </Box>
                        </Th>
                      );
                    }
                    return (
                      <Th key={i} isNumeric fontSize="xs" textAlign="right">
                        {h}
                      </Th>
                    );
                  })}
                  
                  {/* Demais colunas do cabeçalho */}
                  {isColVisible('consumoGrupo') && (
                    <>
                      <ThQuebraLinha linha1="Média" linha2="6 meses" isNumeric />
                      <ThQuebraLinha linha1="Mês últ" linha2="consumo" />
                      <ThQuebraLinha linha1="Qtde últ" linha2="consumo" isNumeric />
                      <ThQuebraLinha linha1="Estoque" linha2="almox." isNumeric />
                      <ThQuebraLinha linha1="Outros" linha2="Estoques" isNumeric />
                      <ThQuebraLinha linha1="Qtde a" linha2="Receber" isNumeric />
                      <ThQuebraLinha linha1="Estoque" linha2="virtual" isNumeric title="Estoque almox. + Saldo empenhos" />
                      <ThQuebraLinha
                        linha1={`Cobertura${renderSortIndicator('cobertura') ?? ''}`}
                        linha2="est. físico"
                        onClick={() => handleSort('cobertura')}
                        cursor="pointer"
                      />
                    </>
                  )}
                  {isColVisible('coberturaVirtual') && <ThQuebraLinha linha1="Cobertura" linha2="físico+emp" isNumeric />}
                  {isColVisible('numeroPreEmpenho') && <ThQuebraLinha linha1="Pré-" linha2="Empenho" />}
                  {isColVisible('processoSeiEmp') && <ThQuebraLinha linha1="PROC. SEI." linha2="EMP" />}
                  {isColVisible('registro') && <Th>Registro</Th>}
                  {isColVisible('vigencia') && (
                    <Th cursor="pointer" onClick={() => handleSort('vigencia')}>
                      Vigência{renderSortIndicator('vigencia')}
                    </Th>
                  )}
                  {isColVisible('saldoRegistro') && <ThQuebraLinha linha1="Saldo" linha2="registro" isNumeric />}
                  {isColVisible('valorUnitRegistro') && <ThQuebraLinha linha1="Valor unit." linha2="registro" isNumeric />}
                  {isColVisible('qtdeEmbalagem') && <Th>Qtde/emb.</Th>}
                  {isColVisible('classificacaoXYZ') && <Th>Class. XYZ</Th>}
                  {isColVisible('tipoArmazenamento') && <Th>Tipo armazen.</Th>}
                  {isColVisible('capacidadeEstocagem') && <Th>Cap. estocagem</Th>}
                  {isColVisible('status') && <Th>Status</Th>}
                  {isColVisible('observacao') && <Th>Observação</Th>}
                  {/* Coluna checkbox fixa à direita */}
                  <Th
                    {...getStickyRightStyles(true)}
                    w={`${STICKY_COL_WIDTHS.check}px`}
                    minW={`${STICKY_COL_WIDTHS.check}px`}
                    maxW={`${STICKY_COL_WIDTHS.check}px`}
                    title="Habilita edição"
                  >
                    ✓
                  </Th>
                </Tr>
              </Thead>
              
              <Tbody>
                {loading && (
                  <Tr>
                    <Td colSpan={dynamicColSpan} textAlign="center" py={8}>
                      <Spinner size="lg" />
                      <Text mt={2}>Carregando dados...</Text>
                    </Td>
                  </Tr>
                )}
                
                {!loading && itens.length === 0 && (
                  <Tr>
                    <Td colSpan={dynamicColSpan} textAlign="center" py={8}>
                      <Text color="gray.500">Nenhum item encontrado</Text>
                      <Text fontSize="sm" color="gray.400" mt={1}>
                        Total: {total} | Página: {page}
                      </Text>
                    </Td>
                  </Tr>
                )}
                
                {!loading && itens.map((item) => {
                  const isSelected = selectedRowKey === item.rowKey;
                  const edits = editValues[item.rowKey] ?? {};
                  
                  const masterDescritivoDisplay = formatMasterDescritivo(item);
                  const responsavelDisplay = getResponsavel(item as unknown as Record<string, unknown>, edits);
                  const apresentacaoDisplay = getApresentacao(item);
                  const classificacaoDisplay = getClassificacao(item);
                  
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
                    estoqueVirtual: item.estoqueVirtual != null && Number.isFinite(Number(item.estoqueVirtual))
                      ? Number(item.estoqueVirtual)
                      : (Number(item.estoqueAlmoxarifados) || 0) + (Number(item.saldoEmpenhos) || 0),
                    coberturaEstoque: calcularCoberturaEstoqueFisica(
                      item.estoqueAlmoxarifados,
                      item.mediaConsumo6Meses
                    ),
                  };
                  
                  const colunasRenderizadas = renderizarColunasControle(dadosColunasRender);
                  
                  return (
                    <Tr key={item.rowKey ?? item.id}>
                      {/* Coluna Master/Descritivo */}
                      <Td
                        {...getStickyStyles('masterDescritivo')}
                        bg={getCellBg(isSelected)}
                        minW={`${STICKY_COL_WIDTHS.masterDescritivo}px`}
                        whiteSpace="normal"
                        wordBreak="break-word"
                        lineHeight="tight"
                        textAlign="left"
                      >
                        {masterDescritivoDisplay}
                      </Td>
                      
                      {/* Coluna Apresentação */}
                      <Td
                        {...getStickyStyles('apres')}
                        bg={getCellBg(isSelected)}
                        w={`${STICKY_COL_WIDTHS.apres}px`}
                        minW={`${STICKY_COL_WIDTHS.apres}px`}
                        maxW={`${STICKY_COL_WIDTHS.apres}px`}
                        textAlign="center"
                      >
                        {apresentacaoDisplay}
                      </Td>
                      
                      {/* Coluna Classificação */}
                      {isColVisible('classificacao') && (
                        <Td
                          bg={getCellBg(isSelected)}
                          w={`${STICKY_COL_WIDTHS.classificacao}px`}
                          minW={`${STICKY_COL_WIDTHS.classificacao}px`}
                          maxW={`${STICKY_COL_WIDTHS.classificacao}px`}
                          whiteSpace="normal"
                          wordBreak="break-word"
                          lineHeight="tight"
                          textAlign="left"
                        >
                          {classificacaoDisplay}
                        </Td>
                      )}
                      
                      {/* Coluna RESP. CTRL (logo após Classificação) */}
                      {isColVisible('responsavel') && (
                        <Td
                          bg={getCellBg(isSelected)}
                          w={`${STICKY_COL_WIDTHS.responsavel}px`}
                          minW={`${STICKY_COL_WIDTHS.responsavel}px`}
                          maxW={`${STICKY_COL_WIDTHS.responsavel}px`}
                          whiteSpace="normal"
                          wordBreak="break-word"
                          lineHeight="tight"
                          textAlign="left"
                          title={responsavelDisplay !== '-' ? responsavelDisplay : undefined}
                        >
                          {isSelected ? (
                            <Input
                              size="xs"
                              value={edits.responsavel ?? responsavelDisplay}
                              onChange={(e) => updateEdit(item.rowKey, 'responsavel', e.target.value)}
                              placeholder="Responsável"
                            />
                          ) : (
                            responsavelDisplay
                          )}
                        </Td>
                      )}
                      
                      {/* Colunas de consumo */}
                      {isColVisible('consumoGrupo') && colunasRenderizadas}
                      
                      {/* Coluna COBERTURA virtual */}
                      {isColVisible('coberturaVirtual') && <Td isNumeric>{formatCoberturaVirtual(item)}</Td>}

                      {/* Coluna Pré-empenho */}
                      {isColVisible('numeroPreEmpenho') && <ColunaPreEmpenhoCell numeroPreEmpenho={item.numeroPreEmpenho} />}
                      {isColVisible('processoSeiEmp') && <Td>{item.processoSeiEmp?.trim() ? item.processoSeiEmp : '-'}</Td>}
                      
                      {/* Demais colunas */}
                      {isColVisible('registro') && <Td>{item.registroMaster ?? '-'}</Td>}
                      {isColVisible('vigencia') && (
                        <Td textAlign="center">
                          {item.vigenciaRegistro ? (() => {
                            const d = parseDate(item.vigenciaRegistro);
                            return d ? formatDate(d, 'dd/MM/yyyy') : '-';
                          })() : '-'}
                        </Td>
                      )}
                      {isColVisible('saldoRegistro') && <Td isNumeric>{item.saldoRegistro != null ? formatarDecimal(item.saldoRegistro, 0) : '-'}</Td>}
                      {isColVisible('valorUnitRegistro') && <Td isNumeric>{item.valorUnitRegistro != null ? `R$ ${formatarDecimal(item.valorUnitRegistro)}` : '-'}</Td>}
                      {isColVisible('qtdeEmbalagem') && <Td isNumeric>
                        {isSelected ? (
                          <Input
                            size="xs"
                            type="number"
                            placeholder="Qtde/emb."
                            w="80px"
                            value={edits.qtde_por_embalagem != null ? String(edits.qtde_por_embalagem) : ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateEdit(item.rowKey, 'qtde_por_embalagem', v === '' ? undefined : (Number(v) || undefined));
                            }}
                          />
                        ) : (
                          item.qtdePorEmbalagem != null ? formatarDecimal(item.qtdePorEmbalagem) : '-'
                        )}
                      </Td>}
                      {isColVisible('classificacaoXYZ') && <Td>{item.classificacaoXYZ ?? '-'}</Td>}
                      {isColVisible('tipoArmazenamento') && <Td>
                        {isSelected ? (
                          <Select
                            size="xs"
                            minW="100px"
                            placeholder="Tipo"
                            value={edits.tipo_armazenamento ?? ''}
                            onChange={(e) => updateEdit(item.rowKey, 'tipo_armazenamento', e.target.value)}
                          >
                            <option value="">—</option>
                            {TIPO_ARMAZEN_OPCOES.map((op) => (
                              <option key={op} value={op}>{op}</option>
                            ))}
                          </Select>
                        ) : (
                          item.tipoArmazenamento ?? '-'
                        )}
                      </Td>}
                      {isColVisible('capacidadeEstocagem') && <Td>
                        {isSelected ? (
                          <Input
                            size="xs"
                            placeholder="Capacidade"
                            minW="80px"
                            value={edits.capacidade_estocagem ?? ''}
                            onChange={(e) => updateEdit(item.rowKey, 'capacidade_estocagem', e.target.value)}
                          />
                        ) : (
                          item.capacidadeEstocagem ?? '-'
                        )}
                      </Td>}
                      {isColVisible('status') && <StatusCell status={item.status} statusDetails={item.statusDetails} />}
                      {isColVisible('observacao') && <Td maxW="300px">
                        {isSelected ? (
                          <Input
                            size="xs"
                            placeholder="Obs."
                            minW="280px"
                            value={edits.observacao ?? ''}
                            onChange={(e) => updateEdit(item.rowKey, 'observacao', e.target.value)}
                          />
                        ) : (
                          (item.observacao ?? '-').toString()
                        )}
                      </Td>}
                      {/* Coluna Checkbox (última coluna, fixa à direita) */}
                      <Td
                        {...getStickyRightStyles(false)}
                        bg={getCellBg(isSelected)}
                        w={`${STICKY_COL_WIDTHS.check}px`}
                        minW={`${STICKY_COL_WIDTHS.check}px`}
                        maxW={`${STICKY_COL_WIDTHS.check}px`}
                      >
                        <Checkbox
                          isChecked={isSelected}
                          onChange={() => toggleSelect(item)}
                        />
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
              <Button
                size="sm"
                variant="outline"
                colorScheme="green"
                onClick={handleExportExcel}
                isDisabled={loading || total === 0 || exporting}
                isLoading={exporting}
                title="Exportar todos os registros (respeitando filtros) para Excel"
              >
                Exportar Excel
              </Button>
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