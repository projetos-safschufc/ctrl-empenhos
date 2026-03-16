import { catalogoRepository, CatalogoFilters } from '../repositories/catalogoRepository';
import {
  getConsumosPorMastersEMeses,
  getUltimoConsumoExcluindoMesAtualPorMasters,
} from '../repositories/movimentoRepository';
import {
  getTotaisEstoqueSaldoPorMasters,
  getEstoqueESaldoPorMasters,
  getCodigosPadronizadosByMasters,
  RegistroConsumoEstoque,
} from '../repositories/consumoEstoqueRepository';
import { getNumeroPreEmpenhoPorMastersERegistros } from '../repositories/empenhoRepository';
import { getEstoqueGeralPorMasters } from '../repositories/estoqueRepository';
import { histCtrlEmpenhoRepository } from '../repositories/histCtrlEmpenhoRepository';
import { memoryCache, CacheKeys, CacheTTL } from '../utils/memoryCache';
import { validarConsumo, validarEstoque, logColunasControle } from '../utils/columnFormatters';
import {
  getMesesParaColunasConsumo,
  calcularMediaConsumo6MesesAnteriores,
  calcularCoberturaEstoqueVirtual,
  calcularStatusComDetalhes,
  calculateStatus,
  consumoPorMesano,
  filtrarRegistrosParaExibicao,
  type StatusItem,
  type StatusInput,
} from './controleEmpenho/calculos';

export type { StatusItem };

export interface ItemControleEmpenho {
  id: number;
  /** Chave única da linha: id quando 1 registro por material; id-numero_registro quando vários registros (ex.: Provisionamento). */
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
  /** Estoque virtual = estoque almoxarifados + saldo empenhos */
  estoqueVirtual: number;
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
  /** Texto explicativo para tooltip (gerado no backend). */
  statusDetails: string;
  observacao: string | null;
  comRegistro: boolean;
  registros: RegistroConsumoEstoque[];
}

type SortField = 'master' | 'cobertura' | 'vigencia';

/** Filtros aceitos pelo getItens (inclui qtdeRegistros para filtro por quantidade exata de registros por material). */
type GetItensFilters = CatalogoFilters & {
  status?: string;
  comRegistro?: boolean;
  qtdeRegistros?: 0 | 1 | 2 | 3;
  /** Campo de ordenação: master = MASTER/DESCRITIVO; cobertura = COBERTURA ESTOQUE; vigencia = VIGÊNCIA. */
  sortBy?: SortField;
  /** Direção da ordenação (padrão asc). */
  sortDir?: 'asc' | 'desc';
};

type CatalogItem = Awaited<ReturnType<typeof catalogoRepository.findMany>>['items'][number];

/**
 * Monta as linhas (itens) da tabela a partir de um lote de itens do catálogo.
 * Usado tanto na paginação por material (qtdeRegistros) quanto na paginação por linhas (else).
 */
async function buildRowsForCatalogBatch(
  catalogItems: CatalogItem[],
  filters: GetItensFilters,
  meses: number[]
): Promise<ItemControleEmpenho[]> {
  if (catalogItems.length === 0) return [];
  const mesanoAtual = meses[6];
  const masters = catalogItems.map((c) => c.master).filter((m): m is string => m != null);
  const materialIds = catalogItems.map((c) => c.id);
  type HistRow = Awaited<ReturnType<typeof histCtrlEmpenhoRepository.findLastByMaterialId>>;
  let codigosPadronizados: Map<string, string>;
  let consumosPorMaster: Map<string, { mesano: number; total: number }[]>;
  let ultimoConsumoPorMaster: Map<string, { mesano: number; qtde: number } | null>;
  let totaisPorMaster: Map<string, { estoqueAlmoxarifados: number; saldoEmpenhos: number }>;
  let preEmpenhoPorMasterERegistro: Map<string, string | null>;
  let registrosPorMaster: Map<string, RegistroConsumoEstoque[]>;
  let registrosExibirPorMaster: Map<string, RegistroConsumoEstoque[]>;
  let estoqueGeralPorMaster: Map<string, number>;
  let lastHistPorMaterialERegistro: Map<string, HistRow> = new Map();
  try {
    const codigosKey = `codigos:${[...masters].sort().join(',')}`;
    const consumosKey = CacheKeys.consumosMaster(masters, meses);
    const ultimoConsumoKey = `ultimo_consumo:${[...masters].sort().join(',')}:${mesanoAtual}`;
    const totaisKey = CacheKeys.totaisEstoque(masters);
    const registrosKey = CacheKeys.registrosMaster(masters);
    const estoqueGeralKey = `estoque_geral:${[...masters].sort().join(',')}`;
    const cachedCodigos = memoryCache.get<Map<string, string>>(codigosKey);
    const cachedConsumos = memoryCache.get<Map<string, { mesano: number; total: number }[]>>(consumosKey);
    const cachedUltimoConsumo = memoryCache.get<Map<string, { mesano: number; qtde: number } | null>>(ultimoConsumoKey);
    const cachedTotais = memoryCache.get<Map<string, { estoqueAlmoxarifados: number; saldoEmpenhos: number }>>(totaisKey);
    const cachedRegistros = memoryCache.get<Map<string, RegistroConsumoEstoque[]>>(registrosKey);
    const cachedEstoqueGeral = memoryCache.get<Map<string, number>>(estoqueGeralKey);
    const promises: Promise<unknown>[] = [];
    const promiseMap: string[] = [];
    if (!cachedCodigos) { promises.push(getCodigosPadronizadosByMasters(masters)); promiseMap.push('codigos'); }
    if (!cachedConsumos) { promises.push(getConsumosPorMastersEMeses(masters, meses)); promiseMap.push('consumos'); }
    if (!cachedUltimoConsumo) { promises.push(getUltimoConsumoExcluindoMesAtualPorMasters(masters, mesanoAtual)); promiseMap.push('ultimoConsumo'); }
    if (!cachedTotais) { promises.push(getTotaisEstoqueSaldoPorMasters(masters)); promiseMap.push('totais'); }
    if (!cachedRegistros) { promises.push(getEstoqueESaldoPorMasters(masters)); promiseMap.push('registros'); }
    if (!cachedEstoqueGeral) { promises.push(getEstoqueGeralPorMasters(masters)); promiseMap.push('estoqueGeral'); }
    const results = promises.length > 0 ? await Promise.all(promises) : [];
    let ri = 0;
    codigosPadronizados = cachedCodigos ?? (promiseMap[ri] === 'codigos' ? results[ri++] as Map<string, string> : new Map());
    consumosPorMaster = cachedConsumos ?? (promiseMap.includes('consumos') ? results[promiseMap.indexOf('consumos')] as Map<string, { mesano: number; total: number }[]> : new Map());
    ultimoConsumoPorMaster = cachedUltimoConsumo ?? (promiseMap.includes('ultimoConsumo') ? results[promiseMap.indexOf('ultimoConsumo')] as Map<string, { mesano: number; qtde: number } | null> : new Map());
    totaisPorMaster = cachedTotais ?? (promiseMap.includes('totais') ? results[promiseMap.indexOf('totais')] as Map<string, { estoqueAlmoxarifados: number; saldoEmpenhos: number }> : new Map());
    registrosPorMaster = cachedRegistros ?? (promiseMap.includes('registros') ? results[promiseMap.indexOf('registros')] as Map<string, RegistroConsumoEstoque[]> : new Map());
    estoqueGeralPorMaster = cachedEstoqueGeral ?? (promiseMap.includes('estoqueGeral') ? results[promiseMap.indexOf('estoqueGeral')] as Map<string, number> : new Map());
    if (!cachedCodigos && codigosPadronizados.size > 0) memoryCache.set(codigosKey, codigosPadronizados, CacheTTL.consumos);
    if (!cachedConsumos && consumosPorMaster.size > 0) memoryCache.set(consumosKey, consumosPorMaster, CacheTTL.consumos);
    if (!cachedUltimoConsumo && ultimoConsumoPorMaster.size > 0) memoryCache.set(ultimoConsumoKey, ultimoConsumoPorMaster, CacheTTL.consumos);
    if (!cachedTotais && totaisPorMaster.size > 0) memoryCache.set(totaisKey, totaisPorMaster, CacheTTL.totaisEstoque);
    if (!cachedRegistros && registrosPorMaster.size > 0) memoryCache.set(registrosKey, registrosPorMaster, CacheTTL.registros);
    if (!cachedEstoqueGeral && estoqueGeralPorMaster.size > 0) memoryCache.set(estoqueGeralKey, estoqueGeralPorMaster, CacheTTL.totaisEstoque);
    registrosExibirPorMaster = new Map<string, RegistroConsumoEstoque[]>();
    for (const m of masters) {
      const raw = registrosPorMaster.get(m) ?? [];
      registrosExibirPorMaster.set(m, filtrarRegistrosParaExibicao(raw));
    }
    const histPairs: { materialId: string; numeroRegistro: string | null }[] = [];
    for (const cat of catalogItems) {
      const masterCode = cat.master;
      if (!masterCode) continue;
      const regs = registrosExibirPorMaster.get(masterCode) ?? [];
      if (regs.length === 0) histPairs.push({ materialId: String(cat.id), numeroRegistro: null });
      else for (const reg of regs) histPairs.push({ materialId: String(cat.id), numeroRegistro: reg.numero_registro ?? null });
    }
    const histPairsKey = `hist:pairs:${[...new Set(histPairs.map((p) => `${p.materialId}|${p.numeroRegistro ?? ''}`))].sort().join(',')}`;
    const cachedHistPairs = memoryCache.get<Map<string, HistRow>>(histPairsKey);
    if (cachedHistPairs) lastHistPorMaterialERegistro = cachedHistPairs;
    else {
      lastHistPorMaterialERegistro = await histCtrlEmpenhoRepository.findLastByMaterialIdAndRegistroPairs(histPairs);
      if (lastHistPorMaterialERegistro.size > 0) memoryCache.set(histPairsKey, lastHistPorMaterialERegistro, CacheTTL.controleItens);
    }
    const pairs: { master: string; numeroRegistro: string | null }[] = [];
    for (const cat of catalogItems) {
      const masterCode = cat.master;
      if (!masterCode) continue;
      const registros = registrosExibirPorMaster.get(masterCode) ?? [];
      if (registros.length === 0) pairs.push({ master: masterCode, numeroRegistro: null });
      else for (const reg of registros) pairs.push({ master: masterCode, numeroRegistro: reg.numero_registro ?? null });
    }
    preEmpenhoPorMasterERegistro = await getNumeroPreEmpenhoPorMastersERegistros(pairs);
  } catch (e) {
    console.warn('[controle-empenhos] buildRowsForCatalogBatch falhou:', (e as Error).message);
    codigosPadronizados = new Map();
    consumosPorMaster = new Map();
    ultimoConsumoPorMaster = new Map();
    totaisPorMaster = new Map();
    preEmpenhoPorMasterERegistro = new Map();
    registrosPorMaster = new Map();
    registrosExibirPorMaster = new Map();
    estoqueGeralPorMaster = new Map();
    lastHistPorMaterialERegistro = new Map();
  }
  const itens: ItemControleEmpenho[] = [];
  for (const cat of catalogItems) {
    const masterKey = cat.master;
    if (!masterKey) continue;
    const masterCode = cat.master || '';
    const consumos = consumosPorMaster.get(masterKey) ?? [];
    const ultimoConsumoExcl = ultimoConsumoPorMaster.get(masterKey) ?? null;
    const totais = totaisPorMaster.get(masterKey) ?? { estoqueAlmoxarifados: 0, saldoEmpenhos: 0 };
    const registros = registrosExibirPorMaster.get(masterKey) ?? [];
    const estoqueGeral = estoqueGeralPorMaster.get(masterKey) ?? 0;
    const porMes = consumoPorMesano(consumos);
    const mediaConsumoMov = calcularMediaConsumo6MesesAnteriores(consumos, mesanoAtual);
    const consumoMesMinus6 = validarConsumo(porMes[meses[0]] ?? 0);
    const consumoMesMinus5 = validarConsumo(porMes[meses[1]] ?? 0);
    const consumoMesMinus4 = validarConsumo(porMes[meses[2]] ?? 0);
    const consumoMesMinus3 = validarConsumo(porMes[meses[3]] ?? 0);
    const consumoMesMinus2 = validarConsumo(porMes[meses[4]] ?? 0);
    const consumoMesMinus1 = validarConsumo(porMes[meses[5]] ?? 0);
    const consumoMesAtual = validarConsumo(porMes[meses[6]] ?? 0);
    const mediaConsumo6Meses = mediaConsumoMov;
    const estoqueVirtual = validarEstoque(totais.estoqueAlmoxarifados) + validarEstoque(totais.saldoEmpenhos);
    const cobertura = calcularCoberturaEstoqueVirtual(estoqueVirtual, mediaConsumo6Meses);
    const comRegistro = registros.length > 0;
    const consumos6Meses = [consumoMesMinus6, consumoMesMinus5, consumoMesMinus4, consumoMesMinus3, consumoMesMinus2, consumoMesMinus1];
    logColunasControle(cat.id, masterCode, { consumoMesMinus6, consumoMesMinus5, consumoMesMinus4, consumoMesMinus3, consumoMesMinus2, consumoMesMinus1, consumoMesAtual, mediaConsumo6Meses, mesUltimoConsumo: ultimoConsumoExcl?.mesano ?? null, qtdeUltimoConsumo: ultimoConsumoExcl?.qtde ?? 0, estoqueAlmoxarifados: totais.estoqueAlmoxarifados, estoqueGeral, saldoEmpenhos: totais.saldoEmpenhos });
    let masterDescritivo = codigosPadronizados.get(masterCode) || masterCode;
    if (!codigosPadronizados.get(masterCode)) {
      const descricao = (cat as Record<string, unknown>).descricao_mat || cat.descricao || cat.servAquisicao;
      if (descricao && String(descricao).trim()) {
        const descricaoLimitada = String(descricao).trim().length > 80 ? String(descricao).trim().substring(0, 80) + '...' : String(descricao).trim();
        masterDescritivo = `${masterCode} - ${descricaoLimitada}`;
      }
    }
    if (filters.comRegistro !== undefined && filters.comRegistro !== comRegistro) continue;
    const base = {
      id: cat.id,
      classificacao: cat.servAquisicao ?? null,
      respControle: cat.respControle ?? null,
      setorControle: cat.setor_controle ?? null,
      masterDescritivo,
      apres: cat.apres ?? null,
      consumoMesMinus6, consumoMesMinus5, consumoMesMinus4, consumoMesMinus3, consumoMesMinus2, consumoMesMinus1, consumoMesAtual,
      mediaConsumo6Meses,
      mesUltimoConsumo: ultimoConsumoExcl?.mesano ?? null,
      qtdeUltimoConsumo: validarConsumo(ultimoConsumoExcl?.qtde),
      estoqueAlmoxarifados: validarEstoque(totais.estoqueAlmoxarifados),
      estoqueGeral: validarEstoque(estoqueGeral) - validarEstoque(totais.estoqueAlmoxarifados),
      saldoEmpenhos: validarEstoque(totais.saldoEmpenhos),
      estoqueVirtual: validarEstoque(totais.estoqueAlmoxarifados) + validarEstoque(totais.saldoEmpenhos),
      numeroPreEmpenho: null as string | null,
      coberturaEstoque: cobertura,
      classificacaoXYZ: cat.xyz ?? null,
      comRegistro,
      registros,
    };
    if (registros.length === 0) {
      const statusInput = { estoqueAlmoxarifados: validarEstoque(totais.estoqueAlmoxarifados), estoqueGeral: validarEstoque(estoqueGeral), saldoEmpenhos: validarEstoque(totais.saldoEmpenhos), estoqueVirtual: validarEstoque(totais.estoqueAlmoxarifados) + validarEstoque(totais.saldoEmpenhos), coberturaEstoque: cobertura, mediaConsumo6Meses, consumoMesAtual, consumos6Meses, mesUltimoConsumo: ultimoConsumoExcl?.mesano ?? null, vigenciaRegistro: null, saldoRegistro: null, comRegistro: false, numeroPreEmpenho: null };
      const { status: s, statusDetails: sd } = calcularStatusComDetalhes(statusInput);
      if (filters.status && filters.status !== s) continue;
      const lastHistSemReg = lastHistPorMaterialERegistro.get(`${cat.id}|`) ?? null;
      itens.push({
        ...base,
        status: s,
        statusDetails: sd,
        numeroPreEmpenho: null,
        rowKey: String(cat.id),
        registroMaster: null,
        vigenciaRegistro: null,
        saldoRegistro: null,
        valorUnitRegistro: null,
        qtdePorEmbalagem: lastHistSemReg?.qtdePorEmbalagem != null ? Number(lastHistSemReg.qtdePorEmbalagem) : null,
        tipoArmazenamento: lastHistSemReg?.tipoArmazenamento ?? null,
        capacidadeEstocagem: lastHistSemReg?.capacidadeEstocagem?.toString() ?? null,
        observacao: lastHistSemReg?.observacao ?? null,
      });
    } else {
      for (let idx = 0; idx < registros.length; idx++) {
        const reg = registros[idx];
        const nr = reg.numero_registro ?? '';
        const numeroPreEmpenho = preEmpenhoPorMasterERegistro.get(`${cat.master}|${nr}`) ?? null;
        const statusInput = { estoqueAlmoxarifados: validarEstoque(totais.estoqueAlmoxarifados), estoqueGeral: validarEstoque(estoqueGeral), saldoEmpenhos: validarEstoque(totais.saldoEmpenhos), estoqueVirtual: validarEstoque(totais.estoqueAlmoxarifados) + validarEstoque(totais.saldoEmpenhos), coberturaEstoque: cobertura, mediaConsumo6Meses, consumoMesAtual, consumos6Meses, mesUltimoConsumo: ultimoConsumoExcl?.mesano ?? null, vigenciaRegistro: reg.vigencia ?? null, saldoRegistro: reg.saldo_registro ?? null, comRegistro: true, numeroPreEmpenho };
        const { status: s, statusDetails: sd } = calcularStatusComDetalhes(statusInput);
        if (filters.status && filters.status !== s) continue;
        const lastHistReg = lastHistPorMaterialERegistro.get(`${cat.id}|${nr}`) ?? null;
        itens.push({
          ...base,
          status: s,
          statusDetails: sd,
          numeroPreEmpenho,
          rowKey: `${cat.id}-${nr}-${idx}`,
          registroMaster: reg.numero_registro ?? null,
          vigenciaRegistro: reg.vigencia ?? null,
          saldoRegistro: reg.saldo_registro ?? null,
          valorUnitRegistro: reg.valor_unitario ?? null,
          estoqueVirtual: validarEstoque(totais.estoqueAlmoxarifados) + validarEstoque(totais.saldoEmpenhos),
          qtdePorEmbalagem: lastHistReg?.qtdePorEmbalagem != null ? Number(lastHistReg.qtdePorEmbalagem) : null,
          tipoArmazenamento: lastHistReg?.tipoArmazenamento ?? null,
          capacidadeEstocagem: lastHistReg?.capacidadeEstocagem?.toString() ?? null,
          observacao: lastHistReg?.observacao ?? null,
        });
      }
    }
  }
  return itens;
}

function sortItens(
  itens: ItemControleEmpenho[],
  sortBy?: SortField,
  sortDir: 'asc' | 'desc' = 'asc'
): ItemControleEmpenho[] {
  if (!sortBy) return itens;
  const dir = sortDir === 'desc' ? -1 : 1;
  const copy = [...itens];

  const compare = (a: ItemControleEmpenho, b: ItemControleEmpenho): number => {
    let va: string | number | null = null;
    let vb: string | number | null = null;

    if (sortBy === 'master') {
      va = a.masterDescritivo ?? '';
      vb = b.masterDescritivo ?? '';
      return dir * String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' });
    }

    if (sortBy === 'cobertura') {
      va = a.coberturaEstoque ?? Number.NEGATIVE_INFINITY;
      vb = b.coberturaEstoque ?? Number.NEGATIVE_INFINITY;
      if (va === vb) return 0;
      return dir * ((va as number) - (vb as number));
    }

    // vigencia: ordenar por data crescente/decrescente; valores nulos vão para o final
    va = a.vigenciaRegistro ? Date.parse(a.vigenciaRegistro) : Number.NaN;
    vb = b.vigenciaRegistro ? Date.parse(b.vigenciaRegistro) : Number.NaN;
    const aValid = Number.isFinite(va as number);
    const bValid = Number.isFinite(vb as number);
    if (!aValid && !bValid) return 0;
    if (!aValid) return 1 * dir; // nulos/invalidos no final
    if (!bValid) return -1 * dir;
    if (va === vb) return 0;
    return dir * (((va as number) > (vb as number)) ? 1 : -1);
  };

  copy.sort(compare);
  return copy;
}

export const controleEmpenhoService = {
  async getItens(
    filters: GetItensFilters,
    page: number,
    pageSize: number
  ): Promise<{ itens: ItemControleEmpenho[]; total: number; mesesConsumo: number[] }> {
    // OTIMIZAÇÃO: Verificar cache primeiro
    const cacheKey = CacheKeys.controleItens(filters as Record<string, unknown>, page, pageSize);
    const cached = memoryCache.get<{ itens: ItemControleEmpenho[]; total: number; mesesConsumo: number[] }>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const meses = getMesesParaColunasConsumo();
    let total: number;

    if (filters.qtdeRegistros !== undefined) {
      // Filtro por quantidade exata de registros: coleta todos os masters que batem, monta todas as linhas
      // (aplicando status/comRegistro), depois pagina por linhas para preencher "Itens por página" corretamente.
      const BATCH = 500;
      let pageCat = 1;
      const collected: string[] = [];
      const catalogFilters: CatalogoFilters = {
        codigo: filters.codigo,
        responsavel: filters.responsavel,
        classificacao: filters.classificacao,
        setor: filters.setor,
      };
      while (true) {
        const { items } = await catalogoRepository.findMany(catalogFilters, pageCat, BATCH);
        if (items.length === 0) break;
        const mastersBatch = items.map((c) => c.master).filter((m): m is string => m != null);
        const registrosMap = await getEstoqueESaldoPorMasters(mastersBatch);
        for (const c of items) {
          const m = c.master;
          if (!m) continue;
          const regs = filtrarRegistrosParaExibicao(registrosMap.get(m) ?? []);
          if (regs.length === filters.qtdeRegistros) collected.push(m);
        }
        if (items.length < BATCH) break;
        pageCat++;
      }
      collected.sort();
      // Paginação por linhas: processar masters em lotes, montar linhas (com filtro status/comRegistro), aplicar ordenação e depois fatiar
      const MASTERS_BATCH = 500;
      let allRows: ItemControleEmpenho[] = [];
      for (let i = 0; i < collected.length; i += MASTERS_BATCH) {
        const mastersChunk = collected.slice(i, i + MASTERS_BATCH);
        const chunkCatalogItems = await catalogoRepository.findManyByMasters(mastersChunk);
        const batchRows = await buildRowsForCatalogBatch(chunkCatalogItems, filters, meses);
        allRows.push(...batchRows);
      }
      allRows = sortItens(allRows, filters.sortBy, filters.sortDir ?? 'asc');
      total = allRows.length;
      const itens = allRows.slice((page - 1) * pageSize, page * pageSize);
      const result = { itens, total, mesesConsumo: meses };
      memoryCache.set(cacheKey, result, CacheTTL.controleItens);
      return result;
    }

    // Paginação por linhas (itens): percorrer todo o catálogo em lotes, montar todas as linhas, depois fatiar pela página
    const catalogFilters: CatalogoFilters = {
      codigo: filters.codigo,
      responsavel: filters.responsavel,
      classificacao: filters.classificacao,
      setor: filters.setor,
    };
    let allRows: ItemControleEmpenho[] = [];
    let pageCat = 1;
    const BATCH = 500;
    while (true) {
      const { items } = await catalogoRepository.findMany(catalogFilters, pageCat, BATCH);
      if (items.length === 0) break;
      const batchRows = await buildRowsForCatalogBatch(items, filters, meses);
      allRows.push(...batchRows);
      pageCat++;
      if (items.length < BATCH) break;
    }
    allRows = sortItens(allRows, filters.sortBy, filters.sortDir ?? 'asc');
    total = allRows.length;
    const itens = allRows.slice((page - 1) * pageSize, page * pageSize);
    const result = { itens, total, mesesConsumo: meses };
    memoryCache.set(cacheKey, result, CacheTTL.controleItens);
    return result;
  },

  async getDashboard(): Promise<{
    totalMateriais: number;
    totalPendencias: number;
    totalAtencao: number;
    totalCritico: number;
    materiaisComConsumoSemRegistro: number;
  }> {
    // OTIMIZAÇÃO: Verificar cache primeiro
    const cacheKey = CacheKeys.dashboard();
    const cached = memoryCache.get<{
      totalMateriais: number;
      totalPendencias: number;
      totalAtencao: number;
      totalCritico: number;
      materiaisComConsumoSemRegistro: number;
    }>(cacheKey);
    
    if (cached) {
      return cached;
    }

    // OTIMIZAÇÃO: Usar contagem direta em vez de buscar todos os registros
    const totalMateriais = await catalogoRepository.count({});
    
    // Lotes menores reduzem pico de memória e tempo por requisição; timeout configurável por env
    const BATCH_SIZE = Math.min(2000, Math.max(200, parseInt(process.env.DASHBOARD_BATCH_SIZE ?? '500', 10) || 500));
    const timeoutMs = parseInt(process.env.DASHBOARD_BATCH_TIMEOUT_MS ?? '60000', 10) || 0; // 0 = sem timeout (confia no pool/DB)
    let totalPendencias = 0;
    let totalAtencao = 0;
    let totalCritico = 0;
    let materiaisComConsumoSemRegistro = 0;
    let batchesFailed = 0;
    let totalBatches = 0;
    
    const meses = getMesesParaColunasConsumo();
    const mesanoAtual = meses[6];
    
    // Processar em lotes
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const { items } = await catalogoRepository.findMany({}, page, BATCH_SIZE);
      hasMore = items.length === BATCH_SIZE;
      page++;
      
      if (items.length === 0) break;
      
      totalBatches++;
      const masters = items.map((c) => c.master).filter((master): master is string => master !== null);
      
      let totaisPorMaster: Map<string, { estoqueAlmoxarifados: number; saldoEmpenhos: number }>;
      let registrosPorMaster: Map<string, RegistroConsumoEstoque[]>;
      let consumosPorMaster: Map<string, { mesano: number; total: number }[]>;
      
      try {
        // OTIMIZAÇÃO: Verificar cache para cada lote
        const totaisKey = CacheKeys.totaisEstoque(masters);
        const registrosKey = CacheKeys.registrosMaster(masters);
        const consumosKey = CacheKeys.consumosMaster(masters, meses);
        
        const cachedTotais = memoryCache.get<Map<string, { estoqueAlmoxarifados: number; saldoEmpenhos: number }>>(totaisKey);
        const cachedRegistros = memoryCache.get<Map<string, RegistroConsumoEstoque[]>>(registrosKey);
        const cachedConsumos = memoryCache.get<Map<string, { mesano: number; total: number }[]>>(consumosKey);
        
        // OTIMIZAÇÃO: Executar apenas queries não cacheadas
        const promises: Promise<unknown>[] = [];
        if (!cachedTotais) promises.push(getTotaisEstoqueSaldoPorMasters(masters));
        if (!cachedRegistros) promises.push(getEstoqueESaldoPorMasters(masters));
        if (!cachedConsumos) promises.push(getConsumosPorMastersEMeses(masters, meses));
        
        const results =
          promises.length === 0
            ? []
            : timeoutMs > 0
              ? await Promise.race([
                  Promise.all(promises),
                  new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout')), timeoutMs)
                  ),
                ])
              : await Promise.all(promises);
        
        // Atribuir resultados ou usar cache
        let resultIndex = 0;
        totaisPorMaster = cachedTotais || (results[resultIndex++] as Map<string, { estoqueAlmoxarifados: number; saldoEmpenhos: number }>);
        registrosPorMaster = cachedRegistros || (results[resultIndex++] as Map<string, RegistroConsumoEstoque[]>);
        consumosPorMaster = cachedConsumos || (results[resultIndex++] as Map<string, { mesano: number; total: number }[]>);
        
        // Armazenar no cache
        if (!cachedTotais) memoryCache.set(totaisKey, totaisPorMaster, CacheTTL.totaisEstoque);
        if (!cachedRegistros) memoryCache.set(registrosKey, registrosPorMaster, CacheTTL.registros);
        if (!cachedConsumos) memoryCache.set(consumosKey, consumosPorMaster, CacheTTL.consumos);
        
      } catch {
        batchesFailed++;
        // Em caso de erro, usar valores padrão para este lote; log único ao final
        totaisPorMaster = new Map();
        registrosPorMaster = new Map();
        consumosPorMaster = new Map();
      }

      // OTIMIZAÇÃO: Calcular status em lote (mesma regra exata do getItens: cobertura por estoque virtual + calculateStatus)
      const registrosExibirPorMaster = new Map<string, RegistroConsumoEstoque[]>();
      for (const m of masters) {
        const raw = registrosPorMaster.get(m) ?? [];
        registrosExibirPorMaster.set(m, filtrarRegistrosParaExibicao(raw));
      }

      for (const cat of items) {
        const masterItem = cat.master;
        if (!masterItem) continue;

        const totais = totaisPorMaster.get(masterItem) ?? { estoqueAlmoxarifados: 0, saldoEmpenhos: 0 };
        const registros = registrosExibirPorMaster.get(masterItem) ?? [];
        const consumos = consumosPorMaster.get(masterItem) ?? [];
        const media = calcularMediaConsumo6MesesAnteriores(consumos, mesanoAtual);
        const estoqueVirtual = validarEstoque(totais.estoqueAlmoxarifados) + validarEstoque(totais.saldoEmpenhos);
        const cobertura = calcularCoberturaEstoqueVirtual(estoqueVirtual, media);
        const consumoMesAtual = consumos.find((c) => c.mesano === mesanoAtual)?.total ?? 0;

        if (registros.length === 0) {
          totalPendencias++;
          const temConsumo = consumoMesAtual > 0 || media > 0 || consumos.some((c) => (c.total ?? 0) > 0);
          if (temConsumo) materiaisComConsumoSemRegistro++;
          const statusInput: StatusInput = {
            estoqueAlmoxarifados: totais.estoqueAlmoxarifados,
            estoqueGeral: 0,
            saldoEmpenhos: totais.saldoEmpenhos,
            estoqueVirtual,
            coberturaEstoque: cobertura,
            mediaConsumo6Meses: media,
            consumoMesAtual,
            consumos6Meses: [],
            mesUltimoConsumo: null,
            vigenciaRegistro: null,
            saldoRegistro: null,
            comRegistro: false,
            numeroPreEmpenho: null,
          };
          const status = calculateStatus(statusInput);
          if (status === 'Atenção') totalAtencao++;
          if (status === 'Crítico') totalCritico++;
        } else {
          for (const reg of registros) {
            const statusInput: StatusInput = {
              estoqueAlmoxarifados: totais.estoqueAlmoxarifados,
              estoqueGeral: 0,
              saldoEmpenhos: totais.saldoEmpenhos,
              estoqueVirtual,
              coberturaEstoque: cobertura,
              mediaConsumo6Meses: media,
              consumoMesAtual,
              consumos6Meses: [],
              mesUltimoConsumo: null,
              vigenciaRegistro: reg.vigencia ?? null,
              saldoRegistro: reg.saldo_registro ?? null,
              comRegistro: true,
              numeroPreEmpenho: null,
            };
            const status = calculateStatus(statusInput);
            if (status === 'Atenção') totalAtencao++;
            if (status === 'Crítico') totalCritico++;
          }
        }
      }
    }

    if (batchesFailed > 0) {
      console.warn(
        `[controle-empenhos] getDashboard: ${batchesFailed} de ${totalBatches} lotes falharam por timeout ou erro.`
      );
    }

    const result = {
      totalMateriais,
      totalPendencias,
      totalAtencao,
      totalCritico,
      materiaisComConsumoSemRegistro,
    };
    
    // OTIMIZAÇÃO: Armazenar resultado no cache
    memoryCache.set(cacheKey, result, CacheTTL.dashboard);
    
    return result;
  },
};
