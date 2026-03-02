import * as nfEmpenhoRepo from '../repositories/nfEmpenhoRepository';
import { userRepository } from '../repositories/userRepository';
import type {
  ListNfEmpenhoFilters,
  ListNfEmpenhoListaFilters,
  NfEmpenhoListaItem,
  UpdateNfEmpenhoInput,
  RegistrarRecebimentoItem,
} from '../repositories/nfEmpenhoRepository';

export const nfEmpenhoService = {
  async list(filters: ListNfEmpenhoFilters) {
    return nfEmpenhoRepo.listNfEmpenho(filters);
  },

  async listLista(filters: ListNfEmpenhoListaFilters): Promise<{ itens: NfEmpenhoListaItem[]; total: number }> {
    const { itens, total } = await nfEmpenhoRepo.listNfEmpenhoParaLista(filters);
    const usuarios = itens.map((r) => r.usuario).filter((u): u is string => u != null && u.trim() !== '');
    const nameByUsuario = await userRepository.findNamesByUsuarioIdentifiers(usuarios);
    const itensComNome: NfEmpenhoListaItem[] = itens.map((r) => {
      const key = r.usuario?.trim();
      const nome = key ? (nameByUsuario.get(key) ?? nameByUsuario.get(key.toLowerCase())) : null;
      return { ...r, usuario: nome ?? r.usuario };
    });
    return { itens: itensComNome, total };
  },

  async update(idEmp: number, input: UpdateNfEmpenhoInput, usuario?: string | null) {
    return nfEmpenhoRepo.updateNfEmpenho(idEmp, input, usuario);
  },

  async registrarRecebimento(itens: RegistrarRecebimentoItem[], usuario?: string | null) {
    return nfEmpenhoRepo.createNfEmpenhoFromLista(itens, usuario);
  },
};
