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
import {
  validarConsumo,
  calcularMediaConsumoValidos,
  validarEstoque,
  logColunasControle,
} from '../utils/columnFormatters';

export type StatusItem = 'Normal' | 'Atenção' | 'Crítico';

/** Meses para colunas de consumo: [mês atual -6, ..., mês atual -1, mês atual] */
export function getMesesParaColunasConsumo(): number[] {
  const now = new Date();
  const meses: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    meses.push(d.getFullYear() * 100 + (d.getMonth() + 1));
  }
  return meses;
}

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

/** Média apenas dos 6 meses anteriores (mês atual -6 a -1), só meses com consumo > 0 */
function calcularMediaConsumo6MesesAnteriores(
  consumosPorMes: { mesano: number; total: number }[],
  mesanoAtual: number
): number {
  const anteriores = consumosPorMes
    .filter((c) => c.mesano < mesanoAtual)
    .map((c) => validarConsumo(c.total))
    .filter((total) => total > 0);
  
  if (anteriores.length === 0) return 0;
  
  // Usar função validada
  return calcularMediaConsumoValidos(anteriores);
}

function calcularCobertura(
  estoqueAlmox: number,
  saldoEmpenhos: number,
  mediaConsumo: number
): number | null {
  // Validar estoques
  const estoqueAlmoxValidado = validarEstoque(estoqueAlmox);
  const saldoEmpenhoValidado = validarEstoque(saldoEmpenhos);
  const mediaValidada = validarConsumo(mediaConsumo);
  
  if (mediaValidada <= 0) return null;
  return (estoqueAlmoxValidado + saldoEmpenhoValidado) / mediaValidada;
}

function definirStatus(cobertura: number | null, comRegistro: boolean): StatusItem {
  if (!comRegistro) return 'Crítico';
  if (cobertura == null) return 'Normal';
  if (cobertura < 1) return 'Crítico';
  if (cobertura < 3) return 'Atenção';
  return 'Normal';
}

function consumoPorMesano(consumos: { mesano: number; total: number }[]): Record<number, number> {
  const map: Record<number, number> = {};
  for (const c of consumos) map[c.mesano] = c.total;
  return map;
}

/**
 * Regra de exibição de dados de registro na tela Controle de Empenhos:
 * exibir apenas quando numero_do_registro != "-" AND fim_vigência > TODAY() AND qtde_a_empenhar > 0.
 * vigencia no DW é fim_vigência; qtde_a_empenhar é mapeada para saldo_registro quando USE_SPEC.
 */
function filtrarRegistrosParaExibicao(registros: RegistroConsumoEstoque[]): RegistroConsumoEstoque[] {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return registros.filter((reg) => {
    const nr = reg.numero_registro != null ? String(reg.numero_registro).trim() : '';
    if (nr === '' || nr === '-') return false;
    const vigencia = reg.vigencia != null ? String(reg.vigencia).trim() : '';
    if (vigencia === '') return false;
    const fimVigencia = parseDate(vigencia);
    if (!fimVigencia || fimVigencia <= hoje) return false;
    const qtdeAEmpenhar = reg.saldo_registro ?? 0;
    if (qtdeAEmpenhar <= 0) return false;
    return true;
  });
}

function parseDate(str: string): Date | null {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (!trimmed) return null;
  const dmY = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmY) {
    const day = parseInt(dmY[1], 10);
    const month = parseInt(dmY[2], 10) - 1;
    const year = parseInt(dmY[3], 10);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

export const controleEmpenhoService = {
  async getItens(
    filters: CatalogoFilters & { status?: string; comRegistro?: boolean },
    page: number,
    pageSize: number
  ): Promise<{ itens: ItemControleEmpenho[]; total: number; mesesConsumo: number[] }> {
    // OTIMIZAÇÃO: Verificar cache primeiro
    const cacheKey = CacheKeys.controleItens(filters as Record<string, unknown>, page, pageSize);
    const cached = memoryCache.get<{ itens: ItemControleEmpenho[]; total: number; mesesConsumo: number[] }>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const { items: catalogItems, total } = await catalogoRepository.findMany(
      filters,
      page,
      pageSize
    );
    const meses = getMesesParaColunasConsumo();
    const mesanoAtual = meses[6];

    const masters = catalogItems.map((c) => c.master).filter((master): master is string => master !== null);
    const materialIds = catalogItems.map((c) => c.id);
    let codigosPadronizados: Map<string, string>;
    let consumosPorMaster: Map<string, { mesano: number; total: number }[]>;
    let ultimoConsumoPorMaster: Map<string, { mesano: number; qtde: number } | null>;
    let totaisPorMaster: Map<string, { estoqueAlmoxarifados: number; saldoEmpenhos: number }>;
    let preEmpenhoPorMasterERegistro: Map<string, string | null>;
    let registrosPorMaster: Map<string, RegistroConsumoEstoque[]>;
    let registrosExibirPorMaster: Map<string, RegistroConsumoEstoque[]>;
    let estoqueGeralPorMaster: Map<string, number>;
    let lastHistPorId: Map<string, Awaited<ReturnType<typeof histCtrlEmpenhoRepository.findLastByMaterialId>>>;
    
    try {
      // OTIMIZAÇÃO: Verificar cache individual para cada tipo de dados
      const codigosKey = `codigos:${masters.sort().join(',')}`;
      const consumosKey = CacheKeys.consumosMaster(masters, meses);
      const ultimoConsumoKey = `ultimo_consumo:${masters.sort().join(',')}:${mesanoAtual}`;
      const totaisKey = CacheKeys.totaisEstoque(masters);
      const registrosKey = CacheKeys.registrosMaster(masters);
      const estoqueGeralKey = `estoque_geral:${masters.sort().join(',')}`;
      const histKey = `hist:${materialIds.sort().join(',')}`;

      // Buscar do cache o que estiver disponível
      const cachedCodigos = memoryCache.get<Map<string, string>>(codigosKey);
      const cachedConsumos = memoryCache.get<Map<string, { mesano: number; total: number }[]>>(consumosKey);
      const cachedUltimoConsumo = memoryCache.get<Map<string, { mesano: number; qtde: number } | null>>(ultimoConsumoKey);
      const cachedTotais = memoryCache.get<Map<string, { estoqueAlmoxarifados: number; saldoEmpenhos: number }>>(totaisKey);
      const cachedRegistros = memoryCache.get<Map<string, RegistroConsumoEstoque[]>>(registrosKey);
      const cachedEstoqueGeral = memoryCache.get<Map<string, number>>(estoqueGeralKey);
      const cachedHist = memoryCache.get<Map<string, Awaited<ReturnType<typeof histCtrlEmpenhoRepository.findLastByMaterialId>>>>(histKey);

      // Preparar promises apenas para dados não cacheados
      const promises: Promise<unknown>[] = [];
      const promiseMap: string[] = [];

      if (!cachedCodigos) {
        promises.push(getCodigosPadronizadosByMasters(masters));
        promiseMap.push('codigos');
      }
      if (!cachedConsumos) {
        promises.push(getConsumosPorMastersEMeses(masters, meses));
        promiseMap.push('consumos');
      }
      if (!cachedUltimoConsumo) {
        promises.push(getUltimoConsumoExcluindoMesAtualPorMasters(masters, mesanoAtual));
        promiseMap.push('ultimoConsumo');
      }
      if (!cachedTotais) {
        promises.push(getTotaisEstoqueSaldoPorMasters(masters));
        promiseMap.push('totais');
      }
      if (!cachedRegistros) {
        promises.push(getEstoqueESaldoPorMasters(masters));
        promiseMap.push('registros');
      }
      if (!cachedEstoqueGeral) {
        promises.push(getEstoqueGeralPorMasters(masters));
        promiseMap.push('estoqueGeral');
      }
      if (!cachedHist) {
        // Converter materialIds para String (campo é String no Prisma)
        const materialIdsStr = materialIds.map(id => String(id));
        promises.push(histCtrlEmpenhoRepository.findLastByMaterialIds(materialIdsStr));
        promiseMap.push('hist');
      }

      // Executar apenas as queries necessárias
      const results = promises.length > 0 ? await Promise.all(promises) : [];

      // Atribuir resultados ou usar cache
      let resultIndex = 0;
      codigosPadronizados = cachedCodigos || (promiseMap[resultIndex] === 'codigos' ? results[resultIndex++] as Map<string, string> : new Map());
      consumosPorMaster = cachedConsumos || (promiseMap.find(p => p === 'consumos') ? results[promiseMap.indexOf('consumos')] as Map<string, { mesano: number; total: number }[]> : new Map());
      ultimoConsumoPorMaster = cachedUltimoConsumo || (promiseMap.find(p => p === 'ultimoConsumo') ? results[promiseMap.indexOf('ultimoConsumo')] as Map<string, { mesano: number; qtde: number } | null> : new Map());
      totaisPorMaster = cachedTotais || (promiseMap.find(p => p === 'totais') ? results[promiseMap.indexOf('totais')] as Map<string, { estoqueAlmoxarifados: number; saldoEmpenhos: number }> : new Map());
      registrosPorMaster = cachedRegistros || (promiseMap.find(p => p === 'registros') ? results[promiseMap.indexOf('registros')] as Map<string, RegistroConsumoEstoque[]> : new Map());
      estoqueGeralPorMaster = cachedEstoqueGeral || (promiseMap.find(p => p === 'estoqueGeral') ? results[promiseMap.indexOf('estoqueGeral')] as Map<string, number> : new Map());
      lastHistPorId = cachedHist || (promiseMap.find(p => p === 'hist') ? results[promiseMap.indexOf('hist')] as Map<string, Awaited<ReturnType<typeof histCtrlEmpenhoRepository.findLastByMaterialId>>> : new Map());

      // Armazenar no cache os dados que foram buscados
      if (!cachedCodigos && codigosPadronizados.size > 0) memoryCache.set(codigosKey, codigosPadronizados, CacheTTL.consumos);
      if (!cachedConsumos && consumosPorMaster.size > 0) memoryCache.set(consumosKey, consumosPorMaster, CacheTTL.consumos);
      if (!cachedUltimoConsumo && ultimoConsumoPorMaster.size > 0) memoryCache.set(ultimoConsumoKey, ultimoConsumoPorMaster, CacheTTL.consumos);
      if (!cachedTotais && totaisPorMaster.size > 0) memoryCache.set(totaisKey, totaisPorMaster, CacheTTL.totaisEstoque);
      if (!cachedRegistros && registrosPorMaster.size > 0) memoryCache.set(registrosKey, registrosPorMaster, CacheTTL.registros);
      if (!cachedEstoqueGeral && estoqueGeralPorMaster.size > 0) memoryCache.set(estoqueGeralKey, estoqueGeralPorMaster, CacheTTL.totaisEstoque);
      if (!cachedHist && lastHistPorId.size > 0) memoryCache.set(histKey, lastHistPorId, CacheTTL.controleItens);

      registrosExibirPorMaster = new Map<string, RegistroConsumoEstoque[]>();
      for (const m of masters) {
        const raw = registrosPorMaster.get(m) ?? [];
        registrosExibirPorMaster.set(m, filtrarRegistrosParaExibicao(raw));
      }
      const pairs: { master: string; numeroRegistro: string | null }[] = [];
      for (const cat of catalogItems) {
        const masterCode = cat.master;
        if (!masterCode) continue; // Pular itens sem master code
        
        const registros = registrosExibirPorMaster.get(masterCode) ?? [];
        if (registros.length === 0) {
          pairs.push({ master: masterCode, numeroRegistro: null });
        } else {
          for (const reg of registros) {
            pairs.push({ master: masterCode, numeroRegistro: reg.numero_registro ?? null });
          }
        }
      }
      preEmpenhoPorMasterERegistro = await getNumeroPreEmpenhoPorMastersERegistros(pairs);
    } catch (e) {
      console.warn('[controle-empenhos] batch falhou:', (e as Error).message);
      codigosPadronizados = new Map();
      consumosPorMaster = new Map();
      ultimoConsumoPorMaster = new Map();
      totaisPorMaster = new Map();
      preEmpenhoPorMasterERegistro = new Map();
      registrosPorMaster = new Map();
      registrosExibirPorMaster = new Map();
      estoqueGeralPorMaster = new Map();
      lastHistPorId = new Map();
    }

    const itens: ItemControleEmpenho[] = [];

    for (const cat of catalogItems) {
      const masterKey = cat.master;
      if (!masterKey) continue; // Pular itens sem master code
      
      // Declarar masterCode antes de usar
      const masterCode = cat.master || '';
      
      const consumos = consumosPorMaster.get(masterKey) ?? [];
      const ultimoConsumoExcl = ultimoConsumoPorMaster.get(masterKey) ?? null;
      const totais = totaisPorMaster.get(masterKey) ?? { estoqueAlmoxarifados: 0, saldoEmpenhos: 0 };
      const registros = registrosExibirPorMaster.get(masterKey) ?? [];
      const estoqueGeral = estoqueGeralPorMaster.get(masterKey) ?? 0;
      const lastHist = lastHistPorId.get(String(cat.id)) ?? null;

      const porMes = consumoPorMesano(consumos);
      const mediaConsumoMov = calcularMediaConsumo6MesesAnteriores(consumos, mesanoAtual);
      
      // Validar e normalizar cada consumo de mês
      const consumoMesMinus6 = validarConsumo(porMes[meses[0]] ?? 0);
      const consumoMesMinus5 = validarConsumo(porMes[meses[1]] ?? 0);
      const consumoMesMinus4 = validarConsumo(porMes[meses[2]] ?? 0);
      const consumoMesMinus3 = validarConsumo(porMes[meses[3]] ?? 0);
      const consumoMesMinus2 = validarConsumo(porMes[meses[4]] ?? 0);
      const consumoMesMinus1 = validarConsumo(porMes[meses[5]] ?? 0);
      const consumoMesAtual = validarConsumo(porMes[meses[6]] ?? 0);
      
      const mediaConsumo6Meses = mediaConsumoMov;
      const cobertura = calcularCobertura(
        totais.estoqueAlmoxarifados,
        totais.saldoEmpenhos,
        mediaConsumo6Meses
      );
      const comRegistro = registros.length > 0;
      const status = definirStatus(cobertura, comRegistro);
      
      // Log de debug (ativo se DEBUG=true)
      logColunasControle(cat.id, masterCode || '', {
        consumoMesMinus6,
        consumoMesMinus5,
        consumoMesMinus4,
        consumoMesMinus3,
        consumoMesMinus2,
        consumoMesMinus1,
        consumoMesAtual,
        mediaConsumo6Meses,
        mesUltimoConsumo: ultimoConsumoExcl?.mesano ?? null,
        qtdeUltimoConsumo: ultimoConsumoExcl?.qtde ?? 0,
        estoqueAlmoxarifados: totais.estoqueAlmoxarifados,
        estoqueGeral,
        saldoEmpenhos: totais.saldoEmpenhos,
      });
      
      // Criar descrição mais rica combinando master + descrição do catálogo
      const codigoPadronizado = codigosPadronizados.get(masterCode);
      let masterDescritivo = codigoPadronizado || masterCode;
      
      // Se não temos código padronizado, criar descrição rica com dados do catálogo
      if (!codigoPadronizado) {
        // Priorizar: descricao_mat > descricao > serv_aquisicao
        // Usar notação de colchetes para acessar descricao_mat (campo não mapeado pelo Prisma)
        const descricao = (cat as any).descricao_mat || cat.descricao || cat.servAquisicao;
        if (descricao && descricao.trim() && descricao.trim() !== '') {
          // Limitar o tamanho da descrição para não quebrar a interface
          const descricaoLimitada = descricao.trim().length > 80 
            ? descricao.trim().substring(0, 80) + '...' 
            : descricao.trim();
          masterDescritivo = `${masterCode} - ${descricaoLimitada}`;
        }
      }

      if (filters.status && filters.status !== status) continue;
      if (filters.comRegistro !== undefined && filters.comRegistro !== comRegistro) continue;

      const base = {
        id: cat.id,
        classificacao: cat.servAquisicao ?? null,
        respControle: cat.respControle ?? null,
        setorControle: cat.setor ?? null,
        masterDescritivo,
        apres: cat.apres ?? null,
        consumoMesMinus6,
        consumoMesMinus5,
        consumoMesMinus4,
        consumoMesMinus3,
        consumoMesMinus2,
        consumoMesMinus1,
        consumoMesAtual,
        mediaConsumo6Meses,
        mesUltimoConsumo: ultimoConsumoExcl?.mesano ?? null,
        qtdeUltimoConsumo: validarConsumo(ultimoConsumoExcl?.qtde),
        estoqueAlmoxarifados: validarEstoque(totais.estoqueAlmoxarifados),
        estoqueGeral: validarEstoque(estoqueGeral),
        saldoEmpenhos: validarEstoque(totais.saldoEmpenhos),
        numeroPreEmpenho: null as string | null,
        coberturaEstoque: cobertura,
        qtdePorEmbalagem: lastHist?.qtdePorEmbalagem != null ? Number(lastHist.qtdePorEmbalagem) : null,
        classificacaoXYZ: cat.xyz ?? null,
        tipoArmazenamento: lastHist?.tipoArmazenamento ?? null,
        capacidadeEstocagem: lastHist?.capacidadeEstocagem?.toString() ?? null,
        status,
        observacao: lastHist?.observacao ?? null,
        comRegistro,
        registros,
      };

      if (registros.length === 0) {
        // Regra de negócio: pré-empenho só é exibido quando existe registro válido (saldo > 0 e vigência > hoje).
        // Sem registro válido, a coluna Nº PRÉ-EMPENHO não exibe número (null / "-").
        itens.push({
          ...base,
          numeroPreEmpenho: null,
          rowKey: String(cat.id),
          registroMaster: null,
          vigenciaRegistro: null,
          saldoRegistro: null,
          valorUnitRegistro: null,
        });
      } else {
        for (let idx = 0; idx < registros.length; idx++) {
          const reg = registros[idx];
          const nr = reg.numero_registro ?? '';
          const preEmpenhoKey = `${cat.master}|${nr}`;
          const numeroPreEmpenho = preEmpenhoPorMasterERegistro.get(preEmpenhoKey) ?? null;
          itens.push({
            ...base,
            numeroPreEmpenho,
            rowKey: `${cat.id}-${nr}-${idx}`,
            registroMaster: reg.numero_registro ?? null,
            vigenciaRegistro: reg.vigencia ?? null,
            saldoRegistro: reg.saldo_registro ?? null,
            valorUnitRegistro: reg.valor_unitario ?? null,
          });
        }
      }
    }

    const result = { itens, total, mesesConsumo: meses };
    
    // OTIMIZAÇÃO: Armazenar resultado no cache
    memoryCache.set(cacheKey, result, CacheTTL.controleItens);
    
    return result;
  },

  async getDashboard(): Promise<{
    totalMateriais: number;
    totalPendencias: number;
    totalAtencao: number;
    totalCritico: number;
  }> {
    // OTIMIZAÇÃO: Verificar cache primeiro
    const cacheKey = CacheKeys.dashboard();
    const cached = memoryCache.get<{
      totalMateriais: number;
      totalPendencias: number;
      totalAtencao: number;
      totalCritico: number;
    }>(cacheKey);
    
    if (cached) {
      return cached;
    }

    // OTIMIZAÇÃO: Usar contagem direta em vez de buscar todos os registros
    const totalMateriais = await catalogoRepository.count({});
    
    // OTIMIZAÇÃO: Processar em lotes para evitar sobrecarga de memória
    const BATCH_SIZE = 1000;
    let totalPendencias = 0;
    let totalAtencao = 0;
    let totalCritico = 0;
    
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
        
        const timeoutMs = 10000; // 10 segundos timeout para ambiente INTRANET
        const results = promises.length > 0 ? await Promise.race([
          Promise.all(promises),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), timeoutMs)
          )
        ]) : [];
        
        // Atribuir resultados ou usar cache
        let resultIndex = 0;
        totaisPorMaster = cachedTotais || (results[resultIndex++] as Map<string, { estoqueAlmoxarifados: number; saldoEmpenhos: number }>);
        registrosPorMaster = cachedRegistros || (results[resultIndex++] as Map<string, RegistroConsumoEstoque[]>);
        consumosPorMaster = cachedConsumos || (results[resultIndex++] as Map<string, { mesano: number; total: number }[]>);
        
        // Armazenar no cache
        if (!cachedTotais) memoryCache.set(totaisKey, totaisPorMaster, CacheTTL.totaisEstoque);
        if (!cachedRegistros) memoryCache.set(registrosKey, registrosPorMaster, CacheTTL.registros);
        if (!cachedConsumos) memoryCache.set(consumosKey, consumosPorMaster, CacheTTL.consumos);
        
      } catch (e) {
        console.warn(`[controle-empenhos] getDashboard batch ${page-1} falhou:`, (e as Error).message);
        // Em caso de erro, usar valores padrão para este lote
        totaisPorMaster = new Map();
        registrosPorMaster = new Map();
        consumosPorMaster = new Map();
      }

      // OTIMIZAÇÃO: Calcular status em lote
      for (const cat of items) {
        const masterItem = cat.master;
        if (!masterItem) continue; // Pular itens sem master code
        
        const totais = totaisPorMaster.get(masterItem) ?? { estoqueAlmoxarifados: 0, saldoEmpenhos: 0 };
        const registros = registrosPorMaster.get(masterItem) ?? [];
        const consumos = consumosPorMaster.get(masterItem) ?? [];
        const media = calcularMediaConsumo6MesesAnteriores(consumos, mesanoAtual);
        const cobertura = calcularCobertura(
          totais.estoqueAlmoxarifados,
          totais.saldoEmpenhos,
          media
        );
        const comRegistro = registros.length > 0;
        const status = definirStatus(cobertura, comRegistro);
        
        if (!comRegistro) totalPendencias++;
        if (status === 'Atenção') totalAtencao++;
        if (status === 'Crítico') totalCritico++;
      }
    }

    const result = {
      totalMateriais,
      totalPendencias,
      totalAtencao,
      totalCritico,
    };
    
    // OTIMIZAÇÃO: Armazenar resultado no cache
    memoryCache.set(cacheKey, result, CacheTTL.dashboard);
    
    return result;
  },
};
