import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Heading,
  Input,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Text,
  Skeleton,
  useToast,
  HStack,
  Button,
} from '@chakra-ui/react';
import { empenhosPendentesApi, EmpenhoPendenteItem, EmpenhosPendentesResponse } from '../api/client';
import { useAppCache, CacheKeys } from '../contexts/AppCacheContext';

function formatNumber(value: number | null): string {
  if (value == null) return '—';
  return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

/** Formata valor monetário em pt-BR: R$ #.###,## */
function formatCurrency(value: number | null): string {
  if (value == null) return '—';
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Gera e faz download de um CSV com os itens atuais (UTF-8 com BOM para Excel). */
function exportarCsv(itens: EmpenhoPendenteItem[]) {
  const cols = [
    'Fornecedor',
    'Reg. licitação',
    'Pregão',
    'Item',
    'Material',
    'Qt saldo',
    'Vl unidade',
    'Vl saldo',
    'Doc. SIAFI',
    'Status item',
  ];
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const row = (r: EmpenhoPendenteItem) =>
    [
      r.nm_fornecedor,
      r.nu_registro_licitacao,
      r.nu_pregao,
      r.item,
      r.material,
      r.qt_saldo ?? '',
      r.vl_unidade ?? '',
      r.vl_saldo != null ? formatCurrency(r.vl_saldo) : '',
      r.nu_documento_siafi,
      r.status_item,
    ].map(escape).join(',');
  const csv = '\uFEFF' + cols.join(',') + '\n' + itens.map(row).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `empenhos-pendentes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const PAGE_SIZE = 20;

export function EmpenhosPendentes() {
  const { getCached, setCached, invalidateEmpenhosPendentes } = useAppCache();
  const [filtroCodigo, setFiltroCodigo] = useState('');
  const [filtroEmpenho, setFiltroEmpenho] = useState('');
  const [itens, setItens] = useState<EmpenhoPendenteItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(
    async (pageOverride?: number, skipCache = false) => {
      const currentPage = pageOverride ?? page;
      const params = {
        codigo: filtroCodigo.trim() || undefined,
        empenho: filtroEmpenho.trim() || undefined,
        page: currentPage,
      };
      const cacheKey = CacheKeys.empenhosPendentes(params);
      if (!skipCache) {
        const cached = getCached<EmpenhosPendentesResponse>(cacheKey);
        if (cached) {
          setItens(Array.isArray(cached.itens) ? cached.itens : []);
          setTotal(typeof cached.total === 'number' ? cached.total : 0);
          if (pageOverride != null) setPage(pageOverride);
          setLastError(null);
          setLoading(false);
          return;
        }
      }
      setLoading(true);
      setLastError(null);
      const { data: res, error } = await empenhosPendentesApi.list({
        ...params,
        pageSize: PAGE_SIZE,
      });
      if (error) {
        toast({ title: error, status: 'error' });
        setLastError(error);
      }
      const itensList = Array.isArray(res?.itens) ? res.itens : [];
      const tot = typeof res?.total === 'number' ? res.total : 0;
      setItens(itensList);
      setTotal(tot);
      if (res) setCached(cacheKey, res);
      if (pageOverride != null) setPage(pageOverride);
      setLoading(false);
    },
    [filtroCodigo, filtroEmpenho, page, toast, getCached, setCached]
  );

  useEffect(() => {
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
  }, [load]);

  const aplicarFiltros = () => {
    setPage(1);
    load(1);
  };

  const atualizar = useCallback(() => {
    invalidateEmpenhosPendentes();
    load(undefined, true);
  }, [invalidateEmpenhosPendentes, load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Box>
      <Heading size="lg" color="brand.darkGreen" mb={4}>
        Empenhos pendentes
      </Heading>
      <Text color="gray.600" mb={4}>
        Listagem de empenhos em aberto (tabela public.empenho). STATUS ITEM: exibidos apenas quando status_item = &quot;Emitido&quot; ou &quot;Atend. parcial&quot;. QT SALDO: calculado (Atend. parcial → qt_saldo_item; Emitido → qt_de_embalagem). Filtro: fl_evento = &quot;Empenho&quot;. Filtre por código do material ou por empenho.
      </Text>
      <HStack mb={4} gap={3} flexWrap="wrap">
        <Input
          maxW="220px"
          placeholder="Filtrar por código (material)"
          value={filtroCodigo}
          onChange={(e) => setFiltroCodigo(e.target.value)}
          size="sm"
        />
        <Input
          maxW="220px"
          placeholder="Filtrar por empenho (documento SIAFI)"
          value={filtroEmpenho}
          onChange={(e) => setFiltroEmpenho(e.target.value)}
          size="sm"
        />
        <Button size="sm" colorScheme="green" onClick={aplicarFiltros}>
          Aplicar
        </Button>
        <Button size="sm" variant="outline" colorScheme="green" onClick={atualizar} isLoading={loading}>
          Atualizar
        </Button>
        <Button
          size="sm"
          variant="outline"
          colorScheme="green"
          isDisabled={loading || itens.length === 0}
          onClick={() => exportarCsv(itens)}
        >
          Exportar CSV
        </Button>
      </HStack>

      {loading ? (
        <Skeleton height="200px" borderRadius="md" />
      ) : lastError ? (
        <Box py={8} textAlign="center" color="gray.600">
          <Text mb={2}>Erro ao carregar empenhos pendentes.</Text>
          <Button size="sm" colorScheme="green" onClick={() => load(undefined, true)}>Tentar novamente</Button>
        </Box>
      ) : itens.length === 0 ? (
        <Box py={8} textAlign="center" color="gray.500">
          Nenhum empenho pendente encontrado.
        </Box>
      ) : (
        <TableContainer overflowX="auto">
          <Table size="sm" variant="striped" whiteSpace="nowrap">
            <Thead bg="gray.50">
              <Tr>
                <Th>Fornecedor</Th>
                <Th>Reg. licitação</Th>
                <Th>Pregão</Th>
                <Th>Item</Th>
                <Th>Material</Th>
                <Th isNumeric>Qt saldo</Th>
                <Th isNumeric>Vl unidade</Th>
                <Th isNumeric>Vl saldo</Th>
                <Th>Doc. SIAFI</Th>
                <Th>Status item</Th>
              </Tr>
            </Thead>
            <Tbody>
              {itens.map((row) => (
                <Tr key={row.id}>
                  <Td>{row.nm_fornecedor ?? '—'}</Td>
                  <Td>{row.nu_registro_licitacao ?? '—'}</Td>
                  <Td>{row.nu_pregao ?? '—'}</Td>
                  <Td>{row.item ?? '—'}</Td>
                  <Td>{row.material ?? '—'}</Td>
                  <Td isNumeric>{formatNumber(row.qt_saldo)}</Td>
                  <Td isNumeric>{formatNumber(row.vl_unidade)}</Td>
                  <Td isNumeric>{formatCurrency(row.vl_saldo)}</Td>
                  <Td>{row.nu_documento_siafi ?? '—'}</Td>
                  <Td>{row.status_item ?? '—'}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      )}

      {!loading && !lastError && total > 0 && (
        <Box py={3} borderTopWidth="1px" display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Text fontSize="sm" color="gray.600">
            {total} {total === 1 ? 'item' : 'itens'} • página {page} de {totalPages}
          </Text>
          <HStack spacing={2}>
            <Button
              size="sm"
              variant="outline"
              colorScheme="green"
              isDisabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              colorScheme="green"
              isDisabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Próxima
            </Button>
          </HStack>
        </Box>
      )}
    </Box>
  );
}
