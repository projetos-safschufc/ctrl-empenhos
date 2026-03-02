# Implementação: Lista de Empenhos — Registrar Recebimento e Cancelar

## Classificação da gravidade

**Médio** — A tela "Lista de Empenhos" não permitia registrar recebimentos na tabela **public.nf_empenho**. Os botões "Registrar Recebimento" e "Cancelar" e a lógica de exibição condicional (checkbox + QTDE_RECEB inteiro > 0) não existiam; a persistência em **nf_empenho** a partir da lista de empenhos pendentes não estava implementada.

---

## 1. Explicação técnica do problema

### Causa raiz

1. **Funcionalidade inexistente**  
   Na tela "Lista de Empenhos" não havia fluxo para gravar dados em **public.nf_empenho**. O backend não expunha endpoint para "registrar recebimento" a partir da lista (empenhos-pendentes); o frontend não tinha botões nem estado de seleção por checkbox nem validação de QTDE_RECEB.

2. **Checkbox e botões**  
   O checkbox existia apenas como elemento visual, sem estado controlado. Não havia botões "Registrar Recebimento" e "Cancelar" nem regra de exibição (itens marcados + QTDE_RECEB inteiro > 0).

3. **Contrato e camadas**  
   Nenhum contrato de API nem camada de serviço/repositório existia para o caso de uso "registrar recebimento a partir da lista de empenhos" em **nf_empenho**.

### Motivo técnico

- **Regra de negócio:** Itens marcados na Lista de Empenhos, com campo "Qtde receb" preenchido com número inteiro maior que zero, devem poder ser registrados em **public.nf_empenho** (e observação, quando informada, em **public.nf_obs**).
- **Implementação anterior:** Lista de empenhos apenas exibia dados (empenhos-pendentes) e permitia exportação; não havia persistência em **nf_empenho** nem botões condicionais.

---

## 2. Correção implementada

### Backend

- **Rota** `routes/nfEmpenhoRoutes.ts`:  
  - **POST /registrar-recebimento** com `validateBody(registrarRecebimentoBodySchema)` e handler `nfEmpenhoController.registrarRecebimento`.  
  - Mantém autenticação via `router.use(authenticate)`.

- **Controller** `controllers/nfEmpenhoController.ts`:  
  - Método **registrarRecebimento**: usa body tipado como **RegistrarRecebimentoBody**, obtém usuário de `req.user`, chama **nfEmpenhoService.registrarRecebimento(body.itens, usuario)** e responde **201** com `{ criados }`.

- **Validador** `validators/registrarRecebimentoSchemas.ts`:  
  - Schema Zod para o body: `itens` (array com `empenho` obrigatório, `qtde_receb` inteiro > 0, demais campos opcionais).  
  - Tipo exportado: **RegistrarRecebimentoBody**.

- **Serviço** `services/nfEmpenhoService.ts`:  
  - **registrarRecebimento(itens, usuario)** repassa para o repositório.

- **Repositório** `repositories/nfEmpenhoRepository.ts`:  
  - **createNfEmpenhoFromLista(itens, usuario)** insere em **public.nf_empenho** (e em **nf_obs** quando há observação), considerando apenas itens com `qtde_receb` inteiro > 0.

### Frontend

- **API** `api/plataforma.ts`:  
  - Tipos **RegistrarRecebimentoItemPayload** e **RegistrarRecebimentoResponse**.  
  - Função **registrarRecebimentoListaEmpenhos(itens)** que chama **POST /nf-empenho/registrar-recebimento** com `{ itens }`.

- **Página** `pages/plataforma/ListaEmpenhos.tsx`:  
  - Estado **selectedIds** (`Set<number>`) para itens marcados no checkbox.  
  - **toggleSelection(id)** para marcar/desmarcar por linha.  
  - **selectedWithValidQtde()**: retorna ids selecionados cujo "Qtde receb" é inteiro > 0.  
  - **canShowButtons**: `true` somente quando há pelo menos um selecionado e **todos** os selecionados têm QTDE_RECEB inteiro > 0.  
  - Checkbox controlado: `isChecked={selectedIds.has(row.id)}`, `onChange={() => toggleSelection(row.id)}`.  
  - Botões **Registrar Recebimento** e **Cancelar** exibidos apenas quando **canShowButtons** é verdadeiro.  
  - **Cancelar**: limpa **selectedIds**.  
  - **Registrar Recebimento**: monta payload (fornecedor, empenho, item, codigo/master, material, saldo_emp, qtde_receb, observacao) a partir dos itens selecionados com qtde válida; chama **registrarRecebimentoListaEmpenhos**; em sucesso limpa seleção e exibe toast com quantidade criada; em erro exibe toast de erro.  
  - **Limpar** (filtros) também limpa **selectedIds**.  
  - Estado **submitting** para desabilitar botões durante o POST.

---

## 3. Antes e depois da alteração

| Aspecto | Antes | Depois |
|--------|--------|--------|
| Checkbox na lista | Apenas visual, sem estado | Controlado por **selectedIds**; toggle por linha |
| Botões Registrar / Cancelar | Inexistentes | Exibidos somente com itens marcados e QTDE_RECEB inteiro > 0 em todos |
| Persistência em nf_empenho a partir da lista | Não havia | **POST /nf-empenho/registrar-recebimento** grava em **public.nf_empenho** (e **nf_obs** se houver observação) |
| Validação no backend | Nenhuma para este fluxo | Body com **registrarRecebimentoBodySchema** (empenho obrigatório, qtde_receb inteiro positivo) |
| Contrato da API | N/A | Novo endpoint; demais contratos mantidos |

---

## 4. Possíveis efeitos colaterais

- **Lista de Empenhos** continua consumindo **empenhos-pendentes** para exibição; o registro em **nf_empenho** não altera essa fonte. Após registrar, a mesma lista pode ser exibida sem recarregar (apenas a seleção é limpa). Se no futuro a lista for filtrada por "já registrados", será necessário outro critério ou endpoint.
- **Permissões**: o endpoint **POST /nf-empenho/registrar-recebimento** usa o mesmo middleware de autenticação das demais rotas de **nf-empenho**; qualquer mudança de perfil (ex.: apenas admin) deve ser aplicada de forma consistente.

---

## 5. Teste manual sugerido para validar a correção

1. Fazer login e acessar **Lista de Empenhos**.
2. Buscar por Master ou Empenho e garantir que há itens na tabela.
3. **Botões não devem aparecer** sem nenhum item marcado.
4. Marcar um item (checkbox) e deixar "Qtde receb" vazio ou com valor não inteiro ou ≤ 0: os botões **não** devem aparecer.
5. Preencher "Qtde receb" com número inteiro > 0 (ex.: 10) para o item marcado: os botões **Registrar Recebimento** e **Cancelar** devem aparecer.
6. Clicar em **Cancelar**: seleção deve ser limpa e botões devem sumir.
7. Marcar novamente um ou mais itens, preencher "Qtde receb" com inteiro > 0 em todos: clicar em **Registrar Recebimento**. Deve retornar **201** e toast de sucesso com quantidade de itens criados; seleção deve ser limpa.
8. Conferir em **public.nf_empenho** os novos registros (fornecedor, empenho, item, codigo, material, saldo_emp, qtde_receb, situacao 'Pendente', usuario). Se tiver preenchido observação, conferir **public.nf_obs**.
9. Enviar body inválido (ex.: qtde_receb 0 ou string): deve retornar **400** com mensagem de validação.

---

## 6. Arquivos alterados / referência

- **Backend (alterados):**  
  - `routes/nfEmpenhoRoutes.ts` — POST /registrar-recebimento com validação.  
  - `controllers/nfEmpenhoController.ts` — import de **RegistrarRecebimentoBody**; método **registrarRecebimento** usando body validado.

- **Frontend (alterados):**  
  - `api/plataforma.ts` — **RegistrarRecebimentoItemPayload**, **RegistrarRecebimentoResponse**, **registrarRecebimentoListaEmpenhos**.  
  - `pages/plataforma/ListaEmpenhos.tsx` — estado de seleção, checkbox controlado, **canShowButtons**, botões Registrar Recebimento e Cancelar, handlers e chamada à API.

- **Documentação:**  
  - `docs/IMPLEMENTACAO_LISTA_EMPENHOS_REGISTRAR_RECEBIMENTO.md` (este arquivo).
