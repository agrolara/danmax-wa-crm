# Handoff Report: OpenWA Config Resolution & Persistent Boot Loading (`env.ts`)

**Agent**: Explorer 3 (Milestone 1)  
**Target File**: `backend/src/config/env.ts`  
**Working Directory**: `c:\Users\Usuario\Documents\antigravity\CRM WHATSAPP\.agents\explorer_m1_3`  
**Date**: 2026-08-14T04:52:30Z  

---

## 1. Observation

### 1.1 Baseline Analysis of `backend/src/config/env.ts`
Current file content (lines 1–26):
```typescript
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
```

### 1.2 Observed Deficiencies and Architectural Gaps
1. **Single Ephemeral Path Vulnerability**:
   - `const DATA_DIR = path.join(__dirname, '../../data');` resolves strictly relative to `__dirname`.
   - In containerized production (Docker / Coolify / Alpine), the container root directory `/app` or `/app/backend/data` is destroyed on redeployments or container restarts unless explicitly mounted.
   - Surviving copies of `openwa_config.json` residing in `~/.danmax_crm_data` or `/tmp/danmax_crm_persistent_data` are completely ignored by `env.ts` during server boot.
2. **Missing Auto-Backfill Integration**:
   - Unlike other data stores (`groups_categories.json`, `templates_db.json`, `kanban_store.json`), `env.ts` did not use `PersistentStore.readJSON`.
   - When a new container boots with empty `./data`, it fails to restore `openwa_config.json` from the surviving persistent volume, causing the server to fall back to hardcoded defaults instead of the user's saved OpenWA URL and admin key.
3. **Absence of Strict TypeScript Interfaces**:
   - `let savedConfig: any = {};` uses untyped `any`, lacking property validation or IDE autocomplete safety.
4. **Runtime Mutation Pattern in `tenant.routes.ts`**:
   - In `backend/src/routes/tenant.routes.ts` (lines 79–96):
     ```typescript
     if (apiUrl) {
       ENV.OPENWA_API_URL = apiUrl;
       process.env.OPENWA_API_URL = apiUrl;
     }
     if (adminKey && !adminKey.includes('•')) {
       ENV.OPENWA_ADMIN_KEY = adminKey;
       process.env.OPENWA_ADMIN_KEY = adminKey;
     }
     PersistentStore.writeJSON('openwa_config.json', {
       openwaApiUrl: ENV.OPENWA_API_URL,
       openwaAdminKey: ENV.OPENWA_ADMIN_KEY,
     });
     ```
   - When the user updates their OpenWA credentials via the UI, `tenant.routes.ts` writes to `openwa_config.json` using `PersistentStore.writeJSON` across all persistent directories and mutates `ENV.OPENWA_API_URL` and `ENV.OPENWA_ADMIN_KEY` in memory.
5. **No Circular Dependency**:
   - `backend/src/services/storage.service.ts` only imports `fs`, `path`, `os`, `express` (`Request`). It does not import `env.ts`.
   - Importing `PersistentStore` into `backend/src/config/env.ts` produces a clean Directed Acyclic Graph (DAG) with zero circular module resolution issues.

---

## 2. Logic Chain

1. **Step 1 — Multi-Directory Persistence Requirement**:
   - *Observation 1.1 & 1.2*: Cloud platforms may mount persistent storage at `~/.danmax_crm_data`, `/tmp/danmax_crm_persistent_data`, or `./data`.
   - *Inference*: `env.ts` must query `PersistentStore.readJSON('openwa_config.json', {})` so that any surviving disk partition recovers the OpenWA connection parameters on server start.
2. **Step 2 — Completeness & Cross-Disk Auto-Backfill**:
   - *Observation 1.2*: `PersistentStore.readJSON` already performs scoring and executes `this.writeJSON` to backfill missing/incomplete disks.
   - *Inference*: Calling `PersistentStore.readJSON('openwa_config.json', {})` during boot guarantees that if a fresh container is deployed with an empty local disk, it instantly synchronizes and writes `openwa_config.json` to the local `./data` folder from surviving mounts.
3. **Step 3 — Defense-in-Depth Fallback Architecture**:
   - *Observation 1.1 & 1.3*: In extreme scenarios (e.g. standalone test harnesses, isolated mock environments, or if `PersistentStore` threw an error), boot must never crash.
   - *Inference*: Implementing a 4-tier resolution hierarchy:
     1. **Tier 1**: `PersistentStore.readJSON<Partial<OpenWAConfigFile>>('openwa_config.json', {})` with auto-backfill.
     2. **Tier 2**: Inline filesystem multi-directory search scanning `[~/.danmax_crm_data, /tmp/danmax_crm_persistent_data, os.tmpdir(), ./data, ../../data]`.
     3. **Tier 3**: Environment variables (`process.env.OPENWA_API_URL`, `process.env.OPENWA_ADMIN_KEY`, `process.env.WEBHOOK_PUBLIC_URL`).
     4. **Tier 4**: Safe default constants (`https://whatsapp-autopublicaciones.agrolara.dedyn.io`, `Agro1280@`, `https://crm-danmax-wa.agrolara.dedyn.io`).
4. **Step 4 — Runtime Synchronization & Compatibility**:
   - *Observation 1.4*: Direct mutation of `ENV` properties (`ENV.OPENWA_API_URL = ...`) is used in `tenant.routes.ts`.
   - *Inference*: The exported `ENV` object must remain mutable and implement the `EnvConfig` interface. Adding `reloadEnvConfig()` and `loadSavedOpenWAConfig()` provides utility for explicit synchronization without breaking existing in-place mutations.

---

## 3. Caveats

1. **Top-Level Synchronous Execution**:
   - `env.ts` executes synchronously at module load time before Express starts listening. All disk operations in `PersistentStore.readJSON` and fallback scanners are synchronous (`fs.readFileSync`, `fs.existsSync`). This is intended and required for configuration boot.
2. **Key Masking in UI**:
   - `tenant.routes.ts` prevents saving masked keys (e.g. `••••••••1280`) back to disk. `openwa_config.json` stores the raw key.
3. **No Caveats regarding Circular Imports**:
   - Verified that `storage.service.ts` does not depend on `env.ts`.

---

## 4. Conclusion & Proposed Implementation

### 4.1 Target File: `backend/src/config/env.ts`

Here is the complete, drop-in replacement code for `backend/src/config/env.ts`:

```typescript
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
 * Multi-directory disk search fallback if PersistentStore is not yet initialized or fails
 */
function loadFallbackConfig(): Partial<OpenWAConfigFile> {
  const candidateDirs = [
    path.resolve(os.homedir(), '.danmax_crm_data'),
    path.resolve('/tmp/danmax_crm_persistent_data'),
    path.resolve(os.tmpdir(), 'danmax_crm_persistent_data'),
    path.resolve(process.cwd(), 'data'),
    path.resolve(__dirname, '../../data'),
    path.resolve(__dirname, '../../../data'),
  ];

  for (const dir of candidateDirs) {
    try {
      const configPath = path.join(dir, 'openwa_config.json');
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch {
      // Continue searching next candidate directory
    }
  }

  return {};
}

/**
 * Loads OpenWA configuration from persistent store with multi-tiered fallback
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
 * Synchronizes ENV object with latest saved disk configuration
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
```

---

## 5. Verification Method

To independently verify the implementation:

1. **TypeScript Type Safety Check**:
   ```bash
   cmd.exe /c "npx tsc --noEmit"
   ```
   Must compile with 0 errors in `backend/`.

2. **Boot Recovery Test across Surviving Volumes**:
   - Write a custom config to `~/.danmax_crm_data/openwa_config.json`:
     `{"openwaApiUrl": "https://custom-openwa.example.com", "openwaAdminKey": "CustomKey999"}`
   - Ensure `./data/openwa_config.json` and `/tmp/danmax_crm_persistent_data/openwa_config.json` do NOT exist.
   - Boot Node / import `ENV`:
     ```javascript
     const { ENV } = require('./dist/config/env');
     console.assert(ENV.OPENWA_API_URL === 'https://custom-openwa.example.com', 'Failed to recover custom URL');
     console.assert(ENV.OPENWA_ADMIN_KEY === 'CustomKey999', 'Failed to recover custom admin key');
     ```
   - Verify that `./data/openwa_config.json` was automatically backfilled by `PersistentStore.readJSON`.

3. **Zero Crash Absence Test**:
   - Delete all copies of `openwa_config.json` across all candidate paths.
   - Clear environment variables `OPENWA_API_URL` and `OPENWA_ADMIN_KEY`.
   - Boot Node / import `ENV`.
   - Verify `ENV.OPENWA_API_URL === 'https://whatsapp-autopublicaciones.agrolara.dedyn.io'` and `ENV.OPENWA_ADMIN_KEY === 'Agro1280@'`.

4. **Runtime Mutation & Reload Test**:
   - Update `ENV.OPENWA_API_URL = 'https://updated.example.com'`.
   - Call `PersistentStore.writeJSON('openwa_config.json', { openwaApiUrl: 'https://updated.example.com', openwaAdminKey: 'NewKey' })`.
   - Call `reloadEnvConfig()`.
   - Verify `ENV.OPENWA_ADMIN_KEY === 'NewKey'`.
