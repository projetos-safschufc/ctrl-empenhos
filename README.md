# Sistema de Controle de Empenhos e Estoque

Aplicação full-stack com **Backend** e **Frontend** em pastas separadas. Banco: PostgreSQL (SAFS, schema `ctrl`).

## Estrutura do projeto

```
app_ctrl_emp_estq/
├── backend/                 # BACKEND (Node.js, Express, Prisma)
│   ├── src/
│   ├── prisma/
│   ├── scripts/
│   ├── package.json
│   └── .env.example
├── frontend/                # FRONTEND (React, Vite, Chakra UI)
│   ├── src/
│   └── package.json
└── README.md
```

## Pré-requisitos

- Node.js 18+
- PostgreSQL (acesso aos bancos SAFS e DW)

## Instalação das dependências

**Opção 1 – Na raiz do projeto (recomendado):**
```bash
npm run install:all
```
Isso instala as dependências do `backend` e do `frontend` em sequência.

**Opção 2 – Em cada pasta:**
```bash
cd backend
npm install

cd ../frontend
npm install
```

## Configuração e execução

### Backend

1. Entre na pasta do backend:
   ```bash
   cd backend
   ```

2. Copie o arquivo de ambiente e ajuste as variáveis **na pasta backend**:
   ```bash
   copy .env.example .env
   ```
   O backend carrega **somente** `backend/.env` (não usa o `.env` da raiz do projeto). Use `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` para o SAFS. **Se a senha tiver `#`, `@` ou `!`, use aspas no .env:** `DB_PASSWORD="abi123!@#qwe"`. O tratamento segue: normalização (mantém #, remove BOM/controle); onde o cliente permite (pg Pool/Client), a senha é passada como parâmetro explícito; na URI (Prisma) a senha é codificada (#→%23). Opcionalmente configure `DW_*` para o banco DW.

3. Instale as dependências, gere o Prisma e aplique as migrations:
   ```bash
   npm install
   npm run prisma:generate
   npm run prisma:migrate
   ```
   Se aparecer erro **P3005** (banco não vazio), na pasta `backend` rode:  
   `npm run db:init` (cria o schema `ctrl` e as tabelas). Depois:  
   `npx prisma migrate resolve --applied 20250213000000_init_schema_ctrl`

   Se o backend subir mas ao fazer login aparecer **"The table \`ctrl.profiles\` does not exist"**, na pasta `backend` rode:  
   `npm run db:init` e em seguida `npm run seed`.

   Se aparecer erro **"The column users.active does not exist"**, na pasta `backend` rode:  
   `npm run db:fix-users-columns` (adiciona as colunas faltantes em `ctrl.users`).

   Se aparecer erro **"The column safs_catalogo.descricao does not exist"**, na pasta `backend` rode:  
   `npm run db:fix-catalogo-columns` (adiciona as colunas faltantes em `ctrl.safs_catalogo`).

4. Execute o seed (perfis e usuário admin):
   ```bash
   npm run seed
   ```
   Usuário inicial: `admin@safs.local` / `Admin@123#` (a senha contém o caractere especial `#`). Se você já tinha rodado o seed antes, execute de novo na pasta `backend`: `npm run seed`, para atualizar a senha do admin para `Admin@123#`.

5. Suba o servidor (deixe este terminal aberto):
   ```bash
   npm run dev
   ```
   API em `http://localhost:3001`. **O frontend só funciona se o backend estiver rodando** (o proxy do Vite encaminha `/api` para a porta 3001). Em outro terminal, suba o frontend.

### Frontend

1. Entre na pasta do frontend:
   ```bash
   cd frontend
   ```

2. Instale e rode **em outro terminal** (com o backend já rodando):
   ```bash
   npm install
   npm run dev
   ```
   Acesse `http://localhost:5173`. O proxy envia `/api` para o backend em `http://localhost:3001`. Se aparecer "Servidor indisponível" ou erro de proxy, confira se o backend está em execução na porta 3001.

## Scripts na raiz

Na raiz do projeto (`package.json`):

| Script | Descrição |
|--------|-----------|
| `npm run install:all` | Instala dependências do backend e do frontend |
| `npm run dev:backend` | Sobe o servidor backend (porta 3001) |
| `npm run dev:frontend` | Sobe o frontend Vite (porta 5173) |
| `npm run build:backend` | Build do backend (TypeScript) |
| `npm run build:frontend` | Build do frontend para produção |

Consulte também `backend/README.md` e `frontend/README.md` para detalhes de cada parte.

## Estrutura do Backend

- `backend/src/config` – configuração (DB, env, DW)
- `backend/src/routes` – rotas da API (auth, controle-empenhos, movimentacao-diaria, empenhos-pendentes, provisionamento)
- `backend/src/controllers` – controladores
- `backend/src/services` – lógica de negócio
- `backend/src/repositories` – acesso a dados (SAFS via Prisma, DW via `pg`)
- `backend/src/middlewares` – autenticação (JWT), autorização
- `backend/prisma/` – schema e migrations

## Banco de dados

- **SAFS** (schema `ctrl`): `profiles`, `users`, `safs_catalogo`, `hist_ctrl_empenho`; `public.empenho`
- **DW**: views `v_df_movimento`, `v_df_consumo_estoque`, `v_df_estoque`, `v_safs_fempenho` (configure `DW_*` no `.env` do backend)

### Estratégia com Prisma

O backend usa **Prisma** para o banco SAFS (schema `ctrl` e `public`): tipagem forte, migrations e um único ponto de verdade (`schema.prisma`). Os erros do tipo *"The table \`ctrl.profiles\` does not exist"* ocorrem quando o banco ainda não foi inicializado (schema/tabelas não criados).

- **Na subida do servidor** é feita uma verificação (via `information_schema`): se `ctrl.profiles` não existir, o processo **não sobe** e é exibida a instrução para rodar `npm run db:init` (e depois `npm run seed`). Assim o problema aparece na hora do `npm run dev`, e não só no primeiro login.
- **Quando o banco não está vazio** (P3005), use `npm run db:init` em vez de `prisma migrate deploy`; em seguida marque a migration como aplicada com `npx prisma migrate resolve --applied 20250213000000_init_schema_ctrl` se precisar.
