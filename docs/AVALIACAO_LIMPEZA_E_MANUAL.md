# Avaliação: Limpeza de Arquivos e Manual de Uso

## 1. Remoção de arquivos desnecessários

### 1.1 Visão geral

Foram identificados **arquivos na raiz do projeto** que são documentação de implementação/auditoria e que podem ser consolidados ou movidos para não poluir a raiz. Nenhum arquivo de **código-fonte** foi indicado para remoção sem revisão prévia.

### 1.2 Documentação na raiz (recomendações)

| Arquivo | Recomendação | Justificativa |
|--------|---------------|----------------|
| **README.md** | Manter na raiz | Ponto de entrada do projeto; deve permanecer visível. |
| **INICIO_RAPIDO.md** | Mover para `docs/` ou remover | Conteúdo específico da implementação "colunas 6–12"; referência a outros .md que também podem ser consolidados. |
| **GUIA_RAPIDO_COLUNAS_6_12.md** | Mover para `docs/guia-colunas-6-12.md` | Guia de teste de uma feature; faz mais sentido em `docs/`. |
| **IMPLEMENTACAO_COLUNAS_6_12.md** | Mover para `docs/` | Documentação técnica de implementação. |
| **RESUMO_IMPLEMENTACAO_COLUNAS.md** | Mover para `docs/` ou fundir com IMPLEMENTACAO_COLUNAS_6_12 | Conteúdo relacionado às colunas 6–12. |
| **STATUS_FINAL_IMPLEMENTACAO.md** | Mover para `docs/` ou arquivar | Relatório de status; pode ser histórico em `docs/historico/`. |
| **SUMARIO_IMPLEMENTACAO_FINAL.md** | Mover para `docs/` ou remover | Índice da implementação colunas 6–12; redundante se outros .md forem movidos. |
| **LISTA_ARQUIVOS_ENVOLVIDOS.md** | Mover para `docs/` | Lista de arquivos de uma implementação. |
| **CLEANUP_REPORT.md** | Mover para `docs/historico/` ou `docs/` | Relatório de limpeza (ex.: Dark Mode); valor histórico. |
| **AUDITORIA_PROJETO.md** | Manter ou mover para `docs/` | Útil para onboarding; pode ficar em `docs/auditoria.md`. |
| **PLANO_DE_DESENVOLVIMENTO.md** | Mover para `docs/` | Planejamento; típico em `docs/`. |
| **RELATORIO_FINAL.md** | Mover para `docs/historico/` | Relatório pontual; histórico. |
| **ENTERPRISE_FEATURES.md** | Mover para `docs/` | Documentação de funcionalidades; `docs/enterprise-features.md`. |

**Ação sugerida (resumida):**

- **Manter na raiz:** apenas `README.md` (e, se existir, `.env.example` na raiz).
- **Mover para `docs/`:** todos os .md de implementação, guias e planejamento listados acima.
- **Opcional:** criar `docs/historico/` para CLEANUP_REPORT, RELATORIO_FINAL, STATUS_FINAL_IMPLEMENTACAO (evita misturar com documentação ativa).

### 1.3 Documentação já em `docs/`

Manter como está; são documentações de correção/implementação ativas:

- `docs/IMPLEMENTACAO_ADICIONAR_OBSERVACOES_NF_OBS.md`
- `docs/IMPLEMENTACAO_LISTA_EMPENHOS_REGISTRAR_RECEBIMENTO.md`
- `docs/CORRECAO_LISTA_RECEBIMENTOS_NF_EMPENHO.md`
- `docs/CORRECAO_EDITAR_RECEBIMENTO_FILTRO.md`

### 1.4 Outros arquivos

- **frontend:** não há `vite.config.js` nem `vite.config.d.ts` em uso (apenas `vite.config.ts`); se ainda existirem no repositório, podem ser removidos.
- **Backend/Frontend:** não foram encontrados arquivos de código claramente duplicados ou obsoletos; qualquer remoção adicional deve ser feita após busca por referências (ex.: `columnRenderers.tsx` citado em INICIO_RAPIDO — confirmar se ainda é usado).

### 1.5 Riscos da limpeza

- **Mover .md:** não quebra build nem runtime; apenas reorganiza documentação.
- **Remover .md:** perda de histórico; prefira mover para `docs/` ou `docs/historico/` em vez de apagar.
- **Remover código:** só após verificar imports e testes; não recomendado em massa sem análise.

---

## 2. Tutorial / Manual de uso

### 2.1 Objetivo

Fornecer um **manual de uso** (tutorial) para usuários finais e/ou suporte, cobrindo as telas principais e fluxos da aplicação, sem substituir a documentação técnica (README, API, implementações em `docs/`).

### 2.2 Público-alvo

- Usuários que utilizam o sistema no dia a dia (controle de empenhos, provisionamento, listas, recebimentos).
- Suporte e treinamento interno.
- Opcional: administradores (login, perfis, primeiro acesso).

### 2.3 Estrutura sugerida do manual

Sugestão de documento único em Markdown (ex.: `docs/MANUAL_DE_USO.md`) ou pasta `docs/manual/` com um arquivo por módulo:

**Opção A — Arquivo único `docs/MANUAL_DE_USO.md`:**

```markdown
# Manual de Uso – Controle de Empenhos e Estoque

## 1. Acesso ao sistema
- URL, login (admin/senha inicial se aplicável), primeiro acesso.

## 2. Visão geral do menu
- Início / Dashboard
- Controle de Empenhos
- Movimentação Diária
- Empenhos Pendentes
- Provisionamento
- Analytics
- (Divisor)
- Lista de Empenhos
- Lista de Recebimentos
- Adicionar Observações
- Editar Recebimento

## 3. Controle de Empenhos
- Objetivo da tela, filtros, colunas principais, ações (se houver).

## 4. Movimentação Diária
- Uso da tela e principais campos.

## 5. Empenhos Pendentes
- Busca por código/empenho, interpretação da lista.

## 6. Provisionamento
- O que é, como usar, exportação (PDF/Excel se existir).

## 7. Analytics
- Métricas exibidas e como interpretar.

## 8. Lista de Empenhos (Plataforma)
- Filtros (Master, Empenho), colunas, Qtde receb e Observação.
- Checkbox, botões Registrar Recebimento e Cancelar (quando aparecem e como usar).
- Exportar PDF/Excel.

## 9. Lista de Recebimentos
- Filtros, colunas, paginação, exportação.

## 10. Adicionar Observações
- Campo empenho (texto), observação (limites de caracteres), Salvar/Cancelar/Limpar.

## 11. Editar Recebimento
- Filtros, edição de itens, salvamento.

## 12. Dúvidas frequentes / Problemas comuns
- Ex.: “Servidor indisponível”, backend não inicia, esquecimento de senha.
```

**Opção B — Pasta `docs/manual/`:**
- `01-acesso.md` — Acesso e menu.
- `02-controle-empenhos.md` — Controle de Empenhos.
- `03-movimentacao-empenhos-pendentes.md` — Movimentação Diária e Empenhos Pendentes.
- `04-provisionamento-analytics.md` — Provisionamento e Analytics.
- `05-plataforma-listas.md` — Lista de Empenhos e Lista de Recebimentos.
- `06-observacoes-editar-recebimento.md` — Adicionar Observações e Editar Recebimento.
- `07-faq.md` — Dúvidas frequentes.

### 2.4 Onde referenciar o manual

- No **README.md** da raiz: adicionar uma seção “Documentação” com link para `docs/MANUAL_DE_USO.md` (ou para `docs/manual/`).
- Opcional: no frontend, link “Manual de uso” no rodapé ou no menu (ex.: ícone de ajuda) apontando para o arquivo ou para uma página que renderize o Markdown.

### 2.5 Manutenção

- Atualizar o manual quando houver nova tela ou mudança relevante de fluxo.
- Manter linguagem simples e orientada a tarefas (passo a passo).
- Incluir capturas de tela apenas se necessário (evitar muitas imagens no repositório; considerar hospedagem externa ou pasta `docs/assets/`).

---

## 3. Próximos passos sugeridos

1. **Limpeza:** Mover os .md da raiz listados na tabela para `docs/` (e opcionalmente `docs/historico/`), e atualizar o README se citar algum deles.
2. **Manual:** Criar `docs/MANUAL_DE_USO.md` com a estrutura da Opção A (ou os arquivos da Opção B) e preencher com o conteúdo das telas atuais.
3. **README:** Incluir link para o manual em “Documentação” ou “Para usuários”.
4. **Revisão:** Confirmar se `columnRenderers.tsx` e scripts de validação das colunas 6–12 ainda são usados antes de remover qualquer referência no código.

Se quiser, posso gerar o esqueleto de `docs/MANUAL_DE_USO.md` (títulos e parágrafos placeholder) para você preencher com os textos finais.
