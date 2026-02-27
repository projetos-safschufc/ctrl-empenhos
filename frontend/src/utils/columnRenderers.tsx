/**
 * columnRenderers.tsx
 * Renderizadores para as colunas 6-12 da tela Controle de Empenhos (Frontend/React/Chakra UI).
 * 
 * Responsável por renderizar dados com formatação consistente, cores, tooltips e validação.
 */

import { Td, Text } from '@chakra-ui/react';

/**
 * Formata número inteiro com separador de milhares (ponto).
 * Ex.: 19534 → "19.534"
 */
export const formatarIntThousands = (val: number | null | undefined, fallback = '-'): string => {
  if (val === null || val === undefined) return fallback;
  const n = Number(val);
  if (Number.isNaN(n)) return fallback;
  const int = Math.round(Math.abs(n));
  return int.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

/**
 * Formata número decimal com N casas decimais.
 * Sempre exibe positivo (se negativo, usa valor absoluto).
 */
export const formatarDecimal = (
  val: number | null | undefined,
  decimals = 2,
  fallback = '-'
): string => {
  if (val === null || val === undefined) return fallback;
  const n = Number(val);
  if (Number.isNaN(n)) return fallback;
  const display = Math.abs(n);
  return display.toFixed(decimals);
};

/**
 * Formata MESANO (inteiro YYYYMM) em MM/YYYY.
 * Ex.: 202502 → "02/2025"
 */
export const formatarMesano = (mesano: number | null | undefined, fallback = '-'): string => {
  if (mesano === null || mesano === undefined) return fallback;
  const n = Number(mesano);
  if (Number.isNaN(n) || n <= 0) return fallback;
  const str = String(n).padStart(6, '0');
  const mm = str.substring(2, 4);
  const yyyy = str.substring(0, 4);
  return `${mm}/${yyyy}`;
};

/**
 * Renderiza célula de consumo (colunas 6-12 consumo mês-6 até mês atual).
 * Aplica cor verde claro para consumos válidos, cinza claro para zero.
 * 
 * @param consumo Valor de consumo (inteiro)
 * @param index Índice do mês (0=mês-6, ..., 6=mês atual)
 */
export function ColunaConsumoCell({
  consumo,
}: {
  consumo: number | null | undefined;
}): JSX.Element {
  const valor = Number(consumo) || 0;
  const texto = formatarIntThousands(valor);
  const bg = valor === 0 ? 'gray.50' : 'green.50';

  return (
    <Td isNumeric bg={bg} title={`Consumo: ${valor}`}>
      {texto}
    </Td>
  );
}

/**
 * Renderiza célula de média de consumo.
 * Usa dígitos decimais (1 casa decimal).
 */
export function ColunaMediaConsumoCell({
  media,
}: {
  media: number | null | undefined;
}): JSX.Element {
  const valor = Number(media) || 0;
  const texto = valor === 0 ? '-' : formatarDecimal(valor, 1);
  const bg = valor === 0 ? 'gray.50' : 'blue.50';

  return (
    <Td isNumeric bg={bg} title={`Média: ${texto}`}>
      {texto}
    </Td>
  );
}

/**
 * Renderiza célula de mês de último consumo (MESANO em MM/YYYY).
 */
export function ColunaMesUltimoConsumoCell({
  mesano,
}: {
  mesano: number | null | undefined;
}): JSX.Element {
  const apresentacao = formatarMesano(mesano);

  return (
    <Td style={{ textAlign: 'center' }} title={`Mês: ${apresentacao}`}>
      {apresentacao}
    </Td>
  );
}

/**
 * Renderiza célula de quantidade de último consumo.
 */
export function ColunaQtdeUltimoConsumoCell({
  qtde,
}: {
  qtde: number | null | undefined;
}): JSX.Element {
  const valor = Number(qtde) || 0;
  const texto = formatarIntThousands(valor);
  const bg = valor === 0 ? 'gray.50' : 'green.50';

  return (
    <Td isNumeric bg={bg} title={`Qtde: ${valor}`}>
      {texto}
    </Td>
  );
}

/**
 * Renderiza célula de estoque (almoxarifados, geral, saldo empenhos).
 * Aplica cores conforme criticidade:
 * - Vermelho (< 100): crítico
 * - Amarelo (100-500): atenção
 * - Verde (> 500): normal
 */
export function ColunaEstoqueCell({
  estoque,
  label = 'Estoque',
}: {
  estoque: number | null | undefined;
  label?: string;
}): JSX.Element {
  const valor = Number(estoque) || 0;
  const texto = valor === 0 ? '-' : formatarIntThousands(valor);

  let bg = 'gray.50';
  if (valor > 0) {
    if (valor < 100) bg = 'red.50';
    else if (valor < 500) bg = 'yellow.50';
    else bg = 'green.50';
  }

  return (
    <Td isNumeric bg={bg} title={`${label}: ${valor}`}>
      {texto}
    </Td>
  );
}

/**
 * Renderiza célula de pré-empenho.
 * Exibe o código do pré-empenho ou "-" se não houver.
 */
export function ColunaPreEmpenhoCell({
  numeroPreEmpenho,
}: {
  numeroPreEmpenho: string | null | undefined;
}): JSX.Element {
  const texto = numeroPreEmpenho || '-';
  const bg = numeroPreEmpenho ? 'blue.50' : 'gray.50';

  return (
    <Td bg={bg} title={`Pré-empenho: ${texto}`}>
      <Text fontWeight="medium">{texto}</Text>
    </Td>
  );
}

/**
 * Renderiza célula de cobertura (dias de estoque).
 * Cálculo: Estoque Almoxarifados / Média Consumo 6 meses.
 *
 * Cores de criticidade:
 * - Vermelho (< 1): < 1 dia (CRÍTICO)
 * - Amarelo (1-3): 1-3 dias (ATENÇÃO)
 * - Verde (> 3): > 3 dias (NORMAL)
 */
export function ColunaCoberturaCellFormatted({
  cobertura,
  mediaConsumo,
}: {
  cobertura: number | null | undefined;
  mediaConsumo?: number;
}): JSX.Element {
  const valor = Number(cobertura);

  if (Number.isNaN(valor) || valor === null) {
    // Se média consumo = 0, cobertura não calculável
    const msg = mediaConsumo === 0 ? 'Sem consumo' : 'N/A';
    return (
      <Td style={{ textAlign: 'center' }} title={msg}>
        <Text fontSize="xs" color="gray.500">
          —
        </Text>
      </Td>
    );
  }

  const texto = formatarDecimal(valor, 1);

  let bg = 'gray.50';
  let borderColor = 'gray.200';
  if (valor < 1) {
    bg = 'red.100';
    borderColor = 'red.500';
  } else if (valor < 3) {
    bg = 'yellow.100';
    borderColor = 'yellow.500';
  } else {
    bg = 'green.100';
    borderColor = 'green.500';
  }

  return (
    <Td
      style={{ textAlign: 'center' }}
      bg={bg}
      borderLeft={`3px solid ${borderColor}`}
      title={`Cobertura: ${texto} dias`}
    >
      <Text fontWeight="medium">{texto}</Text>
    </Td>
  );
}

/**
 * Renderiza linha completa de colunas 6-12 dentro de um Tr (Table Row).
 * Abstrair toda a lógica de renderização em um só lugar facilita manutenção.
 */
export interface DadosColunasControleRender {
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
  coberturaEstoque: number | null;
}

/**
 * Renderizador completo das 7 colunas de consumo + media + ultimas compras + estoques + cobertura.
 * Retorna array de JSX.Element para inserir diretamente no Tr.
 */
export function renderizarColunasControle(dados: DadosColunasControleRender): JSX.Element[] {
  const elementos: JSX.Element[] = [];

  // Colunas 6-12: Consumo dos 7 últimos períodos
  elementos.push(
    <ColunaConsumoCell key="consumo6" consumo={dados.consumoMesMinus6} />,
    <ColunaConsumoCell key="consumo5" consumo={dados.consumoMesMinus5} />,
    <ColunaConsumoCell key="consumo4" consumo={dados.consumoMesMinus4} />,
    <ColunaConsumoCell key="consumo3" consumo={dados.consumoMesMinus3} />,
    <ColunaConsumoCell key="consumo2" consumo={dados.consumoMesMinus2} />,
    <ColunaConsumoCell key="consumo1" consumo={dados.consumoMesMinus1} />,
    <ColunaConsumoCell key="consumoAtual" consumo={dados.consumoMesAtual} />
  );

  // Coluna 13: Média 6 meses
  elementos.push(
    <ColunaMediaConsumoCell key="media" media={dados.mediaConsumo6Meses} />
  );

  // Coluna 14: Mês de último consumo
  elementos.push(
    <ColunaMesUltimoConsumoCell key="mesUltimo" mesano={dados.mesUltimoConsumo} />
  );

  // Coluna 15: Qtde do último consumo
  elementos.push(
    <ColunaQtdeUltimoConsumoCell key="qtdeUltimo" qtde={dados.qtdeUltimoConsumo} />
  );

  // Coluna 16: Estoque almoxarifados
  elementos.push(
    <ColunaEstoqueCell
      key="estoqueAlmox"
      estoque={dados.estoqueAlmoxarifados}
      label="Estoque Almoxarifados"
    />
  );

  // Coluna 17: Estoque geral
  elementos.push(
    <ColunaEstoqueCell
      key="estoqueGeral"
      estoque={dados.estoqueGeral}
      label="Estoque Geral"
    />
  );

  // Coluna 18: Saldo empenhos
  elementos.push(
    <ColunaEstoqueCell
      key="saldoEmpenhos"
      estoque={dados.saldoEmpenhos}
      label="Saldo Empenhos"
    />
  );

  // Coluna 19: Cobertura (estoque almox / média 6 meses)
  elementos.push(
    <ColunaCoberturaCellFormatted
      key="cobertura"
      cobertura={dados.coberturaEstoque}
      mediaConsumo={dados.mediaConsumo6Meses}
    />
  );

  return elementos;
}
