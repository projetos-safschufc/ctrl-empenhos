import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(function (_a) {
    var mode = _a.mode;
    // Vite carrega automaticamente .env, .env.local etc do diretório do frontend
    var env = loadEnv(mode, process.cwd(), '');
    // Detectar backend dinamicamente (backend escreve frontend/.env.local em dev)
    var BACKEND_PORT = env.VITE_BACKEND_PORT || process.env.VITE_BACKEND_PORT || '3002';
    var BACKEND_URL = env.VITE_BACKEND_URL || process.env.VITE_BACKEND_URL || "http://localhost:".concat(BACKEND_PORT);
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
                    configure: function (proxy) {
                        proxy.on('error', function (err) {
                            var _a;
                            var isRefused = err.code === 'ECONNREFUSED' ||
                                (err.message && err.message.indexOf('ECONNREFUSED') !== -1) ||
                                (((_a = err.errors) === null || _a === void 0 ? void 0 : _a.length) && err.errors.some(function (e) { return e.code === 'ECONNREFUSED'; }));
                            if (isRefused) {
                                console.warn("[vite proxy] Backend n\u00E3o est\u00E1 acess\u00EDvel em ".concat(BACKEND_URL, "."));
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
    };
});
