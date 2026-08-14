import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const DATA_DIR = path.join(__dirname, '../../data');
const CONFIG_FILE = path.join(DATA_DIR, 'openwa_config.json');

let savedConfig: any = {};
try {
  if (fs.existsSync(CONFIG_FILE)) {
    savedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  }
} catch (e) {}

export const ENV = {
  PORT: process.env.PORT || 4000,
  NODE_ENV: process.env.NODE_ENV || 'production',
  JWT_SECRET: process.env.JWT_SECRET || 'super_secret_crm_jwt_key_2026_antigravity',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/crm_whatsapp?schema=public',
  OPENWA_API_URL: savedConfig.openwaApiUrl || process.env.OPENWA_API_URL || 'https://whatsapp-autopublicaciones.agrolara.dedyn.io',
  OPENWA_ADMIN_KEY: savedConfig.openwaAdminKey || process.env.OPENWA_ADMIN_KEY || 'Agro1280@',
  WEBHOOK_PUBLIC_URL: process.env.WEBHOOK_PUBLIC_URL || 'https://crm-danmax-wa.agrolara.dedyn.io',
};
