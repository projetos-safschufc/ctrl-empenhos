# Auditoria completa do projeto – Controle de Empenhos e Estoque

**Escopo:** Backend (Node.js + Express + TypeScript + PostgreSQL) e Frontend (React 18 + TypeScript + Vite).  
**Foco:** Análise arquitetural, riscos de escalabilidade e organização. Sem sugestão de código nesta fase; apenas identificação de problemas e refatoração orientada.

---

## 1. Problemas por criticidade

### Crítico

| # | Problema | Onde | Explicação técnica |
|---|----------|------|--------------------|
| 1 | **Promessas async não tratadas no Express** | `authController.register`, outros controllers | Em Express 4, rejeições de Promise em handlers async não são passadas ao middleware de erro. Se `authService.register` ou qualquer chamada async lançar, o processo pode terminar em UnhandledRejection e o cliente receber hang/timeout em vez de 500 padronizado. |
| 2 | **CORS totalmente aberto** | `server.ts`: `app.use(cors())` | Uso de `cors()` sem opções permite qualquer origem. Em produção facilita ataques a partir de outros domínios e uso indevido da API por terceiros. |
| 3 | **Valores padrão de DB no código** | `config/database.ts`, `config/dw.ts`, `config/nf.ts` | Host (`10.28.0.159`), user (`abimael`) e database (`safs`) fixos como fallback. Expõe dados de um ambiente específico e quebra portabilidade e segurança em outros ambientes. |
| 4 | **Risco de tipo materialId (Prisma)** | `histCtrlEmpenhoRepository` + schema Prisma | Schema Prisma define `materialId` como `String`; migrações SQL usam `INTEGER`. Código que passa `number[]` para `in: materialIds` gera erro em tempo de execução (“Expected String…”). Indica inconsistência modelo/banco ou conversão faltando. |

### Alto

| # | Problema | Onde | Explicação técnica |
|---|----------|------|--------------------|
| 5 | **Serviço de controle de empenho sobrecarregado** | `controleEmpenhoService.ts` | Orquestra 6+ repositórios, cache, formatação e regras de negócio em um único módulo (~588 linhas). Alto acoplamento e responsabilidade única violada; dificulta testes e evolução. |
| 6 | **Dois clientes HTTP no frontend** | `api/client.ts` (fetch) e `api/plataforma.ts` (axios) | Duas formas de chamar a API (fetch vs axios), dois padrões de erro e de uso. Aumenta inconsistência, duplicação e custo de manutenção. |
| 7 | **Cache administrativo sem controle de perfil** | `cacheRoutes.ts` + `cacheController` | Qualquer usuário autenticado pode limpar cache, invalidar por padrão e aquecer cache. Em intranet pode ser aceitável, mas não há distinção admin/operador; risco de impacto por uso indevido. |
| 8 | **Escrita em `.env.local` no startup** | `server.ts` | Servidor escreve `VITE_BACKEND_PORT` e `VITE_BACKEND_URL` em arquivo na raiz do projeto. Pode falhar em ambientes somente leitura, conflitar com CI/CD e misturar configuração de runtime com arquivos versionados. |
| 9 | **Exportação PDF/Excel sem limite de volume** | `plataformaExport.ts`, páginas Plataforma | PDF usa `tableRef.outerHTML` em nova janela; Excel monta o workbook inteiro em memória. Para listas grandes (ex.: 5k+ linhas) há risco de travamento do tab, pico de memória e timeout. |
| 10 | **Sem camada de validação de entrada padronizada** | Controllers em geral | Validação feita manualmente (typeof, trim, etc.). Não há schema (Zod/Joi/Yup) reutilizável; risco de edge cases, Mass Assignment e payloads malformados em endpoints novos. |

### Médio

| # | Problema | Onde | Explicação técnica |
|---|----------|------|--------------------|
| 11 | **Páginas grandes com UI + lógica + estado** | `ControleEmpenhos.tsx`, `Provisionamento.tsx` | Componentes com centenas de linhas concentram estado, fetch, cache e tabela. Dificulta leitura, reuso e testes; re-renders desnecessários se estado não for bem segmentado. |
| 12 | **Chaves de cache com `JSON.stringify`** | `memoryCache.ts`: `CacheKeys.controleItens` | Chave usa `JSON.stringify(filters)`. Objetos grandes ou com ordem de chaves variável geram chaves diferentes para o mesmo conjunto lógico; possível fragmentação e menor hit rate. |
| 13 | **Sidebar com muitos links repetidos** | `Layout.tsx` | Vários `ChakraLink` com o mesmo padrão (to, bg, _hover). Código repetitivo e propenso a desalinhamento visual ou de rota ao adicionar novas telas. |
| 14 | **Múltiplos pools de conexão** | `dwPool`, `nfPool`, Prisma (DATABASE_URL) | Dois pools pg (DW e NF) e Prisma com sua própria pool. Para mesmo banco/schema pode haver redundância e maior consumo de conexões. |
| 15 | **Middleware de erro não cobre erros assíncronos** | `server.ts` | Handler de erro com assinatura de 4 argumentos só é chamado para erros passados com `next(err)`. Rejeições em async não são encaminhadas sem wrapper (ex.: express-async-errors). |
| 16 | **Health check sem checagem de dependências** | `GET /health` | Retorna 200 sem validar banco ou cache. Em deploy/load balancer pode marcar instância como saudável mesmo com DB indisponível. |

### Melhoria

| # | Problema | Onde | Explicação técnica |
|---|----------|------|--------------------|
| 17 | **`require('os')` e `require('fs')` no server** | `server.ts` | Uso de `require` no meio do fluxo. Preferível import no topo para consistência com ESM/TypeScript e tree-shaking. |
| 18 | **Logs de console no fluxo crítico** | `controleEmpenhoService`, `columnFormatters` | `console.warn`/`console.log` em regras de cobertura e colunas. Em produção poluem logs e podem expor detalhes internos; melhor usar logger configurável. |
| 19 | **Cache em memória com `setInterval` contínuo** | `memoryCache.ts` | Limpeza a cada 2 minutos. Em shutdown do processo o intervalo continua até o processo terminar; ideal registrar clear no shutdown. |
| 20 | **Duplicação de constantes de cores** | `theme/index.ts` e `constants/plataforma.ts` | Cores da plataforma definidas em dois lugares. Risco de divergência ao alterar apenas um. |
| 21 | **Acessibilidade do sidebar** | `Layout.tsx` | Navegação sem `aria-current`, `role="navigation"` ou agrupamento semântico. Dificulta leitura por leitores de tela. |
| 22 | **Tabelas sem virtualização** | Lista Empenhos, Lista Recebimentos, Controle Empenhos | Renderização de todas as linhas no DOM. Com pageSize alto (ex.: 100+) pode impactar scroll e tempo de pintura; virtualização melhoraria para listas grandes. |

---

## 2. Recomendações estruturais

- **Backend**
  - Introduzir wrapper global para handlers async (ex.: `express-async-errors` ou middleware que chame `next(err)` no catch) e garantir que nenhum controller async dispare rejeição sem tratamento.
  - Configurar CORS por ambiente (origem permitida explícita em produção) e, se aplicável, credenciais.
  - Remover defaults de host/user/database do código; usar apenas variáveis de ambiente e falhar no startup se obrigatórias estiverem ausentes.
  - Alinhar tipo de `material_id` no banco com o modelo Prisma (ou converter sempre para string antes de passar ao Prisma) e documentar a convenção.
  - Adotar uma camada de validação (Zod/Joi) em rotas ou em um middleware de body/query, com tipos inferidos para os controllers.
  - Restringir rotas de cache (clear/invalidate/warmup) a perfil admin ou remover em produção se não for necessário.
  - Parar de escrever em `.env.local` no startup; usar variáveis de ambiente ou config injetada em build/deploy para o frontend.

- **Frontend**
  - Unificar cliente HTTP em um único módulo (fetch ou axios), com interceptors de token, erro e logging.
  - Extrair lógica de dados das páginas pesadas para hooks (ex.: `useControleEmpenhos`, `useProvisionamento`) e deixar componentes focados em UI.
  - Reduzir duplicação do Layout com um array de itens de menu e um componente de link reutilizável.
  - Para exportação: limitar quantidade de linhas (ex.: 2–5k) ou implementar geração em chunks/streaming no backend para Excel e PDF.

- **Arquitetura**
  - Quebrar `controleEmpenhoService` em subserviços ou use cases (ex.: “listagem com consumo”, “dashboard”, “histórico”) e manter o serviço principal apenas orquestrando.
  - Revisar necessidade de dois pools pg (DW vs NF) e, se apontarem ao mesmo cluster, considerar pool único com schemas diferentes.
  - Padronizar tratamento de erro (classe de erro de domínio, mapeamento para status/código) e uso de logger em vez de `console.*`.

---

## 3. Refatoração orientada (incremental e segura)

Ordem sugerida para não quebrar funcionalidades existentes:

**Fase 1 – Estabilidade e segurança (backend)**  
1. Adicionar wrapper de async (ex.: `express-async-errors`) e garantir que todos os controllers retornem ou lancem de forma que o middleware de erro seja acionado.  
2. Configurar CORS por ambiente (variável `ALLOWED_ORIGINS` ou similar).  
3. Remover defaults sensíveis de `database.ts`/`dw.ts`/`nf.ts` e validar env no bootstrap.  
4. Corrigir tipo/conversão de `materialId` no repositório de histórico para evitar “Expected String” (converter para string antes de `findMany`/`findFirst`).

**Fase 2 – Consistência e manutenção**  
5. Introduzir validação de entrada (Zod ou Joi) em 1–2 rotas piloto (ex.: auth, recebimento-notas-fiscais) e estender aos demais endpoints.  
6. Unificar cliente HTTP no frontend (manter um só: fetch ou axios) e migrar chamadas da plataforma para esse cliente.  
7. Proteger rotas de cache com checagem de perfil (admin) ou documentar que são apenas para intranet e aceitar o risco.

**Fase 3 – Arquitetura e performance**  
8. Extrair hooks de dados das páginas mais pesadas (ControleEmpenhos, Provisionamento) e manter a API dos componentes inalterada no primeiro passo.  
9. Refatorar `controleEmpenhoService` em funções ou módulos menores (por caso de uso), mantendo a mesma interface pública e testes manuais das telas.  
10. Adicionar limite ou confirmação nas exportações PDF/Excel (ex.: “Exportar no máximo X linhas”) e, se necessário, endpoint de export em streaming no backend.

**Fase 4 – Qualidade e UX**  
11. Reduzir duplicação do Layout (array de rotas + componente de link).  
12. Revisar acessibilidade do menu (aria-current, roles) e, se houver listas muito longas, avaliar virtualização nas tabelas.

Em cada fase, validar com smoke test (login, uma listagem, uma exportação) antes de passar à seguinte.

---

## 4. Score e classificação para produção

- **Maturidade do código (0–10):** **6,5**  
  Justificativa: Boa separação controller/service/repository e uso de cache e pools. Contudo, tratamento de erros async incompleto, CORS aberto, defaults de ambiente no código e serviço de controle de empenho monolítico reduzem a nota. Frontend com dois clientes HTTP e páginas muito grandes também pesam.

- **Classificação para produção:**  
  **Condicional (intranet)**  
  O projeto está adequado para uso em intranet com usuários controlados, desde que:  
  - CORS seja restrito às origens reais (ex.: front da intranet).  
  - Erros async sejam tratados (wrapper global).  
  - Variáveis de ambiente sejam usadas sem fallbacks que exponham dados de um ambiente específico.  
  Para internet ou cenários com maior superfície de ataque, é recomendável tratar itens críticos e altos (validação, cache admin, limites de exportação, health check com dependências) antes de classificar como “pronto para produção”.

---

## 5. Resumo executivo

- **Pontos fortes:** Camadas bem definidas (controller/service/repository), queries parametrizadas nos repositórios pg, cache em memória com TTL e invalidação, uso de pool e preparo para senhas com caracteres especiais.  
- **Riscos principais:** Rejeições de Promise não tratadas no Express, CORS aberto, configuração sensível hardcoded e serviço de controle de empenho muito acoplado.  
- **Próximos passos recomendados:** Aplicar Fase 1 da refatoração (async + CORS + env + materialId), depois unificar cliente HTTP e validação (Fase 2), e em seguida evoluir arquitetura do serviço e exportações (Fase 3–4).
