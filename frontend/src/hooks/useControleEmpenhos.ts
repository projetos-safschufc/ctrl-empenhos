import { useState, useEffect, useCallback, useMemo } from 'react';
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

const PAGE_SIZE_OPTIONS = [15, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 15;
const DASHBOARD_KEY = CacheKeys.controleDashboard();

function buildItensParams(
  filtroCodigo: string,
  filtroResponsavel: string,
  filtroClassificacao: string,
  filtroSetor: string,
  filtroStatus: string,
  filtroComRegistro: string,
  page: number,
  pageSize: number
) {
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
  };
}

export type EditValuesMap = Record<
  number,
  { qtde_por_embalagem?: number; tipo_armazenamento?: string; capacidade_estocagem?: string; observacao?: string }
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

  const [opcoesClassificacao, setOpcoesClassificacao] = useState<string[]>([]);
  const [opcoesResponsavel, setOpcoesResponsavel] = useState<string[]>([]);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<EditValuesMap>({});
  const [saving, setSaving] = useState(false);

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
      setLoadingDashboard(true);
      const { data, error } = await controleEmpenhosApi.getDashboard();
      if (error) toast({ title: error, status: 'error' });
      const next =
        data && typeof data === 'object' && 'totalMateriais' in data ? data : null;
      setDashboard(next);
      if (next) setCached(DASHBOARD_KEY, next);
      setLoadingDashboard(false);
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
        page,
        pageSize
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
      page,
      pageSize,
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
      const { data } = await controleEmpenhosApi.getOpcoesFiltros();
      if (data) {
        if (Array.isArray(data.classificacoes)) setOpcoesClassificacao(data.classificacoes);
        if (Array.isArray(data.responsaveis)) setOpcoesResponsavel(data.responsaveis);
      }
    })();
  }, []);

  useEffect(() => {
    loadItens();
  }, [loadItens]);

  const aplicarFiltros = useCallback(() => {
    setPage(1);
  }, []);

  const atualizarTudo = useCallback(() => {
    invalidateControleEmpenhos();
    loadDashboard(true);
    loadItens(true);
  }, [invalidateControleEmpenhos, loadDashboard, loadItens]);

  const handleSave = useCallback(async () => {
    if (selectedId == null) return;
    const vals = editValues[selectedId];
    if (!vals) return;
    const item = itens.find((i) => i.id === selectedId);
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
    setSelectedId(null);
    setEditValues((prev) => {
      const next = { ...prev };
      delete next[selectedId];
      return next;
    });
    invalidateControleEmpenhos();
    loadItens(true);
  }, [selectedId, editValues, itens, toast, invalidateControleEmpenhos, loadItens]);

  const toggleSelect = useCallback((item: ItemControleEmpenho) => {
    setSelectedId((prevId) => {
      if (prevId === item.id) {
        setEditValues((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
        return null;
      }
      setEditValues((prev) => ({
        ...prev,
        [item.id]: {
          qtde_por_embalagem: item.qtdePorEmbalagem != null ? Number(item.qtdePorEmbalagem) : undefined,
          tipo_armazenamento: item.tipoArmazenamento ?? '',
          capacidade_estocagem: item.capacidadeEstocagem ?? '',
          observacao: item.observacao ?? '',
        },
      }));
      return item.id;
    });
  }, []);

  const updateEdit = useCallback((id: number, field: string, value: string | number | undefined) => {
    setEditValues((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value === '' ? undefined : value },
    }));
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasDirty = selectedId != null && editValues[selectedId];
  const consumoHeaders = useMemo(() => getConsumoHeaders(mesesConsumo), [mesesConsumo]);

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
      1,
      exportPageSize
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
  ]);

  return {
    dashboard,
    itens,
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
    opcoesClassificacao,
    opcoesResponsavel,
    selectedId,
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
  };
}
