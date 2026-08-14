/**
 * Automated Verification Suite for Milestone 2: Universal Tenant Normalization & Admin Aliasing
 *
 * Covers:
 * 1. Tenant Normalization & Admin Aliasing Convergence
 * 2. Client Partition Isolation
 * 3. Templates Routing, Store & Category CRUD
 * 4. Kanban Pipeline Routing, Store & Card Operations
 * 5. Tenant Lines Routing, Store & WhatsApp State
 * 6. Groups Categories Routing, Store & Defensive Validation
 * 7. Socket Room Normalization & Broadcast Routing
 */

import {
  normalizeTenantId,
  getTenantIdFromReq,
  CANONICAL_ADMIN_TENANT,
  PersistentStore,
} from './services/storage.service';
import {
  loadTemplatesStore,
  saveTemplatesStore,
  DEFAULT_TEMPLATE_CATEGORIES,
} from './routes/templates.routes';
import {
  getOrCreateKanban,
  saveKanban,
} from './routes/kanban.routes';
import {
  loadTenantStore,
  saveTenantStore,
  getOrCreateTenant,
} from './routes/tenant.routes';
import {
  loadGroupStore,
  saveGroupStore,
} from './routes/groups.routes';
import { socketService } from './services/socket.service';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${testName}${detail ? ' -> ' + detail : ''}`);
  }
}

async function runMilestone2Tests() {
  console.log('================================================================');
  console.log('🚀 RUNNING MILESTONE 2 COMPREHENSIVE VERIFICATION SUITE');
  console.log('================================================================\n');

  // ==========================================================================
  // SECTION 1: Tenant Normalization & Admin Aliasing
  // ==========================================================================
  console.log('--- SECTION 1: Tenant Normalization & Admin Aliasing ---');

  const adminAliases = [
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
    null,
    undefined,
  ];

  for (const alias of adminAliases) {
    const normalized = normalizeTenantId(alias as any);
    assert(
      normalized === CANONICAL_ADMIN_TENANT,
      `Alias "${alias}" normalizes to canonical "${CANONICAL_ADMIN_TENANT}"`,
      `Got: ${normalized}`
    );
  }

  // Client tenants preservation
  const client1 = normalizeTenantId('tenant_client_acme');
  assert(client1 === 'tenant_client_acme', 'Client tenant_client_acme preserved');

  const client2 = normalizeTenantId('tenant_restaurante_los_arcos');
  assert(client2 === 'tenant_restaurante_los_arcos', 'Client tenant_restaurante_los_arcos preserved');

  // Request extraction precedence
  const reqHeader = { headers: { 'x-tenant-id': 'danmax_wa_owner' }, query: { tenantId: 'tenant_client_1' } };
  assert(getTenantIdFromReq(reqHeader) === CANONICAL_ADMIN_TENANT, 'Header precedence over query');

  const reqQuery = { headers: {}, query: { tenantId: 'tenant_client_abc' }, body: { tenantId: 'tenant_client_xyz' } };
  assert(getTenantIdFromReq(reqQuery) === 'tenant_client_abc', 'Query precedence over body');

  const reqBody = { headers: {}, query: {}, body: { tenantId: 'tenant_client_corp' } };
  assert(getTenantIdFromReq(reqBody) === 'tenant_client_corp', 'Body extraction when header & query absent');

  const reqEmpty = { headers: {}, query: {}, body: {} };
  assert(getTenantIdFromReq(reqEmpty) === CANONICAL_ADMIN_TENANT, 'Default fallback to canonical admin');

  // ==========================================================================
  // SECTION 2: Templates Routes & Partition Isolation
  // ==========================================================================
  console.log('\n--- SECTION 2: Templates Routes & Partition Isolation ---');

  // Test admin alias convergence in templates store
  const adminTmplStore = loadTemplatesStore('danmax_wa_owner');
  assert(Array.isArray(adminTmplStore.categories), 'Admin templates store has categories array');
  assert(Array.isArray(adminTmplStore.templates), 'Admin templates store has templates array');

  const testTmplId = `test_tmpl_${Date.now()}`;
  adminTmplStore.templates.unshift({
    id: testTmplId,
    tenantId: 'tenant_demo_pizzeria',
    isGlobal: false,
    title: 'Plantilla de Prueba M2',
    category: 'Ventas',
    headerType: 'TEXT',
    headerContent: null,
    content: 'Hola {{nombre}}, tu pedido está en camino a {direccion}',
    footer: 'DanMax',
    variables: ['nombre', 'direccion'],
    mediaUrl: null,
    createdAt: new Date().toISOString(),
  });
  saveTemplatesStore('danmax_wa_owner', adminTmplStore);

  // Read under other admin aliases
  const readUnderSuperAdmin = loadTemplatesStore('super_admin');
  const foundUnderSuperAdmin = readUnderSuperAdmin.templates.some((t) => t.id === testTmplId);
  assert(foundUnderSuperAdmin, 'Template written under danmax_wa_owner is visible under super_admin');

  const readUnderGlobal = loadTemplatesStore('global_whatsapp_line');
  const foundUnderGlobal = readUnderGlobal.templates.some((t) => t.id === testTmplId);
  assert(foundUnderGlobal, 'Template written under danmax_wa_owner is visible under global_whatsapp_line');

  // Client isolation in templates
  const clientTenantKey = `tenant_client_test_${Date.now()}`;
  const clientTmplStore = loadTemplatesStore(clientTenantKey);
  const clientHasAdminTmpl = clientTmplStore.templates.some((t) => t.id === testTmplId);
  assert(!clientHasAdminTmpl, 'Client tenant does NOT see admin templates (Strict Isolation)');

  clientTmplStore.templates.push({
    id: `client_tmpl_${Date.now()}`,
    tenantId: clientTenantKey,
    isGlobal: false,
    title: 'Plantilla Exclusiva Cliente',
    category: 'General',
    headerType: 'TEXT',
    headerContent: null,
    content: 'Promoción solo para clientes de esta cuenta',
    footer: null,
    variables: [],
    mediaUrl: null,
    createdAt: new Date().toISOString(),
  });
  saveTemplatesStore(clientTenantKey, clientTmplStore);

  const reReadAdmin = loadTemplatesStore('super_admin');
  const adminHasClientTmpl = reReadAdmin.templates.some((t) => t.title === 'Plantilla Exclusiva Cliente');
  assert(!adminHasClientTmpl, 'Admin does NOT bleed client templates into its partition');

  // Category management in templates
  const customCat = `Categoria_Especial_${Date.now()}`;
  adminTmplStore.categories.push(customCat);
  saveTemplatesStore('super_admin', adminTmplStore);

  const reReadAliased = loadTemplatesStore('pizzeria');
  assert(reReadAliased.categories.includes(customCat), 'New category saved under super_admin visible in pizzeria');

  // ==========================================================================
  // SECTION 3: Kanban Pipeline & Card Operations
  // ==========================================================================
  console.log('\n--- SECTION 3: Kanban Pipeline & Card Operations ---');

  const kanbanAdmin = getOrCreateKanban('danmax_wa_owner');
  assert(Array.isArray(kanbanAdmin) && kanbanAdmin.length >= 5, 'Admin Kanban has 5 default columns');

  const testLeadId = `lead_test_${Date.now()}`;
  kanbanAdmin[0].leads.unshift({
    id: testLeadId,
    chatId: '56911223344@c.us',
    contactName: 'Cliente Test M2',
    phone: '+56911223344',
    value: '$75.000',
    items: 'Pedido M2 Test',
    createdAt: new Date().toISOString().split('T')[0],
  });
  saveKanban('danmax_wa_owner', kanbanAdmin);

  // Read under another alias
  const kanbanGlobal = getOrCreateKanban('global_whatsapp_line');
  const leadFound = kanbanGlobal[0].leads.some((l) => l.id === testLeadId);
  assert(leadFound, 'Kanban lead added under danmax_wa_owner is visible under global_whatsapp_line');

  // Client isolation in Kanban
  const clientKanbanKey = `tenant_client_kanban_${Date.now()}`;
  const clientKanban = getOrCreateKanban(clientKanbanKey);
  const clientSeesAdminLead = clientKanban.some((c) => c.leads.some((l) => l.id === testLeadId));
  assert(!clientSeesAdminLead, 'Client tenant does NOT see admin Kanban leads (Strict Isolation)');

  // Lead moving test
  const movedLead = kanbanAdmin[0].leads.shift()!;
  kanbanAdmin[1].leads.unshift(movedLead);
  saveKanban('super_admin', kanbanAdmin);

  const reReadMoved = getOrCreateKanban('tenant_demo_pizzeria');
  assert(
    reReadMoved[1].leads.some((l) => l.id === testLeadId),
    'Moved lead correctly appears in target column under canonical admin'
  );

  // Clean up test lead
  kanbanAdmin[1].leads = kanbanAdmin[1].leads.filter((l) => l.id !== testLeadId);
  saveKanban('tenant_demo_pizzeria', kanbanAdmin);

  // ==========================================================================
  // SECTION 4: Tenant Lines & WhatsApp Session State
  // ==========================================================================
  console.log('\n--- SECTION 4: Tenant Lines & WhatsApp Session State ---');

  const tenantStore = loadTenantStore();
  assert(!!tenantStore[CANONICAL_ADMIN_TENANT], 'Tenant store has canonical admin record');

  const adminTenant = getOrCreateTenant('danmax_wa_owner');
  assert(adminTenant.tenantId === CANONICAL_ADMIN_TENANT, 'getOrCreateTenant resolves alias to canonical admin');

  const testLineId = `line_test_${Date.now()}`;
  adminTenant.lines.push({
    id: testLineId,
    name: 'Línea de Prueba M2',
    whatsappPhone: '+56987654321',
    status: 'READY',
    openwaSessionId: 'linea_prueba_m2',
    createdAt: new Date().toISOString(),
  });
  saveTenantStore({ ...tenantStore, [CANONICAL_ADMIN_TENANT]: adminTenant });

  const aliasReadTenant = getOrCreateTenant('super_admin');
  const lineFoundInAlias = aliasReadTenant.lines.some((l) => l.id === testLineId);
  assert(lineFoundInAlias, 'WhatsApp line added under danmax_wa_owner is visible in super_admin');

  // Client isolation in Tenant Lines
  const clientTenantLineKey = `tenant_client_lines_${Date.now()}`;
  const clientTenantData = getOrCreateTenant(clientTenantLineKey);
  assert(clientTenantData.tenantId === clientTenantLineKey, 'Client tenant gets distinct tenantId');
  const clientSeesAdminLine = clientTenantData.lines.some((l) => l.id === testLineId);
  assert(!clientSeesAdminLine, 'Client tenant does NOT see admin WhatsApp lines (Strict Isolation)');

  // Clean up test line
  adminTenant.lines = adminTenant.lines.filter((l) => l.id !== testLineId);
  saveTenantStore({ ...tenantStore, [CANONICAL_ADMIN_TENANT]: adminTenant });

  // ==========================================================================
  // SECTION 5: Groups Routes & Store
  // ==========================================================================
  console.log('\n--- SECTION 5: Groups Routes & Store ---');

  const groupStoreAdmin = loadGroupStore('danmax_wa_owner');
  assert(groupStoreAdmin.categories.includes('Todas'), 'Group store has default "Todas" category');

  const customGroupCat = `GrupoVIP_${Date.now()}`;
  groupStoreAdmin.categories.push(customGroupCat);
  saveGroupStore('super_admin', groupStoreAdmin);

  const groupStoreRead = loadGroupStore('global_whatsapp_line');
  assert(groupStoreRead.categories.includes(customGroupCat), 'Group category saved in super_admin visible in global_whatsapp_line');

  // Client isolation in Groups
  const clientGroupKey = `tenant_client_groups_${Date.now()}`;
  const clientGroupStore = loadGroupStore(clientGroupKey);
  assert(!clientGroupStore.categories.includes(customGroupCat), 'Client group store does NOT include admin categories');

  // Defensive validation in Groups
  const malformedCleanKey = 'tenant_malformed_test';
  const allGroupStores = PersistentStore.readJSON<Record<string, any>>('groups_categories.json', {});
  allGroupStores[malformedCleanKey] = {
    categories: null,
    groupCategoryMap: 'invalid_string',
    hiddenGroupIds: null,
  };
  PersistentStore.writeJSON('groups_categories.json', allGroupStores);

  const sanitizedGroupStore = loadGroupStore(malformedCleanKey);
  assert(Array.isArray(sanitizedGroupStore.categories), 'Defensive load fixes null categories');
  assert(sanitizedGroupStore.categories.includes('Todas'), 'Defensive load ensures "Todas" exists');
  assert(typeof sanitizedGroupStore.groupCategoryMap === 'object', 'Defensive load fixes malformed map');
  assert(Array.isArray(sanitizedGroupStore.hiddenGroupIds), 'Defensive load fixes null hiddenGroupIds');

  // ==========================================================================
  // SECTION 6: Socket Room Normalization
  // ==========================================================================
  console.log('\n--- SECTION 6: Socket Room Normalization ---');

  // Test that socketService methods accept aliases without crashing
  let socketCallPassed = true;
  try {
    socketService.emitToTenant('danmax_wa_owner', 'test_event', { test: true });
    socketService.emitToTenant('super_admin', 'test_event', { test: true });
    socketService.emitToTenant('global_whatsapp_line', 'test_event', { test: true });
    socketService.emitToTenant(null, 'test_event', { test: true });
    socketService.emitToTenant(undefined, 'test_event', { test: true });
    socketService.emitToTenant('tenant_client_xyz', 'test_event', { test: true });
  } catch (e) {
    socketCallPassed = false;
  }
  assert(socketCallPassed, 'socketService.emitToTenant executes smoothly with all aliases, null, and client tenants');

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log('\n================================================================');
  console.log(`📊 TEST RESULTS: Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL MILESTONE 2 TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  }
}

runMilestone2Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
