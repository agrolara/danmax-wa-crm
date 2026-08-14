# Handoff Report — Explorer 2 (Milestone 2: Kanban & Tenant Routes Normalization)

## 1. Observation

### Target Files Inspected
1. `backend/src/routes/kanban.routes.ts` (Lines 1 to 238)
2. `backend/src/routes/tenant.routes.ts` (Lines 1 to 385)
3. `backend/src/services/storage.service.ts` (Lines 1 to 396)
4. `frontend/src/views/KanbanPipelineView.tsx` (Lines 1 to 404)
5. `frontend/src/views/ChatInboxView.tsx` (Lines 240 to 270)
6. `frontend/src/services/api.ts` (Lines 1 to 23)

### Verbatim Observations in `kanban.routes.ts`
- **Import Gap**: Line 3 only imports `PersistentStore` from `../services/storage.service`, missing `getTenantIdFromReq`, `normalizeTenantId`, and `CANONICAL_ADMIN_TENANT`.
- **Raw Tenant Lookup**:
  - Line 64: `export function getOrCreateKanban(tenantId: string = 'tenant_demo_pizzeria'): KanbanColumn[]` directly queries `allStores[tenantId]` without normalizing. When passed `'danmax_wa_owner'`, `'super_admin'`, `'global_whatsapp_line'`, `'pizzeria'`, or `undefined`, it branches into duplicate un-normalized keys.
  - Line 73: `export function saveKanban(tenantId: string = 'tenant_demo_pizzeria', columns: KanbanColumn[]): void` writes directly to `allStores[tenantId]` without normalizing.
- **Un-normalized Route Handlers**:
  - Line 81: `GET /` uses `(req.query.tenantId as string) || 'tenant_demo_pizzeria'`, ignoring `x-tenant-id` headers and raw admin aliases.
  - Line 88: `POST /clear` uses `{ tenantId = 'tenant_demo_pizzeria' } = req.body`.
  - Line 97: `POST /add-from-chat` uses `{ tenantId = 'tenant_demo_pizzeria' } = req.body`.
  - Line 135: `POST /bulk-add` uses `{ tenantId = 'tenant_demo_pizzeria' } = req.body`.
  - Line 170: `POST /move` uses `{ tenantId = 'tenant_demo_pizzeria' } = req.body`.
  - Line 198: `DELETE /lead/:id` uses `(req.query.tenantId as string) || 'tenant_demo_pizzeria'`.
  - Line 216: `POST /leads` uses `{ tenantId = 'tenant_demo_pizzeria' } = req.body`.
- **Missing Sync Endpoint**: Frontend `KanbanPipelineView.tsx` line 38 invokes `API.post('/kanban/sync', ...)` which returned a 404 in `kanban.routes.ts`.

### Verbatim Observations in `tenant.routes.ts`
- **Import Gap**: Line 6 imports `PersistentStore` but misses `getTenantIdFromReq`, `normalizeTenantId`, and `CANONICAL_ADMIN_TENANT`.
- **Hardcoded Admin Keying & Missing Normalization in Store Helpers**:
  - Line 28: `loadTenantStore()` only checks `if (!diskData.tenant_demo_pizzeria)` without migrating legacy admin aliases (`danmax_wa_owner`, `super_admin`).
  - Line 46: `getOrCreateTenant(tenantId: string = 'tenant_demo_pizzeria')` indexes `store[tenantId]` directly without calling `normalizeTenantId(tenantId)`. If an admin calls it with `'danmax_wa_owner'`, a separate tenant record is created in `tenant_lines.json`, fracturing WhatsApp lines and QR codes.
- **Route Handlers Bypassing Header & Normalization**:
  - Line 113: `GET /my-session` uses `(req.query.tenantId as string) || 'tenant_demo_pizzeria'`.
  - Line 175: `POST /add-line` uses `{ tenantId } = req.body; const targetTenantId = tenantId || 'tenant_demo_pizzeria'`.
  - Line 209: `POST /delete-line` uses `{ tenantId } = req.body; const targetTenantId = tenantId || 'tenant_demo_pizzeria'`.
  - Line 241: `POST /switch-line` uses `{ tenantId } = req.body; const targetTenantId = tenantId || 'tenant_demo_pizzeria'`.
  - Line 266: `POST /connect-whatsapp` uses `{ tenantId } = req.body; const targetTenantId = tenantId || 'tenant_demo_pizzeria'`.
  - Line 361: `POST /disconnect-whatsapp` uses `{ tenantId } = req.body; const targetTenantId = tenantId || 'tenant_demo_pizzeria'`.
  - Lines 313, 338, 373: Socket emits send events to `targetTenantId` instead of normalized tenant ID.

---

## 2. Logic Chain

1. **Header & Context Precedence**: In `frontend/src/services/api.ts`, requests automatically attach `x-tenant-id` extracted from localStorage (`danmax_user`). For Super Admins, `user.tenantId` is `null` and `user.businessName` is `"DanMax WA Owner"`, resulting in `x-tenant-id: DanMax WA Owner`.
2. **Unified Extraction**: `getTenantIdFromReq(req)` in `storage.service.ts` inspects (1) `x-tenant-id` header, (2) query params (`tenantId`, `sessionName`, `tenant`), (3) body attributes (`tenantId`, `sessionName`, `tenant`), and runs them through `normalizeTenantId()`.
3. **Admin Alias Convergence**: `normalizeTenantId('DanMax WA Owner')` and all admin aliases (`danmax_wa_owner`, `super_admin`, `global_whatsapp_line`, `pizzeria`, `default`, `admin`, `owner`, `null`, `""`) resolve deterministically to `CANONICAL_ADMIN_TENANT` (`tenant_demo_pizzeria`).
4. **Client Isolation**: Any client identifier (e.g. `tenant_cliente_juan`, `tenant_restaurante_los_arcos`) passes through sanitization without matching `ADMIN_TENANT_ALIASES`, returning its unique partition key.
5. **Storage Consistency in `kanban_store.json`**: By replacing all raw string lookups in `getOrCreateKanban` and `saveKanban` with `normalizeTenantId`, all admin actions share the single canonical column/lead store while each client tenant remains strictly isolated.
6. **Storage Consistency in `tenant_lines.json`**: In `tenant.routes.ts`, replacing raw lookups with `normalizeTenantId` in `loadTenantStore` and `getOrCreateTenant` ensures all admin sessions share the same WhatsApp lines, connection state, and QR events under `tenant_demo_pizzeria`.

---

## 3. Caveats

- **Frontend Sync Route**: Added `POST /api/kanban/sync` to `kanban.routes.ts` so frontend's refresh button (`handleSyncKanban` in `KanbanPipelineView.tsx`) succeeds seamlessly.
- **Legacy Key Migration**: If disk contains legacy keys (`danmax_wa_owner`, `super_admin`) from older sessions, the proposed `getOrCreateKanban` and `loadTenantStore` automatically adopt existing data before initializing default empty arrays.
- **Scope Boundary**: This analysis covers Milestone 2 (route-level normalization for Kanban & Tenant routes). Milestone 3 will focus on frontend component synchronization and client-side isolation polish.

---

## 4. Conclusion & Recommended Implementation

### A. Proposed Replacement for `backend/src/routes/kanban.routes.ts`
*(Artifact stored at `.agents/explorer_m2_2/proposed_kanban.routes.ts`)*

```typescript
import { Router, Request, Response } from 'express';
import { socketService } from '../services/socket.service';
import {
  PersistentStore,
  getTenantIdFromReq,
  normalizeTenantId,
  CANONICAL_ADMIN_TENANT,
} from '../services/storage.service';

export const kanbanRouter = Router();

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

const DEFAULT_KANBAN: KanbanColumn[] = [
  {
    id: 'col_1',
    name: 'Contacto Nuevo',
    color: '#6366f1',
    autoTemplateText: '¡Hola {{nombre}}! Gracias por comunicarte con nosotros.',
    leads: [],
  },
  {
    id: 'col_2',
    name: 'En Cotización / Negociación',
    color: '#f59e0b',
    autoTemplateText: 'Hola {{nombre}}, estamos preparando tu propuesta.',
    leads: [],
  },
  {
    id: 'col_3',
    name: 'En Seguimiento',
    color: '#3b82f6',
    autoTemplateText: 'Hola {{nombre}}, ¿tuviste oportunidad de revisar nuestra información?',
    leads: [],
  },
  {
    id: 'col_4',
    name: 'Venta Cerrada',
    color: '#10b981',
    autoTemplateText: '🎉 ¡Muchas gracias por tu preferencia {{nombre}}!',
    leads: [],
  },
  {
    id: 'col_5',
    name: 'Terminado',
    color: '#ec4899',
    autoTemplateText: '✅ Pedido y atención finalizada con éxito. ¡Gracias por preferirnos!',
    leads: [],
  },
];

// Persistent storage for Kanban board with universal normalization & admin aliasing
export function getOrCreateKanban(tenantId?: string | null): KanbanColumn[] {
  const cleanTenant = normalizeTenantId(tenantId);
  const allStores = PersistentStore.readJSON<Record<string, KanbanColumn[]>>('kanban_store.json', {});

  if (!allStores[cleanTenant] || !Array.isArray(allStores[cleanTenant]) || allStores[cleanTenant].length === 0) {
    // If canonical admin, check if any legacy admin alias has cards
    if (cleanTenant === CANONICAL_ADMIN_TENANT) {
      const legacyKeys = ['danmax_wa_owner', 'super_admin', 'global_whatsapp_line', 'pizzeria', 'default', 'admin'];
      for (const legacy of legacyKeys) {
        if (allStores[legacy] && Array.isArray(allStores[legacy]) && allStores[legacy].length > 0) {
          allStores[cleanTenant] = allStores[legacy];
          break;
        }
      }
    }

    if (!allStores[cleanTenant] || !Array.isArray(allStores[cleanTenant]) || allStores[cleanTenant].length === 0) {
      allStores[cleanTenant] = JSON.parse(JSON.stringify(DEFAULT_KANBAN));
    }

    PersistentStore.writeJSON('kanban_store.json', allStores);
  }

  return allStores[cleanTenant];
}

export function saveKanban(tenantId?: string | null, columns: KanbanColumn[] = []): void {
  const cleanTenant = normalizeTenantId(tenantId);
  const allStores = PersistentStore.readJSON<Record<string, KanbanColumn[]>>('kanban_store.json', {});
  allStores[cleanTenant] = columns;
  PersistentStore.writeJSON('kanban_store.json', allStores);
}

// GET /api/kanban
kanbanRouter.get('/', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const columns = getOrCreateKanban(tenantId);
  return res.json({ success: true, tenantId, columns });
});

// POST /api/kanban/sync (Force re-sync / refresh of Kanban board for tenant)
kanbanRouter.post('/sync', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const columns = getOrCreateKanban(tenantId);
  return res.json({ success: true, tenantId, columns });
});

// POST /api/kanban/clear (Vaciar Embudo Kanban a 0 tarjetas)
kanbanRouter.post('/clear', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const columns = JSON.parse(JSON.stringify(DEFAULT_KANBAN));
  saveKanban(tenantId, columns);
  socketService.emitToTenant(tenantId, 'kanban_updated', columns);
  return res.json({ success: true, message: 'Embudo Kanban vaciado completamente', tenantId, columns });
});

// POST /api/kanban/add-from-chat (Manual addition of a customer from Chat Inbox)
kanbanRouter.post('/add-from-chat', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const { chatId, contactName, phone, columnId = 'col_1', notes, value } = req.body;
  const columns = getOrCreateKanban(tenantId);
  const identifier = chatId || phone;

  // Check if lead already exists in any column
  let existingLead: KanbanLead | null = null;
  for (const col of columns) {
    const found = col.leads.find((l) => l.chatId === identifier || l.id === identifier || l.phone === phone);
    if (found) {
      existingLead = found;
      break;
    }
  }

  if (existingLead) {
    if (notes) existingLead.items = notes;
    if (value) existingLead.value = value;
  } else {
    const targetCol = columns.find((c) => c.id === columnId) || columns[0];
    const newLead: KanbanLead = {
      id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      chatId: identifier,
      contactName: contactName || `Cliente ${identifier.replace(/@.*/, '')}`,
      phone: phone || identifier,
      value: value || '$50.000',
      items: notes || 'Oportunidad agregada desde la Bandeja Multi-Agente',
      createdAt: new Date().toISOString().split('T')[0],
    };
    targetCol.leads.unshift(newLead);
  }

  saveKanban(tenantId, columns);
  socketService.emitToTenant(tenantId, 'kanban_updated', columns);
  return res.json({ success: true, message: `Oportunidad "${contactName}" agregada al Embudo Kanban`, tenantId, columns });
});

// POST /api/kanban/bulk-add (Bulk add selected contacts from Chat Inbox)
kanbanRouter.post('/bulk-add', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const { contacts, columnId = 'col_1' } = req.body;
  if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ success: false, error: 'Debes enviar al menos un contacto' });
  }

  const columns = getOrCreateKanban(tenantId);
  const targetCol = columns.find((c) => c.id === columnId) || columns[0];
  let addedCount = 0;

  for (const c of contacts) {
    const identifier = c.chatId || c.id || c.phone;
    const exists = columns.some((col) => col.leads.some((l) => l.chatId === identifier || l.id === identifier || l.phone === c.phone));

    if (!exists) {
      const newLead: KanbanLead = {
        id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        chatId: identifier,
        contactName: c.contactName || `Cliente ${identifier.replace(/@.*/, '')}`,
        phone: c.phone || identifier,
        value: '$50.000',
        items: c.lastMessageText || 'Agregado desde Selección Masiva de la Bandeja',
        createdAt: new Date().toISOString().split('T')[0],
      };
      targetCol.leads.unshift(newLead);
      addedCount++;
    }
  }

  saveKanban(tenantId, columns);
  socketService.emitToTenant(tenantId, 'kanban_updated', columns);
  return res.json({ success: true, message: `¡${addedCount} contactos agregados exitosamente al Embudo Kanban!`, tenantId, columns });
});

// POST /api/kanban/move (Move lead card between stages and emit real-time socket event)
kanbanRouter.post('/move', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const { leadId, sourceColId, targetColId } = req.body;
  const columns = getOrCreateKanban(tenantId);

  const sourceCol = columns.find((c: any) => c.id === sourceColId);
  const targetCol = columns.find((c: any) => c.id === targetColId);

  if (!sourceCol || !targetCol) return res.status(404).json({ success: false, error: 'Columna no encontrada' });

  const leadIndex = sourceCol.leads.findIndex((l: any) => l.id === leadId);
  if (leadIndex === -1) return res.status(404).json({ success: false, error: 'Lead no encontrado' });

  const [movedLead] = sourceCol.leads.splice(leadIndex, 1);
  targetCol.leads.unshift(movedLead);

  saveKanban(tenantId, columns);
  socketService.emitToTenant(tenantId, 'kanban_updated', columns);

  return res.json({
    success: true,
    message: `Oportunidad movida a ${targetCol.name}`,
    tenantId,
    columns,
    autoTriggerText: targetCol.autoTemplateText?.replace('{{nombre}}', movedLead.contactName),
  });
});

// DELETE /api/kanban/lead/:id (Delete individual card from Kanban)
kanbanRouter.delete('/lead/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const tenantId = getTenantIdFromReq(req);
  const columns = getOrCreateKanban(tenantId);

  let deleted = false;
  for (const col of columns) {
    const idx = col.leads.findIndex((l) => l.id === id);
    if (idx !== -1) {
      col.leads.splice(idx, 1);
      deleted = true;
      break;
    }
  }

  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Oportunidad no encontrada' });
  }

  saveKanban(tenantId, columns);
  socketService.emitToTenant(tenantId, 'kanban_updated', columns);
  return res.json({ success: true, message: 'Oportunidad eliminada del Embudo', tenantId, columns });
});

// POST /api/kanban/leads (Manual creation endpoint)
kanbanRouter.post('/leads', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const { columnId = 'col_1', contactName, phone, value, items, chatId } = req.body;
  const columns = getOrCreateKanban(tenantId);

  const identifier = chatId || phone || `lead_${Date.now()}`;
  const targetCol = columns.find((c) => c.id === columnId) || columns[0];

  const newLead: KanbanLead = {
    id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    chatId: identifier,
    contactName: contactName || 'Nuevo Cliente',
    phone: phone || identifier,
    value: value || '$50.000',
    items: items || 'Creado manualmente',
    createdAt: new Date().toISOString().split('T')[0],
  };

  targetCol.leads.unshift(newLead);
  saveKanban(tenantId, columns);
  socketService.emitToTenant(tenantId, 'kanban_updated', columns);

  return res.json({ success: true, tenantId, columns, lead: newLead });
});
```

---

### B. Proposed Replacement for `backend/src/routes/tenant.routes.ts`
*(Artifact stored at `.agents/explorer_m2_2/proposed_tenant.routes.ts`)*

```typescript
import { Router, Request, Response } from 'express';
import { OpenWAService } from '../services/openwa.service';
import { socketService } from '../services/socket.service';
import {
  PersistentStore,
  getTenantIdFromReq,
  normalizeTenantId,
  CANONICAL_ADMIN_TENANT,
} from '../services/storage.service';
import { ENV } from '../config/env';

export const tenantRouter = Router();

export interface WhatsAppLine {
  id: string;
  name: string;
  whatsappPhone: string | null;
  status: 'DISCONNECTED' | 'STARTING' | 'SCAN_QR' | 'READY';
  qrCodeUrl?: string | null;
  openwaSessionId: string;
  createdAt: string;
}

export interface TenantData {
  tenantId: string;
  name: string;
  activeLineId: string | null;
  lines: WhatsAppLine[];
}

export function loadTenantStore(): Record<string, TenantData> {
  const diskData = PersistentStore.readJSON<Record<string, TenantData>>('tenant_lines.json', {});
  const canonicalKey = CANONICAL_ADMIN_TENANT;

  if (!diskData[canonicalKey]) {
    // Check if any legacy admin alias exists and migrate
    const legacyKeys = ['danmax_wa_owner', 'super_admin', 'global_whatsapp_line', 'pizzeria', 'default', 'admin'];
    let migrated: TenantData | null = null;
    for (const legacy of legacyKeys) {
      if (diskData[legacy] && diskData[legacy].lines && diskData[legacy].lines.length > 0) {
        migrated = {
          ...diskData[legacy],
          tenantId: canonicalKey,
        };
        break;
      }
    }

    diskData[canonicalKey] = migrated || {
      tenantId: canonicalKey,
      name: 'Mi Negocio DanMax WA',
      activeLineId: null,
      lines: [],
    };
    PersistentStore.writeJSON('tenant_lines.json', diskData);
  }
  return diskData;
}

export function saveTenantStore(store: Record<string, TenantData>) {
  PersistentStore.writeJSON('tenant_lines.json', store);
}

export function getOrCreateTenant(tenantId?: string | null): TenantData {
  const cleanTenant = normalizeTenantId(tenantId);
  const store = loadTenantStore();

  if (!store[cleanTenant]) {
    store[cleanTenant] = {
      tenantId: cleanTenant,
      name: cleanTenant === CANONICAL_ADMIN_TENANT ? 'Mi Negocio DanMax WA' : `Cliente ${cleanTenant}`,
      activeLineId: null,
      lines: [],
    };
    saveTenantStore(store);
  }
  return store[cleanTenant];
}

// GET /api/tenant/openwa-config
tenantRouter.get('/openwa-config', async (req: Request, res: Response) => {
  const isConnected = ENV.OPENWA_ADMIN_KEY
    ? (await OpenWAService.testConnection()).success
    : false;

  return res.json({
    success: true,
    config: {
      openwaApiUrl: ENV.OPENWA_API_URL,
      hasAdminKey: !!ENV.OPENWA_ADMIN_KEY,
      isConnected,
      openwaAdminKeyMasked: ENV.OPENWA_ADMIN_KEY ? '••••••••' + ENV.OPENWA_ADMIN_KEY.slice(-4) : '',
      webhookPublicUrl: ENV.WEBHOOK_PUBLIC_URL,
    },
  });
});

// POST /api/tenant/config-openwa
tenantRouter.post('/config-openwa', async (req: Request, res: Response) => {
  const { apiUrl, adminKey } = req.body;

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

  const testResult = await OpenWAService.testConnection(ENV.OPENWA_API_URL, ENV.OPENWA_ADMIN_KEY);

  return res.json({
    success: testResult.success,
    message: testResult.message,
    testResult,
    config: {
      openwaApiUrl: ENV.OPENWA_API_URL,
      hasAdminKey: !!ENV.OPENWA_ADMIN_KEY,
      isConnected: testResult.success,
    },
  });
});

// GET /api/tenant/my-session (Auto-discovers and persists all active running OpenWA sessions)
tenantRouter.get('/my-session', async (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const tenant = getOrCreateTenant(tenantId);

  // Sync state with live OpenWA sessions
  if (ENV.OPENWA_ADMIN_KEY) {
    try {
      const openwaSessions = await OpenWAService.getSessions();
      for (const owaSess of openwaSessions) {
        if (!owaSess.name) continue;

        const isReady = owaSess.status === 'ready' || owaSess.status === 'CONNECTED';
        const formattedPhone = owaSess.phone ? (owaSess.phone.startsWith('+') ? owaSess.phone : `+${owaSess.phone}`) : null;

        // Check if line exists in tenant
        let existingLine = tenant.lines.find(
          (l) =>
            l.openwaSessionId === owaSess.id ||
            l.name.toLowerCase() === owaSess.name.toLowerCase() ||
            l.openwaSessionId === owaSess.name
        );

        if (existingLine) {
          existingLine.status = isReady ? 'READY' : existingLine.status;
          existingLine.whatsappPhone = formattedPhone || existingLine.whatsappPhone;
        } else if (isReady) {
          // Auto-discover active session and persist in tenant!
          const newPersistentLine: WhatsAppLine = {
            id: `line_${owaSess.id || Date.now()}`,
            name: owaSess.name,
            whatsappPhone: formattedPhone,
            status: 'READY',
            openwaSessionId: owaSess.id || owaSess.name,
            createdAt: new Date().toISOString(),
          };
          tenant.lines.push(newPersistentLine);
          if (!tenant.activeLineId) {
            tenant.activeLineId = newPersistentLine.id;
          }
        }
      }

      const store = loadTenantStore();
      store[tenantId] = tenant;
      saveTenantStore(store);
    } catch (e) {
      console.warn('[Session Auto-Discovery Error]:', e);
    }
  }

  const activeLine = tenant.lines.find((l) => l.id === tenant.activeLineId) || tenant.lines[0] || null;

  return res.json({
    success: true,
    tenantId,
    tenant,
    session: activeLine,
    lines: tenant.lines,
    activeLineId: tenant.activeLineId,
  });
});

// POST /api/tenant/add-line
tenantRouter.post('/add-line', async (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const { name } = req.body;
  const tenant = getOrCreateTenant(tenantId);

  const customName = name?.trim() || `Línea WhatsApp ${tenant.lines.length + 1}`;
  const openwaSessionId = OpenWAService.sanitizeSessionName(customName);
  const lineId = `line_${openwaSessionId}_${Date.now()}`;

  const newLine: WhatsAppLine = {
    id: lineId,
    name: customName,
    whatsappPhone: null,
    status: 'DISCONNECTED',
    openwaSessionId,
    createdAt: new Date().toISOString(),
  };

  tenant.lines.push(newLine);
  tenant.activeLineId = lineId;

  const store = loadTenantStore();
  store[tenantId] = tenant;
  saveTenantStore(store);

  return res.json({
    success: true,
    message: `Línea "${customName}" creada exitosamente`,
    tenantId,
    line: newLine,
    lines: tenant.lines,
  });
});

// POST /api/tenant/delete-line
tenantRouter.post('/delete-line', async (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const { lineId } = req.body;
  const tenant = getOrCreateTenant(tenantId);

  const lineIndex = tenant.lines.findIndex((l) => l.id === lineId);
  if (lineIndex === -1) {
    return res.status(404).json({ success: false, error: 'Línea de WhatsApp no encontrada' });
  }

  const [deletedLine] = tenant.lines.splice(lineIndex, 1);
  if (deletedLine.openwaSessionId) {
    await OpenWAService.stopSession(deletedLine.openwaSessionId);
  }

  if (tenant.activeLineId === lineId) {
    tenant.activeLineId = tenant.lines[0]?.id || null;
  }

  const store = loadTenantStore();
  store[tenantId] = tenant;
  saveTenantStore(store);

  return res.json({
    success: true,
    message: `Línea "${deletedLine.name}" eliminada exitosamente`,
    tenantId,
    lines: tenant.lines,
    activeLineId: tenant.activeLineId,
  });
});

// POST /api/tenant/switch-line
tenantRouter.post('/switch-line', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const { lineId } = req.body;
  const tenant = getOrCreateTenant(tenantId);

  const targetLine = tenant.lines.find((l) => l.id === lineId);
  if (!targetLine) {
    return res.status(404).json({ success: false, error: 'Línea de WhatsApp no encontrada' });
  }

  tenant.activeLineId = lineId;

  const store = loadTenantStore();
  store[tenantId] = tenant;
  saveTenantStore(store);

  return res.json({
    success: true,
    message: `Cambiado a la línea "${targetLine.name}"`,
    tenantId,
    activeLine: targetLine,
    lines: tenant.lines,
  });
});

// POST /api/tenant/connect-whatsapp
tenantRouter.post('/connect-whatsapp', async (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const { lineId, sessionNameLabel } = req.body;
  const tenant = getOrCreateTenant(tenantId);

  let line = tenant.lines.find((l) => l.id === (lineId || tenant.activeLineId));

  if (!line) {
    const customName = sessionNameLabel?.trim() || 'Pizzeria';
    const openwaSessionId = OpenWAService.sanitizeSessionName(customName);
    const newLineId = `line_${openwaSessionId}_${Date.now()}`;

    line = {
      id: newLineId,
      name: customName,
      whatsappPhone: null,
      status: 'DISCONNECTED',
      openwaSessionId,
      createdAt: new Date().toISOString(),
    };
    tenant.lines.push(line);
    tenant.activeLineId = newLineId;
  } else if (sessionNameLabel?.trim()) {
    line.name = sessionNameLabel.trim();
  }

  if (!ENV.OPENWA_ADMIN_KEY) {
    return res.status(400).json({
      success: false,
      error: 'Se requiere guardar tu OPENWA_ADMIN_KEY en el panel superior antes de generar un código QR real.',
    });
  }

  line.status = 'STARTING';
  const openwaResult = await OpenWAService.startSession(line.openwaSessionId);

  if (!openwaResult.success) {
    line.status = 'DISCONNECTED';
    return res.status(500).json({
      success: false,
      error: openwaResult.error || 'Error al iniciar sesión en OpenWA',
    });
  }

  if (openwaResult.status === 'READY') {
    line.status = 'READY';
    line.whatsappPhone = openwaResult.me ? (openwaResult.me.startsWith('+') ? openwaResult.me : `+${openwaResult.me}`) : '+56986176136';

    socketService.emitToTenant(tenantId, 'whatsapp_status', {
      status: 'READY',
      lineId: line.id,
      whatsappPhone: line.whatsappPhone,
      sessionNameLabel: line.name,
      message: openwaResult.message,
    });

    const store = loadTenantStore();
    store[tenantId] = tenant;
    saveTenantStore(store);

    return res.json({
      success: true,
      message: openwaResult.message,
      sessionStatus: 'READY',
      whatsappPhone: line.whatsappPhone,
      tenantId,
      line,
    });
  }

  const qrUrl = openwaResult.qrCode;
  line.status = 'SCAN_QR';
  line.qrCodeUrl = qrUrl;

  socketService.emitToTenant(tenantId, 'whatsapp_qr', {
    status: 'SCAN_QR',
    lineId: line.id,
    qrCodeUrl: qrUrl,
    sessionId: line.openwaSessionId,
    sessionNameLabel: line.name,
  });

  const store = loadTenantStore();
  store[tenantId] = tenant;
  saveTenantStore(store);

  return res.json({
    success: true,
    message: `Proceso de vinculación iniciado para "${line.name}" en OpenWA`,
    sessionStatus: 'SCAN_QR',
    qrCodeUrl: qrUrl,
    tenantId,
    line,
  });
});

// POST /api/tenant/disconnect-whatsapp
tenantRouter.post('/disconnect-whatsapp', async (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const { lineId } = req.body;
  const tenant = getOrCreateTenant(tenantId);

  const line = tenant.lines.find((l) => l.id === (lineId || tenant.activeLineId));
  if (line) {
    await OpenWAService.stopSession(line.openwaSessionId);
    line.status = 'DISCONNECTED';
    line.whatsappPhone = null;
    line.qrCodeUrl = null;
  }

  socketService.emitToTenant(tenantId, 'whatsapp_status', {
    status: 'DISCONNECTED',
    lineId: line?.id,
    message: 'Sesión de WhatsApp desconectada.',
  });

  const store = loadTenantStore();
  store[tenantId] = tenant;
  saveTenantStore(store);

  return res.json({ success: true, message: 'Sesión cerrada exitosamente en OpenWA', tenantId, lines: tenant.lines });
});
```

---

## 5. Verification Method

To independently verify this design and implementation:

1. **Compilation Check**:
   Run TypeScript compilation from `backend/`:
   ```cmd
   cmd.exe /c "npx tsc --noEmit"
   ```
   *Expected Output*: Exit code 0, 0 errors.

2. **Automated Unit & Multi-Tenant Test Execution**:
   Run the verification suite:
   ```cmd
   node .agents/explorer_m2_2/test_m2_verification.js
   ```
   *Expected Output*:
   - 23/23 tests pass.
   - Verifies that all admin aliases (`danmax_wa_owner`, `super_admin`, `global_whatsapp_line`, `pizzeria`, `default`, `admin`, `owner`, `""`, `null`, `undefined`) converge to `tenant_demo_pizzeria`.
   - Verifies that client tenant identifiers remain fully isolated.
   - Verifies cross-alias lead persistence in `kanban_store.json`.
   - Verifies cross-alias line persistence in `tenant_lines.json`.
