import { prisma } from '../utils/prisma';

export interface CatalogoFilters {
  codigo?: string;
  responsavel?: string;
  classificacao?: string;
  setor?: string;
  comRegistro?: boolean;
}

export const catalogoRepository = {
  async findMany(filters: CatalogoFilters, page: number, pageSize: number) {
    const where: Record<string, unknown> = {};

    if (filters.codigo?.trim()) {
      where.master = { contains: filters.codigo.trim(), mode: 'insensitive' };
    }
    if (filters.responsavel?.trim()) {
      where.respControle = filters.responsavel.trim();
    }
    if (filters.classificacao?.trim()) {
      where.servAquisicao = filters.classificacao.trim();
    }
    if (filters.setor?.trim()) {
      const setor = filters.setor.trim().toUpperCase();
      where.setor_controle = setor;
    }

    const [items, total] = await Promise.all([
      prisma.safsCatalogo.findMany({
        where,
        orderBy: { master: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.safsCatalogo.count({ where }),
    ]);

    return { items, total };
  },

  // OTIMIZAÇÃO: Método para contagem rápida sem buscar registros
  async count(filters: CatalogoFilters) {
    const where: Record<string, unknown> = {};

    if (filters.codigo?.trim()) {
      where.master = { contains: filters.codigo.trim(), mode: 'insensitive' };
    }
    if (filters.responsavel?.trim()) {
      where.respControle = filters.responsavel.trim();
    }
    if (filters.classificacao?.trim()) {
      where.servAquisicao = filters.classificacao.trim();
    }
    if (filters.setor?.trim()) {
      const setor = filters.setor.trim().toUpperCase();
      where.setor_controle = setor;
    }

    return prisma.safsCatalogo.count({ where });
  },

  async findByMaster(master: string) {
    return prisma.safsCatalogo.findUnique({
      where: { master: master.trim() },
    });
  },

  async findByCodigoOuDescricao(termo: string) {
    const termoTrim = termo.trim();
    // Primeiro tenta buscar por código exato
    const porCodigo = await prisma.safsCatalogo.findUnique({
      where: { master: termoTrim },
    });
    if (porCodigo) return porCodigo;

    // Se não encontrou, busca por descritivo (primeiro resultado)
    return prisma.safsCatalogo.findFirst({
      where: {
        descricao: {
          contains: termoTrim,
          mode: 'insensitive',
        },
      },
      orderBy: { master: 'asc' },
    });
  },

  /**
   * Retorna valores distintos de servAquisicao (classificação) para uso em filtros.
   * Se setor for informado, retorna apenas classificações do respectivo setor_controle.
   */
  async findDistinctClassificacoes(setor?: string | null): Promise<string[]> {
    const where: Record<string, unknown> = { servAquisicao: { not: null } };
    if (setor?.trim()) {
      where.setor_controle = setor.trim().toUpperCase();
    }
    const rows = await prisma.safsCatalogo.findMany({
      where,
      select: { servAquisicao: true },
      distinct: ['servAquisicao'],
      orderBy: { servAquisicao: 'asc' },
    });
    return rows.map((r) => r.servAquisicao as string).filter(Boolean);
  },

  /**
   * Retorna valores distintos de respControle (responsável) para uso em filtros.
   * Se setor for informado, retorna apenas responsáveis do respectivo setor_controle.
   */
  async findDistinctResponsaveis(setor?: string | null): Promise<string[]> {
    const where: Record<string, unknown> = { respControle: { not: null } };
    if (setor?.trim()) {
      where.setor_controle = setor.trim().toUpperCase();
    }
    const rows = await prisma.safsCatalogo.findMany({
      where,
      select: { respControle: true },
      distinct: ['respControle'],
      orderBy: { respControle: 'asc' },
    });
    return rows.map((r) => r.respControle as string).filter(Boolean);
  },

  /**
   * Retorna itens do catálogo cujo master está na lista, na mesma ordem do array masters.
   * Usado para paginação quando filtro por quantidade de registros está ativo.
   */
  async findManyByMasters(masters: string[]): Promise<Awaited<ReturnType<typeof prisma.safsCatalogo.findMany>>[number][]> {
    if (masters.length === 0) return [];
    const uniq = [...new Set(masters.map((m) => m.trim()).filter(Boolean))];
    const items = await prisma.safsCatalogo.findMany({
      where: { master: { in: uniq } },
      orderBy: { master: 'asc' },
    });
    const byMaster = new Map<string, (typeof items)[number]>();
    for (const it of items) {
      if (it.master != null) byMaster.set(it.master, it);
    }
    return masters.map((m) => byMaster.get(m)).filter((x): x is NonNullable<typeof x> => x != null);
  },

  /** Retorna mapa master -> descricao para uma lista de códigos (para batch). */
  async findDescricoesByMasters(masters: string[]): Promise<Map<string, string | null>> {
    if (masters.length === 0) return new Map();
    const uniq = [...new Set(masters.map((m) => m.trim()).filter(Boolean))];
    const items = await prisma.safsCatalogo.findMany({
      where: { master: { in: uniq } },
      select: { master: true, descricao: true },
    });
    const map = new Map<string, string | null>();
    for (const it of items) {
      if (it.master != null) map.set(it.master, it.descricao);
    }
    for (const m of uniq) if (!map.has(m)) map.set(m, null);
    return map;
  },
};
