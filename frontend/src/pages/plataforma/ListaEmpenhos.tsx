import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import {
  Box,
  Input,
  Button,
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
  Checkbox,
  Flex,
} from '@chakra-ui/react';
import { FiSearch, FiRefreshCw, FiCheckSquare, FiX } from 'react-icons/fi';
import { PlataformaPageHeader } from '../../components/plataforma/PlataformaPageHeader';
import { useListaEmpenhos } from '../../hooks/useListaEmpenhos';
import { FILTER_PLACEHOLDERS, PLATAFORMA_COLORS } from '../../constants/plataforma';
import { exportarPdfHorizontal, exportarExcelListaEmpenhos, confirmExportLimit, MAX_EXPORT_ROWS } from '../../utils/plataformaExport';
import { registrarRecebimentoListaEmpenhos, fetchObservacoesByEmpenhos } from '../../api/plataforma';
import type { ListaEmpenhoItem, RegistrarRecebimentoItemPayload } from '../../api/plataforma';

function formatNum(value: number | null | undefined): string {
  if (value == null) return '—';
  return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Extrai "master" do material (código antes do primeiro "-") */
function getMaster(material: string | null | undefined): string {
  if (!material) return '—';
  const idx = material.indexOf('-');
  return idx > 0 ? material.slice(0, idx).trim() : material;
}

const COLUMNS = [
  { key: 'nm_fornecedor', label: 'Fornecedor' },
  { key: 'item', label: 'Item' },
  { key: 'master', label: 'Master' },
  { key: 'material', label: 'Material' },
  { key: 'nu_documento_siafi', label: 'Empenho' },
  { key: 'status_item', label: 'Status Item' },
  { key: 'qt_saldo', label: 'Qtde Emp' },
  { key: 'saldo_item', label: 'Saldo do Item' },
  { key: 'qt_receb', label: 'Qtde receb' },
  { key: 'observacao', label: 'Observação' },
];

export function ListaEmpenhos() {
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
  } = useListaEmpenhos();

  const [filtroMaster, setFiltroMaster] = useState('');
  const [filtroEmpenho, setFiltroEmpenho] = useState('');
  const [filtroFornecedor, setFiltroFornecedor] = useState('');
  const [qtdeReceb, setQtdeReceb] = useState<Record<number, string>>({});
  const [obs, setObs] = useState<Record<number, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const toggleSelection = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectedWithValidQtde = useCallback(() => {
    return Array.from(selectedIds).filter((id) => {
      const q = parseInt(String(qtdeReceb[id] ?? ''), 10);
      return Number.isInteger(q) && q > 0;
    });
  }, [selectedIds, qtdeReceb]);

  const canShowButtons = selectedIds.size > 0 && selectedWithValidQtde().length === selectedIds.size;

  const itensFiltrados = useMemo(() => {
    const f = filtroFornecedor.trim().toLowerCase();
    if (!f) return itens;
    return itens.filter((l) => (l.nm_fornecedor ?? '').toLowerCase().includes(f));
  }, [itens, filtroFornecedor]);

  const handleQtdeRecebChange = useCallback((id: number, qtdeEmp: number | null, value: string) => {
    if (value === '') {
      setQtdeReceb((p) => ({ ...p, [id]: '' }));
      return;
    }
    const num = parseFloat(value.replace(',', '.')) || 0;
    const max = qtdeEmp != null && Number.isFinite(qtdeEmp) ? qtdeEmp : Infinity;
    const clamped = Math.max(0, Math.min(num, max));
    setQtdeReceb((p) => ({ ...p, [id]: String(clamped) }));
  }, []);

  const handleBuscar = useCallback(() => {
    load({ master: filtroMaster, empenho: filtroEmpenho, pageOverride: 1 }).catch(() => {});
  }, [load, filtroMaster, filtroEmpenho]);

  const handleLimpar = useCallback(() => {
    setFiltroMaster('');
    setFiltroEmpenho('');
    setFiltroFornecedor('');
    setQtdeReceb({});
    setObs({});
    setSelectedIds(new Set());
    load({ pageOverride: 1 }).catch(() => {});
  }, [load]);

  const handleCancelar = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleRegistrarRecebimento = useCallback(async () => {
    const ids = selectedWithValidQtde();
    if (ids.length === 0) return;
    const itensPayload: RegistrarRecebimentoItemPayload[] = [];
    for (const id of ids) {
      const row = itens.find((r) => r.id === id);
      if (!row) continue;
      const empenho = String(row.nu_documento_siafi ?? '').trim();
      if (!empenho) continue;
      const qtde = parseInt(String(qtdeReceb[id] ?? ''), 10);
      itensPayload.push({
        fornecedor: row.nm_fornecedor ?? null,
        empenho,
        item: row.item ?? null,
        codigo: getMaster(row.material) || null,
        material: row.material ?? null,
        saldo_emp: row.qt_saldo ?? null,
        qtde_receb: qtde,
        observacao: obs[id]?.trim() || null,
      });
    }
    if (itensPayload.length === 0) {
      toast({ title: 'Nenhum item válido para registrar.', status: 'warning' });
      return;
    }
    setSubmitting(true);
    try {
      const { criados } = await registrarRecebimentoListaEmpenhos(itensPayload);
      setSelectedIds(new Set());
      toast({ title: `Recebimento registrado: ${criados} item(ns) em public.nf_empenho.`, status: 'success' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao registrar recebimento';
      toast({ title: msg, status: 'error' });
    } finally {
      setSubmitting(false);
    }
  }, [itens, selectedWithValidQtde, qtdeReceb, obs, toast]);

  useEffect(() => {
    load({}).catch(() => {});
  }, []);

  const itensIdsKey = itens.map((r) => r.id).sort().join(',');
  useEffect(() => {
    if (loading || itens.length === 0) return;
    const empenhos = [...new Set(itens.map((r) => r.nu_documento_siafi).filter(Boolean))] as string[];
    fetchObservacoesByEmpenhos(empenhos)
      .then((observacoes) => {
        setObs((prev) => {
          const next: Record<number, string> = {};
          itens.forEach((row) => {
            const empenho = row.nu_documento_siafi?.trim();
            next[row.id] = (empenho && observacoes[empenho]) ? observacoes[empenho] : (prev[row.id] ?? '');
          });
          return next;
        });
      })
      .catch(() => {});
    // itensIdsKey identifica a página atual; itens em closure está sincronizado quando a key muda
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, itensIdsKey]);

  useEffect(() => {
    if (error) toast({ title: error, status: 'error' });
  }, [error, toast]);

  const handleExportPdf = useCallback(() => {
    exportarPdfHorizontal('Lista de Empenhos', tableRef.current);
  }, []);

  const handleExportExcel = useCallback(async () => {
    const rows = itens.map((r: ListaEmpenhoItem) => ({
      nm_fornecedor: r.nm_fornecedor ?? '',
      item: r.item ?? '',
      master: getMaster(r.material),
      material: r.material ?? '',
      nu_documento_siafi: r.nu_documento_siafi ?? '',
      status_item: r.status_item ?? '',
      qt_saldo: r.qt_saldo,
      saldo_item: r.qt_saldo,
      qt_receb: qtdeReceb[r.id] ?? '',
      observacao: obs[r.id] ?? '',
    }));
    const ok = await confirmExportLimit(rows.length);
    if (!ok) return;
    const toExport = rows.slice(0, MAX_EXPORT_ROWS);
    await exportarExcelListaEmpenhos(toExport, COLUMNS, 'lista-empenhos');
    toast({ title: toExport.length < rows.length ? `Excel exportado (${toExport.length} de ${rows.length} linhas).` : 'Excel exportado.', status: 'success' });
  }, [itens, qtdeReceb, obs, toast]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Box bg={PLATAFORMA_COLORS.predominante} p={6} borderRadius="lg" minH="100vh">
      <PlataformaPageHeader subtitle="Lista de Empenhos" />

      <HStack spacing={4} mb={4} flexWrap="wrap">
        <Box>
          <Text fontSize="sm" mb={1} color={PLATAFORMA_COLORS.detalheSecundario}>
            Buscar por Master:
          </Text>
          <Input
            placeholder={FILTER_PLACEHOLDERS.buscarPorMaster}
            value={filtroMaster}
            onChange={(e) => setFiltroMaster(e.target.value)}
            bg={PLATAFORMA_COLORS.cinzaApoio}
            borderColor={PLATAFORMA_COLORS.cinzaApoio}
            w="200px"
          />
        </Box>
        <Box>
          <Text fontSize="sm" mb={1} color={PLATAFORMA_COLORS.detalheSecundario}>
            Buscar por Empenho:
          </Text>
          <Input
            placeholder={FILTER_PLACEHOLDERS.buscarPorEmpenho}
            value={filtroEmpenho}
            onChange={(e) => setFiltroEmpenho(e.target.value)}
            bg={PLATAFORMA_COLORS.cinzaApoio}
            borderColor={PLATAFORMA_COLORS.cinzaApoio}
            w="200px"
          />
        </Box>
        <Box>
          <Text fontSize="sm" mb={1} color={PLATAFORMA_COLORS.detalheSecundario}>
            Filtrar por Fornecedor:
          </Text>
          <Input
            placeholder={FILTER_PLACEHOLDERS.buscarPorFornecedor}
            value={filtroFornecedor}
            onChange={(e) => setFiltroFornecedor(e.target.value)}
            bg={PLATAFORMA_COLORS.cinzaApoio}
            borderColor={PLATAFORMA_COLORS.cinzaApoio}
            w="240px"
          />
        </Box>
        <Button
          leftIcon={<FiSearch />}
          bg={PLATAFORMA_COLORS.detalhePrincipal}
          color="white"
          _hover={{ opacity: 0.9 }}
          onClick={handleBuscar}
          isDisabled={loading}
        >
          Buscar
        </Button>
        <Button
          leftIcon={<FiRefreshCw />}
          bg={PLATAFORMA_COLORS.predominante}
          borderWidth="1px"
          borderColor={PLATAFORMA_COLORS.cinzaApoio}
          color="gray.700"
          onClick={handleLimpar}
          isDisabled={loading}
        >
          Limpar
        </Button>
      </HStack>

      <Text mb={2} color={PLATAFORMA_COLORS.detalheSecundario}>
        Total de empenhos: {total}
        {filtroFornecedor.trim() && (
          <> — Exibindo {itensFiltrados.length} de {itens.length} na página</>
        )}
      </Text>

      <HStack mb={2} spacing={2} flexWrap="wrap">
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
        {canShowButtons && (
          <>
            <Button
              size="sm"
              bg={PLATAFORMA_COLORS.detalhePrincipal}
              color="white"
              onClick={handleRegistrarRecebimento}
              isDisabled={loading || submitting}
              leftIcon={<FiCheckSquare />}
            >
              Registrar Recebimento
            </Button>
            <Button
              size="sm"
              variant="outline"
              borderColor={PLATAFORMA_COLORS.cinzaApoio}
              color="gray.700"
              onClick={handleCancelar}
              isDisabled={loading || submitting}
              leftIcon={<FiX />}
            >
              Cancelar
            </Button>
          </>
        )}
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
                <Th color="white"></Th>
                <Th color="white">Fornecedor</Th>
                <Th color="white">Item</Th>
                <Th color="white">Master</Th>
                <Th color="white">Material</Th>
                <Th color="white">Empenho</Th>
                <Th color="white">Status Item</Th>
                <Th color="white">Qtde Emp</Th>
                <Th color="white">Saldo do Item</Th>
                <Th color="white">Qtde receb</Th>
                <Th color="white">Observação</Th>
              </Tr>
            </Thead>
            <Tbody>
              {!loading && itens.length === 0 && (
                <Tr>
                  <Td colSpan={11} py={6}>
                    <Text color={PLATAFORMA_COLORS.detalheSecundario}>
                      Nenhum empenho encontrado. Ajuste os filtros e clique em “Buscar”.
                    </Text>
                  </Td>
                </Tr>
              )}
              {!loading && itens.length > 0 && itensFiltrados.length === 0 && (
                <Tr>
                  <Td colSpan={11} py={6}>
                    <Text color={PLATAFORMA_COLORS.detalheSecundario}>
                      Nenhum empenho corresponde ao filtro por fornecedor.
                    </Text>
                  </Td>
                </Tr>
              )}
              {itensFiltrados.map((row: ListaEmpenhoItem) => (
                <Tr key={row.id}>
                  <Td>
                    <Checkbox
                      borderColor={PLATAFORMA_COLORS.cinzaApoio}
                      isChecked={selectedIds.has(row.id)}
                      onChange={() => toggleSelection(row.id)}
                    />
                  </Td>
                  <Td>{row.nm_fornecedor ?? '—'}</Td>
                  <Td>{row.item ?? '—'}</Td>
                  <Td>{getMaster(row.material)}</Td>
                  <Td>{row.material ?? '—'}</Td>
                  <Td>{row.nu_documento_siafi ?? '—'}</Td>
                  <Td>{row.status_item ?? '—'}</Td>
                  <Td>{formatNum(row.qt_saldo)}</Td>
                  <Td>{formatNum(row.qt_saldo)}</Td>
                  <Td>
                    <Input
                      type="number"
                      size="sm"
                      w="80px"
                      min={0}
                      max={row.qt_saldo != null ? row.qt_saldo : undefined}
                      step="0.01"
                      value={qtdeReceb[row.id] ?? ''}
                      onChange={(e) => handleQtdeRecebChange(row.id, row.qt_saldo ?? null, e.target.value)}
                      bg={PLATAFORMA_COLORS.cinzaApoio}
                      borderColor={PLATAFORMA_COLORS.cinzaApoio}
                      title={
                        row.qt_saldo != null
                          ? `Máximo: ${formatNum(row.qt_saldo)} (Qtde Emp)`
                          : undefined
                      }
                    />
                  </Td>
                  <Td>
                    <Input
                      size="sm"
                      placeholder="Obs.:"
                      value={obs[row.id] ?? ''}
                      onChange={(e) => setObs((p) => ({ ...p, [row.id]: e.target.value }))}
                      bg={PLATAFORMA_COLORS.cinzaApoio}
                      borderColor={PLATAFORMA_COLORS.cinzaApoio}
                    />
                  </Td>
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
              onClick={() => load({ master: filtroMaster, empenho: filtroEmpenho, pageOverride: page - 1 }).catch(() => {})}
              variant="outline"
              borderColor={PLATAFORMA_COLORS.detalhePrincipal}
              color={PLATAFORMA_COLORS.detalheSecundario}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              isDisabled={page >= totalPages}
              onClick={() => load({ master: filtroMaster, empenho: filtroEmpenho, pageOverride: page + 1 }).catch(() => {})}
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
