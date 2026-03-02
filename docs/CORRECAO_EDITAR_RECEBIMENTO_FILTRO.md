# Correção: Editar Recebimento — exibição apenas com filtro

## Classificação da gravidade do erro

**Médio** — A tela permitia listar todos os registros de `public.nf_empenho` sem filtro ao abrir, contrariando a regra de negócio de exibir dados somente quando filtrado por **Empenho** ou **Código (Master)**. Não havia perda de dados nem quebra de segurança crítica.

---

## 1. Explicação técnica do problema

### Causa raiz

1. **Carregamento indevido ao abrir a tela**  
   Um `useEffect` sem dependências chamava `load({})` ao montar o componente. Assim, a API era chamada **sem** `empenho` e `codigo`, e o backend **não exigia** nenhum filtro, retornando todos os registros da tabela (com paginação). Isso viola a regra: *"só deve ser exibido os dados quando filtrado por EMPENHO ou CÓDIGO MASTER"*.

2. **Backend sem validação de filtro**  
   O `GET /nf-empenho` aceitava requisições com `empenho` e `codigo` vazios. O repositório usava `where: undefined` nesse caso, e o Prisma listava todas as linhas de `public.nf_empenho`, sujeito apenas a `LIMIT`/`OFFSET`.

3. **Limpar não zerava resultados**  
   Ao clicar em "Limpar", os campos de filtro eram esvaziados, mas `load({ pageOverride: 1 })` era chamado de novo sem filtros, mantendo ou re-executando a listagem ampla em vez de deixar a tabela vazia.

4. **Buscar sem validação**  
   Era possível clicar em "Buscar" com os dois filtros vazios, gerando novamente a listagem sem restrição.

### Motivo técnico do erro

- **Frontend:** efeito colateral de "carregar algo ao abrir" sem considerar a regra de negócio que exige filtro obrigatório.
- **Backend:** ausência de validação de parâmetros na camada de controller (e de guard no repositório) para exigir ao menos um de `empenho` ou `codigo`.
- **Contrato da API:** os parâmetros de query continuam os mesmos (`empenho`, `codigo`, `page`, `pageSize`); apenas passou a existir validação que retorna **400** quando ambos os filtros estão vazios.

---

## 2. Correção implementada

### Backend

- **Controller (`nfEmpenhoController.ts`)**  
  - Antes de chamar o serviço, valida: se `empenho` e `codigo` (após trim) estiverem vazios, responde com **400** e mensagem:  
    `"É obrigatório informar ao menos um filtro: Empenho ou Código (Master)."`  
  - Contrato da API inalterado (mesmos query params e formato da resposta).

- **Repositório (`nfEmpenhoRepository.ts`)**  
  - Se nenhum filtro for preenchido (após trim), retorna `{ itens: [], total: 0 }` sem acessar o banco, como defesa em profundidade.

### Frontend

- **Página (`EditarRecebimento.tsx`)**  
  - Removido o `useEffect` que chamava `load({})` ao montar. A tabela inicia vazia.  
  - **Buscar:** antes de chamar `load`, valida se há ao menos um de Empenho ou Código (após trim). Se não houver, exibe toast de aviso e não chama a API.  
  - **Limpar:** além de zerar os campos e a seleção, chama `clearResults()`, que limpa itens, total e erro e zera a tabela (sem nova chamada à API).  
  - Label do segundo filtro alterada para **"Filtrar por Código (Master):"** para alinhar à regra.  
  - Mensagem de estado vazio: antes da primeira busca, exibe instrução para informar filtro e clicar em Buscar; após uma busca sem resultados, mantém a mensagem de "Nenhum registro encontrado...".

- **Hook (`useEditarRecebimento.ts`)**  
  - Novo `clearResults()`: zera `itens`, `total`, `error`, `page` e flag `hasSearched`.  
  - Nova flag `hasSearched`: setada em `true` quando `load` é chamado; setada em `false` em `clearResults`, para diferenciar o estado "ainda não buscou" do "buscou e não achou nada".

- **Constantes (`plataforma.ts`)**  
  - Placeholders dos filtros ajustados (ex.: "Ex.: 2023NE000152", "Ex.: 575617 (Código Master)") para orientar o uso de Empenho e Código Master.

O campo **QTDE_RECEB** permanece **editável** (input numérico e salvamento via PATCH), em conformidade com a regra e com a imagem de referência.

---

## 3. Antes e depois da alteração

| Aspecto | Antes | Depois |
|--------|--------|--------|
| Ao abrir a tela | Chamava `load({})` e exibia registros (todos paginados) sem filtro | Tabela vazia com mensagem para informar filtro e clicar em Buscar |
| Buscar sem preencher filtros | Executava a listagem completa | Toast de aviso; não chama a API |
| Limpar | Limpava campos e chamava `load({})` de novo (mantinha listagem ampla) | Limpa campos, seleção e resultados; tabela fica vazia |
| GET /nf-empenho sem filtros | Retornava todos os registros (paginados) | Resposta **400** com mensagem de filtro obrigatório |
| Repositório sem filtros | Consultava a tabela com `where` vazio | Retorna `{ itens: [], total: 0 }` sem hit no banco |
| Label do segundo filtro | "Filtrar por Código" | "Filtrar por Código (Master):" |
| QTDE_RECEB | Editável | Continua editável (sem mudança) |

---

## 4. Possíveis efeitos colaterais

- **Integrações que chamam GET /nf-empenho sem filtro**  
  Passarão a receber **400** até que enviem ao menos um de `empenho` ou `codigo`. Se existir algum consumidor assim, é necessário ajustá-lo para enviar filtro.

- **Expectativa de “última listagem” ao reabrir a tela**  
  Quem esperava ver de novo a última busca ao reabrir a tela deixará de ver; a tela passa a abrir sempre sem dados até o usuário informar filtro e clicar em Buscar. Isso está alinhado à regra de exibir dados só quando filtrado.

- **Nenhuma alteração em**  
  - Contrato de resposta da API (formato dos `itens`, `total`, `page`, `pageSize`).  
  - PATCH /nf-empenho/:id.  
  - Outras telas ou fluxos.

---

## 5. Teste manual sugerido para validar a correção

1. **Abrir a tela Editar Recebimento**  
   - Deve aparecer a tabela vazia com a mensagem:  
     *"Informe ao menos um filtro (Empenho ou Código Master) e clique em Buscar."*  
   - Não deve haver chamada automática à API (ver Network: nenhum GET /nf-empenho ao carregar).

2. **Clicar em Buscar sem preencher nada**  
   - Deve aparecer toast de aviso: *"Informe ao menos um filtro (Empenho ou Código Master)."*  
   - Não deve haver GET /nf-empenho.

3. **Preencher só Empenho (ex.: 2023NE000152) e clicar em Buscar**  
   - Deve haver GET /nf-empenho?empenho=2023NE000152&page=1&pageSize=20.  
   - A tabela deve exibir os registros compatíveis (Empenho, Código, Item, Material, Saldo Emp, Qtde Receb editável, Obs.), como na imagem.

4. **Limpar**  
   - Campos e tabela devem zerar; mensagem inicial de "Informe ao menos um filtro..." deve voltar.  
   - Não deve haver nova requisição.

5. **Preencher só Código (Master) e Buscar**  
   - GET com `codigo` preenchido; resultados coerentes com o filtro.

6. **Editar Qtde Receb, selecionar registro e Salvar**  
   - PATCH /nf-empenho/:id com `valor_total`/`qtde_receb` e, se houver texto, `observacao`; persistência correta em `public.nf_empenho` e `public.nf_obs`.

7. **Chamar a API sem filtro (ex.: curl ou Postman)**  
   - `GET /api/nf-empenho` (sem query) ou com `empenho=` e `codigo=` vazios deve retornar **400** e a mensagem de filtro obrigatório.

---

## 6. Observação sobre o nome da tabela

No projeto, a tabela é referida como **`public.nf_empenho`** (model Prisma `nf_empenho`). Se no ambiente de produção o nome real da tabela for **`public.nf_empenhos`**, é necessário mapear no `schema.prisma` com `@@map("nf_empenhos")` no model `nf_empenho`, sem alterar a regra de negócio nem o comportamento da tela.
