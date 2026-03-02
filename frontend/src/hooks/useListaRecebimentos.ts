import { useState, useCallback } from 'react';
import {
  fetchListaRecebimentosNfEmpenho,
  type ListaRecebimentoItem,
  type ListaRecebimentosResponse,
} from '../api/plataforma';

const DEFAULT_PAGE_SIZE = 100;

export function useListaRecebimentos() {
  const [itens, setItens] = useState<ListaRecebimentoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (params: {
      fornecedor?: string;
      empenho?: string;
      codigo?: string;
      pageOverride?: number;
      pageSizeOverride?: number;
    }) => {
      setLoading(true);
      setError(null);
      const size = params.pageSizeOverride ?? pageSize;
      try {
        const res: ListaRecebimentosResponse = await fetchListaRecebimentosNfEmpenho({
          fornecedor: params.fornecedor,
          empenho: params.empenho,
          codigo: params.codigo,
          page: params.pageOverride ?? page,
          pageSize: size,
        });
        setItens(res.itens ?? []);
        setTotal(res.total ?? 0);
        if (params.pageOverride != null) setPage(params.pageOverride);
        if (params.pageSizeOverride != null) setPageSize(params.pageSizeOverride);
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

  const setPageSafe = useCallback((p: number) => setPage(p), []);
  const setPageSizeSafe = useCallback((s: number) => setPageSize(s), []);

  return {
    itens,
    total,
    page,
    pageSize,
    loading,
    error,
    load,
    setPage: setPageSafe,
    setPageSize: setPageSizeSafe,
  };
}
