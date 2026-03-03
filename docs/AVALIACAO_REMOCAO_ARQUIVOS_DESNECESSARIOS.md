# Avaliação: Remoção de Arquivos Desnecessários

## Resumo

Esta avaliação identifica arquivos que podem ser **removidos** ou **reorganizados** sem impacto em build ou runtime. A base é o projeto atual e o conteúdo de `docs/AVALIACAO_LIMPEZA_E_MANUAL.md`.

---

## 1. Arquivos que podem ser removidos

### 1.1 Código não referenciado

| Arquivo | Motivo | Ação sugerida |
|---------|--------|----------------|
| **`backend/src/repositories/fempenhoRepository.ts`** | Nenhum import em todo o projeto. Contém funções para a view `v_safs_fempenho` (pré-empenho). O fluxo atual usa `empenhoRepository.ts` (que exporta `getNumeroPreEmpenhoPorMastersERegistros`). | **Remover** se a view `v_safs_fempenho` não for usada em nenhum fluxo planejado. Caso seja código reservado para uso futuro, **manter** e documentar em comentário no topo do arquivo ou mover para pasta `backend/src/repositories/_legacy/` ou similar. |

### 1.2 Configuração frontend (já tratado)

- **`frontend/vite.config.js`** e **`frontend/vite.config.d.ts`** — Conforme `docs/AVALIACAO_LIMPEZA_E_MANUAL.md` e status do repositório, esses arquivos já foram removidos; o projeto usa apenas **`frontend/vite.config.ts`**. Nenhuma ação adicional.

---

## 2. Documentação na raiz — reorganizar (não apagar)

A raiz do projeto contém vários `.md` de implementação/auditoria que poluem a pasta. **Recomenda-se mover para `docs/`** (ou `docs/historico/`) em vez de excluir, para preservar histórico.

| Arquivo na raiz | Recomendação | Observação |
|-----------------|--------------|------------|
| **README.md** | **Manter** | Ponto de entrada do projeto. |
| **INICIO_RAPIDO.md** | Mover para `docs/` | Guia de início rápido / colunas 6–12. |
| **GUIA_RAPIDO_COLUNAS_6_12.md** | Mover para `docs/` | Guia de teste da feature. |
| **IMPLEMENTACAO_COLUNAS_6_12.md** | Mover para `docs/` | Documentação técnica. |
| **RESUMO_IMPLEMENTACAO_COLUNAS.md** | Mover para `docs/` ou fundir | Relacionado às colunas 6–12. |
| **STATUS_FINAL_IMPLEMENTACAO.md** | Mover para `docs/historico/` | Relatório de status (histórico). |
| **SUMARIO_IMPLEMENTACAO_FINAL.md** | Mover para `docs/` ou remover | Índice; pode ser redundante. |
| **LISTA_ARQUIVOS_ENVOLVIDOS.md** | Mover para `docs/` | Lista de arquivos de implementação. |
| **CLEANUP_REPORT.md** | Mover para `docs/historico/` | Relatório de limpeza (ex.: Dark Mode). |
| **AUDITORIA_PROJETO.md** | Mover para `docs/auditoria.md` | Útil para onboarding. |
| **PLANO_DE_DESENVOLVIMENTO.md** | Mover para `docs/` | Planejamento. |
| **RELATORIO_FINAL.md** | Mover para `docs/historico/` | Relatório pontual. |
| **ENTERPRISE_FEATURES.md** | Mover para `docs/` | Funcionalidades enterprise. |

**Ação resumida:** Manter na raiz apenas **README.md**. Criar **`docs/historico/`** (opcional) para CLEANUP_REPORT, RELATORIO_FINAL, STATUS_FINAL_IMPLEMENTACAO. Os demais mover para **`docs/`**. Após mover, atualizar o **README.md** na seção "Documentação" se algum link apontar para esses arquivos na raiz.

---

## 3. Documentação já em `docs/`

Manter como está; são documentações de correção/implementação ativas e referenciadas:

- `docs/MANUAL_DE_USO.md`
- `docs/AVALIACAO_LIMPEZA_E_MANUAL.md`
- `docs/AVALIACAO_FILTRO_CLASSIFICACAO.md`
- `docs/CORRECAO_*` e `docs/IMPLEMENTACAO_*`
- `docs/ALTERACAO_PAGINACAO_EXPORT_EXCEL_CONTROLE_EMPENHOS.md`
- `docs/PROVISIONAMENTO_FILTRO_E_QTDE_PEDIDA.md`
- etc.

Nenhum deles é candidato à remoção sem revisão de conteúdo.

---

## 4. Outros diretórios

- **backend/database/nf/** — README e scripts SQL (NF, nf_obs) fazem parte do fluxo de schema/migrations; **manter**.
- **backend/database/optimizations/** — README e scripts de índices; **manter**.
- **backend/scripts/** — Scripts de fix (run-fix-*, run-init-nf-schema) usados em npm scripts; **manter**.

Não há arquivos obsoletos identificados nessas pastas.

---

## 5. Riscos

| Ação | Risco |
|------|--------|
| Remover `.md` da raiz sem mover | Perda de histórico; links quebrados se algo referenciar. |
| Remover `fempenhoRepository.ts` | Se no futuro for necessário usar `v_safs_fempenho`, será preciso recriar ou recuperar do histórico (git). |
| Mover `.md` para `docs/` | Risco baixo; apenas atualizar links no README ou em outros .md se existirem. |

---

## 6. Próximos passos sugeridos

1. **Decisão sobre `fempenhoRepository.ts`:** Confirmar com o time se a view `v_safs_fempenho` será usada. Se não, remover o arquivo; se sim, manter e documentar.
2. **Reorganizar documentação:** Mover os .md listados na tabela da seção 2 para `docs/` (e opcionalmente `docs/historico/`).
3. **README:** Revisar a seção "Documentação" e ajustar links para os novos caminhos em `docs/`.
4. **Não remover** arquivos de código sem verificar imports e testes; a única exceção analisada foi `fempenhoRepository.ts`, que não é referenciado.

---

## 7. Classificação

- **Remoção de código não usado (`fempenhoRepository.ts`):** **Baixo** — reduz ruído e dúvida; risco apenas se o arquivo for necessário no futuro.
- **Reorganização de .md (mover para `docs/`):** **Baixo** — melhora organização; sem impacto em build/runtime.
