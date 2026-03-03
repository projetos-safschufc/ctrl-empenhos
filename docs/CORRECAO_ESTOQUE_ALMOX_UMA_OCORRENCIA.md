# Correção: ESTOQUE ALMOX multiplicado pelo número de registros (Controle de Empenhos)

## Classificação da gravidade

**Alto** — Dado de estoque exibido incorreto (valor multiplicado pelo número de registros do material), impactando decisões de compra, cobertura e provisionamento.

---

## 1. Explicação técnica do problema

### Causa raiz

Na view **`v_df_consumo_estoque`** existe **uma linha por material + registro** (numero_do_registro). A coluna **`qtde_em_estoque`** representa o **estoque em almoxarifado do material** e tem o **mesmo valor em todas as linhas** daquele material (não é estoque “por registro”).

O repositório usava **`SUM(qtde_em_estoque)`** agrupado por material. Com 3 registros para o mesmo material, o mesmo valor (ex.: 85.460) era somado 3 vezes, resultando em **256.380** na tela.

### Motivo do erro

- **Regra de negócio:** ESTOQUE ALMOX deve ser o **valor único de estoque do material** (uma vez por material).
- **Implementação anterior:** Agregação com `SUM(qtde_em_estoque)` sobre todas as linhas da view para o material, o que equivale a multiplicar o valor pelo número de registros quando `qtde_em_estoque` se repete em cada linha.

### Onde ocorria

- **`backend/src/repositories/consumoEstoqueRepository.ts`**
  - **`getTotaisEstoqueSaldo`** (um material): `SUM(qtde_em_estoque)`.
  - **`getTotaisEstoqueSaldoPorMasters`** (vários materials): `SUM(qtde_em_estoque) ... GROUP BY material`.

O serviço de Controle de Empenhos e o de Provisionamento usam esses totais para preencher a coluna ESTOQUE ALMOX e cálculos derivados (cobertura, estoque virtual).

---

## 2. Correção aplicada

Para **estoque almoxarifados**, usar **um único valor por material** em vez de somar todas as linhas. Em SQL, **`MAX(qtde_em_estoque)`** com `GROUP BY material` atende isso: quando todas as linhas têm o mesmo valor, MAX devolve esse valor; quando houver diferenças (caso atípico), ainda se evita a multiplicação indevida.

- **Saldo empenhos:** Mantido **`SUM(...)`**, pois pode fazer sentido somar saldos por registro (conforme regra de negócio).

### Antes

```sql
-- getTotaisEstoqueSaldo (um material)
SELECT
  COALESCE(SUM(qtde_em_estoque::numeric), 0) AS estoque_almoxarifados,
  COALESCE(SUM(saldo_empenhos::numeric), 0) AS saldo_empenhos
FROM v_df_consumo_estoque
WHERE material IN (...)
```

```sql
-- getTotaisEstoqueSaldoPorMasters
SELECT material AS master_code,
  COALESCE(SUM(qtde_em_estoque::numeric), 0) AS estoque_almoxarifados,
  COALESCE(SUM(saldo_empenhos::numeric), 0) AS saldo_empenhos
FROM v_df_consumo_estoque
WHERE material IN (...)
GROUP BY material
```

### Depois

```sql
-- getTotaisEstoqueSaldo (um material)
SELECT
  COALESCE(MAX(qtde_em_estoque::numeric), 0) AS estoque_almoxarifados,
  COALESCE(SUM(saldo_empenhos::numeric), 0) AS saldo_empenhos
FROM v_df_consumo_estoque
WHERE material IN (...)
```

```sql
-- getTotaisEstoqueSaldoPorMasters
SELECT material AS master_code,
  COALESCE(MAX(qtde_em_estoque::numeric), 0) AS estoque_almoxarifados,
  COALESCE(SUM(saldo_empenhos::numeric), 0) AS saldo_empenhos
FROM v_df_consumo_estoque
WHERE material IN (...)
GROUP BY material
```

### Arquivos alterados

| Arquivo | Função | Alteração |
|---------|--------|-----------|
| `backend/src/repositories/consumoEstoqueRepository.ts` | `getTotaisEstoqueSaldo` | `SUM(qtde_em_estoque)` → `MAX(qtde_em_estoque)` |
| `backend/src/repositories/consumoEstoqueRepository.ts` | `getTotaisEstoqueSaldoPorMasters` | `SUM(qtde_em_estoque)` → `MAX(qtde_em_estoque)`; comentário JSDoc explicando o uso de MAX para estoque almox. |

---

## 3. Contratos e impacto

- **API:** Nenhuma mudança de contrato. Os endpoints continuam retornando `estoqueAlmoxarifados` e `saldoEmpenhos`; apenas o valor de `estoqueAlmoxarifados` passa a ser o valor único por material (sem multiplicação por número de registros).
- **Controle de Empenhos:** Coluna ESTOQUE ALMOX e ESTOQUE VIRTUAL (almox + saldo empenhos) passam a refletir o estoque correto.
- **Provisionamento:** Serviço que usa `getTotaisEstoqueSaldo` também passa a ver o estoque almox correto.

---

## 4. Possíveis efeitos colaterais

- **Cache:** Chaves de cache de totais por master não mudaram; o conteúdo do cache passa a ter o novo valor. Após TTL ou invalidação, todos os clientes passam a receber o valor corrigido.
- **Saldo empenhos:** Continua sendo **soma** por material; se no seu negócio o saldo também deva ser “uma ocorrência” por material, será necessário um ajuste específico (não feito nesta correção).
- **Valores distintos por registro:** Se em algum ambiente `qtde_em_estoque` variar por registro para o mesmo material, `MAX` retornará o maior valor; a regra de “primeira ocorrência” pedida foi atendida no sentido de “um valor por material, sem somar registros”.

---

## 5. Teste manual sugerido

1. **Controle de Empenhos**
   - Filtrar por um material com vários registros (ex.: código **562898**).
   - Verificar que a coluna **ESTOQUE ALMOX** exibe **85.460** (ou o valor único da view para esse material), e não 256.380.
   - Confirmar que **ESTOQUE VIRTUAL** e **Cobertura estoque** estão coerentes com esse estoque.
   - Comparar com o valor de `qtde_em_estoque` de **uma** linha da `v_df_consumo_estoque` para o mesmo material (ex.: primeira ocorrência).

2. **Provisionamento**
   - Abrir um material que use `getTotaisEstoqueSaldo` e verificar se o estoque almox exibido bate com um único registro na view.

3. **Regressão**
   - Materiais com **um** registro devem continuar com o mesmo valor de antes (MAX = valor único).
   - Materiais sem registros/linhas na view continuam com estoque 0.

---

## 6. Resumo

| Aspecto | Antes | Depois |
|---------|--------|--------|
| Agregação estoque almox | SUM(qtde_em_estoque) | MAX(qtde_em_estoque) |
| Material 562898 (3 registros) | 256.380 (85.460 × 3) | 85.460 |
| Saldo empenhos | SUM (mantido) | SUM (mantido) |

A causa era a soma de `qtde_em_estoque` em todas as linhas da view para o mesmo material; a correção usa um único valor por material via `MAX(qtde_em_estoque)`.
