# Frontend – Controle de Empenhos e Estoque

React + TypeScript + Vite + Chakra UI. Paleta: fundo areia (#F5F0E6), verde (#8BC547), verde escuro (#145D50).

## Comandos

- `npm install` – instalar dependências
- `npm run dev` – desenvolvimento (http://localhost:5173)
- `npm run build` – build de produção
- `npm run preview` – preview do build

## Configuração

Em desenvolvimento, o Vite faz proxy de `/api` para o backend em `http://localhost:3001`. **Mantenha o backend rodando** (na raiz: `npm run dev:backend` ou em `backend`: `npm run dev`). Se o backend estiver parado, ao tentar login ou outras chamadas à API você verá "Servidor indisponível..." e no terminal do Vite podem aparecer erros `ECONNREFUSED`/`ECONNRESET` — isso é esperado; suba o backend para corrigir.

Para apontar para outra URL da API (ex.: produção), crie `.env` no frontend com:

```
VITE_API_URL=https://sua-api.com/api
```

## Estrutura

- `src/api` – cliente HTTP e chamadas à API (auth)
- `src/contexts` – AuthContext (login, logout, user)
- `src/components` – PrivateRoute, Layout (sidebar)
- `src/pages` – Login, Dashboard, Controle de Empenhos, Provisionamento
- `src/theme` – tema Chakra (cores do projeto)
