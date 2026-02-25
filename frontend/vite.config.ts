import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Detectar porta do backend dinamicamente
const BACKEND_PORT = process.env.VITE_BACKEND_PORT || process.env.PORT || '3001';
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

export default defineConfig({
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
          (proxy as unknown as { on(event: string, cb: (...args: unknown[]) => void): void }).on('error', (err: { code?: string; message?: string; errors?: Array<{ code?: string }> }, _req, _res) => {
            const isRefused =
              err.code === 'ECONNREFUSED' ||
              (err.message && err.message.indexOf('ECONNREFUSED') !== -1) ||
              (err.errors?.length && err.errors.some((e) => e.code === 'ECONNREFUSED'));
            if (isRefused) {
              console.warn(
                '[vite proxy] Backend não está rodando em http://localhost:3001.'
              );
              console.warn('Inicie o backend com: cd backend && npm run dev');
            } else {
              console.error('[vite proxy]', err);
            }
          });
        },
      },
    },
  },
});
