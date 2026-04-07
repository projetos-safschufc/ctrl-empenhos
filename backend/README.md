# Backend – Controle de Empenhos e Estoque

Node.js + TypeScript + Express + Prisma. Bancos: SAFS (Prisma) e DW (pg, views).

## Configuração

1. `copy .env.example .env` e preencha `DB_*` (e opcionalmente `DW_*`, `JWT_SECRET`, `PORT`).
2. `npm install`
3. `npm run prisma:generate` e `npm run prisma:migrate` (ou use o SQL idempotente em `prisma/scripts/` em caso de P3005).
4. `npm run seed` → usuário admin: `admin@safs.local` / `Admin@123#` (senha com `#`)

## Comandos

- `npm run dev` – desenvolvimento
- `npm run build` e `npm start` – produção
- `npm run start:prod` – build + start em sequência
- `npm run prisma:studio` – interface do Prisma
- `npm run seed` – popular perfis e usuário admin

## Execução com PM2 (produção)

1. Build da aplicação:

   - `npm run build`

2. Subir com PM2:

   - `npm run pm2:start`

3. Comandos úteis:

   - `npm run pm2:status`
   - `npm run pm2:logs`
   - `npm run pm2:restart`
   - `npm run pm2:stop`
   - `npm run pm2:delete`

4. Persistir processos após reboot:

   - `npm run pm2:save`
   - `pm2 startup` (executar o comando retornado pelo PM2 no terminal)

Arquivo de configuração do PM2:

- `ecosystem.config.cjs`

## Documentação da API

Endpoints, métodos, query params e bodies estão descritos em **[API.md](./API.md)**.

## Estrutura

- `src/config` – DB, env, DW
- `src/routes` – auth, controle-empenhos, movimentacao-diaria, empenhos-pendentes, provisionamento
- `src/controllers`, `src/services`, `src/repositories`, `src/middlewares`, `src/utils`
