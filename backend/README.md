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
- `npm run prisma:studio` – interface do Prisma
- `npm run seed` – popular perfis e usuário admin

## Documentação da API

Endpoints, métodos, query params e bodies estão descritos em **[API.md](./API.md)**.

## Estrutura

- `src/config` – DB, env, DW
- `src/routes` – auth, controle-empenhos, movimentacao-diaria, empenhos-pendentes, provisionamento
- `src/controllers`, `src/services`, `src/repositories`, `src/middlewares`, `src/utils`
