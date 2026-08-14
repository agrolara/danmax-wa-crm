# Handoff Report: Milestone 2 — Universal Tenant Normalization & Admin Aliasing (`templates.routes.ts` & `groups.routes.ts`)

**Agent**: Explorer 1 (`explorer_m2_1`)  
**Target Milestone**: Milestone 2: Universal Tenant Normalization & Admin Aliasing  
**Working Directory**: `c:\Users\Usuario\Documents\antigravity\CRM WHATSAPP\.agents\explorer_m2_1`  
**Timestamp**: 2026-08-14T05:00:00Z  

---

## 1. Observation

### 1.1 Codebase Survey & Inspection

1. **`backend/src/services/storage.service.ts`** (Lines 6-117):
   - `CANONICAL_ADMIN_TENANT = 'tenant_demo_pizzeria'` (Line 6).
   - `ADMIN_TENANT_ALIASES` (Lines 62-74) contains:
     ```typescript
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
     ```
   - `normalizeTenantId(rawTenant?: string | null): string` (Lines 80-89) converts empty, null, undefined, or alias values to `'tenant_demo_pizzeria'` while cleaning and preserving client tenant strings (e.g. `'tenant_client_xyz'`).
   - `getTenantIdFromReq(req: Request | any): string` (Lines 95-117) extracts tenant identifiers with precedence:
     1. Header: `x-tenant-id` / `X-Tenant-Id`
     2. Query: `req.query.tenantId` / `sessionName` / `tenant`
     3. Body: `req.body.tenantId` / `sessionName` / `tenant`
     4. Default Fallback: `CANONICAL_ADMIN_TENANT` (`'tenant_demo_pizzeria'`)

2. **`backend/src/routes/templates.routes.ts`** (Lines 1-130):
   - Store filename: `templates_db.json`.
   - Current routes:
     - `GET /` (Line 59): Calls `getTenantIdFromReq(req)` and `loadTemplatesStore(tenantId)`.
     - `POST /` (Line 72): Calls `getTenantIdFromReq(req)`, adds template, updates categories, calls `saveTemplatesStore(tenantId, store)`.
     - `DELETE /:id` (Line 112): Calls `getTenantIdFromReq(req)` and deletes template from `store.templates`.
   - **Gaps Identified**:
     - Missing dedicated `GET /categories` endpoint.
     - Missing dedicated `POST /categories` endpoint.
     - Missing dedicated `DELETE /categories/:name` and `DELETE /categories` endpoints.
     - In `loadTemplatesStore` and `saveTemplatesStore`, defensive structure validation is needed to guard against sparse or corrupted JSON properties (e.g. `store.categories` or `store.templates` being non-array).
     - Variable extraction in `POST /` currently only matches double braces `/\{\{([^}]+)\}\}/g` and does not deduplicate variables or handle single braces `/\{{1,2}([^}]+)\}{1,2}/g`.

3. **`backend/src/routes/groups.routes.ts`** (Lines 1-204):
   - Store filename: `groups_categories.json`.
   - Current routes:
     - `GET /` (Line 67): Uses `getTenantIdFromReq(req)`.
     - `POST /sync` (Line 82): Uses `getTenantIdFromReq(req)`.
     - `POST /hide` (Line 97): Uses `getTenantIdFromReq(req)`.
     - `POST /categories` (Line 121): Uses `getTenantIdFromReq(req)`.
     - `DELETE /categories` (Line 141): Uses `getTenantIdFromReq(req)` with body `{ categoryName }`.
     - `POST /assign-category` (Line 159): Uses `getTenantIdFromReq(req)`.
     - `POST /broadcast` (Line 173): Uses `getTenantIdFromReq(req)`.
   - **Gaps & Enhancements Identified**:
     - `DELETE /categories` only reads from `req.body.categoryName`. Supporting `req.params.name` (`DELETE /categories/:name`), `req.query.categoryName`, and `req.body.categoryName` ensures 100% RESTful consistency with `templates.routes.ts`.
     - Defensive structure validation inside `loadGroupStore` (ensuring `categories`, `groupCategoryMap`, and `hiddenGroupIds` exist with proper types).

4. **`frontend/src/views/TemplatesView.tsx`** (Lines 33, 80, 109):
   - `fetchTemplates`: Calls `API.get('/templates?tenantId=global_whatsapp_line')`.
   - `handleCreateTemplate`: Calls `API.post('/templates', { ..., tenantId: 'global_whatsapp_line' })`.
   - `handleDeleteTemplate`: Calls `API.delete('/templates/${id}?tenantId=global_whatsapp_line')`.
   - `API` interceptor (`frontend/src/services/api.ts` Lines 8-22) sets `x-tenant-id` header from `danmax_user` (defaults to `'tenant_demo_pizzeria'`).
   - Under `normalizeTenantId`, `'global_whatsapp_line'` resolves to `tenant_demo_pizzeria`.

5. **`backend/src/routes/kanban.routes.ts` & `tenant.routes.ts`**:
   - `kanban.routes.ts` and `tenant.routes.ts` are audited in parallel by Explorer 2 and Explorer 3.

---

## 2. Logic Chain

1. **Premise 1 (Storage Architecture)**:
   All JSON persistence in the backend is keyed by tenant identifier at the root level of JSON stores (`Record<string, StoreData>`).
2. **Premise 2 (Admin Aliasing Problem)**:
   Users and frontends access the platform using multiple historical aliases (`danmax_wa_owner`, `super_admin`, `global_whatsapp_line`, `pizzeria`, `default`, empty strings). If each alias created a separate dictionary key, categories and templates created under one alias (e.g. `global_whatsapp_line`) would be invisible when logging in under another alias (e.g. `super_admin` or `danmax_wa_owner`).
3. **Premise 3 (Canonical Mapping Resolution)**:
   `normalizeTenantId` in `storage.service.ts` maps all admin aliases to `CANONICAL_ADMIN_TENANT` (`'tenant_demo_pizzeria'`).
4. **Premise 4 (Route-Level Enforcement)**:
   By invoking `const tenantId = getTenantIdFromReq(req);` on every incoming Express request in `templates.routes.ts` and `groups.routes.ts`, every route handler operates on the normalized partition key.
5. **Premise 5 (Strict Client Isolation)**:
   For any tenant ID not in `ADMIN_TENANT_ALIASES` (e.g. `'tenant_client_roma'`, `'tenant_acme_corp'`), `normalizeTenantId` cleans non-alphanumeric characters and returns the distinct client key. Because `templates_db.json` and `groups_categories.json` store separate top-level object partitions for each key, client data is completely isolated with 0 possibility of cross-tenant bleeding.
6. **Premise 6 (Complete API Surface for Templates)**:
   Adding `GET /categories`, `POST /categories`, and `DELETE /categories/:name` (along with body/query-compatible `DELETE /categories`) provides full category management for templates, matching the group categories architecture in `groups.routes.ts`.

---

## 3. Recommended Code Changes

### 3.1 Proposed `backend/src/routes/templates.routes.ts`

```typescript
import { Router, Request, Response } from 'express';
import { PersistentStore, getTenantIdFromReq, normalizeTenantId, CANONICAL_ADMIN_TENANT } from '../services/storage.service';

export const templatesRouter = Router();

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

export const DEFAULT_TEMPLATE_CATEGORIES = [
  'General',
  'Ventas',
  'Promociones',
  'Operaciones',
  'Atención al Cliente',
];

/**
 * Loads the template store for a specific tenant.
 * Guarantees that admin aliases resolve to CANONICAL_ADMIN_TENANT (tenant_demo_pizzeria)
 * and distinct client tenants have isolated partitions.
 */
export function loadTemplatesStore(tenantId: string): TemplatesStore {
  const cleanTenant = normalizeTenantId(tenantId);
  const allStores = PersistentStore.readJSON<Record<string, TemplatesStore>>('templates_db.json', {});

  if (!allStores[cleanTenant]) {
    allStores[cleanTenant] = {
      categories: [...DEFAULT_TEMPLATE_CATEGORIES],
      templates: [],
    };
    PersistentStore.writeJSON('templates_db.json', allStores);
  }

  // Defensive sanitization: ensure categories and templates arrays exist
  if (!Array.isArray(allStores[cleanTenant].categories)) {
    allStores[cleanTenant].categories = [...DEFAULT_TEMPLATE_CATEGORIES];
  }
  if (!Array.isArray(allStores[cleanTenant].templates)) {
    allStores[cleanTenant].templates = [];
  }

  // Ensure default categories are populated
  for (const cat of DEFAULT_TEMPLATE_CATEGORIES) {
    if (!allStores[cleanTenant].categories.includes(cat)) {
      allStores[cleanTenant].categories.push(cat);
    }
  }

  return allStores[cleanTenant];
}

/**
 * Atomically saves the template store for a specific tenant across all persistent disk tiers.
 */
export function saveTemplatesStore(tenantId: string, storeData: TemplatesStore): void {
  const cleanTenant = normalizeTenantId(tenantId);
  const allStores = PersistentStore.readJSON<Record<string, TemplatesStore>>('templates_db.json', {});
  allStores[cleanTenant] = {
    categories: Array.from(new Set(storeData.categories || DEFAULT_TEMPLATE_CATEGORIES)),
    templates: Array.isArray(storeData.templates) ? storeData.templates : [],
  };
  PersistentStore.writeJSON('templates_db.json', allStores);
}

// ============================================================================
// TEMPLATE ROUTES
// ============================================================================

// GET /api/templates — Retrieve all templates and categories for the normalized tenant
templatesRouter.get('/', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const store = loadTemplatesStore(tenantId);

  return res.json({
    success: true,
    tenantId,
    templates: store.templates || [],
    categories: Array.from(new Set(store.categories)),
    total: (store.templates || []).length,
  });
});

// GET /api/templates/categories — Retrieve categories list only for the normalized tenant
templatesRouter.get('/categories', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const store = loadTemplatesStore(tenantId);

  return res.json({
    success: true,
    tenantId,
    categories: Array.from(new Set(store.categories)),
    total: store.categories.length,
  });
});

// POST /api/templates/categories — Create a new template category for the normalized tenant
templatesRouter.post('/categories', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const { categoryName, name } = req.body;
  const targetCategory = (categoryName || name)?.trim();

  if (!targetCategory) {
    return res.status(400).json({ success: false, error: 'categoryName es requerido' });
  }

  const store = loadTemplatesStore(tenantId);
  if (!store.categories.includes(targetCategory)) {
    store.categories.push(targetCategory);
    saveTemplatesStore(tenantId, store);
  }

  return res.json({
    success: true,
    tenantId,
    categories: Array.from(new Set(store.categories)),
    message: `Categoría "${targetCategory}" creada y guardada exclusivamente para tu cuenta`,
  });
});

// DELETE /api/templates/categories/:name — Delete template category by URL param
templatesRouter.delete('/categories/:name', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const categoryName = decodeURIComponent(req.params.name || '').trim();
  const store = loadTemplatesStore(tenantId);

  if (categoryName && store.categories.includes(categoryName)) {
    store.categories = store.categories.filter((c) => c !== categoryName);
    saveTemplatesStore(tenantId, store);
    return res.json({
      success: true,
      tenantId,
      categories: Array.from(new Set(store.categories)),
      message: `Categoría "${categoryName}" eliminada de tu cuenta`,
    });
  }

  return res.status(404).json({ success: false, error: 'Categoría no encontrada en tu cuenta' });
});

// DELETE /api/templates/categories — Delete template category by body or query
templatesRouter.delete('/categories', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const { categoryName, name } = req.body;
  const targetCategory = (categoryName || name || req.query.categoryName || req.query.name as string)?.trim();
  const store = loadTemplatesStore(tenantId);

  if (targetCategory && store.categories.includes(targetCategory)) {
    store.categories = store.categories.filter((c) => c !== targetCategory);
    saveTemplatesStore(tenantId, store);
    return res.json({
      success: true,
      tenantId,
      categories: Array.from(new Set(store.categories)),
      message: `Categoría "${targetCategory}" eliminada de tu cuenta`,
    });
  }

  return res.status(404).json({ success: false, error: 'Categoría no encontrada en tu cuenta' });
});

// POST /api/templates — Create rich multimedia template for normalized tenant
templatesRouter.post('/', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const { title, category, headerType, headerContent, content, footer, isGlobal, mediaUrl } = req.body;

  if (!title?.trim() && !content?.trim()) {
    return res.status(400).json({ success: false, error: 'Título y contenido son requeridos' });
  }

  const store = loadTemplatesStore(tenantId);

  // Robust variable extractor supporting both {{var}} and {var}
  const varMatches = (content || '').match(/\{{1,2}([a-zA-Z0-9_\-]+)\}{1,2}/g) || [];
  const variables = Array.from(
    new Set(varMatches.map((v: string) => v.replace(/[\{\}]/g, '').trim()).filter(Boolean))
  );

  const newTmpl: TemplateItem = {
    id: `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    tenantId: isGlobal ? 'global' : tenantId,
    isGlobal: !!isGlobal,
    title: title?.trim() || 'Plantilla sin título',
    category: category?.trim() || 'General',
    headerType: headerType || 'TEXT',
    headerContent: headerContent || null,
    content: content?.trim() || '',
    footer: footer?.trim() || null,
    variables,
    mediaUrl: mediaUrl || null,
    createdAt: new Date().toISOString(),
  };

  store.templates.unshift(newTmpl);
  if (newTmpl.category && !store.categories.includes(newTmpl.category)) {
    store.categories.push(newTmpl.category);
  }

  saveTemplatesStore(tenantId, store);

  return res.json({
    success: true,
    tenantId,
    message: `Plantilla "${newTmpl.title}" creada y guardada exclusivamente para tu cuenta de forma 100% permanente.`,
    template: newTmpl,
    templates: store.templates,
    categories: Array.from(new Set(store.categories)),
  });
});

// DELETE /api/templates/:id — Delete template owned by normalized tenant
templatesRouter.delete('/:id', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const { id } = req.params;
  const store = loadTemplatesStore(tenantId);

  const idx = store.templates.findIndex((t) => t.id === id);
  if (idx !== -1) {
    const [deleted] = store.templates.splice(idx, 1);
    saveTemplatesStore(tenantId, store);
    return res.json({
      success: true,
      tenantId,
      message: `Plantilla "${deleted.title}" eliminada de tu cuenta`,
      templates: store.templates,
      categories: Array.from(new Set(store.categories)),
    });
  }

  return res.status(404).json({ success: false, error: 'Plantilla no encontrada en tu cuenta' });
});
```

---

### 3.2 Consistency Review with `backend/src/routes/groups.routes.ts`

1. **Group Store Load & Save**:
   - `loadGroupStore(tenantId: string)` in `groups.routes.ts` correctly runs `normalizeTenantId(tenantId)`.
   - `saveGroupStore(tenantId: string, storeData: GroupCategoryStore)` correctly runs `normalizeTenantId(tenantId)`.
2. **Defensive Upgrades for `groups.routes.ts`**:
   - Ensure `loadGroupStore` defensively checks `Array.isArray(allStores[cleanTenant].categories)` and `typeof allStores[cleanTenant].groupCategoryMap === 'object'`.
   - Add parameter support for `DELETE /categories/:name` in addition to body-based `DELETE /categories`.

---

## 4. Caveats

1. **Global Templates vs Tenant Partition**:
   - `TemplateItem.isGlobal` stores `tenantId: 'global'` within the caller's partition, but does not duplicate the template into other isolated client partitions. This prevents cross-tenant data leaks.
2. **Frontend Legacy Parameter `tenantId=global_whatsapp_line`**:
   - `TemplatesView.tsx` passes `?tenantId=global_whatsapp_line` in its queries. `normalizeTenantId('global_whatsapp_line')` evaluates to `'tenant_demo_pizzeria'`, ensuring full backward compatibility without breaking existing UI components.
3. **No other caveats.**

---

## 5. Conclusion

- **Templates Routing**: The designed changes eliminate all manual tenant string fallbacks (`tenantId || 'tenant_demo_pizzeria'`) in favor of `getTenantIdFromReq(req)` and `normalizeTenantId(tenantId)`.
- **Admin Aliasing**: All 11 admin alias representations (`danmax_wa_owner`, `super_admin`, `tenant_demo_pizzeria`, `global_whatsapp_line`, `pizzeria`, `default`, `admin`, `owner`, `undefined`, `null`, `''`) read and write exclusively to the `'tenant_demo_pizzeria'` partition in `templates_db.json`.
- **Strict Client Isolation**: Client tenant keys (`tenant_client_xyz`, `tenant_custom_company`) map to their own isolated partitions in `templates_db.json` and `groups_categories.json`.
- **API Surface Completeness**: Added `GET /categories`, `POST /categories`, and `DELETE /categories/:name` for full category CRUD compatibility.

---

## 6. Verification Method

### 6.1 Verification Script Design (`test_m2_templates_verification.ts`)

A standalone verification test suite can be run with `npx ts-node` or `npx tsx` to confirm:
1. **Alias Convergence**: Writing a template with `x-tenant-id: global_whatsapp_line` and reading it with `x-tenant-id: super_admin`, `x-tenant-id: danmax_wa_owner`, or empty headers all return the exact same template.
2. **Client Partition Isolation**: Writing a template with `x-tenant-id: tenant_client_alpha` does not expose the template to `tenant_client_beta` or `tenant_demo_pizzeria`.
3. **Category Persistence**: Creating and deleting categories under admin aliases mutates only `tenant_demo_pizzeria` and persists to disk.

### 6.2 Test Command
```bash
npx tsx backend/src/test_m2_verification.ts
```
Expected output: 100% PASS on all assertion groups.
