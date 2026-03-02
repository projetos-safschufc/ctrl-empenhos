import { useState, useCallback } from 'react';
import {
  fetchListaEmpenhos,
  type ListaEmpenhoItem,
  type ListaEmpenhosResponse,
} from '../api/plataforma';

export function useListaEmpenhos() {
  const [itens, setItens] = useState<ListaEmpenhoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (params: { master?: string; empenho?: string; pageOverride?: number }) => {
      setLoading(true);
      setError(null);
      try {
        const res: ListaEmpenhosResponse = await fetchListaEmpenhos({
          master: params.master,
          empenho: params.empenho,
          page: params.pageOverride ?? page,
          pageSize,
        });
        setItens(res.itens ?? []);
        setTotal(res.total ?? 0);
        if (params.pageOverride != null) setPage(params.pageOverride);
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

  return { itens, total, page, pageSize, loading, error, load, setPage: setPageSafe };
}
