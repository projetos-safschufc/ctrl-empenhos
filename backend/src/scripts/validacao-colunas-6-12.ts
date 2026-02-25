/**
 * script-validacao-colunas-6-12.ts
 * Script de validação das colunas 6-12 implementadas na tela Controle de Empenhos.
 * 
 * Execução: npm run test:colunas-6-12 (ou adicionar como script em package.json)
 */

import {
  validarConsumo,
  calcularMediaConsumoValidos,
  validarEstoque,
  calcularCoberturaBatch,
  formatarInteiroPontosEspacos,
  formatarDecimalPositivo,
  formatarMesanoMMYYYY,
  validarDadosColunasControle,
  DadosColunasControle,
} from '../utils/columnFormatters';

interface TestCase {
  nome: string;
  entrada: unknown;
  esperado: unknown;
  descricao?: string;
}

interface TestGroup {
  categoria: string;
  testes: TestCase[];
}

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[36m';

let totalTestes = 0;
let passou = 0;
let falhou = 0;

function log(msg: string, cor = '') {
  console.log(cor + msg + RESET);
}

function assert(resultado: unknown, esperado: unknown, testNome: string) {
  totalTestes++;
  const sucesso = resultado === esperado || JSON.stringify(resultado) === JSON.stringify(esperado);
  
  if (sucesso) {
    passou++;
    log(`✓ ${testNome}`, GREEN);
  } else {
    falhou++;
    log(`✗ ${testNome}`, RED);
    log(`  Esperado: ${JSON.stringify(esperado)}`, RED);
    log(`  Recebido: ${JSON.stringify(resultado)}`, RED);
  }
}

/**
 * Validação: validarConsumo()
 */
function testarValidarConsumo() {
  log('\n📋 TESTANDO: validarConsumo()', BLUE);
  
  const testes: TestCase[] = [
    { nome: 'Número válido positivo', entrada: 100, esperado: 100 },
    { nome: 'Zero', entrada: 0, esperado: 0 },
    { nome: 'Número negativo (deve retornar 0)', entrada: -50, esperado: 0 },
    { nome: 'Null (deve retornar 0)', entrada: null, esperado: 0 },
    { nome: 'Undefined (deve retornar 0)', entrada: undefined, esperado: 0 },
    { nome: 'String numérica', entrada: '150', esperado: 150 },
    { nome: 'NaN (deve retornar 0)', entrada: NaN, esperado: 0 },
    { nome: 'String inválida', entrada: 'abc', esperado: 0 },
    { nome: 'Decimal (arredonda para baixo)', entrada: 159.7, esperado: 159 },
  ];
  
  testes.forEach((t) => {
    const resultado = validarConsumo(t.entrada);
    assert(resultado, t.esperado, `validarConsumo(${t.entrada})`);
  });
}

/**
 * Validação: calcularMediaConsumoValidos()
 */
function testarMediaConsumo() {
  log('\n📋 TESTANDO: calcularMediaConsumoValidos()', BLUE);
  
  // Teste 1: Consumos com alguns zeros
  const media1 = calcularMediaConsumoValidos([100, 0, 150, 0, 200, 0]);
  assert(media1, 150, 'Média de [100, 0, 150, 0, 200, 0] = 150'); // (100+150+200)/3
  
  // Teste 2: Todos zeros
  const media2 = calcularMediaConsumoValidos([0, 0, 0, 0]);
  assert(media2, 0, 'Média de todos zeros = 0');
  
  // Teste 3: Sem zeros
  const media3 = calcularMediaConsumoValidos([100, 200, 300, 400]);
  assert(media3, 250, 'Média de [100, 200, 300, 400] = 250'); // (100+200+300+400)/4
  
  // Teste 4: Array vazio
  const media4 = calcularMediaConsumoValidos([]);
  assert(media4, 0, 'Média de array vazio = 0');
}

/**
 * Validação: validarEstoque()
 */
function testarValidarEstoque() {
  log('\n📋 TESTANDO: validarEstoque()', BLUE);
  
  const testes: TestCase[] = [
    { nome: 'Número válido', entrada: 1000, esperado: 1000 },
    { nome: 'Zero', entrada: 0, esperado: 0 },
    { nome: 'Negativo (retorna 0)', entrada: -100, esperado: 0 },
    { nome: 'Null (retorna 0)', entrada: null, esperado: 0 },
    { nome: 'Decimal preservado', entrada: 123.45, esperado: 123.45 },
  ];
  
  testes.forEach((t) => {
    const resultado = validarEstoque(t.entrada);
    assert(resultado, t.esperado, `validarEstoque(${t.entrada})`);
  });
}

/**
 * Validação: calcularCoberturaBatch()
 */
function testarCobertura() {
  log('\n📋 TESTANDO: calcularCoberturaBatch()', BLUE);
  
  // Teste 1: Cobertura normal
  const cob1 = calcularCoberturaBatch(1000, 500, 100);
  assert(cob1, 15, 'Cobertura de (1000+500)/100 = 15 dias');
  
  // Teste 2: Sem consumo (media = 0)
  const cob2 = calcularCoberturaBatch(1000, 500, 0);
  assert(cob2, null, 'Sem consumo retorna null');
  
  // Teste 3: Estoque baixo
  const cob3 = calcularCoberturaBatch(100, 200, 500);
  assert(cob3, 0.6, 'Cobertura baixa: (100+200)/500 = 0.6');
}

/**
 * Validação: formatarInteiroPontosEspacos()
 */
function testarFormatarInteiros() {
  log('\n📋 TESTANDO: formatarInteiroPontosEspacos()', BLUE);
  
  const testes: TestCase[] = [
    { nome: 'Número pequeno', entrada: 123, esperado: '123' },
    { nome: 'Milhares', entrada: 1234, esperado: '1.234' },
    { nome: 'Milhões', entrada: 1234567, esperado: '1.234.567' },
    { nome: 'Zero', entrada: 0, esperado: '0' },
    { nome: 'Negativo (abs)', entrada: -19534, esperado: '19.534' },
    { nome: 'Null', entrada: null, esperado: '-' },
  ];
  
  testes.forEach((t) => {
    const resultado = formatarInteiroPontosEspacos(t.entrada as number | null | undefined);
    assert(resultado, t.esperado, `formatarInteiros(${t.entrada})`);
  });
}

/**
 * Validação: formatarDecimalPositivo()
 */
function testarFormatarDecimais() {
  log('\n📋 TESTANDO: formatarDecimalPositivo()', BLUE);
  
  const testes: TestCase[] = [
    { nome: '1 casa decimal', entrada: 15.527, esperado: '15.5' },
    { nome: '2 casas decimais', entrada: 15.527, esperado: '15.53', descricao: 'decimals=2' },
    { nome: 'Arredonda corretamente', entrada: 15.555, esperado: '15.6' },
    { nome: 'Negativo (abs)', entrada: -20.123, esperado: '20.1' },
    { nome: 'Zero', entrada: 0, esperado: '0.0' },
    { nome: 'Null', entrada: null, esperado: '-' },
  ];
  
  testes.forEach((t) => {
    const decimals = t.descricao?.includes('decimals=2') ? 2 : 1;
    const resultado = formatarDecimalPositivo(t.entrada as number | null | undefined, decimals);
    assert(resultado, t.esperado, `formatarDecimal(${t.entrada}, ${decimals})`);
  });
}

/**
 * Validação: formatarMesanoMMYYYY()
 */
function testarFormatarMesano() {
  log('\n📋 TESTANDO: formatarMesanoMMYYYY()', BLUE);
  
  const testes: TestCase[] = [
    { nome: 'Mesano válido', entrada: 202502, esperado: '02/2025' },
    { nome: 'Mesano outro', entrada: 202412, esperado: '12/2024' },
    { nome: 'Mesano com início 0', entrada: 202501, esperado: '01/2025' },
    { nome: 'Null', entrada: null, esperado: '-' },
    { nome: 'Inválido (0)', entrada: 0, esperado: '-' },
  ];
  
  testes.forEach((t) => {
    const resultado = formatarMesanoMMYYYY(t.entrada as number | null | undefined);
    assert(resultado, t.esperado, `formatarMesano(${t.entrada})`);
  });
}

/**
 * Validação: validarDadosColunasControle()
 */
function testarValidarDadosCompletos() {
  log('\n📋 TESTANDO: validarDadosColunasControle() [Integração]', BLUE);
  
  const dados: Partial<DadosColunasControle> = {
    consumoMesMinus6: 100,
    consumoMesMinus5: 0,
    consumoMesMinus4: 150,
    consumoMesMinus3: undefined, // Mudado de null para undefined
    consumoMesMinus2: 200,
    consumoMesMinus1: -50, // inválido
    consumoMesAtual: 180,
    estoqueAlmoxarifados: 1500,
    estoqueGeral: 2000,
    saldoEmpenhos: 500,
  };
  
  const resultado = validarDadosColunasControle(dados);
  
  assert(resultado.consumoMesMinus6, 100, 'consumoMesMinus6 validado');
  assert(resultado.consumoMesMinus1, 0, 'consumoMesMinus1 negativo → 0');
  assert(resultado.estoqueAlmoxarifados, 1500, 'estoqueAlmoxarifados validado');
  assert(resultado.mediaConsumo6Meses > 0, true, 'Média calculada (excluindo zeros)');
  assert(resultado.estoqueGeral, 2000, 'estoqueGeral validado');
  assert(resultado.saldoEmpenhos, 500, 'saldoEmpenhos validado');
}

/**
 * Executa todas os testes
 */
function executarTodosTestes() {
  log('\n╔═══════════════════════════════════════════════════════════════╗', BLUE);
  log('║         VALIDAÇÃO DAS COLUNAS 6-12 - CONTROLE EMPENHOS        ║', BLUE);
  log('╚═══════════════════════════════════════════════════════════════╝', BLUE);
  
  testarValidarConsumo();
  testarMediaConsumo();
  testarValidarEstoque();
  testarCobertura();
  testarFormatarInteiros();
  testarFormatarDecimais();
  testarFormatarMesano();
  testarValidarDadosCompletos();
  
  // Resumo
  log('\n╔═══════════════════════════════════════════════════════════════╗', BLUE);
  log('║                         RESUMO DOS TESTES                      ║', BLUE);
  log('╚═══════════════════════════════════════════════════════════════╝', BLUE);
  log(`Total de testes: ${totalTestes}`, YELLOW);
  log(`✓ Passaram: ${passou}`, GREEN);
  log(`✗ Falharam: ${falhou}`, falhou > 0 ? RED : GREEN);
  
  if (falhou === 0) {
    log('\n🎉 TODOS OS TESTES PASSARAM!', GREEN);
  } else {
    log(`\n⚠️  ${falhou} teste(s) falharam.`, RED);
    process.exit(1);
  }
}

// Executar testes
executarTodosTestes();
