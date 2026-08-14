# Handoff Report — Explorer 3: Multi-Tenant & Disk Persistence Survey

**Date**: 2026-08-14  
**Author**: Explorer 3  
**Status**: Survey Complete — Implementation Ready  

---

## 1. Observation

Direct inspection of the codebase yielded the following concrete observations across configurations, backend services, routes, socket handlers, and frontend components:

### A. Persistent Storage Engine (`backend/src/services/storage.service.ts`)
- **Multi-location Disk Directories**:
  ```ts
  const PERSISTENT_DIRS = [
    path.join(os.homedir(), '.danmax_crm_data'),
    '/tmp/danmax_crm_persistent_data',
    path.join(__dirname, '../../data'),
  ];
  ```
- **Managed JSON Stores**:
  1. `groups_categories.json` — WhatsApp group categories, group-to-category mappings, hidden group IDs per tenant.
  2. `templates_db.json` — Rich multimedia templates and categories per tenant.
  3. `kanban_store.json` — Kanban sales pipeline columns, custom trigger templates, and lead opportunity cards per tenant.
  4. `tenant_lines.json` — Multi-line WhatsApp sessions, active line selection, connection statuses, QR codes.
  5. `openwa_config.json` — OpenWA API URL and admin authorization key.
- **Auto-Recovery & Backfill Mechanism**:
  `PersistentStore.readJSON<T>(filename, fallback)` scans all directories in `PERSISTENT_DIRS`, finds the most complete JSON file (evaluating entry length/keys count), parses it, and automatically backfills/synchronizes it to all other persistent directories before returning.
  `PersistentStore.writeJSON<T>(filename, data)` writes formatted JSON (`JSON.stringify(data, null, 2)`) simultaneously to all directories in `PERSISTENT_DIRS`.

### B. Tenant Normalization & Admin Aliasing (`storage.service.ts`)
- **Admin Aliases Defined**:
  ```ts
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
  ```
- **Helper Functions**:
  - `normalizeTenantId(rawTenant?: string): string`: Normalizes string by trimming, lowercasing, and replacing non-alphanumeric chars with underscores. If matching `ADMIN_TENANT_ALIASES`, returns canonical `'tenant_demo_pizzeria'`. For any other client ID (e.g. `'tenant_1723612345'`), preserves the unique tenant identifier.
  - `getTenantIdFromReq(req: Request): string`: Extracts tenant identifier from `req.headers['x-tenant-id']`, `req.query.tenantId`, `req.query.sessionName`, `req.body?.tenantId`, or `req.body?.sessionName`, running it through `normalizeTenantId`.

### C. Backend Route Implementations & Normalization Inconsistencies
1. **`backend/src/routes/groups.routes.ts`**:
   - Correctly imports `PersistentStore`, `getTenantIdFromReq`, `normalizeTenantId`.
   - `loadGroupStore(tenantId)` and `saveGroupStore(tenantId, storeData)` both call `normalizeTenantId(tenantId)`.
   - Store structure per tenant:
     ```ts
     interface GroupCategoryStore {
       categories: string[];
       groupCategoryMap: Record<string, string>;
       hiddenGroupIds: string[];
     }
     ```
   - Endpoints (`GET /api/groups`, `POST /sync`, `POST /hide`, `POST /categories`, `DELETE /categories`, `POST /assign-category`, `POST /broadcast`) use `getTenantIdFromReq(req)`.
2. **`backend/src/routes/templates.routes.ts`**:
   - Imports `PersistentStore`, `getTenantIdFromReq`.
   - **Bug / Inconsistency Observed**: In lines 30 and 52:
     ```ts
     const cleanTenant = tenantId || 'tenant_demo_pizzeria';
     ```
     `templates.routes.ts` does NOT call `normalizeTenantId(tenantId)`.
     If a super admin or client passes `'danmax_wa_owner'` or `'global_whatsapp_line'`, templates are stored under that literal key in `templates_db.json` instead of being aliased to `'tenant_demo_pizzeria'`.
3. **`backend/src/routes/kanban.routes.ts`**:
   - Imports `PersistentStore`, `socketService`.
   - **Bug / Inconsistency Observed**:
     `getOrCreateKanban(tenantId)` and `saveKanban(tenantId, columns)` use raw `tenantId` parameter without `normalizeTenantId`.
     Route handlers use `(req.query.tenantId as string) || 'tenant_demo_pizzeria'` or `req.body.tenantId` instead of `getTenantIdFromReq(req)`.
     Socket updates emit to `socketService.emitToTenant(tenantId, 'kanban_updated', columns)` using unnormalized tenant ID.
4. **`backend/src/routes/tenant.routes.ts`**:
   - Uses `loadTenantStore()` and `getOrCreateTenant(tenantId)`.
   - Uses unnormalized tenant keys in several endpoints (`/my-session`, `/add-line`, `/delete-line`, `/switch-line`, `/connect-whatsapp`, `/disconnect-whatsapp`).
5. **`backend/src/services/socket.service.ts`**:
   - Manages rooms as `tenant_${tenantId}`.
   - If tenant IDs are not consistently normalized when clients call `socket.emit('join_tenant', tenantId)` and server calls `socketService.emitToTenant(tenantId, event, payload)`, events could be sent to mismatched room names.

### D. Frontend API & Consumption Points
1. **`frontend/src/services/api.ts`**:
   - Request interceptor checks `localStorage.getItem('danmax_user')`.
   - For regular tenants: extracts `userObj.tenantId` (e.g. `tenant_1723600000`).
   - For super admin: `userObj.tenantId` is `null`, extracts `userObj.businessName` (`'DanMax WA Owner'`).
   - Attaches `config.headers['x-tenant-id'] = tenantId`.
2. **`frontend/src/views/GroupsView.tsx`**:
   - Calls `API.get('/groups')`, `API.post('/groups/categories')`, `API.post('/groups/assign-category')`, `API.post('/groups/hide')`, `API.post('/groups/broadcast')`.
   - Categories and group assignments are fetched and updated per tenant.
   - Deduplicates categories using `Array.from(new Set(['Todas', ...res.data.categories]))`.
3. **`frontend/src/views/TemplatesView.tsx`**:
   - Calls `API.get('/templates?tenantId=global_whatsapp_line')` and `API.post('/templates', { ... tenantId: 'global_whatsapp_line' })`.
   - Relies on backend normalizing `'global_whatsapp_line'` to `'tenant_demo_pizzeria'`.
4. **`frontend/src/views/KanbanPipelineView.tsx`**:
   - Currently hardcodes `tenantId=tenant_demo_pizzeria` in query params and post bodies (`/kanban?tenantId=tenant_demo_pizzeria`, `/kanban/move`, `/kanban/leads`, etc.).
   - Listens to `socket.on('kanban_updated')`.
5. **`frontend/src/views/WhatsAppQRView.tsx`**:
   - Emits `socket.emit('join_tenant', 'tenant_demo_pizzeria')`.

### E. Toolchain, Build, and Typecheck Verification
- **Backend**:
  - TypeScript 5.3.3, CommonJS, Node target ES2022, `strict: true`.
  - Typecheck command: `cmd /c npx tsc --noEmit` (in `backend/`) -> Exits with code 0 (0 errors).
  - Build command: `npm run build` (`tsc && npx prisma generate`).
- **Frontend**:
  - Vite 5.1.0, TypeScript 5.2.2, React 18.2.0, `strict: true`, `noEmit: true`.
  - Typecheck command: `cmd /c npx tsc --noEmit` (in `frontend/`) -> Exits with code 0 (0 errors).
  - Build command: `npm run build` (`tsc && vite build`).
- **Test Framework**:
  - No jest or vitest framework is installed in either package.json.
  - Automated verification must be executed using TypeScript compilation checks (`tsc --noEmit`), build testing, and custom Node.js verification scripts testing the persistence and isolation requirements.

---

## 2. Logic Chain

1. **Premise 1**: Data loss on page refresh, re-login, or Docker container rebuild happens when state is held exclusively in volatile process memory or written to single ephemeral container paths without multi-directory disk persistence and recovery.
2. **Premise 2**: To ensure 100% resilience across all deployment environments (Docker, Coolify, Traefik, local Windows/Linux), `PersistentStore` must read and write from multiple canonical locations (`/tmp/danmax_crm_persistent_data`, `~/.danmax_crm_data`, and `./data`). If any one directory is wiped or replaced, `readJSON` recovers the most complete dataset from the surviving directories and immediately backfills all locations.
3. **Premise 3**: Admin sessions can originate from multiple legacy labels or role attributes (`danmax_wa_owner`, `super_admin`, `tenant_demo_pizzeria`, `global_whatsapp_line`, `pizzeria`, `default`). Without consistent normalization, each label creates a separate entry in the JSON files, causing admin categories, templates, and kanban cards to appear "lost" when switching views or re-logging.
4. **Premise 4**: Client accounts (e.g. `tenant_1723612345678`) must have strictly segregated data. When `normalizeTenantId` is called, client tenant IDs are sanitized and kept distinct from admin aliases and other clients. Every JSON store (`groups_categories.json`, `templates_db.json`, `kanban_store.json`, `tenant_lines.json`) indexes data under `allStores[cleanTenant]`.
5. **Premise 5**: Consistency requires that ALL backend controllers (`groups.routes.ts`, `templates.routes.ts`, `kanban.routes.ts`, `tenant.routes.ts`, `chat.routes.ts`, `webhook.routes.ts`) and socket services use `getTenantIdFromReq(req)` and `normalizeTenantId(tenantId)`.

---

## 3. Caveats

1. **In-Memory Arrays in Secondary Routes**:
   `auth.routes.ts` (`tenantsDb`, `usersDb`), `media.routes.ts` (`mediaDb`), `broadcast.routes.ts` (`broadcastsDb`), and `team.routes.ts` currently store items in in-memory JavaScript arrays. While `ORIGINAL_REQUEST.md` focuses on `groups_categories.json`, `templates_db.json`, `kanban_store.json`, `tenant_lines.json`, and `openwa_config.json`, implementers should ensure all critical stores utilize `PersistentStore`.
2. **Path Resolution on Windows vs Linux**:
   `/tmp/danmax_crm_persistent_data` resolves to `C:\tmp\danmax_crm_persistent_data` on Windows, which is valid and writable. `path.join(__dirname, '../../data')` resolves to `CRM WHATSAPP/data` in dev and `backend/data` in production dist. Using `path.resolve(process.cwd(), 'data')` or ensuring both dev and dist resolve to a stable root `./data` directory ensures consistent file placement.
3. **OpenWA Live Session Binding**:
   WhatsApp chats and messages come live from the OpenWA engine. Custom contact names, group category assignments, and template bindings are stored locally in the persistent JSON layer and layered over the live WhatsApp chat data.

---

## 4. Conclusion & Architecture Recommendations

To fulfill all requirements of the overhaul with zero regression:

1. **`storage.service.ts` Overhaul**:
   - Ensure `PERSISTENT_DIRS` includes:
     - `path.join(os.homedir(), '.danmax_crm_data')`
     - `/tmp/danmax_crm_persistent_data`
     - `path.resolve(process.cwd(), 'data')`
     - `path.resolve(process.cwd(), 'backend/data')`
   - Strengthen `normalizeTenantId`:
     - Guarantee aliases (`danmax_wa_owner`, `super_admin`, `tenant_demo_pizzeria`, `global_whatsapp_line`, `pizzeria`, `default`, `null`, `undefined`, `''`) map to canonical `'tenant_demo_pizzeria'`.
     - Preserve client IDs as lowercase sanitized alphanumeric strings (`tenant_xxx`).
   - Enhance `getTenantIdFromReq`:
     - Inspect `x-tenant-id` header, `tenantId` query param, `sessionName` query param, `tenantId` body param, `sessionName` body param.
2. **Normalize Across All Controllers**:
   - **`templates.routes.ts`**: Replace `cleanTenant = tenantId || 'tenant_demo_pizzeria'` with `normalizeTenantId(getTenantIdFromReq(req))` in `loadTemplatesStore` and `saveTemplatesStore`.
   - **`kanban.routes.ts`**: Use `normalizeTenantId(tenantId)` in `getOrCreateKanban` and `saveKanban`. Update all endpoints (`GET /`, `POST /clear`, `POST /add-from-chat`, `POST /bulk-add`, `POST /move`, `DELETE /lead/:id`, `POST /leads`) to use `getTenantIdFromReq(req)`.
   - **`tenant.routes.ts`**: Use `normalizeTenantId` in `loadTenantStore` and `getOrCreateTenant`.
   - **`socket.service.ts`**: Ensure socket room joining (`join_tenant`) and event broadcasting (`emitToTenant`) normalize the tenant ID so room names always match.
3. **Frontend Alignment**:
   - Update `KanbanPipelineView.tsx`, `WhatsAppQRView.tsx`, `TemplatesView.tsx` to read tenant ID dynamically from logged-in user or rely on the `API` interceptor's `x-tenant-id` header.

---

## 5. Verification Method

To independently verify the implementation and ensure zero build/type regressions:

1. **Backend TypeScript Typecheck**:
   ```bash
   cd "c:\Users\Usuario\Documents\antigravity\CRM WHATSAPP\backend"
   cmd /c npx tsc --noEmit
   ```
   *Expected output*: Exit code 0, no diagnostic errors.

2. **Frontend TypeScript Typecheck**:
   ```bash
   cd "c:\Users\Usuario\Documents\antigravity\CRM WHATSAPP\frontend"
   cmd /c npx tsc --noEmit
   ```
   *Expected output*: Exit code 0, no diagnostic errors.

3. **Backend Full Build**:
   ```bash
   cd "c:\Users\Usuario\Documents\antigravity\CRM WHATSAPP\backend"
   cmd /c npm run build
   ```
   *Expected output*: TypeScript compilation to `dist/` and Prisma client generation succeeds.

4. **Automated Multi-Tenant & Disk Persistence Verification Script**:
   Run a standalone node script verifying:
   - Simultaneous write to all `PERSISTENT_DIRS`.
   - Deletion of 2 out of 3 locations and successful recovery/backfill on `readJSON`.
   - Verification that `danmax_wa_owner`, `super_admin`, `global_whatsapp_line` resolve to `tenant_demo_pizzeria`.
   - Verification that `tenant_client_abc` maintains isolated categories, templates, and kanban cards without leaking into admin or other clients.
