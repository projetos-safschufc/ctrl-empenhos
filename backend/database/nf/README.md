# Módulo Recebimento de Notas Fiscais – Schema NF

## Aplicar o schema

**Opção 1 – Script Node (recomendado, usa o mesmo .env do backend):**

```bash
cd backend
npm run db:init-nf
```

**Opção 2 – psql manual:**

Conecte ao PostgreSQL com um usuário com permissão para criar schema e execute:

```bash
psql -h <host> -U <user> -d <database> -f database/nf/01_create_nf_schema.sql
```

Ou via variáveis de ambiente (usando as mesmas `DB_*` do backend):

```bash
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_DATABASE -f database/nf/01_create_nf_schema.sql
```

**Importante:** se a senha contiver `#`, use aspas no `.env`: `DB_PASSWORD="abi123@#qwe"`.

## Estrutura

- **Schema:** `nf`
- **Tabelas (public):**
  - `public.nf_empenho` – recebimento por empenho (numero, data, empenho, itens, valores, situacao, etc.)
  - `public.nf_obs` – observações por empenho (empenho_id, observacao, usuario, date)
- **Tabelas (schema nf):**
  - `nf.recebimento_nota_fiscal` – cadastro do recebimento (número NF, fornecedor, datas, valor, status)
  - `nf.item_recebimento_nf` – itens da nota (material, quantidade, valores)

### Performance: nf_obs

- Índices e análise de performance: ver `database/nf/NF_OBS_PERFORMANCE.md`.
- Apenas índices (tabela já existente): `02_nf_obs_indexes.sql`.
- Produção (tabela grande): `02_nf_obs_indexes_concurrent.sql` (criar índices com CONCURRENTLY).

## API

- `GET /api/recebimento-notas-fiscais` – lista com filtros e paginação
- `GET /api/recebimento-notas-fiscais/:id` – detalhe com itens
- `POST /api/recebimento-notas-fiscais` – criar (body: numero_nf, data_recebimento, ...)
- `PATCH /api/recebimento-notas-fiscais/:id` – atualizar
- `DELETE /api/recebimento-notas-fiscais/:id` – excluir

Todas as rotas exigem autenticação (Bearer token).
