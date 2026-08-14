import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { PersistentStore } from '../services/storage.service';

dotenv.config();

export interface OpenWAConfigFile {
  openwaApiUrl?: string;
  openwaAdminKey?: string;
  webhookPublicUrl?: string;
  [key: string]: any;
}

export interface EnvConfig {
  PORT: number | string;
  NODE_ENV: string;
  JWT_SECRET: string;
  DATABASE_URL: string;
  OPENWA_API_URL: string;
  OPENWA_ADMIN_KEY: string;
  WEBHOOK_PUBLIC_URL: string;
}

/**
 * Multi-directory direct disk scan fallback in case PersistentStore is unavailable or throws.
 */
function loadFallbackConfig(): Partial<OpenWAConfigFile> {
  const isBackendCwd =
    process.cwd().endsWith('backend') ||
    process.cwd().endsWith('backend\\') ||
    process.cwd().endsWith('backend/');
  const rootDataDir = isBackendCwd ? path.resolve(process.cwd(), '../data') : path.resolve(process.cwd(), 'data');
  const backendDataDir = isBackendCwd ? path.resolve(process.cwd(), 'data') : path.resolve(process.cwd(), 'backend/data');

  const candidateDirs = [
    path.resolve(os.homedir(), '.danmax_crm_data'),
    path.resolve('/tmp/danmax_crm_persistent_data'),
    path.resolve(os.tmpdir(), 'danmax_crm_persistent_data'),
    rootDataDir,
    backendDataDir,
    path.resolve(__dirname, '../../data'),
    path.resolve(__dirname, '../../../data'),
  ];

  for (const dir of candidateDirs) {
    try {
      const configPath = path.join(dir, 'openwa_config.json');
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf-8');
        if (raw && raw.trim()) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            return parsed;
          }
        }
      }
    } catch {
      // Continue scanning remaining directories
    }
  }

  return {};
}

/**
 * Loads OpenWA configuration from multi-disk persistent store with automatic backfill and fallback.
 */
export function loadSavedOpenWAConfig(): Partial<OpenWAConfigFile> {
  try {
    if (typeof PersistentStore !== 'undefined' && typeof PersistentStore.readJSON === 'function') {
      return PersistentStore.readJSON<Partial<OpenWAConfigFile>>('openwa_config.json', {});
    }
  } catch (err) {
    console.warn('[ENV] Warning: PersistentStore.readJSON failed, falling back to direct disk scan:', err);
  }
  return loadFallbackConfig();
}

const savedConfig = loadSavedOpenWAConfig();

export const ENV: EnvConfig = {
  PORT: process.env.PORT || 4000,
  NODE_ENV: process.env.NODE_ENV || 'production',
  JWT_SECRET: process.env.JWT_SECRET || 'super_secret_crm_jwt_key_2026_antigravity',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/crm_whatsapp?schema=public',
  OPENWA_API_URL: savedConfig.openwaApiUrl || process.env.OPENWA_API_URL || 'https://whatsapp-autopublicaciones.agrolara.dedyn.io',
  OPENWA_ADMIN_KEY: savedConfig.openwaAdminKey || process.env.OPENWA_ADMIN_KEY || 'Agro1280@',
  WEBHOOK_PUBLIC_URL: savedConfig.webhookPublicUrl || process.env.WEBHOOK_PUBLIC_URL || 'https://crm-danmax-wa.agrolara.dedyn.io',
};

/**
 * Synchronizes ENV object with latest saved disk configuration.
 */
export function reloadEnvConfig(): EnvConfig {
  const latestSaved = loadSavedOpenWAConfig();
  if (latestSaved.openwaApiUrl) {
    ENV.OPENWA_API_URL = latestSaved.openwaApiUrl;
  }
  if (latestSaved.openwaAdminKey) {
    ENV.OPENWA_ADMIN_KEY = latestSaved.openwaAdminKey;
  }
  if (latestSaved.webhookPublicUrl) {
    ENV.WEBHOOK_PUBLIC_URL = latestSaved.webhookPublicUrl;
  }
  return ENV;
}
