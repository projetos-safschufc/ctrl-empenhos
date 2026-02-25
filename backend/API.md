# Documentação da API – Controle de Empenhos e Estoque

Base URL: `http://localhost:3001/api` (ou a URL configurada no frontend).

Todas as rotas protegidas exigem o header: `Authorization: Bearer <token>`.

---

## Raiz

| Método | Path | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api` | Não | Mensagem de boas-vindas: `{ "message": "API Controle de Empenhos e Estoque" }` |

---

## Autenticação (`/api/auth`)

| Método | Path | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/api/auth/login` | Não | Login. Body: `{ "email", "password" }`. Retorna `{ "token", "user" }`. |
| POST | `/api/auth/register` | Não | Registro. Body: `{ "email", "password", "name?" }`. Retorna `{ "token", "user" }`. |
| GET | `/api/auth/me` | Sim | Usuário autenticado. Retorna objeto do usuário. |

---

## Controle de Empenhos (`/api/controle-empenhos`)

| Método | Path | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/controle-empenhos/dashboard` | Sim | Resumo: `{ "totalMateriais", "totalPendencias", "totalAtencao", "totalCritico" }`. |
| GET | `/api/controle-empenhos` | Sim | Lista itens. Query: `codigo`, `setor`, `responsavel`, `status`, `comRegistro`, `page`, `pageSize`. Retorna `{ "itens", "total", "page", "pageSize", "mesesConsumo" }`. |
| POST | `/api/controle-empenhos/historico` | Sim | Salva histórico. Body: `material_id` (obrig.), `classificacao`, `resp_controle`, `setor_controle`, `master_descritivo`, `numero_registro`, `valor_unit_registro`, `saldo_registro`, `qtde_por_embalagem`, `tipo_armazenamento`, `capacidade_estocagem`, `observacao`. |

---

## Movimentação Diária (`/api/movimentacao-diaria`)

| Método | Path | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/movimentacao-diaria` | Sim | Movimentações do mês. Query: `data` (YYYY-MM-DD). Retorna `{ "data", "itens" }`. Cada item: `mat_cod_antigo`, `movimento_cd`, `tipo`, `quantidade`, `mesano`. |

---

## Empenhos Pendentes (`/api/empenhos-pendentes`)

| Método | Path | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/empenhos-pendentes` | Sim | Lista empenhos (public.empenho; status_item ≠ "Atendido", fl_evento = "Empenho", qt_saldo > 0). Query: `codigo`, `empenho`, `page`, `pageSize`. Retorna `{ "itens", "total", "page", "pageSize" }`. Padrão: page=1, pageSize=20 (máx. 100). |

---

## Provisionamento (`/api/provisionamento`)

| Método | Path | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/provisionamento/:codigoMaterial` | Sim | Dados do material para provisionamento. Retorna `{ "codigo", "descricao", "mediaConsumo", "estoqueAlmoxarifados", "estoqueVirtual", "tempoAbastecimento", "registros" }`. |
| POST | `/api/provisionamento/gerar-pdf` | Sim | Gera PDF. Body: `{ "codigoMaterial", "descricao?", "linhas": [{ "numero_registro?", "vigencia?", "valor_unitario?", "qtde_pedida", "observacao?" }] }`. Retorna PDF (Content-Disposition). |

---

## Erros (resposta padronizada)

Todas as respostas de erro retornam JSON no formato:

```json
{
  "code": "CODIGO",
  "message": "Mensagem legível",
  "error": "Mensagem legível"
}
```

O campo `error` é mantido para compatibilidade com clientes que já leem `.error`. O padrão é usar `code` + `message`.

| code | HTTP | Descrição |
|------|------|-----------|
| UNAUTHORIZED | 401 | Token ausente, inválido ou expirado |
| BAD_REQUEST | 400 | Dados inválidos (ex.: campo obrigatório ausente) |
| NOT_FOUND | 404 | Recurso não encontrado |
| CONFLICT | 409 | Conflito (ex.: e-mail já cadastrado) |
| INTERNAL_ERROR | 500 | Erro interno do servidor |
