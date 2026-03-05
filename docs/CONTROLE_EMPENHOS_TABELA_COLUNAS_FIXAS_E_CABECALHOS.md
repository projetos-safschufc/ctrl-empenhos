# Ajustes na tabela da tela Controle de Empenhos

## Resumo

Foram implementadas duas melhorias na tabela da tela **Controle de Empenhos**:

1. **Colunas fixas:** as 4 primeiras colunas (checkbox, Classificação, Resp ctrl, Master/Descritivo) permanecem fixas ao mover a barra de rolagem horizontal para a direita.
2. **Quebra de linha nos cabeçalhos:** os cabeçalhos das colunas "Mês Atual (Mar/2026)", "Média 6 meses", "Mês últ consumo", "Qtde últ consumo", "Estoque almox.", "Estoque geral", "Saldo empenhos", "Estoque virtual", "Cobertura estoque", "Pré-empenho", "Saldo registro" e "Valor unit. registro" passaram a exibir o texto em duas linhas, reduzindo a largura das colunas.

---

## Causa raiz / Motivo técnico

- **Colunas fixas:** A tabela usa `TableContainer` com `overflowX="auto"`, então todo o conteúdo se desloca junto na rolagem horizontal. Não havia uso de `position: sticky` nas células das primeiras colunas, portanto não havia “colunas fixas” do ponto de vista de layout.
- **Cabeçalhos largos:** Os títulos das colunas eram uma única linha (ex.: "Média 6 meses", "Estoque almox."). Em tabelas com `whiteSpace="nowrap"` e muitas colunas, isso aumenta a largura mínima da tabela e a necessidade de rolagem horizontal. Quebrar o texto do cabeçalho em duas linhas reduz a largura mínima dessas colunas.

---

## Alteração realizada

**Arquivo:** `frontend/src/pages/ControleEmpenhos.tsx`

1. **Constantes de layout**
   - Definição de larguras mínimas das 4 colunas fixas (`STICKY_COL_WIDTHS`) e valores de `left` para cada uma (`STICKY_LEFT_1` a `STICKY_LEFT_4`).

2. **Colunas fixas (sticky)**
   - Nos primeiros 4 `<Th>` do cabeçalho: `position="sticky"`, `left` correspondente, `zIndex={2}`, `bg="gray.50"`, `minW` em pixels, `borderRightWidth` e `borderColor` para separar visualmente da área rolável.
   - Nos primeiros 4 `<Td>` de cada linha: `position="sticky"`, `left` correspondente, `zIndex={1}`, `bg` igual à linha (branco ou `green.50` quando selecionada), `minW`, `borderRightWidth` e `borderColor`.

3. **Quebra de linha nos cabeçalhos**
   - Componente auxiliar `ThQuebraLinha` que renderiza um `<Th>` com duas linhas (`linha1` + `<br />` + `linha2`), `whiteSpace="normal"` e `fontSize="xs"`.
   - Coluna dinâmica “Mês Atual (Mmm/AAAA)”: detecção via regex e renderização “Mês Atual” na primeira linha e “(Mmm/AAAA)” na segunda.
   - Colunas “Média 6 meses”, “Mês últ consumo”, “Qtde últ consumo”, “Estoque almox.”, “Estoque geral”, “Saldo empenhos”, “Estoque virtual”, “Cobertura estoque”, “Pré-empenho”, “Saldo registro” e “Valor unit. registro” passaram a usar `ThQuebraLinha` com texto dividido em duas linhas (ex.: “Média 6” / “meses”, “Saldo” / “empenhos”, “Pré-” / “Empenho”).

---

## Antes e depois

| Aspecto | Antes | Depois |
|--------|--------|--------|
| Rolagem horizontal | Todas as colunas se deslocavam; identificação do item (classificação, responsável, master) sumia ao rolar. | As 4 primeiras colunas permanecem visíveis ao rolar para a direita. |
| Cabeçalhos (Média 6 meses, Mês últ consumo, etc.) | Uma linha, colunas mais largas. | Duas linhas, colunas mais estreitas. |

---

## Efeitos colaterais

- **Navegadores:** `position: sticky` em `<th>`/`<td>` é suportado nos navegadores modernos (Chrome, Firefox, Edge, Safari). Em navegadores muito antigos, as colunas podem não ficar fixas (comportamento degrada para tabela normal).
- **Acessibilidade:** O conteúdo das células e o título (`title`) dos cabeçalhos com quebra de linha continuam com o texto completo; leitores de tela não são impactados negativamente.
- **Exportação Excel:** O `plataformaExport` usa os mesmos nomes de colunas (ex.: "Média 6 meses", "Estoque geral"); não foi alterado contrato de exportação, apenas a exibição na UI.

---

## Teste manual sugerido

1. Abrir a tela **Controle de Empenhos** com dados que gerem barra de rolagem horizontal (muitas colunas).
2. **Colunas fixas:** Rolar horizontalmente para a direita e conferir se as 4 primeiras colunas (checkbox, Classificação, Resp ctrl, Master/Descritivo) permanecem visíveis e alinhadas, com borda à direita separando da área rolável.
3. **Cabeçalhos:** Verificar se os cabeçalhos “Mês Atual (…),” “Média 6 meses,” “Mês últ consumo,” “Qtde últ consumo,” “Estoque almox.,” “Estoque geral,” “Saldo empenhos,” “Estoque virtual,” “Cobertura estoque,” “Pré-empenho,” “Saldo registro” e “Valor unit. registro” aparecem em duas linhas e se as colunas ficam mais estreitas.
4. Selecionar uma linha (checkbox) e rolar horizontalmente: as 4 primeiras células da linha selecionada devem manter o fundo verde claro.

---

## Gravidade

**Baixo:** Melhoria de usabilidade e legibilidade; não havia defeito funcional nem quebra de regra de negócio.
