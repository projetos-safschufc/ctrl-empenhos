/**
 * Sistema de Cache em Memória Otimizado para INTRANET
 * 
 * Características:
 * - Cache LRU (Least Recently Used) para evitar vazamentos de memória
 * - TTL (Time To Live) configurável por tipo de dados
 * - Otimizado para ambiente interno com poucos usuários
 * - Invalidação inteligente por padrões de chave
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccess: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly maxSize: number;
  private readonly defaultTtl: number;

  constructor(maxSize = 1000, defaultTtlMs = 5 * 60 * 1000) { // 5 minutos padrão
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtlMs;
    
    // Limpeza automática a cada 2 minutos
    setInterval(() => this.cleanup(), 2 * 60 * 1000);
  }

  /**
   * Armazena um valor no cache
   */
  set<T>(key: string, value: T, ttlMs?: number): void {
    const now = Date.now();
    const ttl = ttlMs ?? this.defaultTtl;
    
    // Se cache está cheio, remove o item menos usado
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data: value,
      timestamp: now,
      ttl,
      accessCount: 0,
      lastAccess: now,
    });
  }

  /**
   * Recupera um valor do cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    
    // Verifica se expirou
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Atualiza estatísticas de acesso
    entry.accessCount++;
    entry.lastAccess = now;
    
    return entry.data;
  }

  /**
   * Verifica se uma chave existe no cache
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Remove uma chave específica
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Remove todas as chaves que correspondem a um padrão
   */
  deletePattern(pattern: string): number {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    let deleted = 0;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    
    return deleted;
  }

  /**
   * Limpa todo o cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove itens expirados
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
    
    if (keysToDelete.length > 0) {
      console.log(`[MemoryCache] Limpeza automática: ${keysToDelete.length} itens removidos`);
    }
  }

  /**
   * Remove o item menos usado quando cache está cheio
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruScore = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      // Score baseado em: tempo desde último acesso + inverso da frequência de uso
      const score = (Date.now() - entry.lastAccess) / (entry.accessCount + 1);
      
      if (score < lruScore) {
        lruScore = score;
        lruKey = key;
      }
    }
    
    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  /**
   * Estatísticas do cache
   */
  getStats() {
    const now = Date.now();
    let expired = 0;
    let totalAccess = 0;
    
    for (const entry of this.cache.values()) {
      if (now - entry.timestamp > entry.ttl) {
        expired++;
      }
      totalAccess += entry.accessCount;
    }
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      expired,
      totalAccess,
      hitRate: totalAccess > 0 ? (totalAccess / (totalAccess + this.cache.size)) : 0,
    };
  }
}

// Instância singleton otimizada para ambiente INTRANET
export const memoryCache = new MemoryCache(2000, 10 * 60 * 1000); // 2000 itens, 10 min TTL

// Chaves padronizadas para diferentes tipos de cache
export const CacheKeys = {
  // Dashboard (cache longo - dados mudam pouco)
  dashboard: () => 'dashboard:summary',
  
  // Controle de Empenhos (cache médio)
  controleItens: (filters: Record<string, unknown>, page: number, pageSize: number) => 
    `controle:items:${JSON.stringify(filters)}:${page}:${pageSize}`,
  
  // Consumos por master (cache longo - histórico não muda)
  consumosMaster: (masters: string[], meses: number[]) =>
    `consumos:${masters.sort().join(',')}:${meses.join(',')}`,
  
  // Totais estoque/saldo (cache curto - dados dinâmicos)
  totaisEstoque: (masters: string[]) =>
    `totais:${masters.sort().join(',')}`,
  
  // Registros por master (cache médio)
  registrosMaster: (masters: string[]) =>
    `registros:${masters.sort().join(',')}`,
  
  // Movimentação diária (cache médio)
  movimentacao: (mesano: string, filters: Record<string, unknown>, page: number) =>
    `movimentacao:${mesano}:${JSON.stringify(filters)}:${page}`,
  
  // Opções de filtros (cache longo)
  filtrosOpcoes: (mesano: string) =>
    `filtros:${mesano}`,
};

// TTLs específicos por tipo de dados (em milissegundos)
export const CacheTTL = {
  dashboard: 15 * 60 * 1000,      // 15 minutos - dados do dashboard
  controleItens: 5 * 60 * 1000,   // 5 minutos - listagem de itens
  consumos: 60 * 60 * 1000,       // 1 hora - dados históricos de consumo
  totaisEstoque: 2 * 60 * 1000,   // 2 minutos - dados de estoque (mais dinâmicos)
  registros: 10 * 60 * 1000,      // 10 minutos - registros de licitação
  movimentacao: 5 * 60 * 1000,    // 5 minutos - movimentações
  filtrosOpcoes: 30 * 60 * 1000,  // 30 minutos - opções de filtros
};

// Funções utilitárias para invalidação de cache
export const CacheInvalidation = {
  // Invalida cache relacionado a controle de empenhos
  controleEmpenhos: () => {
    memoryCache.deletePattern('controle:*');
    memoryCache.deletePattern('dashboard:*');
  },
  
  // Invalida cache de movimentação
  movimentacao: (mesano?: string) => {
    if (mesano) {
      memoryCache.deletePattern(`movimentacao:${mesano}:*`);
      memoryCache.deletePattern(`filtros:${mesano}`);
    } else {
      memoryCache.deletePattern('movimentacao:*');
      memoryCache.deletePattern('filtros:*');
    }
  },
  
  // Invalida cache de consumos (quando dados históricos mudam)
  consumos: () => {
    memoryCache.deletePattern('consumos:*');
  },
  
  // Invalida cache de totais de estoque
  totaisEstoque: () => {
    memoryCache.deletePattern('totais:*');
  },
};