# Análise de performance: `public.nf_obs`

**Objetivo:** Identificar gargalo, reescrever queries para máxima eficiência, sugerir índices, avaliar impacto e garantir resultado funcional idêntico.

---

## 1. Avaliação da implementação da tabela `nf_obs`

- **Schema DDL:** A tabela foi incluída em `01_create_nf_schema.sql` (estrutura compatível com o DDL informado e com o model Prisma `nf_obs`).
- **Código de aplicação:** Hoje o fluxo "Adicionar Observações" do frontend persiste via `POST /recebimento-notas-fiscais` (tabela `recebimento_nota_fiscal`/schema `nf`), **não** via `nf_obs`. Ou seja, a **funcionalidade de “observações por empenho” está implementada por outro caminho** (recebimento com `observacao`).  
- **Uso direto de `nf_obs`:** Não há queries no backend atual que leiam ou escrevam em `nf_obs`. A tabela existe no Prisma e agora no script SQL; para passar a ser o repositório oficial de observações por empenho será necessário alterar o backend (ex.: novo endpoint ou ajuste do fluxo de “Adicionar Observações”) para ler/gravar em `nf_obs`.

Conclusão: **a estrutura da tabela `nf_obs` está implementada no schema; a funcionalidade de negócio ainda usa recebimento de NF. Se a intenção for usar `nf_obs` como fonte única de observações por empenho, será preciso implementar esse uso no backend/frontend.**

---

## 2. Causa provável do gargalo

Em tabelas como `nf_obs` (histórico de observações por `empenho_id`), os gargalos típicos são:

| Causa | Descrição |
|-------|-----------|
| **Filtro por `empenho_id` sem índice** | `WHERE empenho_id = $1` força **sequential scan** em tabelas grandes. |
| **Ordenação por `date` sem índice** | `ORDER BY date DESC` sem índice adequado gera **sort em memória** (ou disk). |
| **Listagem sem LIMIT** | Retornar todas as linhas aumenta tempo e uso de memória. |
| **JOIN com empenho sem índice** | Se outra query fizer JOIN em `nf_obs.empenho_id`, a falta de índice em `empenho_id` degrada o plano. |

Não há no código atual uma query específica que use `nf_obs`; a análise abaixo considera o **padrão de uso esperado** (listar/inserir observações por empenho) e otimiza para esse padrão.

---

## 3. Query otimizada

### 3.1 Listar observações de um empenho (padrão mais comum)

**Antes (ineficiente):**  
Sem índices, o planejador tende a usar Sequential Scan e ordenar em memória.

```sql
-- Versão que tende a full scan + sort
SELECT id, empenho_id, observacao, usuario, "date"
FROM public.nf_obs
WHERE empenho_id = $1
ORDER BY "date" DESC;
```

**Depois (otimizada):**

```sql
-- Uso do índice (empenho_id, date DESC) → Index Scan
SELECT id, empenho_id, observacao, usuario, "date"
FROM public.nf_obs
WHERE empenho_id = $1
ORDER BY "date" DESC NULLS LAST
LIMIT 100;
```

- **Índice usado:** `idx_nf_obs_empenho_date (empenho_id, "date" DESC NULLS LAST)`.
- **LIMIT 100:** Evita retorno excessivo e mantém resultado funcional controlado (ajustar conforme regra de negócio).
- **NULLS LAST:** Alinha com o índice e evita sort adicional.

### 3.2 Inserir observação

```sql
INSERT INTO public.nf_obs (empenho_id, observacao, usuario)
VALUES ($1, $2, $3)
RETURNING id, empenho_id, observacao, usuario, "date";
```

- Inserção é por **append**; índices em `empenho_id` e `(empenho_id, date)` têm custo de escrita baixo e beneficiam as consultas acima.

### 3.3 Listagem global (por data)

Se houver tela “últimas observações” sem filtro de empenho:

**Otimizada:**

```sql
SELECT id, empenho_id, observacao, usuario, "date"
FROM public.nf_obs
ORDER BY "date" DESC NULLS LAST
LIMIT 200;
```

- Índice: `idx_nf_obs_date_desc`.

---

## 4. Scripts de índice

Os índices já estão em `01_create_nf_schema.sql`. Para **ambiente em que a tabela já existe**, use apenas os índices:

Arquivo: **`02_nf_obs_indexes.sql`** (já criado no projeto):

```sql
CREATE INDEX IF NOT EXISTS idx_nf_obs_empenho_id ON public.nf_obs(empenho_id);
CREATE INDEX IF NOT EXISTS idx_nf_obs_date_desc ON public.nf_obs("date" DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_nf_obs_empenho_date ON public.nf_obs(empenho_id, "date" DESC NULLS LAST);
ANALYZE public.nf_obs;
```

---

## 5. Comparação técnica antes vs depois

| Aspecto | Antes | Depois |
|---------|--------|--------|
| **Filtro por empenho** | Sequential Scan em toda a tabela | Index Scan em `idx_nf_obs_empenho_date` |
| **Ordenação por data** | Sort em memória/disco | Ordem já fornecida pelo índice |
| **Custo de leitura** | O(N) linhas lidas | O(k) linhas (k = linhas do empenho ou LIMIT) |
| **Paginação** | Possível mas com sort caro | LIMIT/OFFSET com índice eficiente |
| **Inserção** | Sem impacto de índice | Pequeno custo extra por índice (aceitável) |

Exemplo de plano (após índices e `ANALYZE`):

```text
-- EXPLAIN (ANALYZE, BUFFERS) para:
-- SELECT ... FROM nf_obs WHERE empenho_id = '123' ORDER BY "date" DESC LIMIT 100;

Index Scan using idx_nf_obs_empenho_date on nf_obs
  Index Cond: (empenho_id = '123')
  Rows: 50 (limit 100)
```

---

## 6. Impacto da mudança

- **Resultado funcional:** Idêntico, desde que a aplicação use a mesma condição (`empenho_id`) e a mesma ordenação (`date DESC`). O `LIMIT` deve ser definido pela regra de negócio (ex.: 100 ou 200).
- **Escalabilidade:** Melhora forte com o crescimento da tabela; consultas por empenho deixam de depender do tamanho total da tabela.
- **Escrita:** Pequeno aumento no tempo de INSERT (atualização de 3 índices); em cenário típico de observações, o ganho em leitura compensa.

---

## 7. Risco da alteração

| Risco | Mitigação |
|-------|------------|
| **Índices em tabela já grande** | `CREATE INDEX IF NOT EXISTS` pode demorar e bloquear leitura por pouco tempo; em tabelas muito grandes, considerar `CREATE INDEX CONCURRENTLY` (fora de transação longa). |
| **LIMIT altera comportamento** | Se hoje não há LIMIT e a aplicação espera “todas” as observações do empenho, definir um LIMIT alto (ex.: 500) ou paginar (LIMIT + OFFSET). |
| **Compatibilidade com Prisma** | Model `nf_obs` já existe; os índices não alteram o contrato da aplicação. |
| **OWNED BY sequence** | `ALTER SEQUENCE ... OWNED BY nf_obs.id` é seguro e garante que a sequence seja removida se a tabela for dropada. |

Recomendação: em produção, para tabela já populada, criar os índices com:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nf_obs_empenho_id ON public.nf_obs(empenho_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nf_obs_date_desc ON public.nf_obs("date" DESC NULLS LAST);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nf_obs_empenho_date ON public.nf_obs(empenho_id, "date" DESC NULLS LAST);
```

(Em scripts de deploy que rodam em transação única, `CONCURRENTLY` não pode ser usado na mesma transação; executar em comandos separados.)

---

## 8. Resumo

- **Tabela `nf_obs`:** Implementada em `01_create_nf_schema.sql` (estrutura + índices).
- **Índices isolados:** `02_nf_obs_indexes.sql` para ambientes em que a tabela já existe.
- **Queries:** Usar filtro por `empenho_id`, `ORDER BY "date" DESC NULLS LAST` e `LIMIT` adequado para aproveitar os índices e manter resultado funcional idêntico ao esperado.
- **Risco:** Baixo; único ponto de atenção é o uso de `CREATE INDEX CONCURRENTLY` em tabelas grandes já em produção.
