# Handoff Report: Multi-Disk Persistence & Storage Subsystem Survey

**Agent**: Explorer 1 (Survey Phase)  
**Date**: 2026-08-14T00:50:00-04:00  
**Target Milestone**: DanMax WA CRM Multi-Tenant & Disk Persistence Overhaul  
**Working Directory**: `c:\Users\Usuario\Documents\antigravity\CRM WHATSAPP\.agents\explorer_survey_1`

---

## 1. Observation

### 1.1 Storage Subsystem Baseline (`backend/src/services/storage.service.ts`)
- **Directory Paths (Lines 7–11)**:
  ```typescript
  const PERSISTENT_DIRS = [
    path.join(os.homedir(), '.danmax_crm_data'),
    '/tmp/danmax_crm_persistent_data',
    path.join(__dirname, '../../data'),
  ];
  ```
  - On Linux containers (Docker / Alpine / Coolify), `os.homedir()` resolves to `/root` (e.g. `/root/.danmax_crm_data`), and `/tmp/danmax_crm_persistent_data` is on the root `/tmp` filesystem.
  - On Windows hosts, `/tmp/danmax_crm_persistent_data` resolves to `C:\tmp\danmax_crm_persistent_data`, while `os.tmpdir()` points to `C:\Users\<User>\AppData\Local\Temp`.
  - When compiled to `dist/`, `__dirname` inside `dist/services/storage.service.js` is `/app/dist/services`, meaning `../../data` resolves to `/app/data`.
- **Directory Ensure Loop (Lines 14–20)**:
  - Directory creation is executed once on module import at top-level. If a directory fails to create or is wiped after startup, there is no runtime dynamic directory re-creation before individual write operations.
- **Completeness Estimation (Lines 60–89)**:
  - `readJSON` loops through `PERSISTENT_DIRS` and uses raw string length `raw.length` to pick `bestData`.
  - It catches errors silently on `JSON.parse`.
  - When valid data is recovered, it invokes `this.writeJSON(filename, bestData)` to backfill across all locations.
- **Write Mechanism (Lines 91–102)**:
  - Direct synchronous write: `fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')`.
  - Non-atomic: A crash, container kill (`SIGKILL`), or power loss during write can corrupt the target JSON file into a partial/empty file.
- **Tenant ID Normalization & Aliasing (Lines 22–41)**:
  ```typescript
  const ADMIN_TENANT_ALIASES = new Set([
    'danmax_wa_owner',
    'super_admin',
    'tenant_demo_pizzeria',
    'global_whatsapp_line',
    'pizzeria',
    'default',
    'undefined',
    'null',
    '',
  ]);

  export function normalizeTenantId(rawTenant?: string): string {
    if (!rawTenant || typeof rawTenant !== 'string') return 'tenant_demo_pizzeria';
    const clean = rawTenant.trim().toLowerCase().replace(/[^a-z0-9_]/gi, '_');
    if (ADMIN_TENANT_ALIASES.has(clean)) {
      return 'tenant_demo_pizzeria';
    }
    return clean;
  }
  ```

---

### 1.2 Route & Storage Usage Discrepancies Across the Codebase

1. **`backend/src/routes/groups.routes.ts`**:
   - Stores data in `groups_categories.json`.
   - Structure: `Record<string, { categories: string[], groupCategoryMap: Record<string, string>, hiddenGroupIds: string[] }>`.
   - Accurately calls `normalizeTenantId(tenantId)` in `loadGroupStore` (Line 21) and `saveGroupStore` (Line 37).
   - Default category `'Todas'` is enforced.

2. **`backend/src/routes/templates.routes.ts`**:
   - Stores data in `templates_db.json`.
   - Structure: `Record<string, { categories: string[], templates: TemplateItem[] }>`.
   - **Discrepancy (Lines 30 & 52)**:
     ```typescript
     const cleanTenant = tenantId || 'tenant_demo_pizzeria';
     ```
     `templates.routes.ts` does **not** call `normalizeTenantId(tenantId)` inside `loadTemplatesStore` or `saveTemplatesStore`. If called with `super_admin` or `global_whatsapp_line` directly, it creates fragmented keys in `templates_db.json`.
   - Default categories: `['General', 'Ventas', 'Promociones', 'Operaciones', 'Atención al Cliente']`.

3. **`backend/src/routes/kanban.routes.ts`**:
   - Stores data in `kanban_store.json`.
   - Structure: `Record<string, KanbanColumn[]>`.
   - **Discrepancy (Lines 64 & 73)**:
     `getOrCreateKanban(tenantId: string = 'tenant_demo_pizzeria')` and `saveKanban` do **not** call `normalizeTenantId(tenantId)` and do **not** use `getTenantIdFromReq(req)`.
   - Default columns: 5 standard stages (`Contacto Nuevo`, `En Cotización / Negociación`, `En Seguimiento`, `Venta Cerrada`, `Terminado`).

4. **`backend/src/routes/tenant.routes.ts`**:
   - Stores lines in `tenant_lines.json` and config in `openwa_config.json`.
   - Structure for `tenant_lines.json`: `Record<string, { tenantId: string, name: string, activeLineId: string | null, lines: WhatsAppLine[] }>`.
   - **Discrepancy (Line 46)**:
     `getOrCreateTenant(tenantId: string = 'tenant_demo_pizzeria')` does not normalize tenant IDs.

5. **`backend/src/config/env.ts`**:
   - **Discrepancy (Lines 7–15)**:
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
     `env.ts` reads exclusively from `./data/openwa_config.json` without leveraging `PersistentStore` or checking `/tmp/danmax_crm_persistent_data` / `~/.danmax_crm_data`. If `./data` is ephemeral on container rebuild, saved OpenWA credentials and URLs are lost on boot.

6. **In-Memory Volatile Stores**:
   - `backend/src/routes/chat.routes.ts`: `chatAgentMap` and `contactNameMap` (Lines 7–8) are in-memory JS objects. Contact renames and agent assignments disappear on restart.
   - `backend/src/routes/auth.routes.ts`: `tenantsDb` and `usersDb` (Lines 10–46) are in-memory JS arrays. Registered client tenants disappear on restart.
   - `backend/src/routes/broadcast.routes.ts`: `broadcastsDb` (Lines 6–27) is in-memory.
   - `backend/src/routes/media.routes.ts`: `mediaDb` (Line 6) is in-memory.

7. **Frontend Client Normalization (`frontend/src/services/api.ts`)**:
   - The axios interceptor retrieves `tenantId` from `localStorage.getItem('danmax_user')` and defaults to `'tenant_demo_pizzeria'`.
   - In `TemplatesView.tsx` (Lines 33 & 80), explicit requests pass `tenantId=global_whatsapp_line`.

---

## 2. Logic Chain

1. **Why multi-location persistence is required**:
   - In cloud container platforms (Coolify, Docker, Kubernetes), the container root filesystem `/app` is recreated on image redeployment or rebuild.
   - When a volume is mounted to either `/tmp/danmax_crm_persistent_data`, `/root/.danmax_crm_data`, or `/app/data`, writing to all candidate directories guarantees persistence regardless of which mount path the DevOps administrator configured.
2. **Why multi-tier recovery and auto-backfill works**:
   - On container cold start, if directory A is fresh and empty, but directory B has the persistent state from a mounted volume, `readJSON` detects valid JSON in directory B.
   - `readJSON` evaluates completeness (structure, key count, entry count, byte size), selects the most complete store, and immediately writes/backfills it into directory A and all other locations.
3. **Why atomic writes are essential**:
   - Direct `fs.writeFileSync` can result in 0-byte or truncated files if the process terminates mid-write.
   - Writing to a temporary file (`.${filename}.tmp.${Date.now()}.${random}`) and performing `fs.renameSync` guarantees filesystem-level atomicity (POSIX atomic rename).
4. **Why universal tenant normalization is required**:
   - Different views and auth sessions use aliases (`danmax_wa_owner`, `super_admin`, `global_whatsapp_line`, `tenant_demo_pizzeria`, `pizzeria`, `default`).
   - Normalizing all admin aliases to `'tenant_demo_pizzeria'` guarantees that all admin users see the exact same categories, templates, kanban board, and WhatsApp lines.
   - Normalizing client tenants (e.g. `rawTenant.trim().toLowerCase().replace(/[^a-z0-9_]/gi, '_')`) guarantees strict multi-tenant isolation so Client A cannot access Client B's data, while guaranteeing 100% disk persistence for each client tenant.

---

## 3. Caveats

1. **Host-level persistence vs Container Ephemeral Storage**: If *none* of the three directories (`/tmp/...`, `~/.danmax_crm_data`, `./data`) are mounted to a persistent Docker volume, data persists across container restarts, but not across destructive container removals (`docker rm` without volumes). Recommending Docker volume mounts in `docker-compose.yml` / Coolify settings is best practice.
2. **Windows Path Resolution**: On Windows, `/tmp/danmax_crm_persistent_data` resolves to `C:\tmp\danmax_crm_persistent_data`. `os.tmpdir()` (`C:\Users\<User>\AppData\Local\Temp`) should also be included in candidate directory list for native Windows execution.
3. **Concurrent Process Locking**: In Node.js single-process model, synchronous atomic writes with temporary files are thread-safe within the process. If multiple Node instances run against the same directory, atomic renames prevent file corruption.

---

## 4. Conclusion & Architecture Recommendations

### Recommended Architecture Implementation for Implementer

#### A. Enhanced `storage.service.ts`
1. **Multi-Platform Path Resolution**:
   ```typescript
   export function getPersistentDirs(): string[] {
     const dirs = [
       path.resolve(os.homedir(), '.danmax_crm_data'),
       path.resolve('/tmp/danmax_crm_persistent_data'),
       path.resolve(os.tmpdir(), 'danmax_crm_persistent_data'),
       path.resolve(process.cwd(), 'data'),
       path.resolve(__dirname, '../../data'),
       path.resolve(__dirname, '../../../data'),
     ];
     return Array.from(new Set(dirs));
   }
   ```
2. **Runtime Directory Ensure**:
   ```typescript
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
   ```
3. **Atomic Writing with Fallback**:
   - Write to `.tmp` file in same directory.
   - `fs.renameSync(tempPath, targetPath)`.
   - On Windows EPERM/EBUSY, fallback to direct overwrite and cleanup temp file.
4. **Intelligent Completeness Scoring in `readJSON`**:
   - Validate JSON syntax.
   - Calculate score: `keysCount * 10000 + itemsCount * 1000 + raw.length`.
   - Backfill highest scoring data to all persistent locations.
5. **Universal `normalizeTenantId`**:
   - Default/Admin aliases mapped to `'tenant_demo_pizzeria'`.
   - Sanitized lowercase client identifiers for strict isolation.

#### B. Store Normalization Across Handlers
- Update `templates.routes.ts`, `kanban.routes.ts`, `tenant.routes.ts`, `groups.routes.ts` to uniformly utilize `normalizeTenantId` and `getTenantIdFromReq`.
- Update `config/env.ts` to load `openwa_config.json` via multi-tier persistent disk paths.
- Optionally add disk persistence for `chat_metadata.json` (`contactNameMap`, `chatAgentMap`) and `auth_tenants.json` / `auth_users.json`.

---

## 5. Verification Method

To independently verify the implementation:

1. **TypeScript Typecheck**:
   ```bash
   cmd.exe /c "npx tsc --noEmit" # (Run in /backend and /frontend)
   ```
   Must exit with code 0.

2. **Multi-Disk Directory & File Creation Test**:
   - Run a test script in Node:
     ```javascript
     const { PersistentStore } = require('./dist/services/storage.service');
     PersistentStore.writeJSON('test_store.json', { test: true, timestamp: Date.now() });
     ```
   - Check that `test_store.json` exists in `~/.danmax_crm_data`, `/tmp/danmax_crm_persistent_data`, and `./data`.

3. **Auto-Recovery & Backfill Test**:
   - Delete `./data/test_store.json`.
   - Call `PersistentStore.readJSON('test_store.json', {})`.
   - Verify that `./data/test_store.json` is automatically re-created and populated with data recovered from `~/.danmax_crm_data`.

4. **Tenant Isolation & Alias Test**:
   - Verify `normalizeTenantId('danmax_wa_owner') === 'tenant_demo_pizzeria'`.
   - Verify `normalizeTenantId('super_admin') === 'tenant_demo_pizzeria'`.
   - Verify `normalizeTenantId('global_whatsapp_line') === 'tenant_demo_pizzeria'`.
   - Verify `normalizeTenantId('client_pizzeria_roma') === 'client_pizzeria_roma'`.
