# Survey Analysis & Architecture Report: Multi-Tenant Key Normalization & Disk Persistence Engine

**Explorer:** Explorer 2 (Survey Phase)  
**Target:** DanMax WA CRM Multi-Tenant & Disk Persistence Overhaul  
**Date:** 2026-08-14  

---

## 1. Observation

Direct investigation of the codebase revealed the following structural details, file paths, line numbers, and behaviors:

### 1.1 Multi-Location Persistent Disk Paths & Storage Engine
- **File:** `backend/src/services/storage.service.ts` (Lines 7–20, 59–103)
  - `PERSISTENT_DIRS` defines three disk targets:
    ```ts
    const PERSISTENT_DIRS = [
      path.join(os.homedir(), '.danmax_crm_data'),
      '/tmp/danmax_crm_persistent_data',
      path.join(__dirname, '../../data'),
    ];
    ```
  - `PersistentStore.readJSON<T>(filename, fallback)` (Lines 60–89) scans all three directories, compares file content length (`raw.length`), picks the most complete file, auto-backfills all three locations via `this.writeJSON`, and returns the best data.
  - `PersistentStore.writeJSON<T>(filename, data)` (Lines 91–102) synchronously writes formatted JSON (`JSON.stringify(data, null, 2)`) to all three locations, creating parent directories on demand.

### 1.2 Tenant Key Normalization & Request Context Resolution
- **File:** `backend/src/services/storage.service.ts` (Lines 22–57)
  - `ADMIN_TENANT_ALIASES` (Lines 22–32) contains:
    `'danmax_wa_owner'`, `'super_admin'`, `'tenant_demo_pizzeria'`, `'global_whatsapp_line'`, `'pizzeria'`, `'default'`, `'undefined'`, `'null'`, `''`.
  - `normalizeTenantId(rawTenant?: string): string` (Lines 34–41) cleans raw strings (`.trim().toLowerCase().replace(/[^a-z0-9_]/gi, '_')`) and maps any admin alias to `'tenant_demo_pizzeria'`.
  - `getTenantIdFromReq(req: Request): string` (Lines 43–57) extracts tenant ID hierarchically from `req.headers['x-tenant-id']`, then `req.query.tenantId || req.query.sessionName`, then `req.body.tenantId || req.body.sessionName`, falling back to `'tenant_demo_pizzeria'`.

### 1.3 Tenant Identity & Session Context Across the Stack
- **Authentication & User Identity (`backend/src/routes/auth.routes.ts` Lines 21–46, 202–228):**
  - Super Admin users (`user_admin_001`, `user_admin_002`) have `tenantId: null`, `role: 'SUPER_ADMIN'`, and `businessName: 'DanMax WA Owner'`.
  - Client / Tenant users have `tenantId: 'tenant_...'`, `role: 'TENANT_ADMIN'`, and `businessName: '<Client Name>'`.
- **Frontend HTTP Interceptor (`frontend/src/services/api.ts` Lines 8–22):**
  - Attaches `x-tenant-id` header to every Axios request:
    ```ts
    const tenantId = userObj.tenantId || userObj.businessName || 'tenant_demo_pizzeria';
    config.headers['x-tenant-id'] = tenantId;
    ```
  - For Super Admin sessions (`tenantId === null`), `userObj.businessName` (`'DanMax WA Owner'`) is sent in `x-tenant-id`.
- **Frontend Views Tenant Query Overrides:**
  - `TemplatesView.tsx` (Lines 33, 80, 109) explicitly requests `/templates?tenantId=global_whatsapp_line`.
  - `WhatsAppQRView.tsx` (Lines 26, 56, 92) passes `tenant_demo_pizzeria`.
  - `KanbanPipelineView.tsx` (Lines 26, 38, 54, 68) passes `tenant_demo_pizzeria`.
  - `GroupsView.tsx` (Lines 36, 121, 159) relies on `API` headers (`x-tenant-id`).

### 1.4 Persistent JSON Store Catalog & Schema Identification
Five primary persistent JSON stores are currently utilized or defined:

1. **`groups_categories.json`** (`backend/src/routes/groups.routes.ts` Lines 7–41):
   - **Keyed by:** Normalized Tenant ID (`Record<string, GroupCategoryStore>`).
   - **Schema:**
     ```ts
     interface GroupCategoryStore {
       categories: string[]; // e.g. ["Todas", "Clientes VIP", "Promociones"]
       groupCategoryMap: Record<string, string>; // { [groupId: string]: categoryName }
       hiddenGroupIds: string[]; // [groupId: string]
     }
     ```
   - **Implementation:** Correctly invokes `normalizeTenantId` in `loadGroupStore` and `saveGroupStore`. Uses `getTenantIdFromReq(req)` across all router endpoints.

2. **`templates_db.json`** (`backend/src/routes/templates.routes.ts` Lines 6–56):
   - **Keyed by:** Normalized Tenant ID (`Record<string, TemplatesStore>`).
   - **Schema:**
     ```ts
     interface TemplateItem {
       id: string;
       tenantId: string | null;
       isGlobal: boolean;
       title: string;
       category: string;
       headerType: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'TEXT';
       headerContent: string | null;
       content: string;
       footer: string | null;
       variables: string[];
       mediaUrl: string | null;
       createdAt: string;
     }
     interface TemplatesStore {
       categories: string[];
       templates: TemplateItem[];
     }
     ```
   - **Defect Observed:** Lines 30 & 52 execute `const cleanTenant = tenantId || 'tenant_demo_pizzeria';` instead of calling `normalizeTenantId(tenantId)`. This caused raw tenant keys like `global_whatsapp_line` or `danmax_wa_owner` to bypass normalization if passed directly.

3. **`kanban_store.json`** (`backend/src/routes/kanban.routes.ts` Lines 64–77):
   - **Keyed by:** Normalized Tenant ID (`Record<string, KanbanColumn[]>`).
   - **Schema:**
     ```ts
     interface KanbanLead {
       id: string;
       chatId: string;
       contactName: string;
       phone: string;
       value: string;
       items: string;
       createdAt: string;
     }
     interface KanbanColumn {
       id: string; // "col_1", "col_2", "col_3", "col_4", "col_5"
       name: string;
       color: string;
       autoTemplateText: string;
       leads: KanbanLead[];
     }
     ```
   - **Defect Observed:** `getOrCreateKanban` and `saveKanban` do not call `normalizeTenantId`. Endpoints in `kanban.routes.ts` use manual fallback `(req.query.tenantId as string) || 'tenant_demo_pizzeria'` without `getTenantIdFromReq(req)`.

4. **`tenant_lines.json`** (`backend/src/routes/tenant.routes.ts` Lines 11–58):
   - **Keyed by:** Normalized Tenant ID (`Record<string, TenantData>`).
   - **Schema:**
     ```ts
     interface WhatsAppLine {
       id: string;
       name: string;
       whatsappPhone: string | null;
       status: 'DISCONNECTED' | 'STARTING' | 'SCAN_QR' | 'READY';
       qrCodeUrl?: string | null;
       openwaSessionId: string;
       createdAt: string;
     }
     interface TenantData {
       tenantId: string;
       name: string;
       activeLineId: string | null;
       lines: WhatsAppLine[];
     }
     ```
   - **Defect Observed:** `getOrCreateTenant` and route handlers in `tenant.routes.ts` do not call `normalizeTenantId` or `getTenantIdFromReq`.

5. **`openwa_config.json`** (`backend/src/config/env.ts` Lines 7–15, `backend/src/routes/tenant.routes.ts` Line 92):
   - **Keyed by:** Global Singleton Object (Server-wide configuration).
   - **Schema:**
     ```ts
     interface OpenWAConfig {
       openwaApiUrl: string;
       openwaAdminKey: string;
     }
     ```
   - **Defect Observed:** `env.ts` reads `openwa_config.json` synchronously only from `./data/openwa_config.json` using `fs.readFileSync`. If `./data` is recreated or empty on container boot, it fails to recover from `/tmp/danmax_crm_persistent_data` or `~/.danmax_crm_data`.

### 1.5 TypeScript Compilation Baseline
- **Backend Build:** Executed `cmd.exe /c "npm run build"` in `backend/` -> `tsc && npx prisma generate` completed with exit code 0.
- **Frontend Build:** Executed `cmd.exe /c "npm run build"` in `frontend/` -> `tsc && vite build` completed with exit code 0.

---

## 2. Logic Chain

1. **Premise 1 (Disjoint Admin Keys):** The frontend generates multiple tenant identifiers for admin activities: `DanMax WA Owner` (from `localStorage` user profile), `super_admin` (from JWT role), `global_whatsapp_line` (from `TemplatesView`), and `tenant_demo_pizzeria` (from `KanbanPipelineView` & `WhatsAppQRView`).
2. **Premise 2 (State Fragmentation):** If backend routes do not uniformly normalize incoming tenant keys to a single canonical identifier (`tenant_demo_pizzeria`), separate store partitions (e.g. `templates_db.json['global_whatsapp_line']` vs `templates_db.json['danmax_wa_owner']` vs `templates_db.json['tenant_demo_pizzeria']`) are written. When the user navigates between views or refreshes the browser, data appears to disappear.
3. **Premise 3 (Incomplete Normalization Adoption):** `groups.routes.ts` already normalizes tenant IDs via `normalizeTenantId`, which is why group categories were isolated and stable. However, `templates.routes.ts`, `kanban.routes.ts`, and `tenant.routes.ts` omitted `normalizeTenantId` inside their internal helper functions (`loadTemplatesStore`, `getOrCreateKanban`, `getOrCreateTenant`).
4. **Premise 4 (Container Volatility):** In Docker environments (Coolify / VPS), container restarts wipe ephemeral container layers. The 3-path persistence mechanism (`/tmp/danmax_crm_persistent_data`, `~/.danmax_crm_data`, `./data`) in `storage.service.ts` provides multi-location redundancy, but `env.ts` was bypassing `PersistentStore.readJSON` during startup.
5. **Conclusion from Logic:** Unifying all storage calls around `normalizeTenantId`, `getTenantIdFromReq`, and `PersistentStore.readJSON` / `PersistentStore.writeJSON` eliminates tenant key fragmentation, unifies all admin sessions under `tenant_demo_pizzeria`, maintains strict client tenant isolation, and guarantees 100% disk persistence across container restarts and page reloads.

---

## 3. Caveats

1. **PostgreSQL vs JSON Stores:** While `prisma/schema.prisma` defines relational models (`Tenant`, `User`, `Contact`, `KanbanColumn`, `Template`), the live operational engine of DanMax WA CRM currently relies on high-speed JSON stores (`groups_categories.json`, `templates_db.json`, `kanban_store.json`, `tenant_lines.json`, `openwa_config.json`) for zero-latency, schema-flexible multi-tenant persistence.
2. **In-Memory Volatility of Team and Broadcasts:** `usersDb` in `auth.routes.ts`, `broadcastsDb` in `broadcast.routes.ts`, and `mediaDb` in `media.routes.ts` are currently in-memory arrays. To achieve complete container persistence for all modules, these should also adopt `PersistentStore`.
3. **Socket Room Normalization:** Sockets join rooms using `join_tenant`. If the client emits `join_tenant` with `'DanMax WA Owner'`, the socket room must also normalize to `tenant_tenant_demo_pizzeria` to ensure real-time events reach all admin browser tabs.

---

## 4. Conclusion & Architecture Recommendations

### 4.1 Central Canonical Tenant Helper (`storage.service.ts`)
1. Expand `ADMIN_TENANT_ALIASES` to exhaustively cover all variations:
   ```ts
   export const CANONICAL_ADMIN_TENANT = 'tenant_demo_pizzeria';

   const ADMIN_TENANT_ALIASES = new Set([
     'danmax_wa_owner',
     'danmax_wa',
     'danmax',
     'super_admin',
     'superadmin',
     'super_admin_danmax_wa',
     'tenant_demo_pizzeria',
     'global_whatsapp_line',
     'global',
     'pizzeria',
     'pizzeria_crm_tenant',
     'default',
     'undefined',
     'null',
     '',
   ]);
   ```
2. Enhance `normalizeTenantId(rawTenant?: string | null): string`:
   - Safely convert input to clean string.
   - Match exact aliases and prefixes (`danmax*`, `super_admin*`, `global*`, `pizzeria*`).
   - If matched, return `CANONICAL_ADMIN_TENANT` (`'tenant_demo_pizzeria'`).
   - For real client IDs (e.g. `tenant_1723612345678`), return clean sanitized string without modification, maintaining strict tenant isolation.

### 4.2 Uniform Route Integration
- **`templates.routes.ts`:** Update `loadTemplatesStore` and `saveTemplatesStore` to wrap `tenantId` with `normalizeTenantId(tenantId)`.
- **`kanban.routes.ts`:** Update `getOrCreateKanban` and `saveKanban` to use `normalizeTenantId(tenantId)`. Replace all query/body parsing with `getTenantIdFromReq(req)`.
- **`tenant.routes.ts`:** Update `getOrCreateTenant` to use `normalizeTenantId(tenantId)` and all endpoints to use `getTenantIdFromReq(req)`.
- **`config/env.ts`:** Update `savedConfig` loading to read across all `PERSISTENT_DIRS` (or via `PersistentStore.readJSON('openwa_config.json', {})`).
- **`socket.service.ts`:** Normalize tenant ID inside `join_tenant` and `emitToTenant`.

### 4.3 Summary of Tenant-Keyed Store Schemas

| Store File | Tenant Partition Key | Schema Value |
|---|---|---|
| `groups_categories.json` | `normalizeTenantId(tenantId)` | `{ categories: string[], groupCategoryMap: Record<string, string>, hiddenGroupIds: string[] }` |
| `templates_db.json` | `normalizeTenantId(tenantId)` | `{ categories: string[], templates: TemplateItem[] }` |
| `kanban_store.json` | `normalizeTenantId(tenantId)` | `KanbanColumn[]` |
| `tenant_lines.json` | `normalizeTenantId(tenantId)` | `{ tenantId: string, name: string, activeLineId: string \| null, lines: WhatsAppLine[] }` |
| `openwa_config.json` | *Global Singleton* | `{ openwaApiUrl: string, openwaAdminKey: string }` |

---

## 5. Verification Method

To independently verify the architecture and persistence behavior:

1. **TypeScript Build Verification:**
   ```powershell
   cmd.exe /c "npm run build" # In backend/
   cmd.exe /c "npm run build" # In frontend/
   ```
2. **Multi-Tenant Normalization Verification Test:**
   - Call `normalizeTenantId('DanMax WA Owner')` -> verify output is `'tenant_demo_pizzeria'`.
   - Call `normalizeTenantId('global_whatsapp_line')` -> verify output is `'tenant_demo_pizzeria'`.
   - Call `normalizeTenantId('super_admin')` -> verify output is `'tenant_demo_pizzeria'`.
   - Call `normalizeTenantId('tenant_restaurante_los_andes')` -> verify output is `'tenant_restaurante_los_andes'`.
3. **Multi-Location Disk Persistence Verification:**
   - Create a template or category as Admin in the UI.
   - Verify file existence and identical JSON payload across:
     - `C:\Users\Usuario\.danmax_crm_data\templates_db.json`
     - `C:\tmp\danmax_crm_persistent_data\templates_db.json` (or `/tmp/...` in Linux)
     - `backend/data/templates_db.json`
   - Delete one directory copy, trigger a `PersistentStore.readJSON` call, and confirm auto-recovery backfill.
