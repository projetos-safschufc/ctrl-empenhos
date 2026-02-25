const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

/** Mensagem quando o backend não está acessível (proxy ECONNREFUSED/ECONNRESET → 500 no cliente) */
const ERRO_SERVIDOR_INDISPONIVEL =
  'Servidor indisponível. Verifique se o backend está em execução (na pasta backend: npm run dev).';

function getToken(): string | null {
  return localStorage.getItem('token');
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data?: T; error?: string; status: number }> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (err) {
    const isNetworkError =
      err instanceof TypeError &&
      (err.message === 'Failed to fetch' || err.message.includes('NetworkError'));
    return {
      error: isNetworkError ? ERRO_SERVIDOR_INDISPONIVEL : (err as Error).message,
      status: 0,
    };
  }

  const status = res.status;
  let data: T | undefined;
  let error: string | undefined;

  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text) as T;
      if (data && typeof data === 'object') {
        const body = data as { message?: string; error?: string };
        error = body.message ?? body.error;
      }
    } catch {
      error = text || 'Erro desconhecido';
    }
  }

  if (!res.ok) {
    const isProxyOrServerError = status === 500 || status === 502 || status === 503;
    const semMensagemApi = !error || error === 'Erro desconhecido' || error === `Erro ${status}`;
    if (isProxyOrServerError && semMensagemApi) {
      error = ERRO_SERVIDOR_INDISPONIVEL;
    }
    return { error: error ?? `Erro ${status}`, status, data };
  }
  return { data: data as T, status };
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, name?: string) =>
    api<{ token: string; user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),

  me: () => api<AuthUser>('/auth/me'),
};

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  profileId: number;
  profileName: string;
}

// --- Controle de Empenhos ---
export interface RegistroConsumoEstoque {
  estoque_almoxarifados: number;
  saldo_empenhos: number;
  numero_registro?: string;
  vigencia?: string;
  valor_unitario?: number;
  saldo_registro?: number;
}

export type StatusItem = 'Normal' | 'Atenção' | 'Crítico';

export interface ItemControleEmpenho {
  id: number;
  /** Chave única da linha (1 por material ou 1 por registro quando material tem vários registros). */
  rowKey: string;
  classificacao: string | null;
  respControle: string | null;
  setorControle: string | null;
  masterDescritivo: string;
  apres: string | null;
  consumoMesMinus6: number;
  consumoMesMinus5: number;
  consumoMesMinus4: number;
  consumoMesMinus3: number;
  consumoMesMinus2: number;
  consumoMesMinus1: number;
  consumoMesAtual: number;
  mediaConsumo6Meses: number;
  mesUltimoConsumo: number | null;
  qtdeUltimoConsumo: number;
  estoqueAlmoxarifados: number;
  estoqueGeral: number;
  saldoEmpenhos: number;
  numeroPreEmpenho: string | null;
  coberturaEstoque: number | null;
  registroMaster: string | null;
  vigenciaRegistro: string | null;
  saldoRegistro: number | null;
  valorUnitRegistro: number | null;
  qtdePorEmbalagem: number | null;
  classificacaoXYZ: string | null;
  tipoArmazenamento: string | null;
  capacidadeEstocagem: string | null;
  status: StatusItem;
  observacao: string | null;
  comRegistro: boolean;
  registros: RegistroConsumoEstoque[];
}

export interface ControleEmpenhosResponse {
  itens: ItemControleEmpenho[];
  total: number;
  page: number;
  pageSize: number;
  mesesConsumo: number[];
}

/** Formato do mês para cabeçalho: mesano (ex. 202608) -> "ago/2026" (minúsculo). */
export function formatMesanoLabel(mesano: number): string {
  const s = String(mesano);
  if (s.length !== 6) return String(mesano);
  const mes = parseInt(s.slice(4, 6), 10);
  const ano = s.slice(0, 4);
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${meses[mes - 1]}/${ano}`;
}

/** Formato MM/YYYY para coluna "Mês último consumo" (ex.: 202601 -> "01/2026"). */
export function formatMesanoMMYYYY(mesano: number): string {
  const s = String(mesano);
  if (s.length !== 6) return String(mesano);
  const mes = s.slice(4, 6);
  const ano = s.slice(0, 4);
  return `${mes}/${ano}`;
}

/**
 * Cabeçalhos dinâmicos para as colunas de consumo (igual ao Monitor de Validades e Perdas).
 * Retorna o nome do mês/ano para cada posição: [Mês-6, Mês-5, ..., Mês-1, Mês Atual].
 * Ex.: mesesConsumo = [202508,202509,...,202602] -> ["Ago/2025", "Set/2025", ..., "Mês Atual (Fev/2026)"].
 */
export function getConsumoHeaders(mesesConsumo: number[]): string[] {
  if (!mesesConsumo.length) return [];
  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);
  return mesesConsumo.map((mesano, i) => {
    const label = capitalize(formatMesanoLabel(mesano));
    return i === mesesConsumo.length - 1 ? `Mês Atual (${label})` : label;
  });
}

export interface DashboardControleResponse {
  totalMateriais: number;
  totalPendencias: number;
  totalAtencao: number;
  totalCritico: number;
}

export const controleEmpenhosApi = {
  getItens: (params: {
    codigo?: string;
    responsavel?: string;
    status?: string;
    comRegistro?: boolean;
    page?: number;
    pageSize?: number;
  }) => {
    const search = new URLSearchParams();
    if (params.codigo) search.set('codigo', params.codigo);
    if (params.responsavel) search.set('responsavel', params.responsavel);
    if (params.status) search.set('status', params.status);
    if (params.comRegistro !== undefined) search.set('comRegistro', String(params.comRegistro));
    if (params.page) search.set('page', String(params.page));
    if (params.pageSize) search.set('pageSize', String(params.pageSize));
    return api<ControleEmpenhosResponse>(`/controle-empenhos?${search.toString()}`);
  },

  getDashboard: () => api<DashboardControleResponse>('/controle-empenhos/dashboard'),

  salvarHistorico: (body: {
    material_id: number;
    classificacao?: string;
    resp_controle?: string;
    setor_controle?: string;
    master_descritivo?: string;
    numero_registro?: string;
    valor_unit_registro?: number;
    saldo_registro?: number;
    qtde_por_embalagem?: number;
    tipo_armazenamento?: string;
    capacidade_estocagem?: string;
    observacao?: string;
  }) =>
    api<unknown>('/controle-empenhos/historico', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

// --- Provisionamento ---
export interface DadosProvisionamentoMaterial {
  codigo: string;
  descricao: string | null;
  mediaConsumo: number;
  estoqueAlmoxarifados: number;
  estoqueVirtual: number;
  tempoAbastecimento: number | null;
  registros: RegistroConsumoEstoque[];
}

/** Linha da tabela de provisionamento (Registro Ativo = sim). */
export interface LinhaProvisionamentoRegistroAtivo {
  id: string;
  codigo: string;
  descricao: string | null;
  mediaConsumo: number;
  estoqueAlmoxarifados: number;
  estoqueVirtual: number;
  tempoAbastecimento: number | null;
  numeroRegistro: string | null;
  saldoRegistro: number | null;
  vigencia: string | null;
  valorUnitario: number | null;
  qtdePedida: number;
  valorTotal: number;
  observacao: string;
}

export const provisionamentoApi = {
  /** Lista todos os materiais com Registro Ativo = sim para a tabela. */
  getRegistrosAtivos: () => api<LinhaProvisionamentoRegistroAtivo[]>('/provisionamento/registros-ativos'),

  getPorCodigo: (codigo: string) =>
    api<DadosProvisionamentoMaterial>(`/provisionamento/${encodeURIComponent(codigo)}`),

  gerarPdf: async (body: {
    codigoMaterial: string;
    descricao?: string | null;
    linhas: Array<{
      numero_registro?: string;
      vigencia?: string;
      valor_unitario?: number;
      qtde_pedida: number;
      observacao?: string;
    }>;
  }): Promise<{ blob?: Blob; error?: string; filename?: string }> => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/provisionamento/gerar-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      let error = text;
      try {
        const j = JSON.parse(text);
        if (j.error) error = j.error;
        if (j.message) error = j.message;
      } catch {}
      return { error };
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition');
    let filename = 'provisionamento.pdf';
    if (disposition) {
      const m = disposition.match(/filename="?([^";]+)"?/);
      if (m) filename = m[1];
    }
    return { blob, filename };
  },

  gerarPdfConsolidado: async (body: {
    materiais: Array<{
      codigoMaterial: string;
      descricao?: string | null;
      /** Média de consumo dos últimos 6 meses (exibida no PDF). */
      mediaConsumo6Meses?: number;
      linhas: Array<{
        numero_registro?: string;
        vigencia?: string;
        valor_unitario?: number;
        qtde_pedida: number;
        observacao?: string;
      }>;
    }>;
  }): Promise<{ blob?: Blob; error?: string; filename?: string }> => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/provisionamento/gerar-pdf-consolidado`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      let error = text;
      try {
        const j = JSON.parse(text);
        if (j.error) error = j.error;
        if (j.message) error = j.message;
      } catch {}
      return { error };
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition');
    let filename = 'provisionamento-consolidado.pdf';
    if (disposition) {
      const m = disposition.match(/filename="?([^";]+)"?/);
      if (m) filename = m[1];
    }
    return { blob, filename };
  },
};

// --- Movimentação Diária (Relatório v_df_movimento; ordenação decrescente por data) ---
export interface MovimentacaoDiariaItem {
  data: string | null;
  mesano: number | null;
  mat_cod_antigo: string;
  umd_codigo: string | null;
  quantidade: number;
  valor: number | null;
  movimento_cd: string;
  tipo: string;
  alm_nome: string | null;
  setor_controle: string | null;
  centro_atividade: string | null;
  grupo: string | null;
  ser_nome: string | null;
}

export interface MovimentacaoDiariaResponse {
  mesano: string;
  itens: MovimentacaoDiariaItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MovimentacaoDiariaParams {
  mesano: string;
  page?: number;
  pageSize?: number;
  almoxarifado?: string;
  setor_controle?: string;
  movimento?: string;
  material?: string;
}

export interface MovimentacaoDiariaFiltrosOpcoes {
  mesanos: string[];
  almoxarifados: string[];
  movimentos: string[];
  materiais: string[];
}

export const movimentacaoDiariaApi = {
  getMovimentacoes: (params: MovimentacaoDiariaParams) => {
    const q = new URLSearchParams();
    q.set('mesano', params.mesano);
    if (params.page != null) q.set('page', String(params.page));
    if (params.pageSize != null) q.set('pageSize', String(params.pageSize));
    if (params.almoxarifado) q.set('almoxarifado', params.almoxarifado);
    if (params.setor_controle) q.set('setor_controle', params.setor_controle);
    if (params.movimento) q.set('movimento', params.movimento);
    if (params.material) q.set('material', params.material);
    return api<MovimentacaoDiariaResponse>(`/movimentacao-diaria?${q.toString()}`);
  },
  getFiltrosOpcoes: (mesano: string) => {
    const q = new URLSearchParams();
    q.set('mesano', mesano);
    return api<MovimentacaoDiariaFiltrosOpcoes>(`/movimentacao-diaria/filtros-opcoes?${q.toString()}`);
  },
};

// --- Empenhos Pendentes (public.empenho: status_item <> 'Atendido', fl_evento = 'Empenho') ---
export interface EmpenhoPendenteItem {
  id: number;
  nm_fornecedor: string | null;
  nu_registro_licitacao: string | null;
  nu_pregao: string | null;
  dt_fim_vigencia: string | null;
  item: string | null;
  material: string | null;
  qt_saldo: number | null;
  valor_numeric: number | null;
  vl_saldo: number | null;
  vl_unidade: number | null;
  fl_evento: string | null;
  nu_documento_siafi: string | null;
  status_item: string | null;
}

export interface EmpenhosPendentesResponse {
  itens: EmpenhoPendenteItem[];
  total: number;
  page: number;
  pageSize: number;
}

export const empenhosPendentesApi = {
  list: (params?: { codigo?: string; empenho?: string; page?: number; pageSize?: number }) => {
    const search = new URLSearchParams();
    if (params?.codigo?.trim()) search.set('codigo', params.codigo.trim());
    if (params?.empenho?.trim()) search.set('empenho', params.empenho.trim());
    if (params?.page != null) search.set('page', String(params.page));
    if (params?.pageSize != null) search.set('pageSize', String(params.pageSize));
    const qs = search.toString();
    return api<EmpenhosPendentesResponse>(`/empenhos-pendentes${qs ? `?${qs}` : ''}`);
  },
};
