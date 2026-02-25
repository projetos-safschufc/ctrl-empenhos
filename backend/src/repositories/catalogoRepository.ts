import { prisma } from '../utils/prisma';

export interface CatalogoFilters {
  codigo?: string;
  responsavel?: string;
  comRegistro?: boolean;
}

export const catalogoRepository = {
  async findMany(filters: CatalogoFilters, page: number, pageSize: number) {
    const where: Record<string, unknown> = {};

    if (filters.codigo?.trim()) {
      where.master = { contains: filters.codigo.trim(), mode: 'insensitive' };
    }
    if (filters.responsavel?.trim()) {
      where.respControle = { contains: filters.responsavel.trim(), mode: 'insensitive' };
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
      where.respControle = { contains: filters.responsavel.trim(), mode: 'insensitive' };
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

  /** Retorna mapa master -> descricao para uma lista de códigos (para batch). */
  async findDescricoesByMasters(masters: string[]): Promise<Map<string, string | null>> {
    if (masters.length === 0) return new Map();
    const uniq = [...new Set(masters.map((m) => m.trim()).filter(Boolean))];
    const items = await prisma.safsCatalogo.findMany({
      where: { master: { in: uniq } },
      select: { master: true, descricao: true },
    });
    const map = new Map<string, string | null>();
    for (const it of items) map.set(it.master, it.descricao);
    for (const m of uniq) if (!map.has(m)) map.set(m, null);
    return map;
  },
};
