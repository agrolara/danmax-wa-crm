## 2026-08-14T05:12:19Z
You are worker_m3 for Milestone 3 (Multi-Tenant Group & Template Persistence & Client Isolation).
Your working directory is `c:\Users\Usuario\Documents\antigravity\CRM WHATSAPP\.agents\worker_m3`.

Please read:
- `c:\Users\Usuario\Documents\antigravity\CRM WHATSAPP\.agents\ORIGINAL_REQUEST.md`
- `c:\Users\Usuario\Documents\antigravity\CRM WHATSAPP\PROJECT.md`
- `c:\Users\Usuario\Documents\antigravity\CRM WHATSAPP\.agents\explorer_m3_1\handoff.md`
- `c:\Users\Usuario\Documents\antigravity\CRM WHATSAPP\.agents\explorer_m3_2\handoff.md`
- `c:\Users\Usuario\Documents\antigravity\CRM WHATSAPP\.agents\explorer_m3_3\handoff.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Tasks:
1. **`backend/src/routes/groups.routes.ts`**:
   - Add legacy admin key migration in `loadGroupStore(cleanTenant)` when `cleanTenant === CANONICAL_ADMIN_TENANT` (check `danmax_wa_owner`, `super_admin`, `global_whatsapp_line`, `pizzeria`, `default`, `admin`).
   - Sanitize `groupCategoryMap` when deleting a category in `DELETE /api/groups/categories/:name` and `DELETE /api/groups/categories` (revert assigned groups from deleted category to `'Todas'`).
   - Add `POST /api/groups/unhide` endpoint to remove a group from `hiddenGroupIds` and persist.
   - Emit `socketService.emitToTenant(cleanTenant, 'groups_updated', store)` on category creation, deletion, assignment, hide, and unhide.

2. **`backend/src/routes/templates.routes.ts`**:
   - Aggregate global templates (`isGlobal: true`) from `CANONICAL_ADMIN_TENANT` in `GET /api/templates` when a non-admin client tenant requests templates.
   - Add `PUT /api/templates/:id` endpoint to allow updating existing templates (title, content, category, headerType, headerContent, footer, mediaUrl).
   - Emit `socketService.emitToTenant(cleanTenant, 'templates_updated', tenantStore)` on template creation, update, and deletion.

3. **`backend/src/routes/kanban.routes.ts`**:
   - Add `PUT /api/kanban/leads/:id` endpoint to update lead card data (`contactName`, `phone`, `value`, `items`, `columnId`).
   - Add `POST /api/kanban/columns` endpoint to update column metadata (`name`, `color`, `autoTemplateText`).
   - Ensure real-time socket events `kanban_updated` are emitted on all mutations.

4. **Frontend View & Interceptor Updates**:
   - `frontend/src/services/api.ts`: Attach `Authorization: Bearer <danmax_token>` if token exists in `localStorage`, alongside `x-tenant-id`.
   - `frontend/src/views/WhatsAppQRView.tsx`: Replace hardcoded `socket.emit('join_tenant', 'tenant_demo_pizzeria')` with `joinTenantRoom()`. Remove hardcoded `tenantId: 'tenant_demo_pizzeria'` in API requests.
   - `frontend/src/views/TemplatesView.tsx`: Remove hardcoded `tenantId=global_whatsapp_line` query/body parameters.
   - `frontend/src/views/KanbanPipelineView.tsx`: Remove hardcoded `tenantId=tenant_demo_pizzeria` query/body parameters.
   - `frontend/src/views/ChatInboxView.tsx`, `frontend/src/views/BroadcastCalendarView.tsx`, `frontend/src/views/MediaCatalogView.tsx`, `frontend/src/views/TeamView.tsx`: Clean up hardcoded `tenant_demo_pizzeria` query/body parameters to let `api.ts` interceptor supply `x-tenant-id`.

5. **Milestone 3 Automated Test Suite**:
   - Create `backend/src/test_m3_verification.ts` with comprehensive unit and integration tests covering:
     - Group categories CRUD, assignment, category deletion map cleansing, unhide endpoint, and disk persistence.
     - Rich templates CRUD, editing via PUT, variable parsing, global template merging, and disk persistence.
     - Kanban lead updating, column customization, and real-time event emission.
     - Strict client isolation across multiple client tenants (`tenant_client_alpha`, `tenant_client_beta`) and canonical admin (`tenant_demo_pizzeria`).
     - Multi-disk file integrity across `~/.danmax_crm_data`, `/tmp/danmax_crm_persistent_data`, and `./data`.

6. **Build & Test Verification**:
   - Run `cmd.exe /c "npx tsc --noEmit"` in `backend/` (must pass with 0 errors).
   - Run `cmd.exe /c "npx tsc --noEmit"` in `frontend/` (must pass with 0 errors).
   - Run `cmd.exe /c "npx ts-node src/test_m3_verification.ts"` in `backend/` (all tests must pass).
   - Also run `cmd.exe /c "npx ts-node src/test_m2_verification.ts"` in `backend/` to verify no regressions.
