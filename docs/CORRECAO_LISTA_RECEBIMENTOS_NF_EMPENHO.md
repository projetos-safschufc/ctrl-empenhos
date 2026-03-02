# Correção: Lista de Recebimentos — dados de public.nf_empenho sem slice

## Classificação da gravidade do erro

**Médio** — A tela "Lista de Recebimentos" exibia dados do módulo **recebimento_nota_fiscal** (NF) com um limite artificial (slider "Número máximo de registros" e texto "limitado a X"), em vez de exibir diretamente os dados da tabela **public.nf_empenho** sem slice, conforme a regra de negócio.

---

## 1. Explicação técnica do problema

### Causa raiz

1. **Fonte de dados incorreta**  
   A tela consumia a API **`/recebimento-notas-fiscais`**, que lê das tabelas do módulo NF (`recebimento_nota_fiscal` / `item_recebimento_nf`), e não da tabela **public.nf_empenho**. Os campos exibidos eram mapeados de forma artificial (ex.: Item = "1", Código = id, Material = fornecedor_nome, Qtde Receb = "—").

2. **Slice/limite artificial**  
   Um **slider** ("Número máximo de registros", 100–5000) definia o `pageSize` da requisição e o texto "Registros encontrados: X (limitado a Y)" reforçava um limite arbitrário. A regra pede exibir os dados de **public.nf_empenho** **sem** esse tipo de slice na interface.

3. **Colunas não preenchidas a partir do banco**  
   Como a origem era recebimento-notas-fiscais, colunas como Item, Código, Material, Qtde Receb e Usuário não vinham de nf_empenho e apareciam com valores fixos ou "—".

### Motivo técnico do erro

- **Backend:** Não existia endpoint que listasse **public.nf_empenho** com todas as colunas necessárias para a listagem e com filtros opcionais (fornecedor, empenho, código).
- **Frontend:** Uso da API de recebimento de NF + controle de “número máximo de registros” (slider) e exibição de “limitado a X”, em desacordo com “apenas exiba os dados da tabela public.nf_empenho, semelhante ao exibido na imagem” e “sem o SLICE”.

---

## 2. Correção implementada

### Backend

- **Novo endpoint GET /nf-empenho/lista**  
  - Lista **public.nf_empenho** com filtros **opcionais**: `fornecedor`, `empenho`, `codigo`.  
  - Paginação: `page`, `pageSize` (máx. 500 por página; padrão 100).  
  - Retorno: id, fornecedor_nome, data_recebimento, numero_nf (empenho), item, codigo, material, valor_total (saldo_emp), qtde_receb, status (situacao), usuario.  
  - **Sem** exigência de filtro e **sem** slice/limite adicional na API; apenas paginação padrão.

- **Repositório**  
  - Nova função `listNfEmpenhoParaLista(filters)` em `nfEmpenhoRepository.ts`, com `select` incluindo fornecedor, data, empenho, item, codigo, material, saldo_emp, qtde_receb, situacao, usuario.  
  - Filtros opcionais: quando todos vazios, lista todos os registros (com paginação).

- **Rota**  
  - `GET /nf-empenho/lista` registrada **antes** de `GET /nf-empenho` e `PATCH /nf-empenho/:id` para não alterar o contrato da tela "Editar Recebimento".

### Frontend

- **API**  
  - Nova função **`fetchListaRecebimentosNfEmpenho`** que chama `GET /nf-empenho/lista` com `fornecedor`, `empenho`, `codigo`, `page`, `pageSize`.  
  - Tipo **ListaRecebimentoItem** estendido com `item`, `codigo`, `material`, `qtde_receb`, `usuario` e `valor_total` aceitando number para compatibilidade com a resposta da lista.

- **Hook useListaRecebimentos**  
  - Passa a usar **fetchListaRecebimentosNfEmpenho** em vez de **fetchListaRecebimentos** (recebimento-notas-fiscais).  
  - **pageSize** fixo em **100** (sem uso de REGISTROS_SLIDER).

- **Página ListaRecebimentos**  
  - **Removidos** o slider ("Número máximo de registros"), o estado `sliderValue` e o texto "Registros encontrados: X (limitado a Y)".  
  - **Incluído** texto: "Exibindo X a Y de Z registros" (paginação clara, sem noção de “limitado a”).  
  - Tabela passando a usar os campos reais da resposta: **ID, Fornecedor, Data, Empenho, Item, Código, Material, Saldo Emp, Qtde Receb, Situação, Usuário**, todos vindos de **public.nf_empenho**.  
  - Paginação (Anterior/Próxima) chama `load()` com os filtros atuais e `pageOverride`, para carregar a página correta.  
  - Export PDF/Excel continua usando as mesmas colunas, agora preenchidas com dados de nf_empenho.

---

## 3. Antes e depois da alteração

| Aspecto | Antes | Depois |
|--------|--------|--------|
| Fonte de dados | `/recebimento-notas-fiscais` (módulo NF) | `GET /nf-empenho/lista` → **public.nf_empenho** |
| Slider "Número máximo de registros" | Sim (100–5000) | Removido |
| Texto "limitado a X" | Sim | Removido; exibido "Exibindo X a Y de Z registros" |
| Colunas Item, Código, Material, Qtde Receb, Usuário | Valores fixos ou "—" | Preenchidas a partir de nf_empenho |
| Paginação | pageSize variável (slider) | pageSize fixo 100; navegação por página |
| Contrato GET /nf-empenho (Editar Recebimento) | Inalterado | Inalterado (rota /lista separada) |

---

## 4. Possíveis efeitos colaterais

- **Quem consumia "Lista de Recebimentos" esperando dados de recebimento_nota_fiscal**  
  A tela passa a mostrar apenas **public.nf_empenho**. Se ainda for necessário uma lista baseada em recebimento_nota_fiscal, será preciso outra tela ou outro endpoint.

- **Performance com muitos registros**  
  Paginação de 100 (ou até 500) por página mantém a resposta controlada. Ordenação por `data DESC, id_emp ASC` pode se beneficiar de índice em `(data, id_emp)` se a tabela crescer muito.

- **Exportação Excel/PDF**  
  Continua limitada por `MAX_EXPORT_ROWS` no frontend; apenas a origem dos dados mudou para nf_empenho.

---

## 5. Teste manual sugerido para validar a correção

1. Abrir a tela **Lista de Recebimentos**.  
   - Deve carregar a primeira página de **public.nf_empenho** (até 100 registros).  
   - Não deve existir slider nem texto "limitado a".

2. Verificar colunas da tabela: ID, Fornecedor, Data, Empenho, Item, Código, Material, Saldo Emp, Qtde Receb, Situação, Usuário, com dados coerentes com a tabela nf_empenho.

3. Usar filtros (Fornecedor, Empenho, Código) e clicar em **Buscar**; conferir se os resultados batem com os filtros.

4. Clicar em **Limpar** e conferir se os filtros são limpos e a lista recarrega (página 1).

5. Com mais de 100 registros, usar **Próxima** e **Anterior** e verificar se o texto "Exibindo X a Y de Z registros" e os dados da tabela mudam corretamente.

6. Exportar PDF e Excel e conferir se as colunas estão preenchidas com os mesmos dados da tela (nf_empenho).

7. Confirmar que a tela **Editar Recebimento** segue funcionando (continua usando `GET /nf-empenho` com filtro obrigatório).

---

## 6. Arquivos alterados / criados

- **Backend:**  
  - `repositories/nfEmpenhoRepository.ts` — interfaces `NfEmpenhoListaItem`, `ListNfEmpenhoListaFilters` e função `listNfEmpenhoParaLista`.  
  - `services/nfEmpenhoService.ts` — método `listLista`.  
  - `controllers/nfEmpenhoController.ts` — método `listLista` e rota GET /nf-empenho/lista.  
  - `routes/nfEmpenhoRoutes.ts` — registro de `GET /lista`.

- **Frontend:**  
  - `api/plataforma.ts` — tipo `ListaRecebimentoItem` estendido; nova `fetchListaRecebimentosNfEmpenho`.  
  - `hooks/useListaRecebimentos.ts` — uso de `fetchListaRecebimentosNfEmpenho`, pageSize 100.  
  - `pages/plataforma/ListaRecebimentos.tsx` — remoção do slider e do texto "limitado a"; tabela e export usando dados de nf_empenho; paginação com `load(...)`.

- **Documentação:**  
  - `docs/CORRECAO_LISTA_RECEBIMENTOS_NF_EMPENHO.md` (este arquivo).
