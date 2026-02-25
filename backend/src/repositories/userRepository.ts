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
        ...data,
        email: data.email.toLowerCase().trim(),
      },
      include: { profile: true },
    });
  },
};
