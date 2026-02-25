import {
  getMovimentacoesPorData,
  getMovimentacaoFiltrosOpcoes,
  MovimentacaoRegistro,
  MovimentacaoDiariaFilters,
} from '../repositories/movimentoRepository';
import { getCurrentMesano } from '../utils/dateHelpers';
import { memoryCache, CacheKeys, CacheTTL } from '../utils/memoryCache';

export type MovimentacaoDiariaItem = MovimentacaoRegistro;

export interface MovimentacaoDiariaQuery {
  mesano?: string;
  page?: number;
  pageSize?: number;
  almoxarifado?: string;
  setor_controle?: string;
  movimento?: string;
  material?: string;
}

export const movimentacaoDiariaService = {
  async getMovimentacoes(query: MovimentacaoDiariaQuery): Promise<{
    mesano: string;
    itens: MovimentacaoDiariaItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const mesanoNorm = (query.mesano ?? '').replace(/\D/g, '').slice(0, 6);
    const mesano = /^\d{6}$/.test(mesanoNorm) ? mesanoNorm : getCurrentMesano();
    
    // OTIMIZAÇÃO: Verificar cache primeiro
    const filters = {
      almoxarifado: query.almoxarifado,
      setor_controle: query.setor_controle,
      movimento: query.movimento,
      material: query.material,
    };
    const cacheKey = CacheKeys.movimentacao(mesano, filters, query.page || 1);
    const cached = memoryCache.get<{
      mesano: string;
      itens: MovimentacaoDiariaItem[];
      total: number;
      page: number;
      pageSize: number;
    }>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const result = await getMovimentacoesPorData(mesano, {
      filters,
      page: query.page,
      pageSize: query.pageSize,
    });
    
    const response = { mesano, ...result };
    
    // OTIMIZAÇÃO: Armazenar no cache
    memoryCache.set(cacheKey, response, CacheTTL.movimentacao);
    
    return response;
  },

  async getFiltrosOpcoes(mesano?: string): Promise<{ mesanos: string[]; almoxarifados: string[]; movimentos: string[]; materiais: string[] }> {
    const m = (mesano ?? '').replace(/\D/g, '').slice(0, 6);
    const mesanoVal = /^\d{6}$/.test(m) ? m : getCurrentMesano();
    
    // OTIMIZAÇÃO: Verificar cache primeiro
    const cacheKey = CacheKeys.filtrosOpcoes(mesanoVal);
    const cached = memoryCache.get<{ mesanos: string[]; almoxarifados: string[]; movimentos: string[]; materiais: string[] }>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const result = await getMovimentacaoFiltrosOpcoes(mesanoVal);
    
    // OTIMIZAÇÃO: Armazenar no cache (TTL longo pois opções mudam pouco)
    memoryCache.set(cacheKey, result, CacheTTL.filtrosOpcoes);
    
    return result;
  },
};
