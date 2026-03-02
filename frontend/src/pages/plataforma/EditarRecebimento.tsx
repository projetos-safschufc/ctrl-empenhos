import { useEffect, useCallback, useState, useMemo } from 'react';
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
  Checkbox,
  Select,
} from '@chakra-ui/react';
import { FiSearch } from 'react-icons/fi';
import { FiRepeat } from 'react-icons/fi';
import { PlataformaPageHeader } from '../../components/plataforma/PlataformaPageHeader';
import { useEditarRecebimento } from '../../hooks/useEditarRecebimento';
import { FILTER_PLACEHOLDERS, PLATAFORMA_COLORS } from '../../constants/plataforma';

export function EditarRecebimento() {
  const toast = useToast();
  const {
    itens,
    total,
    page,
    pageSize,
    loading,
    saving,
    error,
    load,
    clearResults,
    updateItemLocal,
    salvarAlteracoes,
    hasSearched,
  } = useEditarRecebimento();

  // Não inicialize filtros com um valor “exemplo”, pois isso pode esconder os dados no primeiro carregamento.
  const [filtroEmpenho, setFiltroEmpenho] = useState('');
  const [filtroCodigo, setFiltroCodigo] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const handleBuscar = useCallback(() => {
    const empenho = filtroEmpenho.trim();
    const codigo = filtroCodigo.trim();
    if (!empenho && !codigo) {
      toast({
        title: 'Informe ao menos um filtro (Empenho ou Código Master).',
        status: 'warning',
      });
      return;
    }
    load({ empenho: empenho || undefined, codigo: codigo || undefined, pageOverride: 1 }).catch(() => {});
  }, [load, filtroEmpenho, filtroCodigo, toast]);

  const handleLimpar = useCallback(() => {
    setFiltroEmpenho('');
    setFiltroCodigo('');
    setFiltroMes('');
    setSelectedIds(new Set());
    clearResults();
  }, [clearResults]);

  useEffect(() => {
    if (!error) return;
    if (error.includes('Módulo de recebimento de NF não inicializado')) return;
    toast({ title: error, status: 'error' });
  }, [error, toast]);

  // Não carrega dados ao abrir a tela: exibição apenas quando filtrado por Empenho ou Código (Master).

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSalvarSelecionados = async () => {
    if (selectedIds.size === 0) {
      toast({ title: 'Selecione ao menos um registro.', status: 'warning' });
      return;
    }
    try {
      await salvarAlteracoes(Array.from(selectedIds), (item) => ({
        valor_total: item.qtde_receb,
        observacao: item.obs,
      }));
      toast({ title: 'Alterações salvas.', status: 'success' });
      setSelectedIds(new Set());
    } catch {
      // error already in toast
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const item of itens) {
      if (!item.data) continue;
      const key = item.data.slice(0, 7); // YYYY-MM
      if (key) set.add(key);
    }
    return Array.from(set).sort().map((key) => {
      const [year, month] = key.split('-');
      return {
        value: key,
        label: `${month}/${year}`,
      };
    });
  }, [itens]);

  const itensOrdenadosFiltrados = useMemo(() => {
    const sorted = [...itens].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    if (!filtroMes.trim()) return sorted;
    return sorted.filter((item) => (item.data || '').slice(0, 7) === filtroMes);
  }, [itens, filtroMes]);

  return (
    <Box bg={PLATAFORMA_COLORS.predominante} p={6} borderRadius="lg" minH="100vh">
      <PlataformaPageHeader subtitle="Editar Recebimento" />

      <HStack spacing={4} mb={4} flexWrap="wrap">
        <Box>
          <Text fontSize="sm" mb={1} color={PLATAFORMA_COLORS.detalheSecundario}>
            Filtrar por Empenho:
          </Text>
          <Input
            placeholder={FILTER_PLACEHOLDERS.filtrarPorEmpenho}
            value={filtroEmpenho}
            onChange={(e) => setFiltroEmpenho(e.target.value)}
            bg={PLATAFORMA_COLORS.cinzaApoio}
            borderColor={PLATAFORMA_COLORS.cinzaApoio}
            w="220px"
          />
        </Box>
        <Box>
          <Text fontSize="sm" mb={1} color={PLATAFORMA_COLORS.detalheSecundario}>
            Filtrar por Código (Master):
          </Text>
          <Input
            placeholder={FILTER_PLACEHOLDERS.filtrarPorCodigo}
            value={filtroCodigo}
            onChange={(e) => setFiltroCodigo(e.target.value)}
            bg={PLATAFORMA_COLORS.cinzaApoio}
            borderColor={PLATAFORMA_COLORS.cinzaApoio}
            w="220px"
          />
        </Box>
        <Box>
          <Text fontSize="sm" mb={1} color={PLATAFORMA_COLORS.detalheSecundario}>
            Filtrar por Mês (Data):
          </Text>
          <Select
            placeholder="Todos os meses"
            value={filtroMes}
            onChange={(e) => setFiltroMes(e.target.value)}
            bg={PLATAFORMA_COLORS.cinzaApoio}
            borderColor={PLATAFORMA_COLORS.cinzaApoio}
            w="220px"
          >
            {mesesDisponiveis.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
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
          leftIcon={<FiRepeat />}
          bg={PLATAFORMA_COLORS.predominante}
          borderWidth="1px"
          borderColor={PLATAFORMA_COLORS.detalhePrincipal}
          color={PLATAFORMA_COLORS.detalheSecundario}
          onClick={handleLimpar}
          isDisabled={loading}
        >
          Limpar
        </Button>
      </HStack>

      <Text mb={2} color={PLATAFORMA_COLORS.detalheSecundario}>
        Selecione o(s) registro(s) para editar:
      </Text>

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
          <Table size="sm" variant="simple">
            <Thead bg={PLATAFORMA_COLORS.detalheSecundario}>
              <Tr>
                <Th color="white"></Th>
                <Th color="white">Empenho</Th>
                <Th color="white">Data</Th>
                <Th color="white">Código</Th>
                <Th color="white">Item</Th>
                <Th color="white">Material</Th>
                <Th color="white">Saldo Emp</Th>
                <Th color="white">Qtde Receb</Th>
                <Th color="white">Obs.</Th>
              </Tr>
            </Thead>
            <Tbody>
              {!loading && itens.length === 0 && (
                <Tr>
                  <Td colSpan={8} py={6}>
                    <Text color={PLATAFORMA_COLORS.detalheSecundario}>
                      {hasSearched
                        ? 'Nenhum registro encontrado. Ajuste os filtros e clique em Buscar.'
                        : 'Informe ao menos um filtro (Empenho ou Código Master) e clique em Buscar.'}
                    </Text>
                  </Td>
                </Tr>
              )}
              {itensOrdenadosFiltrados.map((row) => (
                <Tr key={row.id}>
                  <Td>
                    <Checkbox
                      isChecked={selectedIds.has(row.id)}
                      onChange={() => toggleSelect(row.id)}
                      borderColor={PLATAFORMA_COLORS.cinzaApoio}
                    />
                  </Td>
                  <Td>{row.empenho}</Td>
                  <Td>{row.data}</Td>
                  <Td>{row.codigo}</Td>
                  <Td>{row.item}</Td>
                  <Td>{row.material}</Td>
                  <Td>{row.saldo_emp.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Td>
                  <Td>
                    <Input
                      size="sm"
                      w="80px"
                      type="number"
                      min={0}
                      max={row.saldo_emp}
                      step="0.01"
                      value={row.qtde_receb}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          updateItemLocal(row.id, { qtde_receb: 0 });
                          return;
                        }
                        const num = parseFloat(raw.replace(',', '.')) || 0;
                        const max = Number.isFinite(row.saldo_emp) ? row.saldo_emp : undefined;
                        const clamped =
                          max != null ? Math.max(0, Math.min(num, max)) : Math.max(0, num);
                        updateItemLocal(row.id, { qtde_receb: clamped });
                      }}
                      bg={PLATAFORMA_COLORS.cinzaApoio}
                      borderColor={PLATAFORMA_COLORS.cinzaApoio}
                      title={`Máximo: ${row.saldo_emp.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} (Saldo Emp)`}
                    />
                  </Td>
                  <Td>
                    <Input
                      size="sm"
                      placeholder="Obs.:"
                      value={row.obs}
                      onChange={(e) => updateItemLocal(row.id, { obs: e.target.value })}
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

      {selectedIds.size > 0 && (
        <Button
          mt={4}
          bg={PLATAFORMA_COLORS.detalhePrincipal}
          color="white"
          onClick={handleSalvarSelecionados}
          isDisabled={saving}
        >
          {saving ? 'Salvando...' : `Salvar alterações (${selectedIds.size} selecionados)`}
        </Button>
      )}

      {!loading && total > 0 && (
        <Flex mt={4} justify="space-between" align="center" flexWrap="wrap">
          <Text fontSize="sm">
            Página {page} de {totalPages} ({total} registros)
          </Text>
          <HStack>
            <Button
              size="sm"
              isDisabled={page <= 1}
              onClick={() => load({ empenho: filtroEmpenho, codigo: filtroCodigo, pageOverride: page - 1 }).catch(() => {})}
              variant="outline"
              borderColor={PLATAFORMA_COLORS.detalhePrincipal}
              color={PLATAFORMA_COLORS.detalheSecundario}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              isDisabled={page >= totalPages}
              onClick={() => load({ empenho: filtroEmpenho, codigo: filtroCodigo, pageOverride: page + 1 }).catch(() => {})}
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
