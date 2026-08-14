# Milestone 3 Explorer Investigation Report: Multi-Tenant Group & Template Persistence & Client Isolation

**Agent**: `explorer_m3_1`  
**Milestone**: Milestone 3 (Multi-Tenant Group & Template Persistence & Client Isolation)  
**Date**: 2026-08-14  
**Target Stores**: `groups_categories.json`, `templates_db.json`, `kanban_store.json`, `tenant_lines.json`  

---

## 1. Observation

### 1.1 Group Categories & Group Assignments (`groups_categories.json`)
- **Backend File**: `backend/src/routes/groups.routes.ts`
  - **Interface**:
    ```typescript
    export interface GroupCategoryStore {
      categories: string[];
      groupCategoryMap: Record<string, string>;
      hiddenGroupIds: string[];
    }
    ```
  - **Store Structure**: Dictionary keyed by normalized tenant ID:
    ```json
    {
      "tenant_demo_pizzeria": {
        "categories": ["Todas", "VIP", "Promociones"],
        "groupCategoryMap": {
          "120363041234567890@g.us": "VIP"
        },
        "hiddenGroupIds": [
          "120363098765432100@g.us"
        ]
      },
      "tenant_cliente_retail": {
        "categories": ["Todas", "Sucursal Centro"],
        "groupCategoryMap": {},
        "hiddenGroupIds": []
      }
    }
    ```
  - **Load & Save Mechanics**:
    - `loadGroupStore(tenantId: string)` (lines 20–44) normalizes `tenantId` via `normalizeTenantId(tenantId)` from `storage.service.ts` and loads from `groups_categories.json`.
    - Sanitization guarantees `categories` array includes `'Todas'`, `groupCategoryMap` is an object, and `hiddenGroupIds` is an array.
    - `saveGroupStore(tenantId: string, storeData: GroupCategoryStore)` (lines 46–55) writes to `groups_categories.json` via `PersistentStore.writeJSON`, propagating changes across all persistent directories (`~/.danmax_crm_data`, `/tmp/danmax_crm_persistent_data`, `./data`, `backend/data`).
  - **Live WhatsApp Group Merging**:
    - `fetchLiveGroups(tenantId)` (lines 57–78) calls `OpenWAService.getLiveChats(tenantId)`, filters out 1-on-1 chats and hidden groups (`hiddenGroupIds`), and attaches the persisted category via `store.groupCategoryMap[g.id] || 'Todas'`.
  - **Observed Routes**:
    - `GET /api/groups` (lines 80–93): Fetches live groups, loads category store, returns `{ success: true, tenantId, groups, categories, total }`.
    - `POST /api/groups/sync` (lines 95–109): Triggers sync with live WhatsApp session.
    - `POST /api/groups/hide` (lines 111–134): Adds `groupId` to `hiddenGroupIds` and persists to disk.
    - `POST /api/groups/categories` (lines 136–159): Appends new unique category to `store.categories` and persists.
    - `DELETE /api/groups/categories/:name` & `DELETE /api/groups/categories` (lines 161–208): Deletes category (guards `'Todas'`).
    - `POST /api/groups/assign-category` (lines 210–222): Updates `groupCategoryMap[groupId] = category` and persists.
    - `POST /api/groups/broadcast` (lines 224–256): Dispatches compiled text, header, footer, and media attachment to selected group IDs.

### 1.2 Rich Multimedia Templates & Template Categories (`templates_db.json`)
- **Backend File**: `backend/src/routes/templates.routes.ts`
  - **Interface**:
    ```typescript
    export interface TemplateItem {
      id: string;
      tenantId: string | null;
      isGlobal: boolean;
      title: string;
      category: string;
      headerType: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'TEXT' | string;
      headerContent: string | null;
      content: string;
      footer: string | null;
      variables: string[];
      mediaUrl: string | null;
      createdAt: string;
    }

    export interface TemplatesStore {
      categories: string[];
      templates: TemplateItem[];
    }
    ```
  - **Default Categories**: `['General', 'Ventas', 'Promociones', 'Operaciones', 'Atención al Cliente']`.
  - **Store Structure**:
    ```json
    {
      "tenant_demo_pizzeria": {
        "categories": ["General", "Ventas", "Promociones", "Operaciones", "Atención al Cliente"],
        "templates": [
          {
            "id": "tmpl_1723612800000_a1b2",
            "tenantId": "tenant_demo_pizzeria",
            "isGlobal": false,
            "title": "Promo Pizza 2x1",
            "category": "Promociones",
            "headerType": "IMAGE",
            "headerContent": "data:image/jpeg;base64,...",
            "content": "¡Hola {{nombre}}! Tu promo está lista.",
            "footer": "DanMax WA Pizzería",
            "variables": ["nombre"],
            "mediaUrl": "data:image/jpeg;base64,...",
            "createdAt": "2026-08-14T01:00:00.000Z"
          }
        ]
      }
    }
    ```
  - **Legacy Migration & Persistence**:
    - `loadTemplatesStore(tenantId)` (lines 44–85) migrates legacy admin keys (`danmax_wa_owner`, `super_admin`, `global_whatsapp_line`, `pizzeria`, `default`, `admin`) to `CANONICAL_ADMIN_TENANT` (`tenant_demo_pizzeria`).
    - `saveTemplatesStore(tenantId, storeData)` (lines 90–98) atomically saves categories and template arrays via `PersistentStore.writeJSON('templates_db.json', allStores)`.
  - **Variable Extraction**:
    - Line 208: `(content || '').match(/\{{1,2}([a-zA-Z0-9_\-]+)\}{1,2}/g)` parses both single bracket `{nombre}` and double bracket `{{nombre}}` parameters.
  - **Observed Routes**:
    - `GET /api/templates` (lines 105–116): Returns `templates` and `categories` for normalized tenant.
    - `GET /api/templates/categories` (lines 118–129): Returns category list.
    - `POST /api/templates/categories` (lines 131–153): Adds new template category.
    - `DELETE /api/templates/categories/:name` & `DELETE /api/templates/categories` (lines 155–194): Deletes category.
    - `POST /api/templates` (lines 196–243): Creates rich template, pushes to unshift of `store.templates`, extracts variables, and writes to disk.
    - `DELETE /api/templates/:id` (lines 245–265): Slices template by ID and writes to disk.

### 1.3 Kanban Columns, Cards, Lead Tags & Triggers (`kanban_store.json`)
- **Backend File**: `backend/src/routes/kanban.routes.ts`
  - **Interfaces**:
    ```typescript
    export interface KanbanLead {
      id: string;
      chatId: string;
      contactName: string;
      phone: string;
      value: string;
      items: string;
      createdAt: string;
    }

    export interface KanbanColumn {
      id: string;
      name: string;
      color: string;
      autoTemplateText: string;
      leads: KanbanLead[];
    }
    ```
  - **Default 5-Stage Pipeline** (lines 30–66):
    - `col_1`: "Contacto Nuevo" (`#6366f1`, autoTemplateText: `"¡Hola {{nombre}}! Gracias por comunicarte con nosotros."`)
    - `col_2`: "En Cotización / Negociación" (`#f59e0b`, autoTemplateText: `"Hola {{nombre}}, estamos preparando tu propuesta."`)
    - `col_3`: "En Seguimiento" (`#3b82f6`, autoTemplateText: `"Hola {{nombre}}, ¿tuviste oportunidad de revisar nuestra información?"`)
    - `col_4`: "Venta Cerrada" (`#10b981`, autoTemplateText: `"🎉 ¡Muchas gracias por tu preferencia {{nombre}}!"`)
    - `col_5`: "Terminado" (`#ec4899`, autoTemplateText: `"✅ Pedido y atención finalizada con éxito. ¡Gracias por preferirnos!"`)
  - **Persistence & Normalization**:
    - `getOrCreateKanban(tenantId)` (lines 69–93) migrates legacy keys and returns `allStores[cleanTenant]`.
    - `saveKanban(tenantId, columns)` (lines 95–100) saves columns array to `kanban_store.json`.
  - **Real-Time Integration**:
    - Every mutation (`/clear`, `/add-from-chat`, `/bulk-add`, `/move`, `/lead/:id`, `/leads`) invokes `socketService.emitToTenant(tenantId, 'kanban_updated', columns)`.

### 1.4 Frontend Integration & Request Interception
- **`frontend/src/services/api.ts`**:
  - Request interceptor extracts `localStorage.getItem('danmax_user')` and sets `config.headers['x-tenant-id'] = userObj.tenantId || userObj.businessName || 'tenant_demo_pizzeria'`.
- **`frontend/src/views/GroupsView.tsx`**:
  - Line 36: `API.get('/groups')`
  - Line 46: `API.get('/templates')`
  - Line 63: `API.post('/groups/sync')`
  - Line 87: `API.post('/groups/hide', { groupId })`
  - Line 134: `API.post('/groups/categories', { categoryName })`
  - Line 165: `API.post('/groups/assign-category', { groupId, category })`
  - Line 193: `API.post('/groups/broadcast', { groupIds, messageText, headerText, footerText, mediaUrl })`
- **`frontend/src/views/TemplatesView.tsx`**:
  - Line 33: `API.get('/templates?tenantId=global_whatsapp_line')` *(Hardcoded)*
  - Line 71: `API.post('/templates', { ..., tenantId: 'global_whatsapp_line' })` *(Hardcoded)*
  - Line 109: `API.delete('/templates/${id}?tenantId=global_whatsapp_line')` *(Hardcoded)*
- **`frontend/src/views/KanbanPipelineView.tsx`**:
  - Line 26: `API.get('/kanban?tenantId=tenant_demo_pizzeria')` *(Hardcoded)*
  - Line 38: `API.post('/kanban/sync', { tenantId: 'tenant_demo_pizzeria' })` *(Hardcoded)*
  - Line 54: `API.post('/kanban/clear', { tenantId: 'tenant_demo_pizzeria' })` *(Hardcoded)*
  - Line 68: `API.delete('/kanban/lead/${leadId}?tenantId=tenant_demo_pizzeria')` *(Hardcoded)*
  - Line 102: `API.post('/kanban/move', { tenantId: 'tenant_demo_pizzeria', ... })` *(Hardcoded)*
  - Line 134: `API.post('/kanban/leads', { tenantId: 'tenant_demo_pizzeria', ... })` *(Hardcoded)*
- **`frontend/src/views/ChatInboxView.tsx`**:
  - Lines 36, 62, 132, 145, 199, 244, 257: Hardcoded `tenant_demo_pizzeria` passed in query/body.
- **`frontend/src/views/WhatsAppQRView.tsx`**:
  - Lines 26, 56, 92, 117, 138, 155, 177: Hardcoded `tenant_demo_pizzeria` passed in query/body and `socket.emit('join_tenant', 'tenant_demo_pizzeria')`.

---

## 2. Logic Chain

1. **Storage Tier Architecture**:
   - `storage.service.ts` provides multi-disk directory resolution across `~/.danmax_crm_data`, `/tmp/danmax_crm_persistent_data`, `./data`, and `backend/data`.
   - `PersistentStore.writeJSON` performs atomic file writes (`fs.writeFileSync` to a unique temp file, followed by `fs.renameSync` and error fallback copying).
   - `PersistentStore.readJSON` scores candidates by structural completeness (`calculateCompletenessScore`), selecting the highest-scoring candidate and auto-backfilling outdated or missing disk locations.

2. **Tenant Normalization & Isolation**:
   - `normalizeTenantId()` maps admin aliases (`danmax_wa_owner`, `super_admin`, `global_whatsapp_line`, `pizzeria`, `default`, `admin`, `tenant_demo_pizzeria`) to `CANONICAL_ADMIN_TENANT` (`tenant_demo_pizzeria`).
   - Distinct client tenant accounts (`tenant_1723612345`, `tenant_acme_corp`) resolve to their own sanitized identifier (`tenant_acme_corp`).
   - When `loadGroupStore`, `loadTemplatesStore`, or `getOrCreateKanban` is called, the JSON root dictionary is partitioned by tenant ID (`allStores[cleanTenant]`).

3. **Vulnerability & Data Leak Analysis (Tracing Gaps)**:
   - **Gap A: Frontend Hardcoded Query/Body Parameters**:
     - `TemplatesView.tsx` passes `tenantId=global_whatsapp_line`.
     - `KanbanPipelineView.tsx` passes `tenantId=tenant_demo_pizzeria`.
     - In `getTenantIdFromReq(req)`:
       1. Header `x-tenant-id`
       2. Query `tenantId`
       3. Body `tenantId`
     - While the Axios interceptor in `api.ts` injects `x-tenant-id` (giving it priority #1), if any request is executed without the interceptor (e.g. direct curl, third-party webhook, query parameter override), the hardcoded query/body forces the request to map to admin (`tenant_demo_pizzeria`).
     - Furthermore, `TemplatesView` hardcoding `global_whatsapp_line` causes confusion and potential cross-tenant template overwrites if a client requests templates via query.
   - **Gap B: Orphaned Categories on Deletion in `groups.routes.ts`**:
     - When a category is deleted via `DELETE /api/groups/categories/:name`, it is removed from `store.categories`. However, `store.groupCategoryMap` is not cleansed.
     - As a result, groups assigned to the deleted category retain `groupCategoryMap[groupId] = "DeletedCat"`. When `fetchLiveGroups` builds the list, it assigns `g.category = "DeletedCat"`, but `"DeletedCat"` is no longer in `categories` pill list, creating a broken filter state in the frontend.
   - **Gap C: Lack of Legacy Alias Migration in `groups.routes.ts`**:
     - Unlike `templates.routes.ts`, `tenant.routes.ts`, and `kanban.routes.ts`, `loadGroupStore()` does NOT check legacy admin keys (`danmax_wa_owner`, `super_admin`, `global_whatsapp_line`, etc.). If an installation previously saved categories under a legacy key, `loadGroupStore` creates a fresh default store for `tenant_demo_pizzeria` rather than migrating the existing categories and mappings.
   - **Gap D: Missing Unhide Endpoint in `groups.routes.ts`**:
     - When a user hides a group (`POST /api/groups/hide`), `hiddenGroupIds` stores the ID. But there is no endpoint (`POST /api/groups/unhide`) to unhide or restore groups.
   - **Gap E: Global Templates Visibility Across Tenants**:
     - `TemplateItem` has `isGlobal: boolean`. When `isGlobal: true`, it sets `tenantId: 'global'`, but writes `newTmpl` into `allStores[cleanTenant].templates`.
     - Other client tenants reading `templates_db.json` only read `allStores[otherTenant].templates`, so global templates are completely invisible to other tenants.
   - **Gap F: Missing Kanban Lead Update & Column Config Endpoints**:
     - There is no endpoint to edit an existing lead's details (`contactName`, `phone`, `value`, `items`) or customize column metadata (`name`, `color`, `autoTemplateText`).

---

## 3. Caveats

- **OpenWA Live Session Coupling**: Live WhatsApp group discovery (`/api/groups`) and chat listing (`/api/chats`) require an active OpenWA/Baileys connection. If the WhatsApp session is disconnected, `fetchLiveGroups` returns `[]`, but the persistent category structure (`categories`, `groupCategoryMap`, `hiddenGroupIds`) remains 100% intact on disk.
- **Base64 Multimedia Payload Limits**: Templates with embedded Base64 images/videos (`mediaUrl`, `headerContent`) can reach several megabytes. `backend/src/index.ts` has configured `express.json({ limit: '50mb' })`, which accommodates HD media in `templates_db.json`. However, excessively large videos (>50MB) should be uploaded as external URLs.
- **Client LocalStorage Dependency**: Frontend tenant identification relies on `localStorage.getItem('danmax_user')`. If a user clears their browser cache or uses incognito mode without logging in, the frontend falls back to `tenant_demo_pizzeria` (default admin tenant).

---

## 4. Conclusion & Recommendations

The persistence infrastructure in `storage.service.ts` (multi-disk resolution, atomic file writes, completeness scoring, and auto-backfill) is robust. However, several specific gaps in `groups.routes.ts`, `templates.routes.ts`, `kanban.routes.ts`, and frontend views need to be resolved to guarantee 100% multi-tenant isolation and prevent data loss.

### Detailed Recommendations for the Implementer/Worker:

#### Recommendation 1: Cleanse Hardcoded Tenant Parameters in Frontend Views
Remove hardcoded `tenantId=global_whatsapp_line` and `tenantId=tenant_demo_pizzeria` query/body parameters across all frontend views. Allow `frontend/src/services/api.ts` request interceptor to dynamically supply `x-tenant-id`.
- **Target Files**:
  - `frontend/src/views/TemplatesView.tsx`: Lines 33, 71, 109
  - `frontend/src/views/KanbanPipelineView.tsx`: Lines 26, 38, 54, 68, 102, 134
  - `frontend/src/views/ChatInboxView.tsx`: Lines 36, 62, 132, 145, 199, 244, 257
  - `frontend/src/views/WhatsAppQRView.tsx`: Lines 26, 56, 92, 117, 138, 155, 177 (use `getActiveTenantId()` for `join_tenant`)
  - `frontend/src/views/MediaCatalogView.tsx`: Line 10
  - `frontend/src/views/BroadcastCalendarView.tsx`: Lines 20, 50
  - `frontend/src/views/TeamView.tsx`: Lines 10, 30

#### Recommendation 2: Upgrade `groups.routes.ts`
1. **Add Legacy Admin Key Migration in `loadGroupStore`**:
   ```typescript
   if (!allStores[cleanTenant]) {
     if (cleanTenant === CANONICAL_ADMIN_TENANT) {
       const legacyKeys = ['danmax_wa_owner', 'super_admin', 'global_whatsapp_line', 'pizzeria', 'default', 'admin'];
       for (const legacy of legacyKeys) {
         if (allStores[legacy] && (allStores[legacy].categories?.length > 0 || Object.keys(allStores[legacy].groupCategoryMap || {}).length > 0)) {
           allStores[cleanTenant] = allStores[legacy];
           break;
         }
       }
     }
     if (!allStores[cleanTenant]) {
       allStores[cleanTenant] = JSON.parse(JSON.stringify(DEFAULT_STORE));
     }
     PersistentStore.writeJSON('groups_categories.json', allStores);
   }
   ```
2. **Sanitize `groupCategoryMap` on Category Deletion**:
   When deleting a category in `DELETE /api/groups/categories/:name` and `DELETE /api/groups/categories`:
   ```typescript
   if (store.groupCategoryMap) {
     for (const [gid, cat] of Object.entries(store.groupCategoryMap)) {
       if (cat === targetCategory) {
         store.groupCategoryMap[gid] = 'Todas';
       }
     }
   }
   ```
3. **Add `POST /api/groups/unhide` Endpoint**:
   ```typescript
   groupsRouter.post('/unhide', async (req: Request, res: Response) => {
     const tenantId = getTenantIdFromReq(req);
     const { groupId } = req.body;
     const store = loadGroupStore(tenantId);
     store.hiddenGroupIds = store.hiddenGroupIds.filter((id) => id !== groupId);
     saveGroupStore(tenantId, store);
     const updatedGroups = await fetchLiveGroups(tenantId);
     return res.json({ success: true, tenantId, message: 'Grupo restaurado en la vista del CRM', groups: updatedGroups });
   });
   ```

#### Recommendation 3: Upgrade `templates.routes.ts`
1. **Aggregate Global Templates in `GET /api/templates`**:
   ```typescript
   templatesRouter.get('/', (req: Request, res: Response) => {
     const tenantId = getTenantIdFromReq(req);
     const cleanTenant = normalizeTenantId(tenantId);
     const allStores = PersistentStore.readJSON<Record<string, TemplatesStore>>('templates_db.json', {});
     const tenantStore = loadTemplatesStore(cleanTenant);

     // Merge global templates from admin/global partitions if current tenant is not admin
     let mergedTemplates = [...(tenantStore.templates || [])];
     if (cleanTenant !== CANONICAL_ADMIN_TENANT && allStores[CANONICAL_ADMIN_TENANT]) {
       const globalTemplates = (allStores[CANONICAL_ADMIN_TENANT].templates || []).filter((t) => t.isGlobal);
       const existingIds = new Set(mergedTemplates.map((t) => t.id));
       for (const gt of globalTemplates) {
         if (!existingIds.has(gt.id)) {
           mergedTemplates.push(gt);
         }
       }
     }

     return res.json({
       success: true,
       tenantId: cleanTenant,
       templates: mergedTemplates,
       categories: Array.from(new Set(tenantStore.categories)),
       total: mergedTemplates.length,
     });
   });
   ```
2. **Add `PUT /api/templates/:id` (Template Editing Endpoint)** to allow updating title, content, media, and footers without losing the template ID.

#### Recommendation 4: Upgrade `kanban.routes.ts`
1. **Add `PUT /api/kanban/leads/:id` (Lead Update Endpoint)**:
   ```typescript
   kanbanRouter.put('/leads/:id', (req: Request, res: Response) => {
     const { id } = req.params;
     const tenantId = getTenantIdFromReq(req);
     const { contactName, phone, value, items, columnId } = req.body;
     const columns = getOrCreateKanban(tenantId);

     let targetLead: KanbanLead | null = null;
     let currentColumn: KanbanColumn | null = null;

     for (const col of columns) {
       const found = col.leads.find((l) => l.id === id);
       if (found) {
         targetLead = found;
         currentColumn = col;
         break;
       }
     }

     if (!targetLead || !currentColumn) {
       return res.status(404).json({ success: false, error: 'Oportunidad no encontrada' });
     }

     if (contactName) targetLead.contactName = contactName.trim();
     if (phone) targetLead.phone = phone.trim();
     if (value) targetLead.value = value.trim();
     if (items) targetLead.items = items.trim();

     if (columnId && columnId !== currentColumn.id) {
       const targetCol = columns.find((c) => c.id === columnId);
       if (targetCol) {
         currentColumn.leads = currentColumn.leads.filter((l) => l.id !== id);
         targetCol.leads.unshift(targetLead);
       }
     }

     saveKanban(tenantId, columns);
     socketService.emitToTenant(tenantId, 'kanban_updated', columns);
     return res.json({ success: true, tenantId, columns, lead: targetLead });
   });
   ```

2. **Add `POST /api/kanban/columns` (Column Metadata Customizer)**:
   Allows updating column display names, colors, and `autoTemplateText`.

---

## 5. Verification Method

To independently verify the persistence and multi-tenant isolation:

### 5.1 Automated TypeScript Build Verification
Run the TypeScript compiler across both backend and frontend workspaces:
```cmd
cmd.exe /c "cd backend && npx tsc --noEmit"
cmd.exe /c "cd frontend && npx tsc --noEmit"
```
*Expected Result*: 0 errors.

### 5.2 Multi-Tenant Isolation & Disk Verification Procedure
1. **Tenant A Creation & Storage**:
   - Issue `POST /api/templates` with header `x-tenant-id: tenant_alpha_client` and payload `{"title": "Alpha Template", "content": "Hello Alpha"}`.
   - Inspect `groups_categories.json`, `templates_db.json`, and `kanban_store.json` in all persistent locations (`~/.danmax_crm_data/`, `/tmp/danmax_crm_persistent_data/`, `./data/`).
   - *Verify*: `templates_db.json` contains a distinct key `"tenant_alpha_client"` with the created template.
2. **Tenant B Isolation**:
   - Issue `GET /api/templates` with header `x-tenant-id: tenant_beta_client`.
   - *Verify*: Response does not contain `"Alpha Template"`, returning only Tenant B's isolated store.
3. **Container Restart / Wipe Simulation**:
   - Delete `./data/templates_db.json`.
   - Issue `GET /api/templates` with header `x-tenant-id: tenant_alpha_client`.
   - *Verify*: `PersistentStore.readJSON` recovers the store from `~/.danmax_crm_data/templates_db.json` and auto-backfills `./data/templates_db.json`.
4. **Group Category Deletion Verification**:
   - Assign group `120363041234567890@g.us` to category `"VIP"`.
   - Delete category `"VIP"` via `DELETE /api/groups/categories/VIP`.
   - Issue `GET /api/groups`.
   - *Verify*: Group `120363041234567890@g.us` automatically reverts to `"Todas"`.

### 5.3 Invalidation Conditions
This report's conclusions would be invalidated if:
- A single shared partition was used instead of dictionary keying by `cleanTenant`.
- `storage.service.ts` failed to write to user home or tmp directory.
- `x-tenant-id` header was ignored by backend route extractors.
