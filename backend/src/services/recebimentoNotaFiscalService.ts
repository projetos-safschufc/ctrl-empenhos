import { recebimentoNotaFiscalRepository } from '../repositories/recebimentoNotaFiscalRepository';
import type {
  RecebimentoNotaFiscal,
  RecebimentoNotaFiscalComItens,
  CreateRecebimentoInput,
  UpdateRecebimentoInput,
  ListRecebimentoFilters,
} from '../types/recebimentoNotaFiscal';

export const recebimentoNotaFiscalService = {
  async list(filters: ListRecebimentoFilters): Promise<{ itens: RecebimentoNotaFiscal[]; total: number }> {
    const { rows, total } = await recebimentoNotaFiscalRepository.list(filters);
    return { itens: rows, total };
  },

  async getById(id: number): Promise<RecebimentoNotaFiscalComItens | null> {
    const recebimento = await recebimentoNotaFiscalRepository.getById(id);
    if (!recebimento) return null;
    const itens = await recebimentoNotaFiscalRepository.getItensByRecebimentoId(id);
    return { ...recebimento, itens };
  },

  async create(input: CreateRecebimentoInput): Promise<RecebimentoNotaFiscal> {
    if (!input.numero_nf?.trim()) {
      throw new Error('numero_nf é obrigatório');
    }
    if (!input.data_recebimento?.trim()) {
      throw new Error('data_recebimento é obrigatório');
    }
    return recebimentoNotaFiscalRepository.create(input);
  },

  async update(id: number, input: UpdateRecebimentoInput): Promise<RecebimentoNotaFiscal | null> {
    const existing = await recebimentoNotaFiscalRepository.getById(id);
    if (!existing) return null;
    return recebimentoNotaFiscalRepository.update(id, input);
  },

  async delete(id: number): Promise<boolean> {
    return recebimentoNotaFiscalRepository.delete(id);
  },
};
