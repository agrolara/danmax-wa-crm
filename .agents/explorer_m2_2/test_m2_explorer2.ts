import {
  PersistentStore,
  normalizeTenantId,
  getTenantIdFromReq,
  CANONICAL_ADMIN_TENANT,
} from '../../backend/src/services/storage.service';
import {
  getOrCreateKanban,
  saveKanban,
  KanbanColumn,
} from './proposed_kanban.routes';
import {
  getOrCreateTenant,
  loadTenantStore,
  saveTenantStore,
} from './proposed_tenant.routes';

async function runTests() {
  console.log('=== TEST SUITE: Milestone 2 Explorer 2 Verification ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // Test 1: normalizeTenantId mapping
  const adminAliases = ['danmax_wa_owner', 'super_admin', 'global_whatsapp_line', 'pizzeria', 'default', 'admin', 'owner', '', null, undefined];
  for (const alias of adminAliases) {
    const norm = normalizeTenantId(alias);
    assert(norm === CANONICAL_ADMIN_TENANT, `Alias "${alias}" maps to "${CANONICAL_ADMIN_TENANT}" (got "${norm}")`);
  }

  // Test 2: Client tenant isolation
  const client1 = normalizeTenantId('tenant_cliente_1');
  const client2 = normalizeTenantId('tenant_cliente_2');
  assert(client1 === 'tenant_cliente_1', 'Client 1 preserves identifier');
  assert(client2 === 'tenant_cliente_2', 'Client 2 preserves identifier');
  assert(client1 !== client2, 'Clients are distinct');
  assert(client1 !== CANONICAL_ADMIN_TENANT, 'Client 1 is not admin');

  // Test 3: getTenantIdFromReq extraction priority
  const reqHeader = { headers: { 'x-tenant-id': 'DanMax WA Owner' }, query: {}, body: {} };
  assert(getTenantIdFromReq(reqHeader) === CANONICAL_ADMIN_TENANT, 'Req with header DanMax WA Owner normalizes to canonical admin');

  const reqClient = { headers: { 'x-tenant-id': 'tenant_acme_corp' }, query: {}, body: {} };
  assert(getTenantIdFromReq(reqClient) === 'tenant_acme_corp', 'Req with header tenant_acme_corp normalizes to tenant_acme_corp');

  // Test 4: Kanban Store Normalization & Admin Aliasing
  const adminKanban1 = getOrCreateKanban('danmax_wa_owner');
  assert(Array.isArray(adminKanban1) && adminKanban1.length === 5, 'Admin Kanban has 5 default columns');

  // Add lead under super_admin
  adminKanban1[0].leads.push({
    id: 'lead_test_1',
    chatId: '56986176136@c.us',
    contactName: 'Cliente Test Admin',
    phone: '+56986176136',
    value: '$100.000',
    items: 'Pedido especial',
    createdAt: '2026-08-14',
  });
  saveKanban('super_admin', adminKanban1);

  // Retrieve under global_whatsapp_line or null
  const adminKanban2 = getOrCreateKanban('global_whatsapp_line');
  assert(adminKanban2[0].leads.some(l => l.id === 'lead_test_1'), 'Lead added under super_admin is visible under global_whatsapp_line');

  const adminKanban3 = getOrCreateKanban(null);
  assert(adminKanban3[0].leads.some(l => l.id === 'lead_test_1'), 'Lead is visible under null tenant (canonical admin)');

  // Verify Client Kanban isolation
  const clientKanban = getOrCreateKanban('tenant_acme_corp');
  assert(clientKanban[0].leads.length === 0, 'Client tenant Kanban leads are isolated (empty)');

  // Test 5: Tenant Lines Normalization & Admin Aliasing
  const adminTenant1 = getOrCreateTenant('danmax_wa_owner');
  assert(adminTenant1.tenantId === CANONICAL_ADMIN_TENANT, 'Admin tenant ID is canonical admin');

  adminTenant1.lines.push({
    id: 'line_admin_test_1',
    name: 'Línea Ventas Admin',
    whatsappPhone: '+56986176136',
    status: 'READY',
    openwaSessionId: 'ventas-admin',
    createdAt: new Date().toISOString(),
  });
  const store = loadTenantStore();
  store[CANONICAL_ADMIN_TENANT] = adminTenant1;
  saveTenantStore(store);

  // Retrieve under super_admin
  const adminTenant2 = getOrCreateTenant('super_admin');
  assert(adminTenant2.lines.some(l => l.id === 'line_admin_test_1'), 'Line added under danmax_wa_owner is visible under super_admin');

  // Verify client tenant line isolation
  const clientTenant = getOrCreateTenant('tenant_acme_corp');
  assert(clientTenant.lines.length === 0, 'Client tenant has isolated 0 lines');

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
}

runTests().catch(console.error);
