import { api } from './client';

/**
 * Executa uma chamada via cliente HTTP unificado e, em caso de erro, lança.
 * Mantém a mesma API das funções que antes usavam axios (retorno direto dos dados).
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const result = await api<T>(path, options);
  if (result.error) throw new Error(result.error);
  return result.data as T;
}

// --- Tipos Lista de Empenhos (baseado em empenhos-pendentes) ---
export interface ListaEmpenhoItem {
  id: number;
  nm_fornecedor: string | null;
  item: string | null;
  material: string | null;
  master?: string | null;
  nu_documento_siafi: string | null;
  status_item: string | null;
  qt_saldo: number | null;
  qt_receb?: number | null;
  observacao?: string | null;
}

export interface ListaEmpenhosResponse {
  itens: ListaEmpenhoItem[];
  total: number;
  page: number;
  pageSize: number;
}

// --- Tipos Lista de Recebimentos (recebimento-notas-fiscais ou nf_empenho/lista) ---
export interface ListaRecebimentoItem {
  id: number;
  numero_nf: string;
  serie_nf?: string | null;
  fornecedor_nome: string | null;
  fornecedor_cnpj?: string | null;
  data_recebimento: string;
  valor_total: string | number;
  status: string;
  observacao?: string | null;
  criado_em?: string;
  criado_por_user_id?: number | null;
  /** Preenchido quando a lista vem de public.nf_empenho (GET /nf-empenho/lista) */
  item?: string;
  codigo?: string;
  material?: string | null;
  qtde_receb?: number | string;
  usuario?: string | null;
}

export interface ListaRecebimentosResponse {
  itens: ListaRecebimentoItem[];
  total: number;
  page: number;
  pageSize: number;
}

// --- Empenhos para dropdown (Adicionar Observações) ---
export interface EmpenhoOption {
  id: string;
  nu_documento_siafi: string;
}

// --- Observação ---
export interface SalvarObservacaoBody {
  empenho: string;
  observacao: string;
}

// --- Editar Recebimento (item editável) ---
export interface EditarRecebimentoItem {
  id: number;
  data: string;
  empenho: string;
  codigo: string;
  item: string;
  material: string;
  saldo_emp: number;
  qtde_receb: number;
  obs: string;
}

export interface EditarRecebimentoResponse {
  itens: EditarRecebimentoItem[];
  total: number;
}

/** Lista de Empenhos: busca por Master e Empenho (usa empenhos-pendentes) */
export async function fetchListaEmpenhos(params: {
  master?: string;
  empenho?: string;
  page?: number;
  pageSize?: number;
}): Promise<ListaEmpenhosResponse> {
  const q = new URLSearchParams();
  if (params.master?.trim()) q.set('codigo', params.master.trim());
  if (params.empenho?.trim()) q.set('empenho', params.empenho.trim());
  if (params.page != null) q.set('page', String(params.page));
  if (params.pageSize != null) q.set('pageSize', String(params.pageSize));
  const path = `/empenhos-pendentes${q.toString() ? `?${q.toString()}` : ''}`;
  return request<ListaEmpenhosResponse>(path);
}

/** Lista de Recebimentos (recebimento-notas-fiscais) */
export async function fetchListaRecebimentos(params: {
  fornecedor?: string;
  empenho?: string;
  codigo?: string;
  page?: number;
  pageSize?: number;
}): Promise<ListaRecebimentosResponse> {
  const q = new URLSearchParams();
  if (params.fornecedor?.trim()) q.set('numero_nf', params.fornecedor.trim());
  if (params.empenho?.trim()) q.set('numero_nf', params.empenho.trim());
  if (params.codigo?.trim()) q.set('fornecedor_cnpj', params.codigo.trim());
  if (params.page != null) q.set('page', String(params.page));
  if (params.pageSize != null) q.set('pageSize', String(params.pageSize));
  return request<ListaRecebimentosResponse>(`/recebimento-notas-fiscais?${q.toString()}`);
}

/**
 * Lista de Recebimentos a partir de public.nf_empenho (GET /nf-empenho/lista).
 * Sem slice/limite artificial; paginação padrão (pageSize 100).
 */
export async function fetchListaRecebimentosNfEmpenho(params: {
  fornecedor?: string;
  empenho?: string;
  codigo?: string;
  page?: number;
  pageSize?: number;
}): Promise<ListaRecebimentosResponse> {
  const q = new URLSearchParams();
  if (params.fornecedor?.trim()) q.set('fornecedor', params.fornecedor.trim());
  if (params.empenho?.trim()) q.set('empenho', params.empenho.trim());
  if (params.codigo?.trim()) q.set('codigo', params.codigo.trim());
  if (params.page != null) q.set('page', String(params.page));
  if (params.pageSize != null) q.set('pageSize', String(params.pageSize));
  return request<ListaRecebimentosResponse>(`/nf-empenho/lista?${q.toString()}`);
}

/** Opções de empenhos para select (usa empenhos-pendentes com limite) */
export async function fetchEmpenhosOpcoes(): Promise<EmpenhoOption[]> {
  const data = await request<ListaEmpenhosResponse>('/empenhos-pendentes?pageSize=500');
  const seen = new Set<string>();
  const list: EmpenhoOption[] = [];
  for (const row of data.itens || []) {
    const doc = row.nu_documento_siafi?.trim();
    if (doc && !seen.has(doc)) {
      seen.add(doc);
      list.push({ id: doc, nu_documento_siafi: doc });
    }
  }
  return list;
}

/** Salvar observação (POST) em public.nf_obs — tela Adicionar Observações. */
export async function salvarObservacao(body: SalvarObservacaoBody): Promise<void> {
  await request<unknown>('/nf-obs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      empenho_id: body.empenho.trim(),
      observacao: body.observacao.trim(),
    }),
  });
}

/** Última observação por empenho (GET /nf-obs?empenhos=...) — para Lista de Empenhos. */
export async function fetchObservacoesByEmpenhos(empenhos: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(empenhos.map((e) => e?.trim()).filter(Boolean))];
  if (unique.length === 0) return {};
  const q = new URLSearchParams();
  q.set('empenhos', unique.join(','));
  const res = await request<{ observacoes: Record<string, string> }>(`/nf-obs?${q.toString()}`);
  return res.observacoes ?? {};
}

/** Itens para Editar Recebimento (filtro por empenho/código) - mapeado de recebimento-notas-fiscais */
export async function fetchEditarRecebimentoItens(params: {
  empenho?: string;
  codigo?: string;
  page?: number;
  pageSize?: number;
}): Promise<EditarRecebimentoResponse> {
  const q = new URLSearchParams();
  if (params.empenho?.trim()) q.set('numero_nf', params.empenho.trim());
  if (params.codigo?.trim()) q.set('fornecedor_cnpj', params.codigo.trim());
  if (params.page != null) q.set('page', String(params.page));
  if (params.pageSize != null) q.set('pageSize', String(params.pageSize));
  const data = await request<{ itens: ListaRecebimentoItem[]; total: number }>(
    `/recebimento-notas-fiscais?${q.toString()}`
  );
  const itens: EditarRecebimentoItem[] = (data.itens || []).map((r, i) => {
    const saldo = Number.parseFloat(String(r.valor_total ?? '0')) || 0;
    return {
      id: r.id,
      data: r.data_recebimento ?? '',
      empenho: r.numero_nf,
      // “Código” na UI: exibir CNPJ quando disponível (é o campo que o backend filtra em fornecedor_cnpj).
      codigo: r.fornecedor_cnpj ? String(r.fornecedor_cnpj) : String(r.id),
      // “Item” na UI: exibir série quando disponível; senão, sequência local.
      item: r.serie_nf ? String(r.serie_nf) : String(i + 1),
      // “Material” na UI: exibir fornecedor_nome (campo existente no recebimento).
      material: r.fornecedor_nome ?? '',
      // “Saldo Emp” na UI: usa valor_total do recebimento.
      saldo_emp: saldo,
      // Campo editável: por enquanto edita o valor_total (mantém compatibilidade com atualizarRecebimento()).
      qtde_receb: saldo,
      // Observação existente do recebimento.
      obs: r.observacao ?? '',
    };
  });
  return { itens, total: data.total ?? 0 };
}

/**
 * Itens para Editar Recebimento a partir de public.nf_empenho (e última obs de nf_obs).
 * Usa GET /nf-empenho; evita dependência do módulo recebimento_nota_fiscal.
 */
export async function fetchEditarRecebimentoItensNfEmpenho(params: {
  empenho?: string;
  codigo?: string;
  page?: number;
  pageSize?: number;
}): Promise<EditarRecebimentoResponse> {
  const q = new URLSearchParams();
  if (params.empenho?.trim()) q.set('empenho', params.empenho.trim());
  if (params.codigo?.trim()) q.set('codigo', params.codigo.trim());
  if (params.page != null) q.set('page', String(params.page));
  if (params.pageSize != null) q.set('pageSize', String(params.pageSize));
  const data = await request<{ itens: EditarRecebimentoItem[]; total: number; page: number; pageSize: number }>(
    `/nf-empenho?${q.toString()}`
  );
  return { itens: data.itens ?? [], total: data.total ?? 0 };
}

/** Atualizar recebimento (PATCH) */
export async function atualizarRecebimento(
  id: number,
  payload: { valor_total?: number; observacao?: string }
): Promise<void> {
  await request<unknown>(`/recebimento-notas-fiscais/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/** Atualizar NF empenho (PATCH) em public.nf_empenho / nf_obs */
export async function atualizarNfEmpenho(
  id: number,
  payload: { valor_total?: number; qtde_receb?: number; observacao?: string }
): Promise<void> {
  await request<unknown>(`/nf-empenho/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// --- Registrar Recebimento (Lista de Empenhos → public.nf_empenho) ---
export interface RegistrarRecebimentoItemPayload {
  fornecedor?: string | null;
  empenho: string;
  item?: string | null;
  codigo?: string | null;
  material?: string | null;
  saldo_emp?: number | null;
  qtde_receb: number;
  observacao?: string | null;
}

export interface RegistrarRecebimentoResponse {
  criados: number;
}

/** Registra recebimento na tabela public.nf_empenho (POST /nf-empenho/registrar-recebimento). */
export async function registrarRecebimentoListaEmpenhos(
  itens: RegistrarRecebimentoItemPayload[]
): Promise<RegistrarRecebimentoResponse> {
  return request<RegistrarRecebimentoResponse>('/nf-empenho/registrar-recebimento', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itens }),
  });
}
