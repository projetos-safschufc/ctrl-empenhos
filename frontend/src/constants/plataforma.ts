/**
 * Cores e constantes da Plataforma de Recebimento e Controle de Suprimentos.
 * Usar nos componentes das páginas Lista Empenhos, Lista Recebimentos, Adicionar Observações, Editar Recebimento.
 */
export const PLATAFORMA_COLORS = {
  predominante: '#FFFFFF',
  detalhePrincipal: '#8BC547',
  detalheSecundario: '#145D50',
  cinzaApoio: '#E5E5E5',
} as const;

export const PLATAFORMA_TITLE = 'Plataforma de Recebimento e Controle de Suprimentos';

/** Placeholders/constantes dos filtros (conforme imagens) */
export const FILTER_PLACEHOLDERS = {
  buscarPorMaster: 'Digite o código',
  buscarPorEmpenho: 'Digite o número',
  buscarPorFornecedor: 'Buscar por Fornecedor',
  buscarPorCodigo: 'Buscar por Código',
  filtrarPorEmpenho: 'Ex.: 2023NE000152',
  filtrarPorCodigo: 'Ex.: 575617 (Código Master)',
} as const;

/** Limites do slider de registros */
export const REGISTROS_SLIDER = { min: 100, max: 5000, default: 1000 } as const;

/** Opções de registros por página (Lista de Recebimentos) */
export const PAGE_SIZE_OPTIONS = [30, 50, 100] as const;

/** Validação da observação */
export const OBSERVACAO_MIN = 10;
export const OBSERVACAO_MAX = 200;
