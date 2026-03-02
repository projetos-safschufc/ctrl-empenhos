import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import fs from 'fs';
import routes from './routes';
import { sendError, ErrorCode } from './utils/errorResponse';
import { getCorsOptions } from './config/cors';

dotenv.config();

const app = express();

app.use(cors(getCorsOptions()));
app.use(express.json());

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', routes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Express error]', err);
  sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Erro interno do servidor');
});

function startServer(port: number, host: string): void {
  const server = app.listen(port, host, () => {
    const hasDbUrl = !!process.env.DATABASE_URL || !!(process.env.DB_HOST && process.env.DB_USER);
    let publicIp: string | null = null;
    const nets = os.networkInterfaces();
    if (nets) {
      for (const name of Object.keys(nets)) {
        const list = nets[name];
        if (list) {
          for (const net of list) {
            if (net.family === 'IPv4' && !net.internal) {
              publicIp = net.address;
              break;
            }
          }
        }
        if (publicIp) break;
      }
    }
    const displayHost = publicIp || host || 'localhost';
    console.log(`🚀 Servidor rodando em http://${displayHost}:${port} (DB: ${hasDbUrl ? 'configurada' : 'não definida'})`);
    if (process.env.NODE_ENV !== 'production') {
      const envLocalPath = path.join(__dirname, '../../.env.local');
      const frontendEnvLocalPath = path.join(__dirname, '../../frontend/.env.local');
      const backendUrl = `http://${displayHost}:${port}`;
      try {
        const content = `VITE_BACKEND_PORT=${port}\nVITE_BACKEND_URL=${backendUrl}\n`;
        // Mantém compatibilidade com scripts/ops no root do projeto
        fs.writeFileSync(envLocalPath, content);
        // Permite que o Vite leia automaticamente (frontend/.env.local)
        fs.writeFileSync(frontendEnvLocalPath, content);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('Não foi possível escrever .env.local:', msg);
      }
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