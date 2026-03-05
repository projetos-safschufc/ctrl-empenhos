# Estilo condicional nas colunas de consumo mensal (Controle de Empenhos)

## Resumo

Nas colunas de consumo mensal da tabela **Controle de Empenhos** (Set/2025, Out/2025, Nov/2025, Dez/2025, Jan/2026, Fev/2026, Mês Atual (Mar/2026)), os valores passaram a ter estilo condicional por valor:

- **Valor igual a zero:** texto na cor **cinza** (`gray.500`).
- **Valor maior que zero:** texto na cor **preta** e em **negrito**.

## Causa raiz / Motivo técnico

As células dessas colunas eram renderizadas por `ColunaConsumoCell` em `columnRenderers.tsx`, que apenas definia cor de fundo (cinza para zero, verde para positivo) e não diferenciava a cor ou o peso do texto. A solicitação era deixar explícita a diferença visual pelo texto: cinza para zero e preto em negrito para valores positivos.

## Alteração realizada

**Arquivo:** `frontend/src/utils/columnRenderers.tsx`

- No componente **`ColunaConsumoCell`**:
  - O valor exibido passou a ser envolvido em um `<Text>` com:
    - `color={isZero ? 'gray.500' : 'black'}`
    - `fontWeight={isZero ? 'normal' : 'bold'}`
  - A cor de fundo da célula foi mantida (`gray.50` para zero, `green.50` para positivo) para consistência com o restante da tabela.

## Antes e depois

| Situação        | Antes                          | Depois                               |
|----------------|---------------------------------|--------------------------------------|
| Valor = 0      | Texto preto, fundo cinza claro  | Texto **cinza**, fundo cinza claro   |
| Valor > 0      | Texto preto, fundo verde claro  | Texto **preto em negrito**, fundo verde claro |

## Efeitos colaterais

- Nenhuma alteração de API, dados ou regra de negócio.
- Apenas mudança visual nas colunas de consumo mensal; demais colunas inalteradas.
- Leitores de tela continuam lendo o mesmo conteúdo; o peso em negrito pode ser anunciado conforme o suporte do leitor.

## Teste manual sugerido

1. Abrir a tela **Controle de Empenhos** com dados que tenham consumos zerados e positivos.
2. Nas colunas Set/2025 … Mês Atual (Mar/2026):
   - Células com valor 0 ou "-" devem aparecer em **cinza** e peso normal.
   - Células com valor > 0 devem aparecer em **preto** e **negrito**.

## Gravidade

**Baixo:** Ajuste de apresentação (UX/legibilidade); sem impacto funcional ou de regra de negócio.
