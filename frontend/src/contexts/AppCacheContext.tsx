import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { controleEmpenhosApi, provisionamentoApi } from '../api/client';

/** Chaves de cache por recurso (evita strings soltas nas páginas). */
export const CacheKeys = {
  controleDashboard: () => 'controle-dashboard',
  controleItens: (params: {
    page?: number;
    pageSize?: number;
    codigo?: string;
    responsavel?: string;
    status?: string;
    comRegistro?: boolean;
  }) => {
    const p = params ?? {};
    return `controle-itens:${p.page ?? 1}:${p.pageSize ?? 20}:${p.codigo ?? ''}:${p.responsavel ?? ''}:${p.status ?? ''}:${p.comRegistro ?? ''}`;
  },
  movimentacao: (params: { mesano: string; page?: number; pageSize?: number; almoxarifado?: string; setor_controle?: string; movimento?: string; material?: string }) => {
    const p = params ?? {};
    return `movimentacao:${p.mesano ?? ''}:${p.page ?? 1}:${p.pageSize ?? 20}:${p.almoxarifado ?? ''}:${p.setor_controle ?? ''}:${p.movimento ?? ''}:${p.material ?? ''}`;
  },
  empenhosPendentes: (params: { page?: number; codigo?: string; empenho?: string }) => {
    const p = params ?? {};
    return `empenhos-pendentes:${p.page ?? 1}:${p.codigo ?? ''}:${p.empenho ?? ''}`;
  },
  provisionamentoRegistros: () => 'provisionamento-registros',
} as const;

interface CacheEntry<T = unknown> {
  data: T;
  fetchedAt: number;
}

type CacheMap = Map<string, CacheEntry>;

interface AppCacheContextValue {
  getCached: <T>(key: string) => T | null;
  setCached: <T>(key: string, data: T) => void;
  invalidate: (key: string) => void;
  invalidateAll: () => void;
  invalidateControleEmpenhos: () => void;
  invalidateEmpenhosPendentes: () => void;
  invalidateMovimentacao: () => void;
  invalidateProvisionamento: () => void;
  prefetchIfNeeded: () => Promise<void>;
}

export const AppCacheContext = createContext<AppCacheContextValue | null>(null);

const CACHE_PREFETCH_KEY = CacheKeys.controleDashboard();

export function AppCacheProvider({ children }: { children: React.ReactNode }) {
  const cacheRef = useRef<CacheMap>(new Map());
  const [, setTick] = useState(0);

  const notify = useCallback(() => setTick((t) => t + 1), []);

  const getCached = useCallback(<T,>(key: string): T | null => {
    const entry = cacheRef.current.get(key) as CacheEntry<T> | undefined;
    return entry ? entry.data : null;
  }, []);

  const setCached = useCallback(<T,>(key: string, data: T) => {
    cacheRef.current.set(key, { data, fetchedAt: Date.now() });
    notify();
  }, [notify]);

  const invalidate = useCallback((key: string) => {
    cacheRef.current.delete(key);
    notify();
  }, [notify]);

  const invalidateAll = useCallback(() => {
    cacheRef.current.clear();
    notify();
  }, [notify]);

  const invalidateControleEmpenhos = useCallback(() => {
    const keysToDelete: string[] = [];
    cacheRef.current.forEach((_, key) => {
      if (key === CACHE_PREFETCH_KEY || key.startsWith('controle-itens:')) keysToDelete.push(key);
    });
    keysToDelete.forEach((k) => cacheRef.current.delete(k));
    notify();
  }, [notify]);

  const invalidateEmpenhosPendentes = useCallback(() => {
    const keysToDelete: string[] = [];
    cacheRef.current.forEach((_, key) => {
      if (key.startsWith('empenhos-pendentes:')) keysToDelete.push(key);
    });
    keysToDelete.forEach((k) => cacheRef.current.delete(k));
    notify();
  }, [notify]);

  const invalidateMovimentacao = useCallback(() => {
    const keysToDelete: string[] = [];
    cacheRef.current.forEach((_, key) => {
      if (key.startsWith('movimentacao:')) keysToDelete.push(key);
    });
    keysToDelete.forEach((k) => cacheRef.current.delete(k));
    notify();
  }, [notify]);

  const invalidateProvisionamento = useCallback(() => {
    invalidate(CacheKeys.provisionamentoRegistros());
  }, [invalidate]);

  const prefetchIfNeeded = useCallback(async () => {
    if (cacheRef.current.has(CACHE_PREFETCH_KEY)) return;
    try {
      const [dashboardRes, provisionamentoRes] = await Promise.all([
        controleEmpenhosApi.getDashboard(),
        provisionamentoApi.getRegistrosAtivos(),
      ]);
      if (dashboardRes.data && typeof dashboardRes.data === 'object' && 'totalMateriais' in dashboardRes.data) {
        cacheRef.current.set(CacheKeys.controleDashboard(), { data: dashboardRes.data, fetchedAt: Date.now() });
      }
      if (provisionamentoRes.data && Array.isArray(provisionamentoRes.data)) {
        cacheRef.current.set(CacheKeys.provisionamentoRegistros(), {
          data: provisionamentoRes.data,
          fetchedAt: Date.now(),
        });
      }
      notify();
    } catch {
      // Prefetch em falha não bloqueia; as abas carregam sob demanda
    }
  }, [notify]);

  const value = useMemo<AppCacheContextValue>(
    () => ({
      getCached,
      setCached,
      invalidate,
      invalidateAll,
      invalidateControleEmpenhos,
      invalidateEmpenhosPendentes,
      invalidateMovimentacao,
      invalidateProvisionamento,
      prefetchIfNeeded,
    }),
    [
      getCached,
      setCached,
      invalidate,
      invalidateAll,
      invalidateControleEmpenhos,
      invalidateEmpenhosPendentes,
      invalidateMovimentacao,
      invalidateProvisionamento,
      prefetchIfNeeded,
    ]
  );

  return <AppCacheContext.Provider value={value}>{children}</AppCacheContext.Provider>;
}

const NOOP_CACHE: AppCacheContextValue = {
  getCached: () => null,
  setCached: () => {},
  invalidate: () => {},
  invalidateAll: () => {},
  invalidateControleEmpenhos: () => {},
  invalidateEmpenhosPendentes: () => {},
  invalidateMovimentacao: () => {},
  invalidateProvisionamento: () => {},
  prefetchIfNeeded: () => Promise.resolve(),
};

export function useAppCache(): AppCacheContextValue {
  const ctx = useContext(AppCacheContext);
  return ctx ?? NOOP_CACHE;
}
