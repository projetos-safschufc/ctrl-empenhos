import * as nfObsRepo from '../repositories/nfObsRepository';
import type { CreateNfObsInput } from '../repositories/nfObsRepository';

export const nfObsService = {
  async create(input: CreateNfObsInput, usuario?: string | null) {
    return nfObsRepo.createNfObs({
      ...input,
      usuario: usuario ?? input.usuario,
    });
  },

  /** Retorna a última observação por empenho (para Lista de Empenhos). */
  async getObservacoesByEmpenhos(empenhoIds: string[]): Promise<Record<string, string>> {
    const map = await nfObsRepo.getUltimaObservacaoPorEmpenhos(empenhoIds);
    return Object.fromEntries(map);
  },
};
