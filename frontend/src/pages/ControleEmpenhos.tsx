import { useState, useCallback } from 'react';
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
  useToast,
} from '@chakra-ui/react';
import { useControleEmpenhos } from '../hooks/useControleEmpenhos';
import { formatDate, parseDate } from '../utils/date';
import {
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

/** Posições left (px) para colunas sticky (RESP. CTRL após Classificação; checkbox no final) */
const STICKY_LEFT = {
  masterDescritivo: 0,
  apres: STICKY_COL_WIDTHS.masterDescritivo,
  classificacao: STICKY_COL_WIDTHS.masterDescritivo + STICKY_COL_WIDTHS.apres,
  responsavel: STICKY_COL_WIDTHS.masterDescritivo + STICKY_COL_WIDTHS.apres + STICKY_COL_WIDTHS.classificacao,
} as const;

/** Cor de fundo do cabeçalho da tabela Gestão de Estoque */
const TABLE_HEADER_BG = '#8BC547';

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
  } = useControleEmpenhos();

  const toast = useToast();
  const [exporting, setExporting] = useState(false);

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
              placeholder="Código"
              size="sm"
              w="120px"
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
                <col style={{ width: `${STICKY_COL_WIDTHS.classificacao}px`, minWidth: `${STICKY_COL_WIDTHS.classificacao}px` }} />
                <col style={{ width: `${STICKY_COL_WIDTHS.responsavel}px`, minWidth: `${STICKY_COL_WIDTHS.responsavel}px` }} />
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
                  >
                    Master/Descritivo
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
                  <Th
                    {...getStickyStyles('classificacao', true)}
                    w={`${STICKY_COL_WIDTHS.classificacao}px`}
                    minW={`${STICKY_COL_WIDTHS.classificacao}px`}
                    maxW={`${STICKY_COL_WIDTHS.classificacao}px`}
                    textAlign="left"
                  >
                    Classificação
                  </Th>
                  <Th
                    {...getStickyStyles('responsavel', true)}
                    w={`${STICKY_COL_WIDTHS.responsavel}px`}
                    minW={`${STICKY_COL_WIDTHS.responsavel}px`}
                    maxW={`${STICKY_COL_WIDTHS.responsavel}px`}
                    textAlign="left"
                    title="Responsável pelo controle"
                  >
                    RESP. CTRL
                  </Th>

                  {/* Colunas de consumo mensal */}
                  {consumoHeaders.map((h, i) => {
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
                  <ThQuebraLinha linha1="Média" linha2="6 meses" isNumeric />
                  <ThQuebraLinha linha1="Mês últ" linha2="consumo" />
                  <ThQuebraLinha linha1="Qtde últ" linha2="consumo" isNumeric />
                  <ThQuebraLinha linha1="Estoque" linha2="almox." isNumeric />
                  <ThQuebraLinha linha1="Outros" linha2="Estoques" isNumeric />
                  <ThQuebraLinha linha1="Qtde a" linha2="Receber" isNumeric />
                  <ThQuebraLinha linha1="Estoque" linha2="virtual" isNumeric title="Estoque almox. + Saldo empenhos" />
                  <ThQuebraLinha linha1="Cobertura" linha2="estoque" />
                  <ThQuebraLinha linha1="Pré-" linha2="Empenho" />
                  <Th>Registro</Th>
                  <Th>Vigência</Th>
                  <ThQuebraLinha linha1="Saldo" linha2="registro" isNumeric />
                  <ThQuebraLinha linha1="Valor unit." linha2="registro" isNumeric />
                  <Th>Qtde/emb.</Th>
                  <Th>Class. XYZ</Th>
                  <Th>Tipo armazen.</Th>
                  <Th>Cap. estocagem</Th>
                  <Th>Status</Th>
                  <Th>Observação</Th>
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
                    <Td colSpan={32} textAlign="center" py={8}>
                      <Spinner size="lg" />
                      <Text mt={2}>Carregando dados...</Text>
                    </Td>
                  </Tr>
                )}
                
                {!loading && itens.length === 0 && (
                  <Tr>
                    <Td colSpan={32} textAlign="center" py={8}>
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
                    coberturaEstoque: item.coberturaEstoque ? Number(item.coberturaEstoque) : null,
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
                      <Td
                        {...getStickyStyles('classificacao')}
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
                      
                      {/* Coluna RESP. CTRL (logo após Classificação) */}
                      <Td
                        {...getStickyStyles('responsavel')}
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
                      
                      {/* Colunas de consumo */}
                      {colunasRenderizadas}
                      
                      {/* Coluna Pré-empenho */}
                      <ColunaPreEmpenhoCell numeroPreEmpenho={item.numeroPreEmpenho} />
                      
                      {/* Demais colunas */}
                      <Td>{item.registroMaster ?? '-'}</Td>
                      <Td textAlign="center">
                        {item.vigenciaRegistro ? (() => { 
                          const d = parseDate(item.vigenciaRegistro); 
                          return d ? formatDate(d, 'dd/MM/yyyy') : '-'; 
                        })() : '-'}
                      </Td>                       
                      <Td isNumeric>{item.saldoRegistro != null ? formatarDecimal(item.saldoRegistro, 0) : '-'}</Td>
                      <Td isNumeric>{item.valorUnitRegistro != null ? `R$ ${formatarDecimal(item.valorUnitRegistro)}` : '-'}</Td>
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
                              updateEdit(item.rowKey, 'qtde_por_embalagem', v === '' ? undefined : (Number(v) || undefined));
                            }}
                          />
                        ) : (
                          item.qtdePorEmbalagem != null ? formatarDecimal(item.qtdePorEmbalagem) : '-'
                        )}
                      </Td>
                      <Td>{item.classificacaoXYZ ?? '-'}</Td>
                      <Td>
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
                      </Td>
                      <Td>
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
                      </Td>
                      <StatusCell status={item.status} statusDetails={item.statusDetails} />
                      <Td maxW="300px">
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
                      </Td>
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