# Provisionamento: Filtro por registro e validação Qtde Pedida

## Resumo

Foram implementadas duas melhorias na tela **Provisionamento**:

1. **Filtro por número de registro** — Foi adicionado um **campo de texto (text-box)** dedicado **"Filtrar por número registro"**, além do filtro existente por código/descritivo. Os dois filtros podem ser usados em conjunto (lógica AND): primeiro por código ou descritivo, depois por número registro.
2. **Qtde pedida ≤ Saldo registro** — O campo **Qtde pedida** só aceita valores menores ou iguais ao **Saldo registro** da mesma linha; valores maiores são limitados automaticamente e o input exibe dica de valor máximo.

---

## 1. Causa raiz / Motivo

- **Filtro:** Não havia como filtrar linhas pelo número do registro (ex.: 64794, 64147), apenas por código ou descritivo do material.
- **Qtde pedida:** Não havia validação; o usuário podia informar quantidade maior que o saldo do registro, inconsistente com a regra de negócio (não pedir além do saldo disponível).

---

## 2. Correção implementada

### Backend
- Nenhuma alteração. Contratos da API mantidos.

### Frontend

**`frontend/src/hooks/useProvisionamento.ts`**
- **filtroNumeroRegistro:** Novo estado para o text-box dedicado ao número registro.
- **linhasFiltradas:** Aplica primeiro o filtro por código/descritivo (`filtroTabela`); em seguida aplica o filtro por número registro (`filtroNumeroRegistro`), quando preenchido (busca case-insensitive por substring no `numeroRegistro`).
- **updateLinha (qtdePedida):** Cálculo de `maxQtde = saldoRegistro ?? Infinity` e `qtde = Math.max(0, Math.min(raw, maxQtde))`, garantindo 0 ≤ qtde ≤ saldo registro.

**`frontend/src/pages/Provisionamento.tsx`**
- **Novo Input:** "Filtrar por número registro" (placeholder), ao lado do filtro por código/descritivo, com valor controlado por `filtroNumeroRegistro` / `setFiltroNumeroRegistro`.
- Placeholder do primeiro filtro mantido como *"Filtrar na tabela (código ou descritivo)"*.
- Contador "X de Y registro(s)" e mensagem "após filtro" passam a considerar os dois filtros.

---

## 3. Antes e depois

| Aspecto | Antes | Depois |
|--------|--------|--------|
| Filtro da tabela | Um único campo (código e descritivo) | Dois campos: **código/descritivo** + **número registro** (text-box dedicado) |
| Filtro por registro | Inexistente | **Text-box "Filtrar por número registro"** (aplica em conjunto com o outro filtro) |
| Qtde pedida | Qualquer valor ≥ 0 | Limitada a **0 ≤ valor ≤ Saldo registro** (quando saldo definido) |
| UX Qtde pedida | Sem indicação de teto | `max` no input + tooltip com valor máximo |

---

## 4. Efeitos colaterais

- Linhas com `saldoRegistro == null` continuam sem limite máximo no frontend (comportamento anterior mantido).
- Se o usuário colar ou digitar valor maior que o saldo, o valor é ajustado automaticamente para o saldo (sem toast), mantendo a interface consistente.

---

## 5. Teste manual sugerido

1. **Filtro por registro**
   - Abrir Provisionamento e carregar registros ativos (ou adicionar um material).
   - No **segundo** campo de filtro ("Filtrar por número registro"), digitar parte de um número de registro (ex.: `64794` ou `94`).
   - Verificar que apenas linhas cujo **Número registro** contém o texto permanecem na tabela.
   - Opcional: usar também o primeiro filtro (código/descritivo) e confirmar que os dois filtros se aplicam em conjunto (AND).
   - Limpar os filtros e conferir que a lista volta ao estado anterior.

2. **Qtde pedida ≤ Saldo registro**
   - Em uma linha com **Saldo registro** preenchido (ex.: 72,00), no campo **Qtde pedida**:
     - Digitar um valor maior (ex.: 100) e sair do campo: o valor deve permanecer ou ser corrigido para 72,00.
     - Passar o mouse sobre o campo: deve aparecer o tooltip "Máximo: 72,00 (saldo registro)".
   - Em uma linha com **Saldo registro** vazio (—), o campo Qtde pedida deve aceitar qualquer valor não negativo, sem tooltip de máximo.

---

## 6. Gravidade

**Médio** — Melhoria de usabilidade e conformidade com a regra de negócio (não permitir pedido acima do saldo do registro). Não corrige falha crítica de segurança; a validação no backend (se existir) permanece recomendada para requisições diretas à API.
