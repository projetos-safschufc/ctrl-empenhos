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
 * Ajuste cada valor para alterar a largura da coluna na tabela.
 */
const STICKY_COL_WIDTHS = {
  /** Coluna ✓ (checkbox) */
  check: 50,
  /** Coluna Classificação */
  classificacao: 280,
  /** Coluna Resp. ctrl */
  respCtrl: 80,
  /** Coluna Master/Descritivo */
  masterDescritivo: 380,
  /** Coluna Apres (apresentação) */
  apres: 52,
} as const;

/** Posições left para colunas sticky (derivadas de STICKY_COL_WIDTHS). */
const STICKY_LEFT_1 = 0;
const STICKY_LEFT_2 = STICKY_COL_WIDTHS.check;
const STICKY_LEFT_3 = STICKY_LEFT_2 + STICKY_COL_WIDTHS.classificacao;
const STICKY_LEFT_4 = STICKY_LEFT_3 + STICKY_COL_WIDTHS.respCtrl;

/** Renderiza cabeçalho com quebra de linha para colunas que devem ficar mais estreitas. */
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
    opcoesClassificacao,
    opcoesResponsavel,
    selectedId,
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

  return (
    <Box>
      <Heading size="lg" color="brand.darkGreen" mb={4}>
        Gestão de Estoque
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
        {/* Para listas muito grandes (ex.: pageSize > 100), considere virtualizar o corpo da tabela com @tanstack/react-virtual para melhor performance. */}
        <TableContainer overflowX="auto">
          {loading ? (
            <Flex justify="center" align="right" py={20}>
              <Spinner size="lg" color="brand.darkGreen" />
            </Flex>
          ) : (
            <Table size="sm" whiteSpace="nowrap">
              <colgroup>
                {/*<col style={{ width: `${STICKY_COL_WIDTHS.check}px`, minWidth: `${STICKY_COL_WIDTHS.check}px` }} />*/}
                <col style={{ width: `${STICKY_COL_WIDTHS.classificacao}px`, minWidth: `${STICKY_COL_WIDTHS.classificacao}px` }} />
              </colgroup>
              <Thead bg="gray.50">
                <Tr>
                  <Th
                    title="Habilita edição"
                    position="sticky"
                    left={STICKY_LEFT_1}
                    zIndex={1}
                    bg="gray.50"
                    w={`${STICKY_COL_WIDTHS.check}px`}
                    minW={`${STICKY_COL_WIDTHS.check}px`}
                    maxW={`${STICKY_COL_WIDTHS.check}px`}
                    borderRightWidth="1px"
                    borderColor="gray.200"
                  >
                    ✓
                  </Th>
                  <Th
                    position="sticky"
                    left={STICKY_LEFT_2}
                    zIndex={5}
                    bg="gray.50"
                    w={`${STICKY_COL_WIDTHS.classificacao}px`}
                    minW={`${STICKY_COL_WIDTHS.classificacao}px`}
                    maxW={`${STICKY_COL_WIDTHS.classificacao}px`}
                    borderRightWidth="1px"
                    borderColor="gray.200"
                    textAlign="left"
                  >Classificação</Th>
                  
                  <Th
                    position="sticky"
                    left={STICKY_LEFT_3}
                    zIndex={2}
                    bg="gray.50"
                    minW={`${STICKY_COL_WIDTHS.respCtrl}px`}
                    borderRightWidth="1px"
                    borderColor="gray.200"
                  >
                    Resp ctrl
                  </Th>
                  <Th
                    position="sticky"
                    left={STICKY_LEFT_4}
                    zIndex={2}
                    bg="gray.50"
                    minW={`${STICKY_COL_WIDTHS.masterDescritivo}px`}
                    borderRightWidth="1px"
                    borderColor="gray.200"
                  >
                    Master/Descritivo
                  </Th>
                  <Th
                    w={`${STICKY_COL_WIDTHS.apres}px`}
                    minW={`${STICKY_COL_WIDTHS.apres}px`}
                    maxW={`${STICKY_COL_WIDTHS.apres}px`}
                  >
                    Apres
                  </Th>
                  {consumoHeaders.map((h, i) => {
                    const isLast = i === consumoHeaders.length - 1;
                    const match = isLast && h.match(/^Mês Atual \((.+)\)$/);
                    if (match) {
                      return (
                        <Th key={i} whiteSpace="normal" fontSize="xs">
                          <Box as="span" whiteSpace="normal" lineHeight="tight" fontSize="xs">
                            Mês Atual
                            <br />
                            ({match[1]})
                          </Box>
                        </Th>
                      );
                    }
                    return (
                      <Th key={i} isNumeric fontSize="xs">
                        {h}
                      </Th>
                    );
                  })}
                  <ThQuebraLinha linha1="Média 6" linha2="meses" isNumeric />
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
                </Tr>
              </Thead>
              <Tbody>
                {loading && (
                  <Tr>
                    <Td colSpan={31} textAlign="center" py={8}>
                      <Spinner size="lg" />
                      <Text mt={2}>Carregando dados...</Text>
                    </Td>
                  </Tr>
                )}
                {!loading && itens.length === 0 && (
                  <Tr>
                    <Td colSpan={31} textAlign="center" py={8}>
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
                    estoqueVirtual: item.estoqueVirtual != null && Number.isFinite(Number(item.estoqueVirtual))
                      ? Number(item.estoqueVirtual)
                      : (Number(item.estoqueAlmoxarifados) || 0) + (Number(item.saldoEmpenhos) || 0),
                    coberturaEstoque: item.coberturaEstoque ? Number(item.coberturaEstoque) : null,
                  };
                  
                  const colunasRenderizadas = renderizarColunasControle(dadosColunasRender);
                  
                  return (
                    <Tr key={item.rowKey ?? item.id} bg={isSelected ? 'green.50' : undefined}>
                      <Td
                        position="sticky"
                        left={STICKY_LEFT_1}
                        zIndex={1}
                        bg={isSelected ? 'green.50' : 'white'}
                        w={`${STICKY_COL_WIDTHS.check}px`}
                        minW={`${STICKY_COL_WIDTHS.check}px`}
                        maxW={`${STICKY_COL_WIDTHS.check}px`}
                        borderRightWidth="1px"
                        borderColor="gray.200"
                      >
                        <Checkbox
                          isChecked={isSelected}
                          onChange={() => toggleSelect(item)}
                        />
                      </Td>
                      <Td
                        w={`${STICKY_COL_WIDTHS.classificacao}px`}
                        minW={`${STICKY_COL_WIDTHS.classificacao}px`}
                        maxW={`${STICKY_COL_WIDTHS.classificacao}px`}
                        whiteSpace="normal"
                        wordBreak="break-word"
                        lineHeight="tight"
                        position="sticky"
                        left={STICKY_LEFT_2}
                        zIndex={1}
                        bg={isSelected ? 'green.50' : 'white'}
                        borderRightWidth="1px"
                        borderColor="gray.200"
                        textAlign="left"
                      >
                        {item.classificacao ?? '-'}
                      </Td>
                      <Td
                        maxW="80px"
                        overflow="hidden"
                        textOverflow="ellipsis"
                        position="sticky"
                        left={STICKY_LEFT_3}
                        zIndex={1}
                        bg={isSelected ? 'green.50' : 'white'}
                        minW={`${STICKY_COL_WIDTHS.respCtrl}px`}
                        borderRightWidth="1px"
                        borderColor="gray.200"
                      >
                        {item.respControle ?? '-'}
                      </Td>
                      <Td
                        maxW="600px"
                        whiteSpace="normal"
                        wordBreak="break-word"
                        lineHeight="tight"
                        position="sticky"
                        left={STICKY_LEFT_4}
                        zIndex={1}
                        bg={isSelected ? 'green.50' : 'white'}
                        minW={`${STICKY_COL_WIDTHS.masterDescritivo}px`}
                        borderRightWidth="1px"
                        borderColor="gray.200"
                        textAlign="left"
                      >
                        {item.masterDescritivo ?? '-'}
                      </Td>
                      <Td
                        w={`${STICKY_COL_WIDTHS.apres}px`}
                        minW={`${STICKY_COL_WIDTHS.apres}px`}
                        maxW={`${STICKY_COL_WIDTHS.apres}px`}
                      >
                        {item.apres ?? '-'}
                      </Td>
                      
                      {/* Colunas 6-12: Renderizadas com formatação e cores */}
                      {colunasRenderizadas}
                      
                      {/* Coluna Pré-empenho */}
                      <ColunaPreEmpenhoCell numeroPreEmpenho={item.numeroPreEmpenho} />
                      
                      {/* Colunas após as colunas de consumo/indicadores (20 em diante) */}
                      <Td>{item.registroMaster ?? '-'}</Td>
                      <Td style={{ textAlign: 'center' }}>{item.vigenciaRegistro ? (() => { const d = parseDate(item.vigenciaRegistro); return d ? formatDate(d, 'dd/MM/yyyy') : '-'; })() : '-'}</Td>                       
                      <Td isNumeric>{item.saldoRegistro != null ? formatarDecimal(item.saldoRegistro, 0) : '-'}</Td>
                      {/*<Td isNumeric>{formatarDecimal(item.valorUnitRegistro)}</Td>VALOR MONETÁRIO*/}                      
                      <Td isNumeric>{item.valorUnitRegistro != null ? "R$" + formatarDecimal(item.valorUnitRegistro) : '-'}</Td>
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
                      {/* Tipo armazen.: editável quando checkbox selecionado — Select com opções fixas */}
                      <Td>
                        {isSelected ? (
                          <Select
                            size="xs"
                            minW="100px"
                            placeholder="Tipo"
                            value={edits.tipo_armazenamento ?? ''}
                            onChange={(e) => updateEdit(item.id, 'tipo_armazenamento', e.target.value)}
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
                      {/* Status: calculado no backend; célula + tooltip com statusDetails */}
                      <StatusCell status={item.status} statusDetails={item.statusDetails} />
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
