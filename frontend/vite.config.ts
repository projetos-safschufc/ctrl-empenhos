import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Vite carrega automaticamente .env, .env.local etc do diretório do frontend
  const env = loadEnv(mode, process.cwd(), '');

  // Detectar backend dinamicamente (backend escreve frontend/.env.local em dev)
  const BACKEND_PORT = env.VITE_BACKEND_PORT || process.env.VITE_BACKEND_PORT || '3002';
  const BACKEND_URL = env.VITE_BACKEND_URL || process.env.VITE_BACKEND_URL || `http://localhost:${BACKEND_PORT}`;

  return {
    plugins: [react()],
    define: {
      'process.env.VITE_BACKEND_URL': JSON.stringify(BACKEND_URL),
      'process.env.VITE_BACKEND_PORT': JSON.stringify(BACKEND_PORT),
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: BACKEND_URL,
          changeOrigin: true,
          configure: (proxy) => {
            (proxy as unknown as { on(event: string, cb: (...args: unknown[]) => void): void }).on(
              'error',
              (err: { code?: string; message?: string; errors?: Array<{ code?: string }> }) => {
                const isRefused =
                  err.code === 'ECONNREFUSED' ||
                  (err.message && err.message.indexOf('ECONNREFUSED') !== -1) ||
                  (err.errors?.length && err.errors.some((e) => e.code === 'ECONNREFUSED'));
                if (isRefused) {
                  console.warn(`[vite proxy] Backend não está acessível em ${BACKEND_URL}.`);
                  console.warn('Inicie o backend com: cd backend && npm run dev');
                } else {
                  console.error('[vite proxy]', err);
                }
              }
            );
          },
        },
      },
    },
  };
});
