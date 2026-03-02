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
  Spinner,
  Flex,
  HStack,
  IconButton,
} from '@chakra-ui/react';
import { DeleteIcon } from '@chakra-ui/icons';
import { useProvisionamento } from '../hooks/useProvisionamento';
import { parseDate } from '../utils/date';

/** Gera e faz download de um CSV com as linhas atuais da tabela (UTF-8 com BOM para Excel). */
function exportarCsvProvisionamento(linhas: Array<{ codigo: string; descricao: string | null; mediaConsumo: number; estoqueAlmoxarifados: number; estoqueVirtual: number; tempoAbastecimento: number | null; numeroRegistro: string | null; saldoRegistro: number | null; vigencia: string | null; valorUnitario: number | null; qtdePedida: number; valorTotal: number; observacao: string }>) {
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
  const row = (r: (typeof linhas)[0]) =>
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
  const {
    codigoBusca,
    setCodigoBusca,
    loading,
    loadingTabela,
    linhas,
    gerandoPdf,
    lastError,
    filtroTabela,
    setFiltroTabela,
    page,
    setPage,
    linhasPagina,
    totalPages,
    pageStart,
    PAGE_SIZE,
    carregarRegistrosAtivos,
    atualizarTabela,
    buscarMaterial,
    updateLinha,
    removerLinha,
    limparTabela,
    handleGerarPdf,
    totalGeral,
    linhasFiltradas,
  } = useProvisionamento();

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
                onClick={limparTabela}
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
