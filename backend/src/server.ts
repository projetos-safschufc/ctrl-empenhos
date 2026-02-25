import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes';
import { sendError, ErrorCode } from './utils/errorResponse';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = parseInt(process.env.PORT || '3001');
const HOST = process.env.HOST || '0.0.0.0';

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', routes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Express error]', err);
  sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro interno do servidor');
});

/**
 * Tenta iniciar o servidor em uma porta.
 * Se estiver em uso, tenta próximas portas automaticamente.
 */
function startServer(port: number, host: string): void {
  const server = app.listen(port, host, () => {
    const hasDbUrl = !!process.env.DATABASE_URL;
    // detectar IP de rede para escrever URL amigável para outros hosts
    const os = require('os');
    const nets = os.networkInterfaces();
    let publicIp: string | null = null;
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          publicIp = net.address;
          break;
        }
      }
      if (publicIp) break;
    }
    const displayHost = publicIp || host || 'localhost';
    console.log(`🚀 Servidor rodando em http://${displayHost}:${port} (DB: ${hasDbUrl ? 'configurada' : 'não definida'})`);
    // Salvar porta/URL em .env.local para frontend consumir
    const fs = require('fs');
    const path = require('path');
    const envLocalPath = path.join(__dirname, '../../.env.local');
    const backendUrl = `http://${displayHost}:${port}`;
    try {
      fs.writeFileSync(envLocalPath, `VITE_BACKEND_PORT=${port}\nVITE_BACKEND_URL=${backendUrl}`);
    } catch (e) {
      console.warn('Não foi possível escrever .env.local:', e.message || e);
    }
  }).on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️  Porta ${port} já está em uso. Tentando porta ${port + 1}...`);
      startServer(port + 1, host);
    } else {
      throw err;
    }
  });
}

startServer(PORT, HOST);