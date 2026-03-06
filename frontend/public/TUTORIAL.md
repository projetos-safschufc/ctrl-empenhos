# Tutorial da Aplicação Controle de Empenhos e Estoque

Este tutorial descreve o uso da aplicação dividido em duas frentes: **controle administrativo** (gestão de estoque, movimentação, empenhos e provisionamento) e **controle operacional** (recebimento de notas fiscais e observações). O texto está organizado para consulta rápida e uso no dia a dia.

---

## Parte 1 — Atividade administrativa de controle

As telas desta parte destinam-se a gestores e equipes que acompanham indicadores, movimentações e planejamento de compras. São elas: **Gestão de Estoque**, **Movimentação Diária**, **Empenhos Pendentes** e **Provisionamento**.

---

### 1.1 Gestão de Estoque

**Objetivo:** Visualizar e controlar os materiais cadastrados, com indicadores de consumo, estoque, cobertura e status (Normal, Atenção, Crítico), além de permitir exportação e edição de dados.

**Onde acessar:** Menu lateral → **Gestão de Estoque** (ou **Controle de Empenhos**).

**Principais funcionalidades:**

- **Resumo no topo:** Cartões com totais de Materiais, Pendências, Atenção e Crítico, dando uma visão geral antes de aplicar filtros.
- **Filtros:** Código, Responsável, Classificação, Setor, Status e “Com registro”. Use **Aplicar** para filtrar a lista e **Atualizar** para recarregar os dados.
- **Tabela:** Exibe uma linha por material/registro, com colunas como Classificação, Responsável controle, Master/Descritivo, Apresentação, consumo por mês, média de consumo, estoques, quantidade a receber (empenhos), cobertura de estoque, pré-empenho, registro, vigência, saldo de registro, valor unitário, quantidade por embalagem, classificação XYZ, tipo de armazenamento, capacidade de estocagem, **Status** (Normal, Atenção, Crítico) e Observação. O **Status** segue regras de negócio (cobertura, saldo a receber e saldo de registro). Ao passar o mouse sobre o Status, é exibido um tooltip com detalhes e storytelling.
- **Seleção e edição:** Marque o checkbox da linha para habilitar a edição de campos como quantidade por embalagem, tipo de armazenamento, capacidade de estocagem e observação. Use **Salvar alterações** para gravar.
- **Exportar Excel:** O botão **Exportar Excel** exporta **todos os registros que atendem aos filtros aplicados** (não apenas a página atual), em formato adequado para análise externa.

**Dica:** Mantenha os filtros aplicados ao exportar para que o arquivo reflita exatamente o conjunto de dados que você está analisando.

---

### 1.2 Movimentação Diária

**Objetivo:** Consultar e exportar as movimentações de estoque por data e período (mês/ano), com detalhes de material, quantidade, valor, tipo de movimento, almoxarifado e setor.

**Onde acessar:** Menu lateral → **Movimentação Diária**.

**Principais funcionalidades:**

- **Filtros:** Defina o **mês/ano** (período) desejado. A listagem considera as movimentações daquele período.
- **Tabela:** Colunas típicas incluem Data, Mês, Material, Apresentação, Quantidade, Valor, Movimento, Almoxarifado, Setor controle, Destino, Grupo e Usuário.
- **Exportação:** É possível exportar os dados da consulta para planilha (Excel), para uso em relatórios e auditoria.

**Uso recomendado:** Utilize esta tela para acompanhar entradas e saídas diárias e mensais e para cruzar com o controle de empenhos e do estoque exibido na Gestão de Estoque.

---

### 1.3 Empenhos Pendentes

**Objetivo:** Listar os empenhos em aberto (pendentes de atendimento), com possibilidade de filtrar por código, número do empenho e de exportar os dados.

**Onde acessar:** Menu lateral → **Empenhos Pendentes**.

**Principais funcionalidades:**

- **Filtros:** Código do material e número do empenho, permitindo refinar a busca.
- **Listagem:** Exibe os empenhos que ainda possuem saldo a receber ou situações pendentes, com informações relevantes para o acompanhamento administrativo.
- **Exportação:** Os resultados podem ser exportados para planilha, facilitando o acompanhamento e o repasse às equipes operacionais.

**Dica:** Use esta tela em conjunto com a **Gestão de Estoque** (coluna “Qtde a receber”) e com a **Lista de Empenhos** (parte operacional) para ter uma visão completa do que está empenhado e do que falta receber.

---

### 1.4 Provisionamento

**Objetivo:** Montar listas de provisionamento com base em busca por código de material, visualizando média de consumo, estoques, registro de preços e tempo de abastecimento, e gerar PDF/CSV para solicitação de compras.

**Onde acessar:** Menu lateral → **Provisionamento**.

**Principais funcionalidades:**

- **Busca:** Informe o código do material para localizar o item. Os resultados exibem descritivo, média de consumo (6 meses), estoque em almoxarifados, estoque virtual, tempo de abastecimento, número e saldo de registro, vigência, valor unitário, entre outros.
- **Tabela de provisionamento:** É possível definir quantidade a pedir e observações por linha. As colunas incluem quantidade pedida, valor total e observação.
- **Ações:** Remover itens da lista, exportar a tabela em **CSV** (para uso em planilhas) e gerar **PDF** para formalização da solicitação de compras ou documentação interna.

**Uso recomendado:** Utilize o Provisionamento após analisar a **Gestão de Estoque** e os **Empenhos Pendentes**, para definir o que comprar e em que quantidade, com base em consumo e estoque.

---

## Parte 2 — Atividade operacional de controle de recebimento de notas fiscais

As telas desta parte são voltadas à operação de recebimento de notas fiscais e registro de observações. São elas: **Lista de Empenhos**, **Lista de Recebimentos**, **Adicionar Observações** e **Editar Recebimento**.

---

### 2.1 Lista de Empenhos

**Objetivo:** Consultar empenhos (por fornecedor, item, material, número de documento etc.) e registrar ou acompanhar o recebimento dos itens, com exportação para PDF e Excel.

**Onde acessar:** Menu lateral → **Lista de Empenhos**.

**Principais funcionalidades:**

- **Filtros:** Use os campos disponíveis (por exemplo fornecedor, empenho, material) para refinar a lista de empenhos exibida.
- **Tabela:** Colunas típicas incluem Fornecedor, Item, Master, Material, Empenho (número documento SIAFI), Status do item, Quantidade empenhada, Saldo do item, Quantidade recebida e Observação.
- **Registro de recebimento:** É possível registrar o recebimento vinculado aos empenhos listados, integrando a operação de recebimento de NF com o controle de empenhos.
- **Exportação:** Exportar a lista para **Excel** ou **PDF**, respeitando o limite de linhas configurado e os filtros aplicados.

**Dica:** Esta tela complementa a **Empenhos Pendentes** (visão administrativa) com foco na execução do recebimento e no preenchimento de observações por empenho/item.

---

### 2.2 Lista de Recebimentos

**Objetivo:** Visualizar os recebimentos já realizados (notas fiscais / itens recebidos), com filtros e exportação para PDF e Excel.

**Onde acessar:** Menu lateral → **Lista de Recebimentos**.

**Principais funcionalidades:**

- **Filtros:** Ajuste a listagem por período, fornecedor, documento, item ou outros critérios disponíveis na tela.
- **Tabela:** Exibe dados como ID, Fornecedor, Data do recebimento, Número da NF/Empenho, Item, Código, Material, Saldo empenho, Quantidade recebida, Situação e Usuário responsável.
- **Exportação:** Os dados podem ser exportados para **Excel** ou **PDF**, dentro do limite de linhas definido pela aplicação.

**Uso recomendado:** Use esta tela para conferir o que já foi recebido, para auditoria e para cruzar com a **Lista de Empenhos** e com o **Editar Recebimento**, quando for necessário corrigir ou complementar dados de um recebimento.

---

### 2.3 Adicionar Observações

**Objetivo:** Incluir ou atualizar observações em itens/empenhos ou recebimentos, centralizando o registro de informações textuais importantes para a operação e para a gestão.

**Onde acessar:** Menu lateral → **Adicionar Observações**.

**Principais funcionalidades:**

- **Seleção do contexto:** A tela permite escolher o tipo de registro (empenho, recebimento ou outro disponível) e localizar o item desejado.
- **Campo de observação:** Preenchimento de texto livre para registrar ocorrências, restrições, devoluções, pendências ou qualquer informação relevante.
- **Salvamento:** As observações são gravadas e passam a aparecer nas listagens (por exemplo na coluna Observação da Lista de Empenhos ou em telas de detalhe).

**Dica:** Manter observações atualizadas facilita o acompanhamento pela equipe administrativa e a rastreabilidade na **Lista de Empenhos** e na **Lista de Recebimentos**.

---

### 2.4 Editar Recebimento

**Objetivo:** Alterar ou complementar dados de um recebimento já registrado (quantidades, datas, observações ou outros campos permitidos), garantindo consistência entre o que foi recebido e o que consta no sistema.

**Onde acessar:** Menu lateral → **Editar Recebimento**.

**Principais funcionalidades:**

- **Busca e seleção:** Localize o recebimento a ser editado (por ID, nota, data, fornecedor ou critérios disponíveis).
- **Formulário de edição:** Exibição dos dados atuais do recebimento com campos editáveis. Ajuste quantidades, datas, observações ou demais informações conforme a política da organização.
- **Salvamento:** Após as alterações, confirme para gravar. O registro atualizado passa a refletir na **Lista de Recebimentos** e nas demais consultas que utilizam esses dados.

**Uso recomendado:** Utilize esta tela quando for necessário corrigir um lançamento de recebimento ou incluir informações que não estavam disponíveis no momento do primeiro registro. Evite alterações que conflitem com documentos fiscais ou com a **Lista de Empenhos**.

---

## Resumo do fluxo recomendado

- **Administrativo:** Consulte **Gestão de Estoque** e **Empenhos Pendentes** para indicadores e pendências; use **Movimentação Diária** para detalhes de entradas e saídas; e **Provisionamento** para montar e exportar pedidos com base em consumo e estoque.
- **Operacional:** Consulte a **Lista de Empenhos** para receber e registrar; use **Lista de Recebimentos** para conferir o que já foi recebido; **Adicionar Observações** para anotações importantes; e **Editar Recebimento** quando precisar corrigir ou complementar um recebimento.

Para dúvidas ou sugestões sobre o uso da aplicação, consulte a equipe de suporte ou a documentação interna da sua instituição.
