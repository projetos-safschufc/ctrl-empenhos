# Filtro Setor Controle e coluna SETOR (setor_controle) – Controle de Empenhos

## Resumo

Ajustes para alinhar **filtro Setor** e **coluna SETOR** ao campo **setor_controle** da tabela **ctrl.safs_catalogo**, e posicionar a coluna SETOR **entre CHECKBOX e CLASSIFICAÇÃO**.

1. **Filtro Setor Controle:** Passa a filtrar pela coluna **setor_controle** de `safs_catalogo` (antes usava a coluna `setor`). Valores UACE/ULOG (ou outros) devem estar em `setor_controle`.
2. **Origem do dado na listagem:** O item da listagem passa a usar **safs_catalogo.setor_controle** para preencher `setorControle` (antes usava `safs_catalogo.setor`).
3. **Posição da coluna SETOR:** A coluna SETOR foi colocada **entre a coluna de checkbox e a coluna Classificação**, e configurada como coluna fixa (sticky) na rolagem horizontal.

**Relacionamento:** A listagem usa **ctrl.safs_catalogo**; o código do material é `master`. A view **v_df_consumo_estoque** relaciona por `codigo_padronizado` (parte antes do "-") equivalente a `safs_catalogo.master`. O setor exibido e filtrado vem apenas de **safs_catalogo.setor_controle**.

---

## Causa raiz / Motivo técnico

- **Campo errado:** O serviço e o filtro usavam a coluna **setor** de `safs_catalogo`. O negócio e o CREATE TABLE informado referem **setor_controle**. Com isso, o filtro e o valor exibido podiam não refletir o “Setor Controle” correto.
- **Posição da coluna:** A coluna SETOR estava após Classificação; o desenho da tela pedia SETOR **entre** CHECKBOX e CLASSIFICAÇÃO para eliminar o espaço vazio e melhorar a leitura.

---

## Alterações realizadas

### Backend

- **`backend/src/services/controleEmpenhoService.ts`**  
  - Atribuição do item: de `cat.setor` para **`cat.setor_controle`** ao montar `setorControle`.

- **`backend/src/repositories/catalogoRepository.ts`**  
  - Filtro por setor: de `where.setor = setor` para **`where.setor_controle = setor`** em `findMany` e `count` (valor do filtro em maiúsculas, match exato).

### Frontend

- **`frontend/src/pages/ControleEmpenhos.tsx`**
  - **Colunas fixas:** Inclusão de **Setor** como segunda coluna fixa (entre checkbox e Classificação). Larguras: `check: 40`, **setor: 80**, `classificacao: 320`, `respCtrl: 80`, `masterDescritivo: 280`. Recalculados os `left` das 5 colunas sticky (STICKY_LEFT_1 a STICKY_LEFT_5).
  - **Cabeçalho:** Ordem passando a ser: ✓ (checkbox), **Setor**, Classificação, Resp ctrl, Master/Descritivo, …
  - **Corpo:** Mesma ordem nas células; célula Setor com `position="sticky"`, `left={STICKY_LEFT_2}`, exibindo `item.setorControle ?? '-'`.

- **`frontend/src/utils/plataformaExport.ts`**
  - Ordem na exportação Excel ajustada para refletir a tabela: **Setor** como primeira coluna de dados, depois Classificação, Resp ctrl, …

---

## Antes e depois

| Aspecto | Antes | Depois |
|--------|--------|--------|
| Origem do valor Setor | safs_catalogo.**setor** | safs_catalogo.**setor_controle** |
| Filtro Setor | WHERE setor = ? | WHERE **setor_controle** = ? |
| Posição da coluna SETOR | Após Classificação | **Entre checkbox e Classificação** (2ª coluna, sticky) |
| Export Excel | Classificação, Setor, … | **Setor**, Classificação, … |

---

## Efeitos colaterais

- Se na base existir apenas **setor** preenchido e **setor_controle** nulo, a coluna SETOR passará a exibir "-" e o filtro por Setor não retornará esses registros. É necessário preencher **setor_controle** em `safs_catalogo` para o comportamento desejado.
- Colunas fixas na rolagem horizontal passam a ser 5 (checkbox, Setor, Classificação, Resp ctrl, Master/Descritivo).

---

## Teste manual sugerido

1. **Dado:** Conferir em `safs_catalogo` se há registros com **setor_controle** (ex.: UACE, ULOG).
2. **Coluna:** Na tela Controle de Empenhos, verificar se a segunda coluna é **Setor** (entre checkbox e Classificação), com valores vindos de setor_controle ou "-".
3. **Filtro:** Selecionar Setor (ex.: UACE), aplicar e verificar se a listagem filtra corretamente por setor_controle.
4. **Excel:** Exportar e conferir se a primeira coluna de dados é Setor e está alinhada ao que aparece na tela.

---

## Gravidade

**Médio:** Correção de origem de dado (setor_controle) e de filtro; melhoria de layout (posição da coluna). Pode alterar resultado da listagem e do filtro se setor e setor_controle tiverem valores diferentes na base.
