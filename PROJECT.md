# Project: DanMax WA CRM Multi-Tenant & Disk Persistence Overhaul

## Architecture
DanMax WA CRM features a dual-layer architecture combining real-time Baileys/OpenWA WhatsApp session connections with a multi-tenant JSON persistence engine (`PersistentStore`). 
- **Storage Subsystem**: Writes concurrently to multiple persistent disk locations (`~/.danmax_crm_data`, `/tmp/danmax_crm_persistent_data`, `./data`, `backend/data`) with atomic file writes, automatic completeness scoring, and instant cross-disk recovery backfill.
- **Tenant Subsystem**: Enforces a canonical admin alias mapping (`danmax_wa_owner`, `super_admin`, `global_whatsapp_line`, `tenant_demo_pizzeria`, etc. -> `tenant_demo_pizzeria`) while strictly preserving isolated client tenant partitions (`tenant_<id>`).
- **Data Stores**:
  - `groups_categories.json`: WhatsApp group categories, category assignments, hidden groups per tenant.
  - `templates_db.json`: Rich multimedia templates (text, image, video, document, variables, footers) per tenant.
  - `kanban_store.json`: Sales pipeline columns, trigger templates, and lead opportunity cards per tenant.
  - `tenant_lines.json`: Multi-session WhatsApp lines, connection states, QR codes per tenant.
  - `openwa_config.json`: OpenWA server endpoint and authorization keys (global singleton).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Multi-Disk Persistent Directory Engine | Persistent storage across `~/.danmax_crm_data`, `/tmp/danmax_crm_persistent_data`, and `./data` | M1 | Survey / Req 1 |
| 2 | Atomic File Writing & Error Resilience | Safe atomic write using temp files with rename and fallback | M1 | Survey / Req 1 |
| 3 | Multi-Tier Auto-Recovery & Backfill | Completeness scoring in `readJSON` with automatic synchronization across all locations | M1 | Survey / Req 1 |
| 4 | Multi-Path OpenWA Config Resolution | Persistent boot loading of `openwa_config.json` across all disk tiers in `env.ts` | M1 | Survey / Req 1 |
| 5 | Admin Tenant Aliasing & Canonical Mapping | Map all admin aliases (`danmax_wa_owner`, `super_admin`, `global_whatsapp_line`, etc.) to `tenant_demo_pizzeria` | M2 | Survey / Req 2 |
| 6 | Unified Request Tenant Context Extractor | Extract and normalize tenant context hierarchically from headers, query, and body in `getTenantIdFromReq` | M2 | Survey / Req 2 |
| 7 | Route-Level Normalization Integration | Universal normalization in `templates.routes.ts`, `kanban.routes.ts`, `tenant.routes.ts`, and `socket.service.ts` | M2 | Survey / Req 2 |
| 8 | Group Categories & Assignment Persistence | 100% disk persistence for group categories, mappings, and hidden groups per tenant in `groups_categories.json` | M3 | Survey / Req 3 |
| 9 | Rich Template Store Persistence | 100% disk persistence for multimedia templates, categories, and variables per tenant in `templates_db.json` | M3 | Survey / Req 3 |
| 10 | Strict Client Tenant Isolation | Strict segregation between distinct client tenant accounts and admin accounts | M3 | Survey / Req 3 |
| 11 | Frontend Session Context Synchronization | Align `api.ts`, `GroupsView`, `TemplatesView`, and `KanbanPipelineView` with normalized tenant routing | M3 | Survey / Req 3 |
| 12 | Full E2E Test Suite & Adversarial Hardening | Comprehensive test harness covering Tiers 1-4 and Tier 5 adversarial chaos testing | M4 | Survey / Req 4 |
| 13 | TypeScript Build & Compilation Verification | 0-error TypeScript compilation on backend (`tsc --noEmit`) and frontend | M4 | Survey / Req 4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Storage Engine Core & Multi-Disk Fallback | Implement multi-location resolution, atomic write, completeness scoring, auto-backfill, and config persistence in `storage.service.ts` and `env.ts` | none | DONE |
| 2 | Universal Tenant Normalization & Admin Aliasing | Implement canonical admin alias mapping, `getTenantIdFromReq`, and route-level normalization in `templates.routes.ts`, `kanban.routes.ts`, `tenant.routes.ts`, and `socket.service.ts` | M1 | DONE |
| 3 | Multi-Tenant Group & Template Persistence & Client Isolation | Guarantee 100% disk persistence for groups, categories, rich templates, and kanban cards per tenant with strict client isolation and frontend synchronization | M2 | IN_PROGRESS |
| 4 | E2E Verification & Adversarial Coverage Hardening | Run complete E2E test suite (Tiers 1-4), execute Tier 5 adversarial stress/wipe tests, and verify 0-error TypeScript builds | M3 | PLANNED |

## Interface Contracts

### `backend/src/services/storage.service.ts`
```typescript
export const CANONICAL_ADMIN_TENANT = 'tenant_demo_pizzeria';

export function normalizeTenantId(rawTenant?: string | null): string;
export function getTenantIdFromReq(req: any): string;
export function getPersistentDirs(): string[];
export function ensureDir(dirPath: string): boolean;

export class PersistentStore {
  static getFilePaths(filename: string): string[];
  static readJSON<T>(filename: string, fallback: T): T;
  static writeJSON<T>(filename: string, data: T): void;
}
```

### `backend/src/routes/templates.routes.ts`
- Store: `templates_db.json`
- Keying: `Record<string, { categories: string[], templates: TemplateItem[] }>`
- Normalization: `normalizeTenantId(getTenantIdFromReq(req))`

### `backend/src/routes/groups.routes.ts`
- Store: `groups_categories.json`
- Keying: `Record<string, { categories: string[], groupCategoryMap: Record<string, string>, hiddenGroupIds: string[] }>`
- Normalization: `normalizeTenantId(getTenantIdFromReq(req))`

### `backend/src/routes/kanban.routes.ts`
- Store: `kanban_store.json`
- Keying: `Record<string, KanbanColumn[]>`
- Normalization: `normalizeTenantId(getTenantIdFromReq(req))`

### `backend/src/routes/tenant.routes.ts`
- Store: `tenant_lines.json`
- Keying: `Record<string, TenantData>`
- Normalization: `normalizeTenantId(getTenantIdFromReq(req))`

## Code Layout
- Backend Source: `backend/src/`
  - `backend/src/services/storage.service.ts` (Storage & Tenant Normalization Engine)
  - `backend/src/services/socket.service.ts` (Socket Room Normalization)
  - `backend/src/config/env.ts` (Environment & Persistent Config Boot)
  - `backend/src/routes/groups.routes.ts` (Groups & Categories Controller)
  - `backend/src/routes/templates.routes.ts` (Rich Templates Controller)
  - `backend/src/routes/kanban.routes.ts` (Kanban Pipeline Controller)
  - `backend/src/routes/tenant.routes.ts` (Tenant Lines & OpenWA Session Controller)
- Frontend Source: `frontend/src/`
  - `frontend/src/services/api.ts` (Axios Tenant Context Interceptor)
  - `frontend/src/views/GroupsView.tsx` (Group Categories UI)
  - `frontend/src/views/TemplatesView.tsx` (Rich Templates UI)
  - `frontend/src/views/KanbanPipelineView.tsx` (Kanban UI)
  - `frontend/src/views/WhatsAppQRView.tsx` (QR & Session UI)
- Persistent Data Directories:
  - `~/.danmax_crm_data/`
  - `/tmp/danmax_crm_persistent_data/`
  - `./data/` (or `backend/data/`)
