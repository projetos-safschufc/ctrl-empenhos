import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useToast } from '@chakra-ui/react';
import {
  controleEmpenhosApi,
  ItemControleEmpenho,
  DashboardControleResponse,
  getConsumoHeaders,
  ControleEmpenhosResponse,
} from '../api/client';
import { useAppCache, CacheKeys } from '../contexts/AppCacheContext';
import { MAX_EXPORT_ROWS } from '../utils/plataformaExport';

/**
 * Opções de paginação permitidas na tela de Gestão de Estoque.
 * Valores muito altos (ex.: 100+) deixam a renderização da tabela pesada,
 * pois há muitas colunas e componentes por linha. Limitamos aqui a 50
 * para equilibrar usabilidade e performance; para grandes volumes o fluxo
 * recomendado continua sendo a exportação para Excel.
 */
const PAGE_SIZE_OPTIONS = [15, 25, 50] as const;
const DEFAULT_PAGE_SIZE = 15;
const DASHBOARD_KEY = CacheKeys.controleDashboard();

/** Valor do filtro por quantidade de registros: '' = todos, '0'|'1'|'2'|'3' = exatamente N registros por material. */
export const QTDE_REGISTROS_OPCOES = ['', '0', '1', '2', '3'] as const;

function buildItensParams(
  filtroCodigo: string,
  filtroResponsavel: string,
  filtroClassificacao: string,
  filtroSetor: string,
  filtroStatus: string,
  filtroComRegistro: string,
  filtroQtdeRegistros: string,
  page: number,
  pageSize: number,
  sortBy: 'master' | 'cobertura' | 'vigencia' | null,
  sortDir: 'asc' | 'desc'
) {
  const qr =
    filtroQtdeRegistros === '' ? undefined : (Number(filtroQtdeRegistros) as 0 | 1 | 2 | 3);
  return {
    page,
    pageSize,
    codigo: filtroCodigo || undefined,
    responsavel: filtroResponsavel || undefined,
    classificacao: filtroClassificacao || undefined,
    setor: filtroSetor || undefined,
    status: filtroStatus || undefined,
    comRegistro:
      filtroComRegistro === 'true' ? true : filtroComRegistro === 'false' ? false : undefined,
    qtdeRegistros: qr,
    sortBy: sortBy ?? undefined,
    sortDir,
  };
}

/** Chave de edição por linha (rowKey do item) para suportar valores diferentes por registro do mesmo material. */
export type EditValuesMap = Record<
  string,
  {
    qtde_por_embalagem?: number;
    tipo_armazenamento?: string;
    capacidade_estocagem?: string;
    observacao?: string;
    responsavel?: string;
  }
>;

export function useControleEmpenhos() {
  const { getCached, setCached, invalidateControleEmpenhos } = useAppCache();
  const toast = useToast();

  const [dashboard, setDashboard] = useState<DashboardControleResponse | null>(() =>
    getCached<DashboardControleResponse>(DASHBOARD_KEY)
  );
  const [itens, setItens] = useState<ItemControleEmpenho[]>([]);
  const [mesesConsumo, setMesesConsumo] = useState<number[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(
    !getCached<DashboardControleResponse>(DASHBOARD_KEY)
  );

  const [filtroCodigo, setFiltroCodigo] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [filtroClassificacao, setFiltroClassificacao] = useState('');
  const [filtroSetor, setFiltroSetor] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('');
  const [filtroComRegistro, setFiltroComRegistro] = useState<string>('');
  const [filtroQtdeRegistros, setFiltroQtdeRegistros] = useState<string>('');

  const [opcoesClassificacao, setOpcoesClassificacao] = useState<string[]>([]);
  const [opcoesResponsavel, setOpcoesResponsavel] = useState<string[]>([]);

  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<EditValuesMap>({});
  const [saving, setSaving] = useState(false);
  const dashboardPromiseRef = useRef<Promise<void> | null>(null);
  const [sortBy, setSortBy] = useState<'master' | 'cobertura' | 'vigencia' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const loadDashboard = useCallback(
    async (skipCache = false) => {
      if (!skipCache) {
        const cached = getCached<DashboardControleResponse>(DASHBOARD_KEY);
        if (cached) {
          setDashboard(cached);
          setLoadingDashboard(false);
          return;
        }
      }
      const inFlight = dashboardPromiseRef.current;
      if (inFlight) {
        await inFlight;
        const cached = getCached<DashboardControleResponse>(DASHBOARD_KEY);
        if (cached) setDashboard(cached);
        setLoadingDashboard(false);
        return;
      }
      setLoadingDashboard(true);
      const promise = (async () => {
        try {
          const { data, error } = await controleEmpenhosApi.getDashboard();
          if (error) toast({ title: error, status: 'error' });
          const next =
            data && typeof data === 'object' && 'totalMateriais' in data ? data : null;
          setDashboard(next);
          if (next) setCached(DASHBOARD_KEY, next);
        } finally {
          dashboardPromiseRef.current = null;
        }
      })();
      dashboardPromiseRef.current = promise;
      try {
        await promise;
      } finally {
        setLoadingDashboard(false);
      }
    },
    [toast, getCached, setCached]
  );

  const loadItens = useCallback(
    async (skipCache = false) => {
      const params = buildItensParams(
        filtroCodigo,
        filtroResponsavel,
        filtroClassificacao,
        filtroSetor,
        filtroStatus,
        filtroComRegistro,
        filtroQtdeRegistros,
        page,
        pageSize,
        sortBy,
        sortDir
      );
      const itensKey = CacheKeys.controleItens(params);
      if (!skipCache) {
        const cached = getCached<ControleEmpenhosResponse>(itensKey);
        if (cached) {
          setItens(Array.isArray(cached.itens) ? cached.itens : []);
          setMesesConsumo(Array.isArray(cached.mesesConsumo) ? cached.mesesConsumo : []);
          setTotal(typeof cached.total === 'number' ? cached.total : 0);
          setLoading(false);
          return;
        }
      }
      setLoading(true);
      const { data, error } = await controleEmpenhosApi.getItens(params);
      if (error) toast({ title: error, status: 'error' });
      const itensList = Array.isArray(data?.itens) ? data.itens : [];
      const meses = Array.isArray(data?.mesesConsumo) ? data.mesesConsumo : [];
      const tot = typeof data?.total === 'number' ? data.total : 0;
      setItens(itensList);
      setMesesConsumo(meses);
      setTotal(tot);
      setCached(itensKey, { itens: itensList, total: tot, mesesConsumo: meses });
      setLoading(false);
    },
    [
      filtroCodigo,
      filtroResponsavel,
      filtroClassificacao,
      filtroSetor,
      filtroStatus,
      filtroComRegistro,
      filtroQtdeRegistros,
      page,
      pageSize,
      sortBy,
      sortDir,
      toast,
      getCached,
      setCached,
    ]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    (async () => {
      const setor = filtroSetor.trim() || undefined;
      const { data } = await controleEmpenhosApi.getOpcoesFiltros(setor);
      if (data) {
        const classificacoes = Array.isArray(data.classificacoes) ? data.classificacoes : [];
        const responsaveis = Array.isArray(data.responsaveis) ? data.responsaveis : [];
        setOpcoesClassificacao(classificacoes);
        setOpcoesResponsavel(responsaveis);
        setFiltroResponsavel((prev) =>
          prev.trim() && responsaveis.length > 0 && !responsaveis.includes(prev.trim()) ? '' : prev
        );
        setFiltroClassificacao((prev) =>
          prev.trim() && classificacoes.length > 0 && !classificacoes.includes(prev.trim()) ? '' : prev
        );
      }
    })();
  }, [filtroSetor]);

  useEffect(() => {
    loadItens();
  }, [loadItens]);

  useEffect(() => {
    setPage(1);
  }, [filtroQtdeRegistros, sortBy, sortDir]);

  const aplicarFiltros = useCallback(() => {
    setPage(1);
  }, []);

  const atualizarTudo = useCallback(() => {
    invalidateControleEmpenhos();
    loadDashboard(true);
    loadItens(true);
  }, [invalidateControleEmpenhos, loadDashboard, loadItens]);

  const handleSave = useCallback(async () => {
    if (selectedRowKey == null) return;
    const vals = editValues[selectedRowKey];
    if (!vals) return;
    const item = itens.find((i) => i.rowKey === selectedRowKey);
    if (!item) return;
    setSaving(true);
    const toNum = (v: number | undefined | null): number | undefined => {
      if (v == null) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const toStr = (v: string | undefined | null): string | undefined => {
      const s = v != null ? String(v).trim() : '';
      return s === '' ? undefined : s;
    };
    const { error, status } = await controleEmpenhosApi.salvarHistorico({
      material_id: item.id,      
      classificacao: toStr(item.classificacao ?? null),
      resp_controle: toStr(item.respControle ?? null),
      setor_controle: toStr(item.setorControle ?? null),
      master_descritivo: toStr(item.masterDescritivo ?? null),
      numero_registro: toStr(item.registroMaster ?? null),
      valor_unit_registro: toNum(item.valorUnitRegistro),
      saldo_registro: toNum(item.saldoRegistro),
      qtde_por_embalagem: toNum(vals.qtde_por_embalagem),
      tipo_armazenamento: toStr(vals.tipo_armazenamento),
      capacidade_estocagem: toStr(vals.capacidade_estocagem),
      observacao: toStr(vals.observacao),
    });
    setSaving(false);
    if (status === 401) {
      toast({ title: 'Sessão expirada', status: 'error' });
      return;
    }
    if (error) {
      toast({ title: error, status: 'error' });
      return;
    }
    toast({ title: 'Histórico salvo', status: 'success' });
    setSelectedRowKey(null);
    setEditValues((prev) => {
      const next = { ...prev };
      delete next[selectedRowKey];
      return next;
    });
    invalidateControleEmpenhos();
    loadItens(true);
  }, [selectedRowKey, editValues, itens, toast, invalidateControleEmpenhos, loadItens]);

  const toggleSelect = useCallback((item: ItemControleEmpenho) => {
    setSelectedRowKey((prevKey) => {
      if (prevKey === item.rowKey) {
        setEditValues((prev) => {
          const next = { ...prev };
          delete next[item.rowKey];
          return next;
        });
        return null;
      }
      setEditValues((prev) => ({
        ...prev,
        [item.rowKey]: {
          qtde_por_embalagem: item.qtdePorEmbalagem != null ? Number(item.qtdePorEmbalagem) : undefined,
          tipo_armazenamento: item.tipoArmazenamento ?? '',
          capacidade_estocagem: item.capacidadeEstocagem ?? '',
          observacao: item.observacao ?? '',
        },
      }));
      return item.rowKey;
    });
  }, []);

  const updateEdit = useCallback((rowKey: string, field: string, value: string | number | undefined) => {
    setEditValues((prev) => ({
      ...prev,
      [rowKey]: { ...prev[rowKey], [field]: value === '' ? undefined : value },
    }));
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasDirty = selectedRowKey != null && editValues[selectedRowKey];
  const consumoHeaders = useMemo(() => getConsumoHeaders(mesesConsumo), [mesesConsumo]);

  const sortedItens = useMemo(() => {
    if (!sortBy) return itens;
    const copy = [...itens];

    const compare = (a: ItemControleEmpenho, b: ItemControleEmpenho): number => {
      const dir = sortDir === 'desc' ? -1 : 1;

      if (sortBy === 'cobertura') {
        const va = a.coberturaEstoque;
        const vb = b.coberturaEstoque;
        const aNull = va == null;
        const bNull = vb == null;
        if (aNull && bNull) return 0;
        if (aNull) return 1; // nulos sempre no final
        if (bNull) return -1;
        return dir * ((va as number) - (vb as number));
      }

      if (sortBy === 'vigencia') {
        const toTime = (s: string | null): number => {
          if (!s) return Number.NaN;
          const t = Date.parse(s);
          return Number.isNaN(t) ? Number.NaN : t;
        };
        const ta = toTime(a.vigenciaRegistro);
        const tb = toTime(b.vigenciaRegistro);
        const aNull = !Number.isFinite(ta);
        const bNull = !Number.isFinite(tb);
        if (aNull && bNull) return 0;
        if (aNull) return 1; // datas nulas/invalidas no final
        if (bNull) return -1;
        if (ta === tb) return 0;
        return dir * (ta < tb ? -1 : 1);
      }

      // sortBy === 'master'
      const va = a.masterDescritivo ?? '';
      const vb = b.masterDescritivo ?? '';
      return dir * String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' });
    };

    copy.sort(compare);
    return copy;
  }, [itens, sortBy, sortDir]);

  /**
   * Busca todos os itens conforme os filtros atuais para exportação Excel (até MAX_EXPORT_ROWS).
   * Usa o mesmo contrato da API com export=true para permitir pageSize maior no backend.
   */
  const fetchItensForExport = useCallback(async (): Promise<{
    itens: ItemControleEmpenho[];
    consumoHeaders: string[];
  }> => {
    const exportPageSize = Math.min(total, MAX_EXPORT_ROWS);
    const params = buildItensParams(
      filtroCodigo,
      filtroResponsavel,
      filtroClassificacao,
      filtroSetor,
      filtroStatus,
      filtroComRegistro,
      filtroQtdeRegistros,
      1,
      exportPageSize,
      sortBy,
      sortDir
    );
    const { data, error } = await controleEmpenhosApi.getItens({
      ...params,
      export: true,
    });
    if (error) throw new Error(error);
    const itensList = Array.isArray(data?.itens) ? data.itens : [];
    const meses = Array.isArray(data?.mesesConsumo) ? data.mesesConsumo : [];
    return {
      itens: itensList,
      consumoHeaders: getConsumoHeaders(meses),
    };
  }, [
    total,
    filtroCodigo,
    filtroResponsavel,
    filtroClassificacao,
    filtroSetor,
    filtroStatus,
    filtroComRegistro,
    filtroQtdeRegistros,
    sortBy,
    sortDir,
  ]);

  return {
    dashboard,
    itens: sortedItens,
    mesesConsumo,
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
    loadDashboard,
    loadItens,
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
    sortBy,
    sortDir,
    setSortBy,
    setSortDir,
  };
}
