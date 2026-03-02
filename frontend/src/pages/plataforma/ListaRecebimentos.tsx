import { useEffect, useRef, useCallback, useState } from 'react';
import {
  Box,
  Button,
  Input,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Text,
  HStack,
  useToast,
  Spinner,
  Alert,
  AlertIcon,
  Flex,
  Select,
} from '@chakra-ui/react';
import { FiSearch } from 'react-icons/fi';
import { FiTrash2 } from 'react-icons/fi';
import { PlataformaPageHeader } from '../../components/plataforma/PlataformaPageHeader';
import { useListaRecebimentos } from '../../hooks/useListaRecebimentos';
import { FILTER_PLACEHOLDERS, PLATAFORMA_COLORS, PAGE_SIZE_OPTIONS } from '../../constants/plataforma';
import { exportarPdfHorizontal, exportarExcelListaRecebimentos, confirmExportLimit, MAX_EXPORT_ROWS } from '../../utils/plataformaExport';

const COLUMNS_RECEB = [
  { key: 'id', label: 'ID' },
  { key: 'fornecedor_nome', label: 'Fornecedor' },
  { key: 'data_recebimento', label: 'Data' },
  { key: 'numero_nf', label: 'Empenho' },
  { key: 'item', label: 'Item' },
  { key: 'codigo', label: 'Código' },
  { key: 'material', label: 'Material' },
  { key: 'valor_total', label: 'Saldo Emp' },
  { key: 'qtde_receb', label: 'Qtde Receb' },
  { key: 'status', label: 'Situação' },
  { key: 'usuario', label: 'Usuário' },
];

function formatDate(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    const d = new Date(s);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return String(s);
  }
}

export function ListaRecebimentos() {
  const toast = useToast();
  const tableRef = useRef<HTMLTableElement>(null);
  const {
    itens,
    total,
    page,
    pageSize,
    loading,
    error,
    load,
  } = useListaRecebimentos();

  const [filtroFornecedor, setFiltroFornecedor] = useState('');
  const [filtroEmpenho, setFiltroEmpenho] = useState('');
  const [filtroCodigo, setFiltroCodigo] = useState('');

  const handleBuscar = useCallback(() => {
    load({
      fornecedor: filtroFornecedor,
      empenho: filtroEmpenho,
      codigo: filtroCodigo,
      pageOverride: 1,
    }).catch(() => {});
  }, [load, filtroFornecedor, filtroEmpenho, filtroCodigo]);

  const handleLimpar = useCallback(() => {
    setFiltroFornecedor('');
    setFiltroEmpenho('');
    setFiltroCodigo('');
    load({ pageOverride: 1 }).catch(() => {});
  }, [load]);

  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      load({
        fornecedor: filtroFornecedor,
        empenho: filtroEmpenho,
        codigo: filtroCodigo,
        pageOverride: 1,
        pageSizeOverride: newSize,
      }).catch(() => {});
    },
    [load, filtroFornecedor, filtroEmpenho, filtroCodigo]
  );

  useEffect(() => {
    load({}).catch(() => {});
  }, []);

  useEffect(() => {
    if (error) toast({ title: error, status: 'error' });
  }, [error, toast]);

  const handleExportPdf = useCallback(() => {
    exportarPdfHorizontal('Lista de Recebimentos', tableRef.current);
  }, []);

  const handleExportExcel = useCallback(async () => {
    const rows = itens.map((r) => ({
      id: r.id,
      fornecedor_nome: r.fornecedor_nome ?? '',
      data_recebimento: formatDate(r.data_recebimento),
      numero_nf: r.numero_nf,
      item: r.item ?? '',
      codigo: r.codigo ?? String(r.id),
      material: r.material ?? r.fornecedor_nome ?? '',
      valor_total: typeof r.valor_total === 'number' ? r.valor_total : r.valor_total,
      qtde_receb: r.qtde_receb != null ? r.qtde_receb : '',
      status: r.status ?? '',
      usuario: r.usuario ?? '',
    }));
    const ok = await confirmExportLimit(rows.length);
    if (!ok) return;
    const toExport = rows.slice(0, MAX_EXPORT_ROWS);
    await exportarExcelListaRecebimentos(toExport, COLUMNS_RECEB, 'lista-recebimentos');
    toast({ title: toExport.length < rows.length ? `Excel exportado (${toExport.length} de ${rows.length} linhas).` : 'Excel exportado.', status: 'success' });
  }, [itens, toast]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Box bg={PLATAFORMA_COLORS.predominante} p={6} borderRadius="lg" minH="100vh">
      <PlataformaPageHeader subtitle="Lista de Recebimentos" />

      <HStack spacing={4} mb={4} flexWrap="wrap">
        <Input
          placeholder={FILTER_PLACEHOLDERS.buscarPorFornecedor}
          value={filtroFornecedor}
          onChange={(e) => setFiltroFornecedor(e.target.value)}
          bg={PLATAFORMA_COLORS.cinzaApoio}
          borderColor={PLATAFORMA_COLORS.cinzaApoio}
          w="220px"
        />
        <Input
          placeholder={FILTER_PLACEHOLDERS.buscarPorEmpenho}
          value={filtroEmpenho}
          onChange={(e) => setFiltroEmpenho(e.target.value)}
          bg={PLATAFORMA_COLORS.cinzaApoio}
          borderColor={PLATAFORMA_COLORS.cinzaApoio}
          w="220px"
        />
        <Input
          placeholder={FILTER_PLACEHOLDERS.buscarPorCodigo}
          value={filtroCodigo}
          onChange={(e) => setFiltroCodigo(e.target.value)}
          bg={PLATAFORMA_COLORS.cinzaApoio}
          borderColor={PLATAFORMA_COLORS.cinzaApoio}
          w="220px"
        />
        <Button
          leftIcon={<FiSearch />}
          bg={PLATAFORMA_COLORS.cinzaApoio}
          borderWidth="2px"
          borderColor={PLATAFORMA_COLORS.detalhePrincipal}
          color={PLATAFORMA_COLORS.detalheSecundario}
          _hover={{ opacity: 0.9 }}
          onClick={handleBuscar}
          isDisabled={loading}
        >
          Buscar
        </Button>
        <Button
          leftIcon={<FiTrash2 />}
          bg={PLATAFORMA_COLORS.cinzaApoio}
          borderWidth="2px"
          borderColor={PLATAFORMA_COLORS.detalhePrincipal}
          color={PLATAFORMA_COLORS.detalheSecundario}
          onClick={handleLimpar}
          isDisabled={loading}
        >
          Limpar
        </Button>
      </HStack>

      <Text fontSize="sm" mb={2} color={PLATAFORMA_COLORS.detalheSecundario}>
        {total > 0
          ? `Exibindo ${(page - 1) * pageSize + 1} a ${(page - 1) * pageSize + itens.length} de ${total} registros`
          : 'Nenhum registro. Use os filtros e clique em Buscar ou recarregue a página.'}
      </Text>

      <HStack mb={2} spacing={4} align="center">
        <Text fontSize="sm" color={PLATAFORMA_COLORS.detalheSecundario}>
          Registros por página:
        </Text>
        <Select
          w="80px"
          size="sm"
          value={pageSize}
          onChange={(e) => handlePageSizeChange(Number(e.target.value))}
          bg={PLATAFORMA_COLORS.cinzaApoio}
          borderColor={PLATAFORMA_COLORS.cinzaApoio}
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </HStack>

      <HStack mb={2} spacing={2}>
        <Button
          size="sm"
          bg={PLATAFORMA_COLORS.detalhePrincipal}
          color="white"
          onClick={handleExportPdf}
          isDisabled={loading || itens.length === 0}
        >
          Exportar PDF (horizontal)
        </Button>
        <Button
          size="sm"
          bg={PLATAFORMA_COLORS.detalhePrincipal}
          color="white"
          onClick={handleExportExcel}
          isDisabled={loading || itens.length === 0}
        >
          Exportar Excel formatado
        </Button>
      </HStack>

      {error && (
        <Alert status="error" mb={4}>
          <AlertIcon />
          {error}
        </Alert>
      )}

      <TableContainer overflowX="auto" borderWidth="1px" borderColor={PLATAFORMA_COLORS.cinzaApoio}>
        {loading ? (
          <Flex p={8} justify="center">
            <Spinner color={PLATAFORMA_COLORS.detalhePrincipal} />
          </Flex>
        ) : (
          <Table size="sm" ref={tableRef} variant="simple">
            <Thead bg={PLATAFORMA_COLORS.detalheSecundario}>
              <Tr>
                <Th color="white">ID</Th>
                <Th color="white">Fornecedor</Th>
                <Th color="white">Data</Th>
                <Th color="white">Empenho</Th>
                <Th color="white">Item</Th>
                <Th color="white">Código</Th>
                <Th color="white">Material</Th>
                <Th color="white">Saldo Emp</Th>
                <Th color="white">Qtde Receb</Th>
                <Th color="white">Situação</Th>
                <Th color="white">Usuário</Th>
              </Tr>
            </Thead>
            <Tbody>
              {itens.map((r) => (
                <Tr key={r.id}>
                  <Td>{r.id}</Td>
                  <Td>{r.fornecedor_nome ?? '—'}</Td>
                  <Td>{formatDate(r.data_recebimento)}</Td>
                  <Td>{r.numero_nf}</Td>
                  <Td>{r.item ?? '—'}</Td>
                  <Td>{r.codigo ?? '—'}</Td>
                  <Td>{r.material ?? '—'}</Td>
                  <Td>{typeof r.valor_total === 'number' ? r.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : r.valor_total}</Td>
                  <Td>{r.qtde_receb != null && r.qtde_receb !== '' ? String(r.qtde_receb) : '—'}</Td>
                  <Td>{r.status || '—'}</Td>
                  <Td>{r.usuario ?? '—'}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </TableContainer>

      {!loading && total > 0 && (
        <Flex mt={4} justify="space-between" align="center" flexWrap="wrap">
          <Text fontSize="sm">
            Página {page} de {totalPages} ({total} registros)
          </Text>
          <HStack>
            <Button
              size="sm"
              isDisabled={page <= 1}
              onClick={() =>
                load({
                  fornecedor: filtroFornecedor,
                  empenho: filtroEmpenho,
                  codigo: filtroCodigo,
                  pageOverride: page - 1,
                }).catch(() => {})
              }
              variant="outline"
              borderColor={PLATAFORMA_COLORS.detalhePrincipal}
              color={PLATAFORMA_COLORS.detalheSecundario}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              isDisabled={page >= totalPages}
              onClick={() =>
                load({
                  fornecedor: filtroFornecedor,
                  empenho: filtroEmpenho,
                  codigo: filtroCodigo,
                  pageOverride: page + 1,
                }).catch(() => {})
              }
              variant="outline"
              borderColor={PLATAFORMA_COLORS.detalhePrincipal}
              color={PLATAFORMA_COLORS.detalheSecundario}
            >
              Próxima
            </Button>
          </HStack>
        </Flex>
      )}
    </Box>
  );
}
