import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { getDatabaseUrl } from './database';

const cwd = process.cwd();
const backendEnv = cwd.endsWith('backend')
  ? path.join(cwd, '.env')
  : path.join(cwd, 'backend', '.env');
const fallbackEnv = path.join(cwd, '.env');

if (fs.existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
} else if (fs.existsSync(fallbackEnv)) {
  dotenv.config({ path: fallbackEnv });
} else {
  dotenv.config();
}

// DATABASE_URL: montada com DB_* quando possível (senha normalizada e codificada para #, @, !)
process.env.DATABASE_URL = getDatabaseUrl();
