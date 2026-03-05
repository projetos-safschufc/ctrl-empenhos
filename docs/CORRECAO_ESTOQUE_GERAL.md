# Correção: Coluna ESTOQUE GERAL na tela Controle de Empenhos

## Resumo

A coluna **ESTOQUE GERAL** na tela Controle de Empenhos aparecia sempre com "-" porque a consulta ao DW usava a coluna errada na view `v_df_estoque` para o schema **gad_dlih_safs**. Foi ajustado o repositório para usar `nome_do_material_padronizado` quando `DW_SCHEMA=gad_dlih_safs`, permitindo o relacionamento correto com `codigo_padronizado` (parte antes de "-") da `v_df_consumo_estoque`.

## Causa raiz

- O valor de ESTOQUE GERAL é a **soma da coluna `saldo`** da view **`v_df_estoque`** (schema `gad_dlih_safs`) **por material**.
- O relacionamento com a tela de Controle de Empenhos (que usa dados de `v_df_consumo_estoque`) é: **código antes do "-"** de `codigo_padronizado` = **código antes do "-"** de `nome_do_material_padronizado`.
- No código, o repositório de estoque (`estoqueRepository.ts`) usava **sempre** a coluna padrão `mat_cod_antigo` na view `v_df_estoque`. No schema **gad_dlih_safs** a view expõe **`nome_do_material_padronizado`**, não `mat_cod_antigo`. Com isso, a condição `WHERE` não encontrava linhas (ou usava coluna inexistente/errada) e o mapa de estoque geral voltava vazio, resultando em "-" na coluna.

## Alteração realizada

**Arquivo:** `backend/src/repositories/estoqueRepository.ts`

- Definição da coluna de material na `v_df_estoque` passou a depender do schema:
  - Se **`DW_SCHEMA=gad_dlih_safs`**: default **`nome_do_material_padronizado`** (relaciona com `codigo_padronizado` antes de "-").
  - Caso contrário: **`mat_cod_antigo`** (comportamento anterior).
- Continua respeitando `DW_ESTOQUE_MATERIAL_COLUMN` e `DW_MATERIAL_COLUMN` quando definidos no `.env`.
- Comentários atualizados para deixar explícito o relacionamento entre as views.

**Arquivo:** `backend/.env.example`

- Incluído comentário e exemplo para `DW_ESTOQUE_MATERIAL_COLUMN` (v_df_estoque / Estoque geral), documentando o uso de `nome_do_material_padronizado` no schema gad_dlih_safs.

## Antes e depois

| Aspecto | Antes | Depois |
|--------|--------|--------|
| Coluna usada em `v_df_estoque` (gad_dlih_safs) | `mat_cod_antigo` (fixo) | `nome_do_material_padronizado` (default quando `DW_SCHEMA=gad_dlih_safs`) |
| Match com itens da tela | Não (coluna inexistente ou sem match) | Sim (código antes de "-" = codigo_padronizado) |
| Coluna ESTOQUE GERAL na UI | "-" | Soma de `saldo` por material |

## Efeitos colaterais

- **Nenhum** para ambientes que já usam `gad_dlih_safs`: a view já possui `nome_do_material_padronizado`; apenas passamos a usá-la.
- Para outros schemas: comportamento inalterado (continua `mat_cod_antigo`).
- Se em algum ambiente com `gad_dlih_safs` existir override explícito `DW_ESTOQUE_MATERIAL_COLUMN=mat_cod_antigo`, esse override continua prevalecendo.

## Teste manual sugerido

1. Garantir `DW_SCHEMA=gad_dlih_safs` (e conexão DW correta) no `.env` do backend.
2. Abrir a tela **Controle de Empenhos** e aplicar filtros se necessário.
3. Verificar que a coluna **ESTOQUE GERAL** passa a exibir valores numéricos (soma de `saldo` por material) onde houver dados em `v_df_estoque` para o código (antes do "-") do item.
4. Itens sem registro em `v_df_estoque` podem continuar com "-" ou zero, conforme regra atual.

## Gravidade

**Médio:** Funcionalidade de exibição de estoque geral não operava no schema gad_dlih_safs; não havia perda de dados nem quebra de outras telas.
