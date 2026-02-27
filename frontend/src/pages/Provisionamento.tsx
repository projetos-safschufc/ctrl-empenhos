import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Heading,
  Input,
  Button,
  Card,
  CardBody,
  Text,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  useToast,
  Spinner,
  Flex,
  HStack,
  IconButton,
} from '@chakra-ui/react';
import { DeleteIcon } from '@chakra-ui/icons';
import {
  provisionamentoApi,
  LinhaProvisionamentoRegistroAtivo,
} from '../api/client';
import { useAppCache, CacheKeys } from '../contexts/AppCacheContext';
import { parseDate } from '../utils/date';

/** Linha da tabela virtual de provisionamento (um material + um registro) */
type LinhaProvisionamento = LinhaProvisionamentoRegistroAtivo;

const PAGE_SIZE = 50;

/** Gera e faz download de um CSV com as linhas atuais da tabela (UTF-8 com BOM para Excel). */
function exportarCsvProvisionamento(linhas: LinhaProvisionamento[]) {
  const cols = [
    'Código',
    'Descritivo',
    'Média consumo (6 meses)',
    'Estoque (almoxarifados)',
    'Estoque virtual',
    'Tempo abastecimento',
    'Número registro',
    'Saldo registro',
    'Vigência',
    'Valor unitário',
    'Qtde pedida',
    'Valor total',
    'Observação',
  ];
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const fmtNum = (n: number | null | undefined) =>
    n != null ? Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '';
  const row = (r: LinhaProvisionamento) =>
    [
      r.codigo,
      r.descricao ?? '',
      fmtNum(r.mediaConsumo),
      fmtNum(r.estoqueAlmoxarifados),
      fmtNum(r.estoqueVirtual),
      r.tempoAbastecimento != null ? fmtNum(r.tempoAbastecimento) : '',
      r.numeroRegistro ?? '',
      r.saldoRegistro != null ? fmtNum(r.saldoRegistro) : '',
      r.vigencia ?? '',
      r.valorUnitario != null ? fmtNum(r.valorUnitario) : '',
      r.qtdePedida,
      fmtNum(r.valorTotal),
      r.observacao ?? '',
    ].map(escape).join(',');
  const csv = '\uFEFF' + cols.join(',') + '\n' + linhas.map(row).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `provisionamento-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function Provisionamento() {
  const [codigoBusca, setCodigoBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTabela, setLoadingTabela] = useState(true);
  const [linhas, setLinhas] = useState<LinhaProvisionamento[]>([]);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [filtroTabela, setFiltroTabela] = useState('');
  const [page, setPage] = useState(1);

  const toast = useToast();

  const linhasFiltradas = useMemo(() => {
    const t = filtroTabela.trim().toLowerCase();
    if (!t) return linhas;
    return linhas.filter(
      (l) =>
        (l.codigo && l.codigo.toLowerCase().includes(t)) ||
        (l.descricao && l.descricao.toLowerCase().includes(t))
    );
  }, [linhas, filtroTabela]);

  const totalPages = Math.max(1, Math.ceil(linhasFiltradas.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const linhasPagina = useMemo(
    () => linhasFiltradas.slice(pageStart, pageStart + PAGE_SIZE),
    [linhasFiltradas, pageStart]
  );

  useEffect(() => {
    setPage(1);
  }, [filtroTabela, linhas.length]);

  const { getCached, setCached, invalidateProvisionamento } = useAppCache();
  const PROVISIONAMENTO_KEY = CacheKeys.provisionamentoRegistros();

  const carregarRegistrosAtivos = useCallback(
    async (silent = false, skipCache = false) => {
      if (!skipCache) {
        const cached = getCached<LinhaProvisionamentoRegistroAtivo[]>(PROVISIONAMENTO_KEY);
        if (cached && Array.isArray(cached)) {
          setLinhas(cached);
          setLastError(null);
          setLoadingTabela(false);
          return;
        }
      }
      setLoadingTabela(true);
      setLastError(null);
      const { data, error } = await provisionamentoApi.getRegistrosAtivos();
      setLoadingTabela(false);
      if (error) {
        setLastError(error);
        if (!silent) toast({ title: error, status: 'error' });
        return;
      }
      setLastError(null);
      if (data && data.length > 0) {
        setLinhas(data);
        setCached(PROVISIONAMENTO_KEY, data);
        if (!silent) toast({ title: `${data.length} registro(s) ativo(s) carregado(s)`, status: 'success' });
      } else {
        setLinhas([]);
      }
    },
    [toast, getCached, setCached]
  );

  const atualizarTabela = useCallback(() => {
    invalidateProvisionamento();
    carregarRegistrosAtivos(true, true);
  }, [invalidateProvisionamento, carregarRegistrosAtivos]);

  useEffect(() => {
    carregarRegistrosAtivos(true);
  }, [carregarRegistrosAtivos]);

  const buscarMaterial = useCallback(async () => {
    const codigo = codigoBusca.trim();
    if (!codigo) {
      toast({ title: 'Informe o código do material', status: 'warning' });
      return;
    }
    setLoading(true);
    const { data, error } = await provisionamentoApi.getPorCodigo(codigo);
    setLoading(false);
    if (error) {
      toast({ title: error, status: 'error' });
      return;
    }
    if (data) {
      if (data.registros.length === 0) {
        toast({ title: 'Material encontrado, mas sem registros ativos', status: 'info' });
        return;
      }
      const novasLinhas: LinhaProvisionamento[] = data.registros.map((r, idx) => ({
        id: `${data.codigo}-${r.numero_registro ?? idx}-${Date.now()}`,
        codigo: data.codigo,
        descricao: data.descricao,
        mediaConsumo: data.mediaConsumo,
        estoqueAlmoxarifados: data.estoqueAlmoxarifados,
        estoqueVirtual: data.estoqueVirtual,
        tempoAbastecimento: data.tempoAbastecimento,
        numeroRegistro: r.numero_registro ?? null,
        saldoRegistro: r.saldo_registro ?? null,
        vigencia: r.vigencia ?? null,
        valorUnitario: r.valor_unitario ?? null,
        qtdePedida: 0,
        observacao: '',
        valorTotal: 0,
      }));
      setLinhas((prev) => [...prev, ...novasLinhas]);
      setCodigoBusca('');
      toast({ title: `${novasLinhas.length} registro(s) adicionado(s) à tabela`, status: 'success' });
    }
  }, [codigoBusca, toast]);

  const updateLinha = (id: string, field: 'qtdePedida' | 'observacao', value: number | string) => {
    setLinhas((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        if (field === 'qtdePedida') {
          const qtde = Number(value) || 0;
          return {
            ...l,
            qtdePedida: qtde,
            valorTotal: qtde * (l.valorUnitario ?? 0),
          };
        }
        return { ...l, observacao: String(value) };
      })
    );
  };

  const removerLinha = (id: string) => {
    setLinhas((prev) => prev.filter((l) => l.id !== id));
  };

  const handleGerarPdf = async () => {
    if (linhas.length === 0) {
      toast({ title: 'Nenhum registro na tabela', status: 'warning' });
      return;
    }
    const comQtde = linhas.filter((l) => l.qtdePedida > 0);
    if (comQtde.length === 0) {
      toast({ title: 'Informe ao menos uma quantidade pedida', status: 'warning' });
      return;
    }

    // Agrupa linhas por material (código + descrição)
    const materiaisMap = new Map<string, LinhaProvisionamento[]>();
    for (const linha of comQtde) {
      const key = `${linha.codigo}|${linha.descricao ?? ''}`;
      if (!materiaisMap.has(key)) {
        materiaisMap.set(key, []);
      }
      materiaisMap.get(key)!.push(linha);
    }

    const materiais = Array.from(materiaisMap.entries()).map(([, linhasMaterial]) => {
      const primeiraLinha = linhasMaterial[0];
      return {
        codigoMaterial: primeiraLinha.codigo,
        descricao: primeiraLinha.descricao,
        mediaConsumo6Meses: primeiraLinha.mediaConsumo,
        linhas: linhasMaterial.map((l) => ({
          numero_registro: l.numeroRegistro ?? undefined,
          vigencia: l.vigencia ?? undefined,
          valor_unitario: l.valorUnitario ?? undefined,
          qtde_pedida: l.qtdePedida,
          observacao: l.observacao || undefined,
        })),
      };
    });

    setGerandoPdf(true);
    const { blob, filename, error } = await provisionamentoApi.gerarPdfConsolidado({
      materiais,
    });
    setGerandoPdf(false);
    if (error) {
      toast({ title: error, status: 'error' });
      return;
    }
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename ?? 'provisionamento-consolidado.pdf';
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'PDF consolidado gerado e enviado para download', status: 'success' });
    }
  };

  const totalGeral = linhasFiltradas.reduce((s, l) => s + l.valorTotal, 0);

  return (
    <Box>
      <Heading size="lg" color="brand.darkGreen" mb={1}>
        Provisionamento
      </Heading>
      <Text fontSize="sm" color="gray.600" mb={4}>
        Tabela virtual para emissão de empenhos. Dados da view <strong>v_df_consumo_estoque</strong> (DW). Digite o código ou descritivo do material para adicionar à tabela; edite a qtde pedida e exporte em PDF.
      </Text>

      <Card bg="white" mb={4}>
        <CardBody>
          <HStack spacing={3} flexWrap="wrap">
            <Button
              colorScheme="teal"
              onClick={atualizarTabela}
              isLoading={loadingTabela}
            >
              {loadingTabela ? 'Carregando…' : 'Atualizar registros ativos'}
            </Button>
            <Input
              placeholder="Código ou descritivo do material"
              value={codigoBusca}
              onChange={(e) => setCodigoBusca(e.target.value)}
              w="280px"
              onKeyDown={(e) => e.key === 'Enter' && buscarMaterial()}
            />
            <Button colorScheme="green" onClick={buscarMaterial} isLoading={loading}>
              Adicionar Material
            </Button>
            {linhas.length > 0 && (
              <Button
                colorScheme="red"
                variant="outline"
                onClick={() => setLinhas([])}
                size="sm"
              >
                Limpar Tabela
              </Button>
            )}
          </HStack>
        </CardBody>
      </Card>

      {(loading || loadingTabela) && (
        <Flex justify="center" py={8}>
          <Spinner color="brand.darkGreen" />
        </Flex>
      )}

      {!loadingTabela && linhas.length > 0 && (
        <>
          <Card bg="white" mb={4}>
            <CardBody>
              <Heading size="sm" mb={3} color="brand.darkGreen">
                Tabela de Provisionamento
              </Heading>
              <HStack mb={3} spacing={3} flexWrap="wrap">
                <Input
                  placeholder="Filtrar na tabela (código ou descritivo)"
                  value={filtroTabela}
                  onChange={(e) => setFiltroTabela(e.target.value)}
                  w="320px"
                  size="sm"
                />
                {filtroTabela.trim() && (
                  <Text fontSize="sm" color="gray.600">
                    {linhasFiltradas.length} de {linhas.length} registro(s)
                  </Text>
                )}
              </HStack>
              <Box overflowX="auto">
                <Table size="sm" variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Código/Descritivo</Th>
                      <Th isNumeric title="Últimos 6 meses">Média consumo (6 meses)</Th>
                      <Th isNumeric>Estoque (almoxarifados)</Th>
                      <Th isNumeric>Estoque virtual (emp)</Th>
                      <Th isNumeric>Tempo abast do estoque</Th>
                      <Th>Número registro</Th>
                      <Th isNumeric>Saldo registro</Th>
                      <Th>Vigência</Th>
                      <Th isNumeric>Valor unit</Th>
                      <Th isNumeric>Qtde pedida</Th>
                      <Th isNumeric>Valor total</Th>
                      <Th>Observação</Th>
                      <Th>Ações</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {linhasPagina.map((linha) => (
                      <Tr key={linha.id}>
                        <Td>
                          <Box>
                            <Text fontWeight="medium">{linha.codigo}</Text>
                            {linha.descricao && (
                              <Text fontSize="xs" color="gray.600">
                                {linha.descricao.length > 40
                                  ? `${linha.descricao.substring(0, 40)}...`
                                  : linha.descricao}
                              </Text>
                            )}
                          </Box>
                        </Td>
                        <Td isNumeric>
                          {linha.mediaConsumo.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </Td>
                        <Td isNumeric>
                          {linha.estoqueAlmoxarifados.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </Td>
                        <Td isNumeric>
                          {linha.estoqueVirtual.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </Td>
                        <Td isNumeric>
                          {linha.tempoAbastecimento != null
                            ? linha.tempoAbastecimento.toLocaleString('pt-BR', {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 1,
                              })
                            : '—'}
                        </Td>
                        <Td>{linha.numeroRegistro ?? '—'}</Td>
                        <Td isNumeric>
                          {linha.saldoRegistro != null
                            ? linha.saldoRegistro.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : '—'}
                        </Td>

                        <Td>
                          {linha.vigencia
                            ? (() => { const d = parseDate(linha.vigencia); return d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '--/--/----'; })()
                            : '--/--/----'}
                        </Td>


                        <Td isNumeric>
                          {linha.valorUnitario != null
                            ? linha.valorUnitario.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : '—'}
                        </Td>
                        <Td>
                          <Input
                            type="number"
                            size="sm"
                            w="100px"
                            min={0}
                            step="0.01"
                            value={linha.qtdePedida || ''}
                            onChange={(e) => updateLinha(linha.id, 'qtdePedida', e.target.value)}
                          />
                        </Td>
                        <Td isNumeric fontWeight="medium">
                          {linha.valorTotal.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </Td>
                        <Td>
                          <Input maxW="300px"
                            size="sm"
                            placeholder="Observação"
                            value={linha.observacao}
                            onChange={(e) => updateLinha(linha.id, 'observacao', e.target.value)}
                          />
                        </Td>
                        <Td>
                          <IconButton
                            aria-label="Remover linha"
                            icon={<DeleteIcon />}
                            size="sm"
                            colorScheme="red"
                            variant="ghost"
                            onClick={() => removerLinha(linha.id)}
                          />
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
              {(linhasFiltradas.length > 0 || filtroTabela.trim()) && (
                <Flex justify="space-between" align="center" mt={4} flexWrap="wrap" gap={2}>
                  <HStack spacing={2}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      isDisabled={page <= 1}
                    >
                      Anterior
                    </Button>
                    <Text fontSize="sm" color="gray.600">
                      Página {page} de {totalPages}
                      {linhasFiltradas.length > 0 && (
                        <> · {linhasFiltradas.length} registro(s){linhasFiltradas.length > PAGE_SIZE && ` (exibindo ${pageStart + 1}-${Math.min(pageStart + PAGE_SIZE, linhasFiltradas.length)})`}</>
                      )}
                    </Text>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      isDisabled={page >= totalPages}
                    >
                      Próxima
                    </Button>
                  </HStack>
                  <Text fontWeight="bold" fontSize="lg">
                    Total geral: R${' '}
                    {totalGeral.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                </Flex>
              )}
            </CardBody>
          </Card>

          <HStack spacing={3} flexWrap="wrap">
            <Button
              colorScheme="green"
              onClick={handleGerarPdf}
              isLoading={gerandoPdf}
              size="lg"
            >
              Gerar PDF Consolidado
            </Button>
            <Button
              colorScheme="blue"
              variant="outline"
              onClick={() => exportarCsvProvisionamento(linhasFiltradas)}
              size="lg"
              isDisabled={linhasFiltradas.length === 0}
            >
              Exportar CSV
            </Button>
            <Text color="gray.600" fontSize="sm">
              {linhas.length} registro(s) na tabela
              {filtroTabela.trim() && ` · ${linhasFiltradas.length} após filtro`}
            </Text>
          </HStack>
        </>
      )}

      {!loadingTabela && lastError && (
        <Card bg="red.50" borderColor="red.200" borderWidth="1px" my={4}>
          <CardBody>
            <Text color="red.700" mb={3}>
              Erro ao carregar registros ativos: {lastError}
            </Text>
            <Button colorScheme="red" variant="outline" onClick={() => carregarRegistrosAtivos()}>
              Tentar novamente
            </Button>
          </CardBody>
        </Card>
      )}

      {!loadingTabela && !lastError && linhas.length === 0 && (
        <Card bg="white">
          <CardBody>
            <Text color="gray.600" textAlign="center" py={6}>
              Nenhum dado na tabela. Digite o <strong>código ou descritivo do material</strong> no campo acima e clique em &quot;Adicionar Material&quot; para exibir os dados da view <strong>v_df_consumo_estoque</strong>.
            </Text>
            <Text color="gray.500" textAlign="center" fontSize="sm">
              Ou use &quot;Atualizar registros ativos&quot; para carregar todos os materiais com registro ativo.
            </Text>
          </CardBody>
        </Card>
      )}
    </Box>
  );
}
