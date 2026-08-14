# Milestone 1: Storage Engine Core & Multi-Disk Fallback — Architectural Analysis & Handoff Report

**Agent**: Explorer 1 (Milestone 1)  
**Date**: 2026-08-14T04:53:00Z  
**Target Files**:
- `backend/src/services/storage.service.ts`
- `backend/src/config/env.ts`

---

## 1. Observation

### Current Implementation State
Direct examination of `backend/src/services/storage.service.ts` (lines 1-104) and `backend/src/config/env.ts` (lines 1-26) reveals:

1. **Hardcoded Persistent Directory Array**:
   - `storage.service.ts` (lines 7-11):
     ```typescript
     const PERSISTENT_DIRS = [
       path.join(os.homedir(), '.danmax_crm_data'),
       '/tmp/danmax_crm_persistent_data',
       path.join(__dirname, '../../data'),
     ];
     ```
   - **Limitation**: Missing `path.join(os.tmpdir(), 'danmax_crm_persistent_data')` (which dynamically resolves to `%TEMP%\danmax_crm_persistent_data` on Windows and `/tmp/...` on POSIX), `./data` relative to `process.cwd()`, and `./backend/data`. Paths are not deduplicated or fully normalized.

2. **Non-Atomic File Writing Vulnerability**:
   - `storage.service.ts` (lines 91-102):
     ```typescript
     public static writeJSON<T>(filename: string, data: T): void {
       for (const dir of PERSISTENT_DIRS) {
         try {
           if (!fs.existsSync(dir)) {
             fs.mkdirSync(dir, { recursive: true });
           }
           const filePath = path.join(dir, filename);
           fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
         } catch (err) {}
       }
     }
     ```
   - **Limitation**: Direct `fs.writeFileSync` directly overwrites the target file in place. If the server process crashes, is terminated by Docker during container redeployment (`SIGKILL`/`SIGTERM`), or a concurrent read occurs mid-write, the JSON file is left corrupted/truncated (0-byte or syntax-error state), causing data loss.

3. **Crude Completeness Scoring in Recovery**:
   - `storage.service.ts` (lines 60-80):
     ```typescript
     const raw = fs.readFileSync(filePath, 'utf-8');
     const parsed = JSON.parse(raw) as T;
     const entriesCount = raw.length;
     if (entriesCount > maxEntriesCount) {
       maxEntriesCount = entriesCount;
       bestData = parsed;
     }
     ```
   - **Limitation**: `raw.length` measures raw character count. An empty object with lots of whitespace or an empty template store could override a compact but populated store. It should compute structural completeness based on keys count, tenant entries, and nested items (templates, categories, leads, lines).

4. **Single-Path Config Boot in `env.ts`**:
   - `backend/src/config/env.ts` (lines 7-15):
     ```typescript
     const DATA_DIR = path.join(__dirname, '../../data');
     const CONFIG_FILE = path.join(DATA_DIR, 'openwa_config.json');
     let savedConfig: any = {};
     try {
       if (fs.existsSync(CONFIG_FILE)) {
         savedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
       }
     } catch (e) {}
     ```
   - **Limitation**: If `./data/openwa_config.json` is missing or cleared on rebuild, but `openwa_config.json` was persisted in `~/.danmax_crm_data` or `/tmp/danmax_crm_persistent_data`, `env.ts` fails to discover it. It must leverage `PersistentStore.readJSON` across all multi-disk tiers.

5. **TypeScript Verification Command**:
   - Running `node ./node_modules/typescript/bin/tsc --noEmit` in `c:\Users\Usuario\Documents\antigravity\CRM WHATSAPP\backend` executes cleanly with exit code 0.

---

## 2. Logic Chain

1. **Multi-Platform Persistent Directory Strategy**:
   - On Windows, paths like `/tmp/danmax_crm_persistent_data` may resolve to `C:\tmp\...` (which may fail due to lack of drive permissions or non-existence), whereas `path.join(os.tmpdir(), 'danmax_crm_persistent_data')` resolves reliably to `C:\Users\<user>\AppData\Local\Temp\danmax_crm_persistent_data`.
   - On Linux / Docker containers, `os.homedir()` resolves to `/root` or `/home/node`, while `/tmp/danmax_crm_persistent_data` provides container-level temporary persistence, and `./data` / `./backend/data` provide volume-mounted persistence.
   - Therefore, `getPersistentDirs()` must aggregate:
     1. `path.join(os.homedir(), '.danmax_crm_data')`
     2. `'/tmp/danmax_crm_persistent_data'`
     3. `path.join(os.tmpdir(), 'danmax_crm_persistent_data')`
     4. `path.resolve(process.cwd(), 'data')`
     5. `path.resolve(process.cwd(), 'backend/data')`
     6. `path.resolve(__dirname, '../../data')`
     7. `path.resolve(__dirname, '../../../data')`
   - All paths must be normalized (`path.resolve`) and deduplicated via `Set`.

2. **Directory Creation Safety (`ensureDir`)**:
   - `ensureDir(dirPath: string): boolean` must wrap `fs.mkdirSync(dirPath, { recursive: true })` inside a `try/catch` block.
   - If creation fails (e.g. read-only filesystem or OS permission restriction), it logs a debug warning and returns `false` without throwing an unhandled exception.
   - `writeJSON` and `readJSON` only operate on directories where `ensureDir` returns `true` or where the directory exists.

3. **Atomic File Writing Pattern with Fallback Resilience**:
   - To guarantee zero data loss:
     1. Create unique temporary file in the *same* directory as target file:
        `const tempPath = path.join(dir, `.${filename}.${process.pid}.${Date.now()}.${Math.random().toString(36).substring(2, 8)}.tmp`);`
        *(Placing temp file in the same directory guarantees it is on the same filesystem/mount, enabling atomic inode renaming).*
     2. Write complete JSON string to `tempPath` with `fs.writeFileSync(tempPath, serialized, 'utf-8')`.
     3. Perform atomic replace via `fs.renameSync(tempPath, targetPath)`.
     4. **Windows / Lock Resilience**: On Windows OS, `fs.renameSync` can throw `EPERM`, `EBUSY`, or `EACCES` if an active reader, antivirus scanner, or file watcher has an open handle on `targetPath`.
        - If `renameSync` throws, fallback to `fs.copyFileSync(tempPath, targetPath)` followed by `fs.unlinkSync(tempPath)`.
        - If `copyFileSync` also throws, fallback to direct `fs.writeFileSync(targetPath, serialized, 'utf-8')`.
     5. **Guaranteed Temp Cleanup**: Ensure `tempPath` is removed inside a `finally` block or catch block if it still exists.

4. **Completeness Scoring & Instant Cross-Disk Auto-Backfill**:
   - When reading a store (e.g. `groups_categories.json`, `templates_db.json`, `kanban_store.json`, `tenant_lines.json`, `openwa_config.json`), iterate through all persistent directories.
   - For each file found:
     - Parse JSON safely. If invalid/corrupted, ignore and continue.
     - Calculate completeness score:
       - Score = `(topLevelKeys * 100) + (nestedItemsCount * 1000) + (rawJsonLength)`
       - Nested items include:
         - Templates array length
         - Category count
         - WhatsApp lines array length
         - Kanban leads array length across all columns
     - Track `bestData` with highest score.
   - If `bestData` was found in at least one disk location:
     - Immediately invoke `PersistentStore.writeJSON(filename, bestData)` to auto-backfill and synchronize all other disk locations.
     - Return `bestData`.
   - If no valid data is found anywhere, return `fallback` without crashing.

5. **Multi-Disk Boot in `env.ts`**:
   - Replace manual `fs.readFileSync` in `env.ts` with `PersistentStore.readJSON('openwa_config.json', {})`.
   - Now, even after a fresh git checkout or container restart where `./data` is empty, `env.ts` will auto-discover the OpenWA configuration from `~/.danmax_crm_data` or `/tmp/danmax_crm_persistent_data`.

---

## 3. Recommended Implementation Code

### File: `backend/src/services/storage.service.ts`

```typescript
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Request } from 'express';

export const CANONICAL_ADMIN_TENANT = 'tenant_demo_pizzeria';

/**
 * Returns a deduplicated list of multi-platform persistent disk directory paths
 * Survives container restarts, OS wipes of /tmp, and fresh repo checkouts.
 */
export function getPersistentDirs(): string[] {
  const rawDirs = [
    path.join(os.homedir(), '.danmax_crm_data'),
    '/tmp/danmax_crm_persistent_data',
    path.join(os.tmpdir(), 'danmax_crm_persistent_data'),
    path.resolve(process.cwd(), 'data'),
    path.resolve(process.cwd(), 'backend/data'),
    path.resolve(__dirname, '../../data'),
    path.resolve(__dirname, '../../../data'),
  ];

  const uniqueDirs = new Set<string>();
  for (const d of rawDirs) {
    try {
      uniqueDirs.add(path.resolve(d));
    } catch {
      uniqueDirs.add(d);
    }
  }

  return Array.from(uniqueDirs);
}

/**
 * Safely ensures that a directory exists, trapping permission or syntax errors.
 */
export function ensureDir(dirPath: string): boolean {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}

// Pre-initialize persistent directories
for (const dir of getPersistentDirs()) {
  ensureDir(dir);
}

const ADMIN_TENANT_ALIASES = new Set([
  'danmax_wa_owner',
  'super_admin',
  'tenant_demo_pizzeria',
  'global_whatsapp_line',
  'pizzeria',
  'default',
  'admin',
  'owner',
  'undefined',
  'null',
  '',
]);

/**
 * Normalizes any tenant identifier into its canonical partition key.
 * All admin/default session aliases resolve to CANONICAL_ADMIN_TENANT.
 */
export function normalizeTenantId(rawTenant?: string | null): string {
  if (!rawTenant || typeof rawTenant !== 'string') {
    return CANONICAL_ADMIN_TENANT;
  }
  const clean = rawTenant.trim().toLowerCase().replace(/[^a-z0-9_]/gi, '_');
  if (ADMIN_TENANT_ALIASES.has(clean)) {
    return CANONICAL_ADMIN_TENANT;
  }
  return clean;
}

/**
 * Hierarchically extracts and normalizes the tenant identifier from an Express Request.
 * Priority: Header (x-tenant-id) -> Query (tenantId, sessionName) -> Body (tenantId, sessionName) -> Fallback
 */
export function getTenantIdFromReq(req: Request | any): string {
  if (!req) return CANONICAL_ADMIN_TENANT;

  // 1. Header extraction
  const headerTenant = (req.headers && (req.headers['x-tenant-id'] || req.headers['X-Tenant-Id'])) as string;
  if (headerTenant && typeof headerTenant === 'string' && headerTenant.trim()) {
    return normalizeTenantId(headerTenant);
  }

  // 2. Query extraction
  const queryTenant = req.query && (req.query.tenantId || req.query.sessionName || req.query.tenant);
  if (queryTenant && typeof queryTenant === 'string' && queryTenant.trim()) {
    return normalizeTenantId(queryTenant);
  }

  // 3. Body extraction
  const bodyTenant = req.body && (req.body.tenantId || req.body.sessionName || req.body.tenant);
  if (bodyTenant && typeof bodyTenant === 'string' && bodyTenant.trim()) {
    return normalizeTenantId(bodyTenant);
  }

  return CANONICAL_ADMIN_TENANT;
}

/**
 * Helper to compute completeness score of a parsed JSON object for multi-disk recovery.
 */
function scoreDataCompleteness(parsed: any, rawLength: number): number {
  if (parsed === null || parsed === undefined) return -1;
  let score = rawLength;

  if (Array.isArray(parsed)) {
    score += parsed.length * 1000;
    return score;
  }

  if (typeof parsed === 'object') {
    const keys = Object.keys(parsed);
    score += keys.length * 100;

    for (const key of keys) {
      const val = parsed[key];
      if (val && typeof val === 'object') {
        if (Array.isArray(val.templates)) score += val.templates.length * 1000;
        if (Array.isArray(val.categories)) score += val.categories.length * 200;
        if (Array.isArray(val.lines)) score += val.lines.length * 500;
        if (Array.isArray(val.hiddenGroupIds)) score += val.hiddenGroupIds.length * 50;
        if (val.groupCategoryMap && typeof val.groupCategoryMap === 'object') {
          score += Object.keys(val.groupCategoryMap).length * 100;
        }
        if (Array.isArray(val)) {
          // Kanban columns array per tenant
          score += val.length * 500;
          for (const col of val) {
            if (col && Array.isArray(col.leads)) {
              score += col.leads.length * 1000;
            }
          }
        }
      }
    }
  }

  return score;
}

export class PersistentStore {
  /**
   * Returns all resolved file paths across all persistent directories for a given filename.
   */
  public static getFilePaths(filename: string): string[] {
    return getPersistentDirs().map((dir) => path.join(dir, filename));
  }

  /**
   * Reads JSON data from multi-disk locations with completeness scoring and automatic synchronization backfill.
   */
  public static readJSON<T>(filename: string, fallback: T): T {
    let bestData: T | null = null;
    let maxScore = -1;

    for (const dir of getPersistentDirs()) {
      try {
        const filePath = path.join(dir, filename);
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, 'utf-8');
          if (!raw.trim()) continue;

          const parsed = JSON.parse(raw) as T;
          const score = scoreDataCompleteness(parsed, raw.length);

          if (score > maxScore) {
            maxScore = score;
            bestData = parsed;
          }
        }
      } catch {
        // Ignore unreadable or corrupted files on individual disks
      }
    }

    if (bestData !== null) {
      // Cross-disk Auto-Backfill: Sync best data to all disks
      try {
        this.writeJSON(filename, bestData);
      } catch {
        // Non-blocking backfill
      }
      return bestData;
    }

    return fallback;
  }

  /**
   * Atomically writes JSON data across all persistent disks using temp files, rename, and Windows lock fallbacks.
   */
  public static writeJSON<T>(filename: string, data: T): void {
    const serialized = JSON.stringify(data, null, 2);
    const persistentDirs = getPersistentDirs();

    for (const dir of persistentDirs) {
      if (!ensureDir(dir)) continue;

      const targetPath = path.join(dir, filename);
      const tempPath = path.join(
        dir,
        `.${filename}.${process.pid}.${Date.now()}.${Math.random().toString(36).substring(2, 8)}.tmp`
      );

      let written = false;

      try {
        // Step 1: Write to unique temp file on the same disk mount
        fs.writeFileSync(tempPath, serialized, 'utf-8');

        // Step 2: Atomic Rename
        fs.renameSync(tempPath, targetPath);
        written = true;
      } catch (err: any) {
        // Step 3: Windows / Lock Fallbacks (EPERM, EBUSY, EACCES, EXDEV)
        try {
          if (fs.existsSync(tempPath)) {
            fs.copyFileSync(tempPath, targetPath);
            fs.unlinkSync(tempPath);
            written = true;
          }
        } catch {
          // Direct write fallback as last resort
          try {
            fs.writeFileSync(targetPath, serialized, 'utf-8');
            written = true;
          } catch {
            // Disk failed, continue to other disks
          }
        }
      } finally {
        // Step 4: Guaranteed temp file cleanup
        try {
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
        } catch {
          // Ignore temp cleanup errors
        }
      }
    }
  }
}
```

---

### File: `backend/src/config/env.ts`

```typescript
import dotenv from 'dotenv';
import { PersistentStore } from '../services/storage.service';

dotenv.config();

// Multi-path persistent boot loading of OpenWA configuration across all disk tiers
let savedConfig: { openwaApiUrl?: string; openwaAdminKey?: string } = {};
try {
  savedConfig = PersistentStore.readJSON('openwa_config.json', {});
} catch {
  savedConfig = {};
}

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

---

## 4. Caveats

1. **Operating System Permissions**:
   - On Windows, if Node.js runs under a restricted user profile, root paths like `/tmp` or `C:\tmp` might trigger `EPERM`. The `ensureDir` helper and directory-level try/catch explicitly safeguard against this by safely skipping inaccessible paths while writing to available ones (`%TEMP%`, `~/.danmax_crm_data`, `./data`).
2. **Same-Filesystem Rename Requirement**:
   - Atomic rename (`fs.renameSync`) requires the temporary file and target file to reside on the same filesystem/partition. By creating the `.tmp` file in the same directory (`dir`), this is strictly guaranteed.
3. **Circular Dependency Verification**:
   - `storage.service.ts` does not import `env.ts`.
   - `env.ts` imports `PersistentStore` from `./services/storage.service`.
   - Verified that no circular import cycle exists.

---

## 5. Conclusion

- The proposed architecture fully addresses Requirements 1 & 4 of Milestone 1.
- All 5 persistent directory locations (`~/.danmax_crm_data`, `/tmp/danmax_crm_persistent_data`, `os.tmpdir()/danmax_crm_persistent_data`, `./data`, `backend/data`) are seamlessly unified with deduplication and error-trapped creation.
- Atomic file writes prevent corrupted JSON files during sudden container kills or crashes.
- Windows file locking (`EPERM`/`EBUSY`) is handled with multi-tier copy/direct write fallbacks.
- Deep completeness scoring guarantees that richer stores supersede empty or truncated stores, automatically synchronizing all disks on read.
- `env.ts` boots configuration consistently regardless of container restart or directory wipe.

---

## 6. Verification Method

To independently verify the implementation:

1. **TypeScript Build Check**:
   ```bash
   node ./node_modules/typescript/bin/tsc --noEmit
   ```
   *(Must exit with code 0).*

2. **Multi-Disk Persistence Test**:
   - Call `PersistentStore.writeJSON('test_m1.json', { testKey: 'active_data', count: 42 })`.
   - Inspect files in:
     - `path.join(os.homedir(), '.danmax_crm_data', 'test_m1.json')`
     - `path.join(os.tmpdir(), 'danmax_crm_persistent_data', 'test_m1.json')`
     - `backend/data/test_m1.json`
   - Verify all copies contain matching JSON content.

3. **Auto-Recovery & Backfill Test**:
   - Delete `backend/data/test_m1.json`.
   - Call `PersistentStore.readJSON('test_m1.json', {})`.
   - Verify `backend/data/test_m1.json` is automatically recreated with the data recovered from `~/.danmax_crm_data` or `%TEMP%`.

4. **Atomic Temp File Cleanup**:
   - Confirm no lingering `.tmp` files remain in any persistent directories after writes.
