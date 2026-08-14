# Original User Request

## Initial Request — 2026-08-14T04:46:36Z

Fix permanent storage and multi-tenant persistence in DanMax WA CRM so group categories, group assignments, and rich templates never disappear on page refresh, re-login, or Docker container redeployment.

Requirements:
1. Update `storage.service.ts` to write and auto-recover JSON stores (`groups_categories.json`, `templates_db.json`, `kanban_store.json`, `tenant_lines.json`, `openwa_config.json`) across multiple persistent disk locations (`/tmp/danmax_crm_persistent_data`, `~/.danmax_crm_data`, and `./data`).
2. Alias and normalize default/admin tenant keys (`danmax_wa_owner`, `super_admin`, `tenant_demo_pizzeria`, `global_whatsapp_line`) so all admin sessions map to the same persistent category and template store.
3. Maintain strict tenant isolation for client accounts while guaranteeing 100% disk persistence for each client's categories and templates.
4. Verify TypeScript compilation and ensure clean code changes.
