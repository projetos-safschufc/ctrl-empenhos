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

/** Filtros aceitos pelo getItens (inclui qtdeRegistros para filtro por quantidade exata de registros por material). */
type GetItensFilters = CatalogoFilters & { status?: string; comRegistro?: boolean; qtdeRegistros?: 0 | 1 | 2 | 3 };

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
    let catalogItems: Awaited<ReturnType<typeof catalogoRepository.findMany>>['items'];
    let total: number;

    if (filters.qtdeRegistros !== undefined) {
      // Filtro por quantidade exata de registros: primeiro coleta todos os masters que batem, depois pagina.
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
      total = collected.length;
      const mastersPage = collected.slice((page - 1) * pageSize, page * pageSize);
      catalogItems = await catalogoRepository.findManyByMasters(mastersPage);
    } else {
      const result = await catalogoRepository.findMany(filters, page, pageSize);
      catalogItems = result.items;
      total = result.total;
    }

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
    type HistRow = Awaited<ReturnType<typeof histCtrlEmpenhoRepository.findLastByMaterialId>>;
    let lastHistPorMaterialERegistro: Map<string, HistRow> = new Map();

    try {
      // OTIMIZAÇÃO: Verificar cache individual para cada tipo de dados
      const codigosKey = `codigos:${masters.sort().join(',')}`;
      const consumosKey = CacheKeys.consumosMaster(masters, meses);
      const ultimoConsumoKey = `ultimo_consumo:${masters.sort().join(',')}:${mesanoAtual}`;
      const totaisKey = CacheKeys.totaisEstoque(masters);
      const registrosKey = CacheKeys.registrosMaster(masters);
      const estoqueGeralKey = `estoque_geral:${masters.sort().join(',')}`;

      // Buscar do cache o que estiver disponível (hist é buscado depois, por par material+registro)
      const cachedCodigos = memoryCache.get<Map<string, string>>(codigosKey);
      const cachedConsumos = memoryCache.get<Map<string, { mesano: number; total: number }[]>>(consumosKey);
      const cachedUltimoConsumo = memoryCache.get<Map<string, { mesano: number; qtde: number } | null>>(ultimoConsumoKey);
      const cachedTotais = memoryCache.get<Map<string, { estoqueAlmoxarifados: number; saldoEmpenhos: number }>>(totaisKey);
      const cachedRegistros = memoryCache.get<Map<string, RegistroConsumoEstoque[]>>(registrosKey);
      const cachedEstoqueGeral = memoryCache.get<Map<string, number>>(estoqueGeralKey);

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

      // Armazenar no cache os dados que foram buscados
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

      // Histórico por (material_id, numero_registro) para edição por linha
      const histPairs: { materialId: string; numeroRegistro: string | null }[] = [];
      for (const cat of catalogItems) {
        const masterCode = cat.master;
        if (!masterCode) continue;
        const regs = registrosExibirPorMaster.get(masterCode) ?? [];
        if (regs.length === 0) {
          histPairs.push({ materialId: String(cat.id), numeroRegistro: null });
        } else {
          for (const reg of regs) {
            histPairs.push({ materialId: String(cat.id), numeroRegistro: reg.numero_registro ?? null });
          }
        }
      }
      const histPairsKey = `hist:pairs:${[...new Set(histPairs.map((p) => `${p.materialId}|${p.numeroRegistro ?? ''}`))].sort().join(',')}`;
      const cachedHistPairs = memoryCache.get<Map<string, HistRow>>(histPairsKey);
      if (cachedHistPairs) {
        lastHistPorMaterialERegistro = cachedHistPairs;
      } else {
        lastHistPorMaterialERegistro = await histCtrlEmpenhoRepository.findLastByMaterialIdAndRegistroPairs(histPairs);
        if (lastHistPorMaterialERegistro.size > 0) memoryCache.set(histPairsKey, lastHistPorMaterialERegistro, CacheTTL.controleItens);
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
      lastHistPorMaterialERegistro = new Map();
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
      const estoqueVirtual = validarEstoque(totais.estoqueAlmoxarifados) + validarEstoque(totais.saldoEmpenhos);
      const cobertura = calcularCoberturaEstoqueVirtual(estoqueVirtual, mediaConsumo6Meses);

      // Validação adicional: garantir que cobertura não seja igual ao estoque (bug comum).
      // Em produção, apenas registra quando DEBUG=true para não poluir os logs.
      if (cobertura === totais.estoqueAlmoxarifados && totais.estoqueAlmoxarifados > 0) {
        if (process.env.DEBUG === 'true') {
          console.error(
            `[BUG DETECTADO] Cobertura igual ao estoque para master ${masterCode}: estoque=${totais.estoqueAlmoxarifados}, media=${mediaConsumo6Meses}, cobertura=${cobertura}`
          );
        }
        // Mantemos a cobertura calculada; o log serve apenas para investigação.
      }

      const comRegistro = registros.length > 0;
      const consumos6Meses = [
        consumoMesMinus6,
        consumoMesMinus5,
        consumoMesMinus4,
        consumoMesMinus3,
        consumoMesMinus2,
        consumoMesMinus1,
      ];

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

      if (filters.comRegistro !== undefined && filters.comRegistro !== comRegistro) continue;

      const base = {
        id: cat.id,
        classificacao: cat.servAquisicao ?? null,
        respControle: cat.respControle ?? null,
        setorControle: cat.setor_controle ?? null,
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
        // Regra de negócio: pré-empenho só é exibido quando existe registro válido (saldo > 0 e vigência > hoje).
        // Sem registro válido, a coluna Nº PRÉ-EMPENHO não exibe número (null / "-").
        const statusInput = {
          estoqueAlmoxarifados: validarEstoque(totais.estoqueAlmoxarifados),
          estoqueGeral: validarEstoque(estoqueGeral),
          saldoEmpenhos: validarEstoque(totais.saldoEmpenhos),
          estoqueVirtual: validarEstoque(totais.estoqueAlmoxarifados) + validarEstoque(totais.saldoEmpenhos),
          coberturaEstoque: cobertura,
          mediaConsumo6Meses,
          consumoMesAtual,
          consumos6Meses,
          mesUltimoConsumo: ultimoConsumoExcl?.mesano ?? null,
          vigenciaRegistro: null,
          saldoRegistro: null,
          comRegistro: false,
          numeroPreEmpenho: null,
        };
        const { status: s, statusDetails: sd } = calcularStatusComDetalhes(statusInput);
        if (filters.status && filters.status !== s) continue;
        const histKeySemRegistro = `${cat.id}|`;
        const lastHistSemReg = lastHistPorMaterialERegistro.get(histKeySemRegistro) ?? null;
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
          const preEmpenhoKey = `${cat.master}|${nr}`;
          const numeroPreEmpenho = preEmpenhoPorMasterERegistro.get(preEmpenhoKey) ?? null;
          const statusInput = {
            estoqueAlmoxarifados: validarEstoque(totais.estoqueAlmoxarifados),
            estoqueGeral: validarEstoque(estoqueGeral),
            saldoEmpenhos: validarEstoque(totais.saldoEmpenhos),
            estoqueVirtual: validarEstoque(totais.estoqueAlmoxarifados) + validarEstoque(totais.saldoEmpenhos),
            coberturaEstoque: cobertura,
            mediaConsumo6Meses,
            consumoMesAtual,
            consumos6Meses,
            mesUltimoConsumo: ultimoConsumoExcl?.mesano ?? null,
            vigenciaRegistro: reg.vigencia ?? null,
            saldoRegistro: reg.saldo_registro ?? null,
            comRegistro: true,
            numeroPreEmpenho,
          };
          const { status: s, statusDetails: sd } = calcularStatusComDetalhes(statusInput);
          if (filters.status && filters.status !== s) continue;
          const histKeyRegistro = `${cat.id}|${nr}`;
          const lastHistReg = lastHistPorMaterialERegistro.get(histKeyRegistro) ?? null;
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
    
    // OTIMIZAÇÃO: Processar em lotes para evitar sobrecarga de memória
    const BATCH_SIZE = 1000;
    let totalPendencias = 0;
    let totalAtencao = 0;
    let totalCritico = 0;
    let materiaisComConsumoSemRegistro = 0;
    
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
