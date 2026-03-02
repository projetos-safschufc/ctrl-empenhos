import { useState, useCallback } from 'react';
import {
  fetchEditarRecebimentoItensNfEmpenho,
  atualizarNfEmpenho,
  type EditarRecebimentoItem,
} from '../api/plataforma';

export function useEditarRecebimento() {
  const [itens, setItens] = useState<EditarRecebimentoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const load = useCallback(
    async (params: {
      empenho?: string;
      codigo?: string;
      pageOverride?: number;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchEditarRecebimentoItensNfEmpenho({
          empenho: params.empenho,
          codigo: params.codigo,
          page: params.pageOverride ?? page,
          pageSize,
        });
        setItens(res.itens ?? []);
        setTotal(res.total ?? 0);
        if (params.pageOverride != null) setPage(params.pageOverride);
        setHasSearched(true);
        return res;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setItens([]);
        setTotal(0);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize]
  );

  const clearResults = useCallback(() => {
    setItens([]);
    setTotal(0);
    setError(null);
    setPage(1);
    setHasSearched(false);
  }, []);

  const updateItemLocal = useCallback((id: number, updates: Partial<EditarRecebimentoItem>) => {
    setItens((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...updates } : row))
    );
  }, []);

  const salvarAlteracoes = useCallback(
    async (ids: number[], getPayload: (item: EditarRecebimentoItem) => { valor_total?: number; observacao?: string }) => {
      setSaving(true);
      setError(null);
      try {
        for (const id of ids) {
          const item = itens.find((i) => i.id === id);
          if (!item) continue;
          const payload = getPayload(item);
        await atualizarNfEmpenho(id, payload);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [itens]
  );

  const setPageSafe = useCallback((p: number) => setPage(p), []);

  return {
    itens,
    total,
    page,
    pageSize,
    loading,
    saving,
    error,
    hasSearched,
    load,
    clearResults,
    setPage: setPageSafe,
    updateItemLocal,
    salvarAlteracoes,
  };
}
