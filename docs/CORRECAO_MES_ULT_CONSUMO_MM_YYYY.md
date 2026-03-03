# Correção: Formato da coluna MÊS ÚLT CONSUMO (YY/YYYY → MM/YYYY)

## Classificação da gravidade

**Alto** — Dado exibido incorreto (mês trocado pelos dois últimos dígitos do ano), levando a interpretação errada do “último mês de consumo” pelo usuário.

---

## 1. Explicação técnica do problema

### Causa raiz

O valor **mesano** é um inteiro no formato **YYYYMM** (ex.: `202501` = janeiro de 2025). Na conversão para a string "MM/YYYY", o código usava **posições erradas** da string:

- Para `202501`, após `padStart(6,'0')` → `"202501"`.
- **Código incorreto:** `mm = str.substring(2, 4)` → `"25"` (posições 2 e 3 = dois últimos dígitos do ano).
- **Código incorreto:** `yyyy = str.substring(0, 4)` → `"2025"`.
- **Resultado exibido:** "25/2025" em vez de "01/2025".

Ou seja, o mês (MM) estava sendo extraído das posições 2–3 da string (parte do ano), e não das posições 4–5 (MM em YYYYMM).

### Onde ocorria

- **Frontend:** `frontend/src/utils/columnRenderers.tsx` — função `formatarMesano`, usada por `ColunaMesUltimoConsumoCell` na coluna "Mês últ consumo".
- **Backend:** `backend/src/utils/columnFormatters.ts` — função `formatarMesanoMMYYYY` (mesma lógica incorreta; usada em scripts/validação e possíveis relatórios).

---

## 2. Correção aplicada

Regra correta para uma string de 6 caracteres no formato **YYYYMM**:

- **YYYY** = `str.substring(0, 4)`
- **MM**   = `str.substring(4, 6)`

### Antes

```ts
const str = String(n).padStart(6, '0');
const mm = str.substring(2, 4);   // ERRADO: "25" para 202501
const yyyy = str.substring(0, 4);
return `${mm}/${yyyy}`;
```

### Depois

```ts
const str = String(n).padStart(6, '0');
const yyyy = str.substring(0, 4);
const mm = str.substring(4, 6);   // CORRETO: "01" para 202501
return `${mm}/${yyyy}`;
```

### Arquivos alterados

| Arquivo | Função | Alteração |
|---------|--------|-----------|
| `frontend/src/utils/columnRenderers.tsx` | `formatarMesano` | `mm = str.substring(4, 6)` |
| `backend/src/utils/columnFormatters.ts` | `formatarMesanoMMYYYY` | `mm = str.substring(4, 6)` |

---

## 3. Contratos e impacto

- **API:** Nenhuma alteração. O backend continua enviando `mesUltimoConsumo` como número (YYYYMM); apenas a formatação em string no frontend e no backend foi corrigida.
- **Tipagem:** Inalterada.
- **Outros usos:** Qualquer uso de `formatarMesano` ou `formatarMesanoMMYYYY` passa a exibir MM/YYYY corretamente (cabeçalhos de consumo, scripts de validação, etc.).

---

## 4. Possíveis efeitos colaterais

- **Positivo:** Relatórios ou scripts que usem `formatarMesanoMMYYYY` no backend passam a mostrar datas corretas.
- **Risco:** Nenhum identificado; a correção apenas alinha a exibição ao padrão YYYYMM já utilizado no sistema.

---

## 5. Teste manual sugerido

1. Abrir a tela **Controle de Empenhos**.
2. Localizar a coluna **MÊS ÚLT CONSUMO**.
3. Verificar que os valores estão no formato **MM/YYYY** (ex.: "01/2025", "02/2026", "12/2024"), com mês entre 01 e 12.
4. Confirmar que não aparecem mais valores como "25/2025" ou "26/2026" (que seriam ano no lugar do mês).
5. (Opcional) Executar o script de validação de colunas 6–12 no backend, se existir, e conferir que os casos de `formatarMesanoMMYYYY` continuam passando com o novo formato MM/YYYY.

---

## 6. Resumo

| Aspecto | Antes | Depois |
|---------|--------|--------|
| Exemplo 202501 | "25/2025" | "01/2025" |
| Exemplo 202612 | "26/2026" | "12/2026" |
| Interpretação | Incorreta (YY/YYYY) | Correta (MM/YYYY) |

A causa era apenas a extração do mês com `substring(2, 4)` em vez de `substring(4, 6)` na representação string de YYYYMM.
