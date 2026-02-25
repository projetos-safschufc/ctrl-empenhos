import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Heading,
  Input,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Flex,
  Text,
  Skeleton,
  useToast,
  SimpleGrid,
  Select,
} from '@chakra-ui/react';
import { Workbook } from 'exceljs';
import { movimentacaoDiariaApi, MovimentacaoDiariaItem, MovimentacaoDiariaResponse, MovimentacaoDiariaFiltrosOpcoes } from '../api/client';
import { useAppCache, CacheKeys } from '../contexts/AppCacheContext';

const PAGE_SIZE_OPTIONS = [20, 50, 100];

/** Mês atual no formato YYYYMM (ex.: 202602). */
function getMesanoAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Formata MESANO (YYYYMM) para exibição (ex.: "Fevereiro/2026"). */
function mesanoParaLabel(mesano: string): string {
  const s = (mesano ?? '').replace(/\D/g, '').slice(0, 6);
  if (s.length !== 6) return mesano || '—';
  const y = s.slice(0, 4);
  const m = parseInt(s.slice(4, 6), 10);
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return m >= 1 && m <= 12 ? `${meses[m - 1]}/${y}` : s;
}

const COLS_EXPORT = ['Data', 'Mês', 'Material', 'Apresentação', 'Quantidade', 'Valor', 'Movimento', 'Almoxarifado', 'Setor controle', 'Destino', 'Grupo', 'Usuário'];

const COL_WIDTHS = [14, 10, 50, 12, 14, 14, 12, 38, 14, 22, 16, 22];

/** Gera e faz download de um XLSX com os itens do período, com formatação (cabeçalho em negrito, larguras de coluna, formato numérico). */
async function exportarXlsx(itens: MovimentacaoDiariaItem[], periodoLabel: string): Promise<void> {
  const wb = new Workbook();
  const ws = wb.addWorksheet('Movimentação', {
    properties: { defaultRowHeight: 18 },
    pageSetup: { fitToPage: true, fitToWidth: 1, orientation: 'landscape' },
  });

  ws.columns = COL_WIDTHS.map((w, i) => ({ header: COLS_EXPORT[i], key: `col${i}`, width: w }));

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8E0' },
  };
  headerRow.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

  for (const r of itens) {
    ws.addRow([
      r.data ?? '',
      r.mesano ?? '',
      r.mat_cod_antigo ?? '',
      r.umd_codigo ?? '',
      typeof r.quantidade === 'number' ? r.quantidade : (r.quantidade ?? 0),
      r.valor != null ? Number(r.valor) : '',
      r.movimento_cd ?? '',
      r.alm_nome ?? '',
      r.setor_controle ?? '',
      r.centro_atividade ?? '',
      r.grupo ?? '',
      r.ser_nome ?? '',
    ]);
  }

  const qtyCol = ws.getColumn(5);
  const valCol = ws.getColumn(6);
  if (qtyCol) qtyCol.numFmt = '#,##0';
  if (valCol) valCol.numFmt = '#,##0.00';

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `movimentacao-${periodoLabel.replace(/\//g, '-')}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export function MovimentacaoDiaria() {
  const { getCached, setCached, invalidateMovimentacao } = useAppCache();
  const [mesano, setMesano] = useState(() => getMesanoAtual());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [itens, setItens] = useState<MovimentacaoDiariaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState({ almoxarifado: '', setor_controle: '', movimento: '', material: '' });
  const [filtrosAplicados, setFiltrosAplicados] = useState({ almoxarifado: '', setor_controle: '', movimento: '', material: '' });
  const [opcoesFiltros, setOpcoesFiltros] = useState<MovimentacaoDiariaFiltrosOpcoes>({ mesanos: [], almoxarifados: [], movimentos: [], materiais: [] });
  const toast = useToast();

  const carregarOpcoesFiltros = useCallback(async () => {
    const { data: res } = await movimentacaoDiariaApi.getFiltrosOpcoes(mesano);
    setOpcoesFiltros({
      mesanos: Array.isArray(res?.mesanos) ? res.mesanos : [],
      almoxarifados: Array.isArray(res?.almoxarifados) ? res.almoxarifados : [],
      movimentos: Array.isArray(res?.movimentos) ? res.movimentos : [],
      materiais: Array.isArray(res?.materiais) ? res.materiais : [],
    });
  }, [mesano]);

  useEffect(() => {
    carregarOpcoesFiltros();
  }, [carregarOpcoesFiltros]);

  const load = useCallback(
    async (skipCache = false) => {
      const key = CacheKeys.movimentacao({ mesano, page, pageSize, ...filtrosAplicados });
      if (!skipCache) {
        const cached = getCached<MovimentacaoDiariaResponse>(key);
        if (cached && Array.isArray(cached.itens)) {
          setItens(cached.itens);
          setTotal(cached.total ?? 0);
          setLastError(null);
          setLoading(false);
          return;
        }
      }
      setLoading(true);
      setLastError(null);
      const { data: res, error } = await movimentacaoDiariaApi.getMovimentacoes({
        mesano,
        page,
        pageSize,
        almoxarifado: filtrosAplicados.almoxarifado || undefined,
        setor_controle: filtrosAplicados.setor_controle || undefined,
        movimento: filtrosAplicados.movimento || undefined,
        material: filtrosAplicados.material || undefined,
      });
      if (error) {
        toast({ title: error, status: 'error' });
        setLastError(error);
      }
      const list = Array.isArray(res?.itens) ? res.itens : [];
      setItens(list);
      setTotal(res?.total ?? 0);
      if (res) setCached(key, res);
      setLoading(false);
    },
    [mesano, page, pageSize, filtrosAplicados, toast, getCached, setCached]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [mesano]);

  useEffect(() => {
    setFiltros((f) => ({ ...f, material: '', almoxarifado: '', movimento: '' }));
    setFiltrosAplicados((a) => ({ ...a, material: '', almoxarifado: '', movimento: '' }));
  }, [mesano]);

  const aplicarFiltros = useCallback(() => {
    setFiltrosAplicados({ ...filtros });
    setPage(1);
  }, [filtros]);

  const atualizar = useCallback(() => {
    invalidateMovimentacao();
    load(true);
  }, [invalidateMovimentacao, load]);

  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
  const temAnterior = page > 1;
  const temProxima = page < totalPaginas;

  const mesAnoLabel = mesanoParaLabel(mesano);

  return (
    <Box>
      <Heading size="lg" color="brand.darkGreen" mb={4}>
        Movimentação Diária
      </Heading>
      <Text color="gray.600" mb={4}>
        Movimentações do mês (view v_df_movimento). Selecione o MESANO e use os filtros para refinar.
      </Text>

      <Box mb={4} p={3} bg="gray.50" borderRadius="md">
        <Text fontWeight="semibold" mb={2}>Filtros</Text>
        <SimpleGrid columns={{ base: 1, md: 2, lg: 5 }} spacing={3} mb={3}>
          <Box>
            <Text fontSize="sm" mb={1}>MESANO</Text>
            <Select
              value={mesano}
              onChange={(e) => setMesano(e.target.value)}
              size="sm"
            >
              {(() => {
                const lista = [...opcoesFiltros.mesanos];
                if (mesano && !lista.includes(mesano)) lista.unshift(mesano);
                if (lista.length === 0) lista.push(getMesanoAtual());
                return lista.map((m) => (
                  <option key={m} value={m}>{m} – {mesanoParaLabel(m)}</option>
                ));
              })()}
            </Select>
          </Box>
          <Box>
            <Text fontSize="sm" mb={1}>Material</Text>
            <Input
              placeholder="Código ou parte"
              value={filtros.material}
              onChange={(e) => setFiltros((f) => ({ ...f, material: e.target.value }))}
              size="sm"
            />
          </Box>
          <Box>
            <Text fontSize="sm" mb={1}>Almoxarifado</Text>
            <Select
              placeholder="Todos"
              value={filtros.almoxarifado}
              onChange={(e) => setFiltros((f) => ({ ...f, almoxarifado: e.target.value }))}
              size="sm"
            >
              {opcoesFiltros.almoxarifados.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </Select>
          </Box>
          <Box>
            <Text fontSize="sm" mb={1}>Setor controle</Text>
            <Select
              placeholder="Todos"
              value={filtros.setor_controle}
              onChange={(e) => setFiltros((f) => ({ ...f, setor_controle: e.target.value }))}
              size="sm"
            >
              <option value="UACE">UACE</option>
              <option value="ULOG">ULOG</option>
            </Select>
          </Box>
          <Box>
            <Text fontSize="sm" mb={1}>Movimento</Text>
            <Select
              placeholder="Todos"
              value={filtros.movimento}
              onChange={(e) => setFiltros((f) => ({ ...f, movimento: e.target.value }))}
              size="sm"
            >
              {opcoesFiltros.movimentos.map((mov) => (
                <option key={mov} value={mov}>{mov}</option>
              ))}
            </Select>
          </Box>
        </SimpleGrid>
        <Flex gap={2} align="center" flexWrap="wrap">
          <Text fontSize="sm" color="gray.600">Período: <strong>{mesAnoLabel}</strong></Text>
          <Button size="sm" colorScheme="green" onClick={aplicarFiltros} isLoading={loading}>
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
            onClick={async () => {
              try {
                await exportarXlsx(itens, mesAnoLabel);
              } catch (e) {
                toast({ title: 'Erro ao exportar XLSX', status: 'error' });
              }
            }}
          >
            Exportar XLSX
          </Button>
        </Flex>
      </Box>

      {loading ? (
        <Skeleton height="200px" borderRadius="md" />
      ) : lastError ? (
        <Box py={8} textAlign="center" color="gray.600">
          <Text mb={2}>Erro ao carregar movimentações.</Text>
          <Button size="sm" colorScheme="green" onClick={() => load(true)}>Tentar novamente</Button>
        </Box>
      ) : itens.length === 0 ? (
        <Box py={8} textAlign="center" color="gray.500">
          Nenhuma movimentação encontrada para o período.
        </Box>
      ) : (
        <>
        <TableContainer overflowX="auto" maxW="100%" overflowY="visible" whiteSpace="nowrap">
          <Table size="sm" variant="striped" minW="900px">
            <Thead>
              <Tr>
                <Th>Data</Th>
                <Th>Mês</Th>
                <Th>Material</Th>
                <Th>Apresentação</Th>
                <Th isNumeric>Quantidade</Th>
                {/*<Th isNumeric>Valor</Th>*/}
                <Th>Movimento</Th>
                <Th>Almoxarifado</Th>
                <Th>Setor controle</Th>
                <Th>Destino</Th>
                <Th>Grupo</Th>
                <Th>Usuário</Th>
              </Tr>
            </Thead>
            <Tbody>
              {itens.map((row, i) => (
                <Tr key={`${row.data ?? ''}-${row.mat_cod_antigo}-${row.movimento_cd}-${i}`}>
                  <Td>{row.data 
                            ? new Date(row.data ?? '').toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })
                            : '--/--/----'}</Td>


                  <Td>{row.mesano ?? '—'}</Td>
                  <Td>{row.mat_cod_antigo ?? '—'}</Td>
                  <Td>{row.umd_codigo ?? '—'}</Td>
                  <Td isNumeric>{(Number(row.quantidade) || 0).toLocaleString('pt-BR')}</Td>
                  {/*<Td isNumeric>{row.valor != null ? Number(row.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</Td>*/}
                  <Td>{row.movimento_cd ?? '—'}</Td>
                  <Td>{row.alm_nome ?? '—'}</Td>
                  <Td>{row.setor_controle ?? '—'}</Td>
                  <Td>{row.centro_atividade ?? '—'}</Td>
                  <Td>{row.grupo ?? '—'}</Td>
                  <Td>{row.ser_nome ?? '—'}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
        <Flex mt={3} justify="space-between" align="center" flexWrap="wrap" gap={2}>
          <Text fontSize="sm" color="gray.600">
            {total} itens – página {page} de {totalPaginas}
          </Text>
          <Flex gap={2} align="center">
            <Text fontSize="sm">Itens por página:</Text>
            <Select
              size="sm"
              maxW="70px"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </Select>
            <Button size="sm" isDisabled={!temAnterior} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Anterior
            </Button>
            <Button size="sm" isDisabled={!temProxima} onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))}>
              Próxima
            </Button>
          </Flex>
        </Flex>
        </>
      )}
    </Box>
  );
}
