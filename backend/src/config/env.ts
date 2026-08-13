import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT || 4000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'super_secret_crm_jwt_key_2026_antigravity',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/crm_whatsapp?schema=public',
  OPENWA_API_URL: process.env.OPENWA_API_URL || 'https://whatsapp-autopublicaciones.agrolara.dedyn.io',
  OPENWA_ADMIN_KEY: process.env.OPENWA_ADMIN_KEY || 'default_admin_key',
  WEBHOOK_PUBLIC_URL: process.env.WEBHOOK_PUBLIC_URL || 'http://localhost:4000',
};
