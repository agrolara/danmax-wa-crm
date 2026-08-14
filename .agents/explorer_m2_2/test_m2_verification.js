const {
  PersistentStore,
  normalizeTenantId,
  getTenantIdFromReq,
  CANONICAL_ADMIN_TENANT,
} = require('../../backend/dist/services/storage.service');

const DEFAULT_KANBAN = [
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

function getOrCreateKanban(tenantId) {
  const cleanTenant = normalizeTenantId(tenantId);
  const allStores = PersistentStore.readJSON('kanban_store.json', {});

  if (!allStores[cleanTenant] || !Array.isArray(allStores[cleanTenant]) || allStores[cleanTenant].length === 0) {
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

function saveKanban(tenantId, columns) {
  const cleanTenant = normalizeTenantId(tenantId);
  const allStores = PersistentStore.readJSON('kanban_store.json', {});
  allStores[cleanTenant] = columns;
  PersistentStore.writeJSON('kanban_store.json', allStores);
}

function loadTenantStore() {
  const diskData = PersistentStore.readJSON('tenant_lines.json', {});
  const canonicalKey = CANONICAL_ADMIN_TENANT;

  if (!diskData[canonicalKey]) {
    const legacyKeys = ['danmax_wa_owner', 'super_admin', 'global_whatsapp_line', 'pizzeria', 'default', 'admin'];
    let migrated = null;
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

function saveTenantStore(store) {
  PersistentStore.writeJSON('tenant_lines.json', store);
}

function getOrCreateTenant(tenantId) {
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

async function run() {
  console.log('=== TEST SUITE: Milestone 2 Explorer 2 Verification ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, msg) {
    if (condition) {
      console.log(`✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // 1. Admin aliases
  const aliases = ['danmax_wa_owner', 'super_admin', 'global_whatsapp_line', 'pizzeria', 'default', 'admin', 'owner', '', null, undefined];
  for (const a of aliases) {
    const norm = normalizeTenantId(a);
    assert(norm === CANONICAL_ADMIN_TENANT, `normalizeTenantId('${a}') === '${CANONICAL_ADMIN_TENANT}' (got '${norm}')`);
  }

  // 2. Client Tenants
  const c1 = normalizeTenantId('tenant_cliente_juan');
  const c2 = normalizeTenantId('tenant_restaurante_los_arcos');
  assert(c1 === 'tenant_cliente_juan', 'c1 normalized properly');
  assert(c2 === 'tenant_restaurante_los_arcos', 'c2 normalized properly');
  assert(c1 !== c2, 'c1 and c2 are separate');

  // 3. getTenantIdFromReq
  assert(getTenantIdFromReq({ headers: { 'x-tenant-id': 'DanMax WA Owner' } }) === CANONICAL_ADMIN_TENANT, 'x-tenant-id DanMax WA Owner -> canonical');
  assert(getTenantIdFromReq({ headers: { 'x-tenant-id': 'tenant_cliente_juan' } }) === 'tenant_cliente_juan', 'x-tenant-id tenant_cliente_juan -> tenant_cliente_juan');
  assert(getTenantIdFromReq({ query: { tenantId: 'super_admin' } }) === CANONICAL_ADMIN_TENANT, 'query tenantId super_admin -> canonical');
  assert(getTenantIdFromReq({ body: { tenantId: 'global_whatsapp_line' } }) === CANONICAL_ADMIN_TENANT, 'body tenantId global_whatsapp_line -> canonical');

  // 4. Kanban cross-alias persistence
  const kAdmin1 = getOrCreateKanban('danmax_wa_owner');
  assert(kAdmin1.length === 5, 'Default 5 columns created');

  kAdmin1[0].leads.push({
    id: 'lead_exp2_test',
    chatId: '56986176136@c.us',
    contactName: 'Cliente Prueba M2',
    phone: '+56986176136',
    value: '$250.000',
    items: 'Prueba de sincronización',
    createdAt: '2026-08-14',
  });
  saveKanban('super_admin', kAdmin1);

  const kAdmin2 = getOrCreateKanban('global_whatsapp_line');
  assert(kAdmin2[0].leads.some(l => l.id === 'lead_exp2_test'), 'Lead saved under super_admin is readable under global_whatsapp_line');

  const kClient = getOrCreateKanban('tenant_cliente_juan');
  assert(!kClient[0].leads.some(l => l.id === 'lead_exp2_test'), 'Client tenant does NOT see admin lead');

  // Clean test lead
  kAdmin2[0].leads = kAdmin2[0].leads.filter(l => l.id !== 'lead_exp2_test');
  saveKanban(null, kAdmin2);

  // 5. Tenant lines cross-alias persistence
  const tAdmin1 = getOrCreateTenant('danmax_wa_owner');
  assert(tAdmin1.tenantId === CANONICAL_ADMIN_TENANT, 'Admin tenant ID is canonical');

  tAdmin1.lines.push({
    id: 'line_exp2_test',
    name: 'Línea de Prueba M2',
    whatsappPhone: '+56986176136',
    status: 'READY',
    openwaSessionId: 'line-m2-test',
    createdAt: new Date().toISOString(),
  });
  const tStore = loadTenantStore();
  tStore[CANONICAL_ADMIN_TENANT] = tAdmin1;
  saveTenantStore(tStore);

  const tAdmin2 = getOrCreateTenant('super_admin');
  assert(tAdmin2.lines.some(l => l.id === 'line_exp2_test'), 'Line saved under danmax_wa_owner is readable under super_admin');

  const tClient = getOrCreateTenant('tenant_cliente_juan');
  assert(!tClient.lines.some(l => l.id === 'line_exp2_test'), 'Client tenant does NOT see admin line');

  // Clean test line
  tAdmin2.lines = tAdmin2.lines.filter(l => l.id !== 'line_exp2_test');
  tStore[CANONICAL_ADMIN_TENANT] = tAdmin2;
  saveTenantStore(tStore);

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
}

run().catch(console.error);
