import { prisma } from '../utils/prisma';

export const userRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { profile: true },
    });
  },

  findById(id: number) {
    return prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
  },

  create(data: { email: string; passwordHash: string; name?: string; profileId: number }) {
    return prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        passwordHash: data.passwordHash,
        name: data.name ?? '',
        profileId: data.profileId,
      },
      include: { profile: true },
    });
  },

  /**
   * Resolve uma lista de identificadores (id numérico como string ou email) para o nome do usuário.
   * Retorna um Map: identificador original -> name (ou o próprio identificador se não encontrar).
   * Usado para exibir nome completo na Lista de Recebimentos em vez de login/email.
   */
  async findNamesByUsuarioIdentifiers(identifiers: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(identifiers)].filter(Boolean);
    if (unique.length === 0) return new Map();

    const ids: number[] = [];
    const emails: string[] = [];
    for (const u of unique) {
      const trimmed = u.trim();
      if (!trimmed) continue;
      const n = parseInt(trimmed, 10);
      if (Number.isFinite(n) && String(n) === trimmed) {
        ids.push(n);
      } else {
        emails.push(trimmed.toLowerCase());
      }
    }

    type WhereClause = { id?: { in: number[] }; email?: { in: string[] } };
    const orConditions: WhereClause[] = [];
    if (ids.length) orConditions.push({ id: { in: ids } });
    if (emails.length) orConditions.push({ email: { in: emails } });
    if (orConditions.length === 0) return new Map();

    const users = await prisma.user.findMany({
      where: { OR: orConditions },
      select: { id: true, email: true, name: true },
    });

    const map = new Map<string, string>();
    for (const u of users) {
      map.set(String(u.id), u.name);
      map.set(u.email, u.name);
      map.set(u.email.toLowerCase(), u.name);
    }
    return map;
  },
};
