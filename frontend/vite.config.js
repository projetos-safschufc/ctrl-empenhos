import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: {
        host: process.env.VITE_DEV_HOST || '0.0.0.0',
        port: Number(process.env.VITE_DEV_PORT || 5177),
        proxy: {
            '/api': {
                target: process.env.VITE_BACKEND_URL || 'http://localhost:3001',
                changeOrigin: true,
                configure: function (proxy) {
                    proxy.on('error', function (err, _req, _res) {
                        var _a;
                        var isRefused = err.code === 'ECONNREFUSED' ||
                            (err.message && err.message.indexOf('ECONNREFUSED') !== -1) ||
                            (((_a = err.errors) === null || _a === void 0 ? void 0 : _a.length) && err.errors.some(function (e) { return e.code === 'ECONNREFUSED'; }));
                        if (isRefused) {
                            console.warn('[vite proxy] Backend não está acessível em ' + (process.env.VITE_BACKEND_URL || 'http://localhost:3001') + '. Inicie o backend: cd backend && npm run dev');
                        }
                        else {
                            console.error('[vite proxy]', err);
                        }
                    });
                },
            },
        },
    },
});
