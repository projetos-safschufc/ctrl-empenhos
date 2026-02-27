import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Detectar porta do backend dinamicamente
var BACKEND_PORT = process.env.VITE_BACKEND_PORT || process.env.PORT || '3001';
var BACKEND_URL = "http://localhost:".concat(BACKEND_PORT);
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
                configure: function (proxy) {
                    proxy.on('error', function (err, _req, _res) {
                        var _a;
                        var isRefused = err.code === 'ECONNREFUSED' ||
                            (err.message && err.message.indexOf('ECONNREFUSED') !== -1) ||
                            (((_a = err.errors) === null || _a === void 0 ? void 0 : _a.length) && err.errors.some(function (e) { return e.code === 'ECONNREFUSED'; }));
                        if (isRefused) {
                            console.warn('[vite proxy] Backend não está rodando em http://localhost:3001.');
                            console.warn('Inicie o backend com: cd backend && npm run dev');
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
