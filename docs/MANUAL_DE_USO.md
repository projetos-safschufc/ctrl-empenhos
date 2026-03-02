# Manual de Uso — Controle de Empenhos e Estoque

Este manual descreve o uso das telas da aplicação para usuários finais. Para instalação e configuração técnica, consulte o [README principal](../README.md).

---

## 1. Acesso ao sistema

- **URL:** conforme ambiente (ex.: `http://localhost:5173` em desenvolvimento).
- **Login:** utilize o e-mail e a senha fornecidos pelo administrador.
- **Primeiro acesso:** se for o usuário inicial, use as credenciais padrão informadas na documentação de instalação (ex.: `admin@safs.local`).

Após o login, você será redirecionado para o **Início** (Dashboard).

---

## 2. Visão geral do menu

O menu lateral (sidebar) contém:

**Bloco principal**
- **Início** — Dashboard com resumo.
- **Controle de Empenhos** — Gestão de empenhos e colunas de consumo/estoque.
- **Movimentação Diária** — Movimentações do dia.
- **Empenhos Pendentes** — Listagem de empenhos pendentes.
- **Provisionamento** — Cálculo e acompanhamento de provisionamento.
- **Analytics** — Métricas e indicadores.

**Bloco Plataforma** (separado por uma linha no menu)
- **Lista de Empenhos** — Consulta e registro de recebimentos por empenho.
- **Lista de Recebimentos** — Listagem de recebimentos registrados.
- **Adicionar Observações** — Cadastro de observações por empenho.
- **Editar Recebimento** — Edição de recebimentos já registrados.

No rodapé do menu aparecem seu e-mail e o botão **Sair**.

---

## 3. Controle de Empenhos

- **Objetivo:** Consultar e acompanhar empenhos, com colunas de consumo, estoque e cobertura.
- **Uso:** Ajuste os filtros disponíveis (se houver) e visualize a tabela. Cores nas colunas indicam níveis de atenção (ex.: verde/amarelo/vermelho para estoque ou cobertura).
- **Ações:** Utilize as opções de exportação ou filtros conforme disponíveis na tela.

---

## 4. Movimentação Diária

- **Objetivo:** Visualizar movimentações do dia.
- **Uso:** A tela exibe os registros conforme os filtros e a data. Use os controles de data e filtros para refinar a lista.

---

## 5. Empenhos Pendentes

- **Objetivo:** Listar empenhos com status pendente.
- **Uso:** Informe **código** (master) e/ou **empenho** nos filtros e clique em **Buscar**. A tabela mostra os itens encontrados. Use **Limpar** para resetar os filtros.

---

## 6. Provisionamento

- **Objetivo:** Calcular e acompanhar o provisionamento de itens.
- **Uso:** Configure os filtros e parâmetros da tela. É possível exportar relatórios em PDF ou Excel, conforme disponível na interface.

---

## 7. Analytics

- **Objetivo:** Visualizar métricas e indicadores do sistema.
- **Uso:** Navegue pelos cards e gráficos. As métricas são atualizadas conforme os dados do banco.

---

## 8. Lista de Empenhos (Plataforma)

- **Objetivo:** Consultar empenhos, informar quantidade recebida e observações e registrar o recebimento na tabela de controle.
- **Filtros:** **Buscar por Master** e **Buscar por Empenho**. Clique em **Buscar** para aplicar e **Limpar** para resetar.
- **Tabela:** Colunas como Fornecedor, Item, Master, Material, Empenho, Status, Qtde Emp, Saldo do Item, **Qtde receb** (editável) e **Observação** (editável). A coluna Observação pode ser preenchida automaticamente com dados já cadastrados para o empenho.
- **Checkbox:** Marque as linhas que deseja incluir no registro de recebimento.
- **Registrar Recebimento:** Os botões **Registrar Recebimento** e **Cancelar** aparecem somente quando há pelo menos um item marcado e, em todos os marcados, o campo **Qtde receb** está preenchido com número inteiro maior que zero.
  - **Registrar Recebimento:** grava os itens selecionados na tabela de recebimentos (nf_empenho). Em sucesso, a seleção é limpa e uma mensagem informa quantos itens foram criados.
  - **Cancelar:** desmarca todos os itens.
- **Exportação:** Use **Exportar PDF (horizontal)** ou **Exportar Excel formatado** para gerar relatórios da lista exibida.

---

## 9. Lista de Recebimentos

- **Objetivo:** Visualizar os recebimentos já registrados (origem: tabela nf_empenho).
- **Filtros:** Fornecedor, Empenho, Código. **Buscar** e **Limpar** para aplicar ou resetar.
- **Tabela:** ID, Fornecedor, Data, Empenho, Item, Código, Material, Saldo Emp, Qtde Receb, Situação, Usuário (nome completo quando disponível).
- **Paginação:** Altere “Registros por página” e use **Anterior** / **Próxima**.
- **Exportação:** PDF horizontal e Excel formatado.

---

## 10. Adicionar Observações

- **Objetivo:** Cadastrar observações vinculadas a um empenho (tabela nf_obs).
- **Empenho:** Digite o número do empenho no campo de texto (ex.: 2020NE804180).
- **Observação:** Preencha o texto respeitando o mínimo e o máximo de caracteres indicados (ex.: 10 a 200).
- **Botões:** **Salvar Observação** grava os dados; **Cancelar** volta à tela anterior; **Limpar** limpa os campos.

---

## 11. Editar Recebimento

- **Objetivo:** Alterar dados de recebimentos já registrados.
- **Uso:** Utilize os filtros (empenho, código) para localizar os itens. Ajuste os campos editáveis (ex.: quantidade recebida, observação) e salve as alterações conforme os botões disponíveis na tela.

---

## 12. Dúvidas frequentes e problemas comuns

- **“Servidor indisponível” / erro ao carregar dados:** Verifique se o backend está em execução (na pasta backend: `npm run dev`). O frontend depende da API na porta configurada (ex.: 3001).
- **Não consigo fazer login:** Confirme usuário e senha. Se for o primeiro acesso, use as credenciais padrão da instalação ou solicite ao administrador.
- **Campo Observação vazio na Lista de Empenhos:** A observação é preenchida automaticamente quando existe registro em “Adicionar Observações” para aquele empenho. Caso não apareça, verifique se já foi cadastrada uma observação para o número do empenho.
- **Botões “Registrar Recebimento” e “Cancelar” não aparecem:** Eles só são exibidos quando há itens marcados com checkbox e, em todos eles, o campo **Qtde receb** está preenchido com número inteiro maior que zero.

---

*Documento: Manual de Uso — Controle de Empenhos e Estoque. Atualize este manual quando houver mudanças relevantes nas telas.*
