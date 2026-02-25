# Plano de Desenvolvimento – Sistema de Controle de Empenhos e Estoque

## Etapas concluídas

| Etapa | Descrição |
|-------|-----------|
| 1 | Setup backend, Prisma, schema `ctrl`, migrations, seed (perfis + admin) |
| 2 | Autenticação e autorização (JWT, login, registro, frontend: AuthContext, PrivateRoute, sidebar) |
| 3 | API Controle de Empenhos (dashboard, itens com filtros, histórico) |
| 4 | Tela Controle de Empenhos (dashboard, filtros, tabela, paginação, edição e salvar histórico) |
| 5 | Módulo Provisionamento (busca material, formulário, geração de PDF) |

## Etapas implementadas nesta entrega

| Etapa | Descrição |
|-------|-----------|
| 6 | **Movimentação Diária** – API e tela para consulta de movimentações por data (view `v_df_movimento`) |
| 7 | **Empenhos Pendentes** – API e tela para listagem de empenhos em aberto (tabela `public.empenho`; critérios: status_item ≠ "Atendido", fl_evento = "Empenho") |
| 8 | **UI/UX** – Estados de carregamento (Skeleton/Spinner), empty states, links no menu, "Tentar novamente" em erro |

## Funcionalidades do plano inicial (complementos)

| Item | Descrição |
|------|-----------|
| Resumo na home | Página **Início** exibe os 4 cards do Controle de Empenhos (Materiais, Pendências, Atenção, Crítico) via API `/controle-empenhos/dashboard` |
| Movimentação Diária | Label "Período consultado: Mês/Ano"; estado de erro com botão "Tentar novamente" |
| Empenhos Pendentes | Estado de erro com botão "Tentar novamente"; filtros por código e empenho |

## Fase 9 – Qualidade e operação ✅

| # | Item | Status |
|---|------|--------|
| 9.1 | **Exportação CSV** – Botão "Exportar CSV" na tela Empenhos Pendentes (dados atuais da tabela) | ✅ Implementado |
| 9.2 | Documentação dos endpoints da API (README ou Swagger) | ✅ Implementado (backend/API.md) |
| 9.3 | .env.example completo com todas as variáveis utilizadas | ✅ Implementado (backend + frontend) |
| 9.4 | Respostas de erro padronizadas (JSON com código e mensagem) | ✅ Implementado (utils/errorResponse, todos os controllers) |

## Fase 10 – Melhorias de uso ✅

| # | Item | Status |
|---|------|--------|
| 10.1 | **Exportação CSV** na tela Movimentação Diária (dados do período consultado) | ✅ Implementado |
| 10.2 | **Exportação CSV** na tela Provisionamento (dados atuais da tabela virtual) | ✅ Implementado |
| 10.3 | **Estado de erro** na tela Provisionamento com botão "Tentar novamente" ao falhar o carregamento | ✅ Implementado |

## Dependências de dados (DW)

- **v_df_movimento**: para Movimentação Diária, a view deve expor filtro por data (ex.: coluna `data_movimento` ou `dt_movimento` em nível dia). Se existir apenas `mesano`, a API pode filtrar por mês.
- **v_safs_fempenho**: para Empenhos Pendentes (ex.: `mat_cod_antigo`, `numero_pre_empenho`, `valor`, `situacao`).

## Fase 11 – Testes (sugestão)

| # | Item | Status |
|---|------|--------|
| 11.1 | Testes automatizados (unitários e/ou integração para APIs e serviços) | Pendente |

## Fase 12 – Paginação Provisionamento ✅

| # | Item | Status |
|---|------|--------|
| 12.1 | Paginação client-side na tela Provisionamento (50 itens por página; Anterior/Próxima) | ✅ Implementado |

## Fase 13 – Filtro local Provisionamento ✅

| # | Item | Status |
|---|------|--------|
| 13.1 | Filtro local na tabela de Provisionamento (por código ou descritivo nas linhas já carregadas) | ✅ Implementado |
