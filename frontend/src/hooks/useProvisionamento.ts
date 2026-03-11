import { useState, useCallback, useEffect, useMemo } from 'react';
import { useToast } from '@chakra-ui/react';
import {
  provisionamentoApi,
  LinhaProvisionamentoRegistroAtivo,
  getMesesUltimos6,
  getConsumoHeaders,
} from '../api/client';
import { useAppCache, CacheKeys } from '../contexts/AppCacheContext';

const PAGE_SIZE = 50;
type LinhaProvisionamento = LinhaProvisionamentoRegistroAtivo;

export function useProvisionamento() {
  const toast = useToast();
  const { getCached, setCached, invalidateProvisionamento } = useAppCache();
  const PROVISIONAMENTO_KEY = CacheKeys.provisionamentoRegistros();

  const [codigoBusca, setCodigoBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTabela, setLoadingTabela] = useState(true);
  const [linhas, setLinhas] = useState<LinhaProvisionamento[]>([]);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [filtroTabela, setFiltroTabela] = useState('');
  const [filtroNumeroRegistro, setFiltroNumeroRegistro] = useState('');
  const [page, setPage] = useState(1);

  const linhasFiltradas = useMemo(() => {
    let result = linhas;
    const t = filtroTabela.trim().toLowerCase();
    if (t) {
      result = result.filter(
        (l) =>
          (l.codigo && l.codigo.toLowerCase().includes(t)) ||
          (l.descricao && l.descricao.toLowerCase().includes(t))
      );
    }
    const r = filtroNumeroRegistro.trim().toLowerCase();
    if (r) {
      result = result.filter(
        (l) => l.numeroRegistro != null && String(l.numeroRegistro).toLowerCase().includes(r)
      );
    }
    return result;
  }, [linhas, filtroTabela, filtroNumeroRegistro]);

  const totalPages = Math.max(1, Math.ceil(linhasFiltradas.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const linhasPagina = useMemo(
    () => linhasFiltradas.slice(pageStart, pageStart + PAGE_SIZE),
    [linhasFiltradas, pageStart]
  );

  useEffect(() => {
    setPage(1);
  }, [filtroTabela, filtroNumeroRegistro, linhas.length]);

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
    [toast, getCached, setCached, PROVISIONAMENTO_KEY]
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
      const consumosPorMes = data.consumosPorMes ?? Array(7).fill(0);
      const coberturaEstoque = data.coberturaEstoque ?? (data.mediaConsumo > 0 ? data.estoqueVirtual / data.mediaConsumo : null);
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
        consumosPorMes,
        coberturaEstoque,
      }));
      setLinhas((prev) => [...prev, ...novasLinhas]);
      setCodigoBusca('');
      toast({ title: `${novasLinhas.length} registro(s) adicionado(s) à tabela`, status: 'success' });
    }
  }, [codigoBusca, toast]);

  const updateLinha = useCallback((id: string, field: 'qtdePedida' | 'observacao', value: number | string) => {
    setLinhas((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        if (field === 'qtdePedida') {
          const raw = Number(value) || 0;
          const maxQtde = l.saldoRegistro != null ? l.saldoRegistro : Infinity;
          const qtde = Math.max(0, Math.min(raw, maxQtde));
          return {
            ...l,
            qtdePedida: qtde,
            valorTotal: qtde * (l.valorUnitario ?? 0),
          };
        }
        return { ...l, observacao: String(value) };
      })
    );
  }, []);

  const removerLinha = useCallback((id: string) => {
    setLinhas((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const limparTabela = useCallback(() => setLinhas([]), []);

  const handleGerarPdf = useCallback(async () => {
    if (linhas.length === 0) {
      toast({ title: 'Nenhum registro na tabela', status: 'warning' });
      return;
    }
    const comQtde = linhas.filter((l) => l.qtdePedida > 0);
    if (comQtde.length === 0) {
      toast({ title: 'Informe ao menos uma quantidade pedida', status: 'warning' });
      return;
    }

    const materiaisMap = new Map<string, LinhaProvisionamento[]>();
    for (const linha of comQtde) {
      const key = `${linha.codigo}|${linha.descricao ?? ''}`;
      if (!materiaisMap.has(key)) materiaisMap.set(key, []);
      materiaisMap.get(key)!.push(linha);
    }

    const materiais = Array.from(materiaisMap.entries()).map(([, linhasMaterial]) => {
      const primeiraLinha = linhasMaterial[0];
      const consumosPorMes = (primeiraLinha.consumosPorMes ?? []).length >= 7
        ? primeiraLinha.consumosPorMes!
        : Array.from({ length: 7 }, (_, i) => (primeiraLinha.consumosPorMes ?? [])[i] ?? 0);
      return {
        codigoMaterial: primeiraLinha.codigo,
        descricao: primeiraLinha.descricao,
        mediaConsumo6Meses: primeiraLinha.mediaConsumo,
        consumosPorMes,
        estoqueAlmoxarifados: primeiraLinha.estoqueAlmoxarifados,
        coberturaEstoque: primeiraLinha.coberturaEstoque ?? undefined,
        linhas: linhasMaterial.map((l) => ({
          numero_registro: l.numeroRegistro ?? undefined,
          vigencia: l.vigencia ?? undefined,
          valor_unitario: l.valorUnitario ?? undefined,
          qtde_pedida: l.qtdePedida,
          observacao: l.observacao || undefined,
          saldo_registro: l.saldoRegistro ?? undefined,
        })),
      };
    });

    setGerandoPdf(true);
    const { blob, filename, error } = await provisionamentoApi.gerarPdfConsolidado({ materiais });
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
  }, [linhas, toast]);

  const totalGeral = useMemo(
    () => linhasFiltradas.reduce((s, l) => s + l.valorTotal, 0),
    [linhasFiltradas]
  );

  const consumoHeaders = useMemo(
    () => getConsumoHeaders(getMesesUltimos6()),
    []
  );

  return {
    codigoBusca,
    setCodigoBusca,
    loading,
    loadingTabela,
    linhas,
    gerandoPdf,
    lastError,
    filtroTabela,
    setFiltroTabela,
    filtroNumeroRegistro,
    setFiltroNumeroRegistro,
    page,
    setPage,
    linhasFiltradas,
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
    consumoHeaders,
  };
}
