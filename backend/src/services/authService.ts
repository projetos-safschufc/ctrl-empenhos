import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { userRepository } from '../repositories/userRepository';

const JWT_SECRET = process.env.JWT_SECRET ?? 'default-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d';

export type TokenPayload = {
  userId: number;
  profileId: number;
  email: string;
  profileName: string;
};

export const authService = {
  async login(email: string, password: string) {
    try {
      const user = await userRepository.findByEmail(email);
      if (!user || !user.active) {
        return null;
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return null;

      const payload: TokenPayload = {
      userId: user.id,
      profileId: user.profileId,
      email: user.email,
      profileName: user.profile.name,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          profileId: user.profileId,
          profileName: user.profile.name,
        },
      };
    } catch {
      return null;
    }
  },

  async register(email: string, password: string, name?: string) {
    const existing = await userRepository.findByEmail(email);
    if (existing) return null;

    const profileConsultor = await prisma.profile.findUnique({
      where: { name: 'consultor' },
    });
    if (!profileConsultor) throw new Error('Perfil consultor não encontrado');

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await userRepository.create({
      email,
      passwordHash,
      name: name ?? email.split('@')[0],
      profileId: profileConsultor.id,
    });

    const payload: TokenPayload = {
      userId: user.id,
      profileId: user.profileId,
      email: user.email,
      profileName: user.profile.name,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        profileId: user.profileId,
        profileName: user.profile.name,
      },
    };
  },

  verifyToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
      return decoded;
    } catch {
      return null;
    }
  },
};
