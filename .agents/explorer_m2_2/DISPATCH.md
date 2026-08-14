## 2026-08-14T04:57:21Z
You are Explorer 2 for Milestone 2: Universal Tenant Normalization & Admin Aliasing.
Your working directory: c:\Users\Usuario\Documents\antigravity\CRM WHATSAPP\.agents\explorer_m2_2
Project Scope document: c:\Users\Usuario\Documents\antigravity\CRM WHATSAPP\PROJECT.md
Original user request: c:\Users\Usuario\Documents\antigravity\CRM WHATSAPP\.agents\ORIGINAL_REQUEST.md

TASK:
1. Read ORIGINAL_REQUEST.md and PROJECT.md first.
2. Investigate `backend/src/routes/kanban.routes.ts` and `backend/src/routes/tenant.routes.ts`.
3. Design the exact changes to normalize tenant keys in `kanban.routes.ts`:
   - Replace raw queries/body checks with `getTenantIdFromReq(req)` and `normalizeTenantId(tenantId)` across all endpoints (`GET /`, `POST /clear`, `POST /add-from-chat`, `POST /bulk-add`, `POST /move`, `DELETE /lead/:id`, `POST /leads`).
   - Ensure all admin aliases map to `tenant_demo_pizzeria` in `kanban_store.json`.
4. Design the exact changes to normalize tenant keys in `tenant.routes.ts`:
   - Ensure `getOrCreateTenant`, `loadTenantStore`, `/my-session`, `/add-line`, `/switch-line`, `/delete-line`, `/connect-whatsapp`, `/disconnect-whatsapp` use `normalizeTenantId` and `getTenantIdFromReq`.
   - Ensure admin sessions share `tenant_lines.json` under `tenant_demo_pizzeria`.
5. Write your complete analysis and recommended code changes to `c:\Users\Usuario\Documents\antigravity\CRM WHATSAPP\.agents\explorer_m2_2\handoff.md`.
6. Update progress.md and send a completion message.
