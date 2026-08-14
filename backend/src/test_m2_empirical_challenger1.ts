/**
 * EMPIRICAL CHALLENGER 1 VERIFICATION HARNESS — MILESTONE 2
 *
 * Universal Tenant Normalization & Admin Aliasing Deep Empirical Challenge
 *
 * Tests:
 * 1. Normalization Matrix: 5 Target Aliases + Edge Cases + Client Preservations
 * 2. Header / Query / Body Request Tenant Extractor Precedence
 * 3. Empirical Store Mutation & Convergence Across All 4 Stores (templates_db, groups_categories, kanban_store, tenant_lines)
 *    Targeting the 5 mandatory aliases:
 *    - danmax_wa_owner
 *    - super_admin
 *    - global_whatsapp_line
 *    - pizzeria
 *    - default
 * 4. Raw Disk Inspection: Zero partition fragmentation (Only tenant_demo_pizzeria key written to disk)
 * 5. Multi-Tenant Strict Client Isolation (Zero bleed between clients and admin)
 * 6. Multi-Disk Synchronization & Auto-Recovery Backfill across OS directories
 * 7. Express Route Handlers End-to-End Simulation via Mock Requests
 * 8. Socket Room Normalization
 */

import fs from 'fs';
import path from 'path';
import {
  normalizeTenantId,
  getTenantIdFromReq,
  CANONICAL_ADMIN_TENANT,
  PersistentStore,
  getPersistentDirs,
} from './services/storage.service';
import {
  templatesRouter,
  loadTemplatesStore,
  saveTemplatesStore,
  TemplateItem,
} from './routes/templates.routes';
import {
  groupsRouter,
  loadGroupStore,
  saveGroupStore,
} from './routes/groups.routes';
import {
  kanbanRouter,
  getOrCreateKanban,
  saveKanban,
  KanbanLead,
} from './routes/kanban.routes';
import {
  tenantRouter,
  loadTenantStore,
  saveTenantStore,
  getOrCreateTenant,
} from './routes/tenant.routes';
import { socketService } from './services/socket.service';

interface MockResponse {
  statusCode: number;
  data: any;
  status(code: number): MockResponse;
  json(body: any): MockResponse;
}

function createMockRes(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    data: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.data = body;
      return this;
    },
  };
  return res;
}

const noopNext = () => {};

let testCount = 0;
let passCount = 0;
let failCount = 0;
const failureDetails: string[] = [];

function check(condition: boolean, title: string, detail?: string) {
  testCount++;
  if (condition) {
    passCount++;
    console.log(`  [PASS] ${title}`);
  } else {
    failCount++;
    const errMsg = `[FAIL] ${title}${detail ? ' -> ' + detail : ''}`;
    console.error(`  ❌ ${errMsg}`);
    failureDetails.push(errMsg);
  }
}

const MANDATORY_ADMIN_ALIASES = [
  'danmax_wa_owner',
  'super_admin',
  'global_whatsapp_line',
  'pizzeria',
  'default',
];

async function runEmpiricalChallenge() {
  console.log('================================================================');
  console.log('🔬 STARTING EMPIRICAL CHALLENGER 1 — MILESTONE 2 HARNESS');
  console.log('================================================================\n');

  // ==========================================================================
  // MODULE 1: Universal Tenant Normalization Matrix
  // ==========================================================================
  console.log('--- MODULE 1: Universal Tenant Normalization Matrix ---');

  for (const alias of MANDATORY_ADMIN_ALIASES) {
    const result = normalizeTenantId(alias);
    check(
      result === CANONICAL_ADMIN_TENANT,
      `Mandatory alias "${alias}" maps to canonical "${CANONICAL_ADMIN_TENANT}"`,
      `Got: ${result}`
    );
  }

  // Edge cases: Uppercase, leading/trailing whitespace, punctuation, null/undefined
  const edgeCaseAdminAliases = [
    { input: 'DANMAX_WA_OWNER', label: 'Uppercase DANMAX_WA_OWNER' },
    { input: '  super_admin  ', label: 'Padded whitespace super_admin' },
    { input: 'GLOBAL_WHATSAPP_LINE', label: 'Uppercase GLOBAL_WHATSAPP_LINE' },
    { input: 'Pizzeria', label: 'Titlecase Pizzeria' },
    { input: 'DEFAULT', label: 'Uppercase DEFAULT' },
    { input: 'tenant_demo_pizzeria', label: 'Canonical identity itself' },
    { input: 'admin', label: 'Generic admin' },
    { input: 'owner', label: 'Generic owner' },
    { input: '', label: 'Empty string ""' },
    { input: '   ', label: 'Whitespace-only string' },
    { input: null, label: 'null literal' },
    { input: undefined, label: 'undefined literal' },
    { input: 'undefined', label: 'string "undefined"' },
    { input: 'null', label: 'string "null"' },
  ];

  for (const tc of edgeCaseAdminAliases) {
    const res = normalizeTenantId(tc.input as any);
    check(
      res === CANONICAL_ADMIN_TENANT,
      `Edge case "${tc.label}" maps to "${CANONICAL_ADMIN_TENANT}"`,
      `Got: ${res}`
    );
  }

  // Client tenants preservation (must NOT alias to admin)
  const clientTenants = [
    'tenant_client_1',
    'tenant_client_acme',
    'tenant_pizzeria_roma', // contains 'pizzeria' substring but is distinct client
    'tenant_super_admin_corp', // contains 'super_admin' substring but is distinct client
    'client_restaurant_don_pepe',
    'org_danmax_client_alpha',
  ];

  for (const client of clientTenants) {
    const res = normalizeTenantId(client);
    check(
      res === client.toLowerCase().replace(/[^a-z0-9_]/gi, '_'),
      `Client tenant "${client}" preserved as distinct partition "${res}"`,
      `Expected ${client}, got ${res}`
    );
    check(
      res !== CANONICAL_ADMIN_TENANT,
      `Client tenant "${client}" does NOT alias to CANONICAL_ADMIN_TENANT`
    );
  }

  // ==========================================================================
  // MODULE 2: Request Tenant Context Extractor Hierarchy
  // ==========================================================================
  console.log('\n--- MODULE 2: Request Tenant Extractor Precedence ---');

  // 1. Header takes precedence over query and body
  const req1 = {
    headers: { 'x-tenant-id': 'super_admin' },
    query: { tenantId: 'tenant_client_ignored' },
    body: { tenantId: 'tenant_client_ignored2' },
  };
  check(
    getTenantIdFromReq(req1) === CANONICAL_ADMIN_TENANT,
    'Header "x-tenant-id: super_admin" takes precedence over query/body client IDs'
  );

  // 2. Capitalized Header 'X-Tenant-Id'
  const req2 = {
    headers: { 'X-Tenant-Id': 'danmax_wa_owner' },
    query: {},
    body: {},
  };
  check(
    getTenantIdFromReq(req2) === CANONICAL_ADMIN_TENANT,
    'Capitalized header "X-Tenant-Id: danmax_wa_owner" correctly extracted'
  );

  // 3. Query precedence over body when header absent
  const req3 = {
    headers: {},
    query: { sessionName: 'global_whatsapp_line' },
    body: { tenantId: 'tenant_client_ignored' },
  };
  check(
    getTenantIdFromReq(req3) === CANONICAL_ADMIN_TENANT,
    'Query param "sessionName: global_whatsapp_line" extracted when header absent'
  );

  // 4. Body extraction when header and query absent
  const req4 = {
    headers: {},
    query: {},
    body: { tenantId: 'pizzeria' },
  };
  check(
    getTenantIdFromReq(req4) === CANONICAL_ADMIN_TENANT,
    'Body param "tenantId: pizzeria" extracted when header & query absent'
  );

  // 5. Body fallback with sessionName: default
  const req5 = {
    headers: {},
    query: {},
    body: { sessionName: 'default' },
  };
  check(
    getTenantIdFromReq(req5) === CANONICAL_ADMIN_TENANT,
    'Body param "sessionName: default" extracted and aliased'
  );

  // 6. Complete absence defaults to canonical admin
  const req6 = { headers: {}, query: {}, body: {} };
  check(
    getTenantIdFromReq(req6) === CANONICAL_ADMIN_TENANT,
    'Empty request falls back to CANONICAL_ADMIN_TENANT'
  );

  // ==========================================================================
  // MODULE 3: Empirical Store Mutation & Convergence Across All 4 Stores
  // ==========================================================================
  console.log('\n--- MODULE 3: Empirical Store Mutation & Convergence Across All 4 Stores ---');

  // --------------------------------------------------------------------------
  // STORE 1: templates_db.json
  // --------------------------------------------------------------------------
  console.log('  -> Testing Store: templates_db.json');

  const uniqueTmplCategory = `CatEmp_${Date.now()}`;
  const uniqueTmplTitle = `Empirical Test Template ${Date.now()}`;
  const tmplId = `tmpl_emp_${Date.now()}`;

  // Step 1: Add category using alias 1: 'danmax_wa_owner'
  const adminTmpls1 = loadTemplatesStore('danmax_wa_owner');
  adminTmpls1.categories.push(uniqueTmplCategory);
  saveTemplatesStore('danmax_wa_owner', adminTmpls1);

  // Step 2: Add template using alias 2: 'super_admin'
  const adminTmpls2 = loadTemplatesStore('super_admin');
  const newTmpl: TemplateItem = {
    id: tmplId,
    tenantId: 'tenant_demo_pizzeria',
    isGlobal: false,
    title: uniqueTmplTitle,
    category: uniqueTmplCategory,
    headerType: 'TEXT',
    headerContent: null,
    content: 'Hola {{nombre}}, tu código es {codigo}!',
    footer: 'DanMax Empirical',
    variables: ['nombre', 'codigo'],
    mediaUrl: null,
    createdAt: new Date().toISOString(),
  };
  adminTmpls2.templates.unshift(newTmpl);
  saveTemplatesStore('super_admin', adminTmpls2);

  // Step 3: Verify raw disk storage partition
  const rawTemplatesOnDisk = PersistentStore.readJSON<Record<string, any>>('templates_db.json', {});
  check(
    !!rawTemplatesOnDisk[CANONICAL_ADMIN_TENANT],
    `templates_db.json contains canonical key "${CANONICAL_ADMIN_TENANT}"`
  );
  for (const alias of MANDATORY_ADMIN_ALIASES) {
    if (alias !== CANONICAL_ADMIN_TENANT) {
      check(
        rawTemplatesOnDisk[alias] === undefined,
        `templates_db.json has NO fragmented key for alias "${alias}" on disk`
      );
    }
  }

  // Step 4: Verify reads across remaining mandatory aliases: global_whatsapp_line, pizzeria, default
  const readGlobal = loadTemplatesStore('global_whatsapp_line');
  check(
    readGlobal.categories.includes(uniqueTmplCategory),
    'Category written under danmax_wa_owner is visible under "global_whatsapp_line"'
  );
  check(
    readGlobal.templates.some((t) => t.id === tmplId),
    'Template written under super_admin is visible under "global_whatsapp_line"'
  );

  const readPizzeria = loadTemplatesStore('pizzeria');
  check(
    readPizzeria.categories.includes(uniqueTmplCategory) &&
    readPizzeria.templates.some((t) => t.id === tmplId),
    'Category and template are visible under "pizzeria"'
  );

  const readDefault = loadTemplatesStore('default');
  check(
    readDefault.categories.includes(uniqueTmplCategory) &&
    readDefault.templates.some((t) => t.id === tmplId),
    'Category and template are visible under "default"'
  );

  // Step 5: Delete template using alias 4: 'pizzeria'
  const tmplsPizzeria = loadTemplatesStore('pizzeria');
  tmplsPizzeria.templates = tmplsPizzeria.templates.filter((t) => t.id !== tmplId);
  saveTemplatesStore('pizzeria', tmplsPizzeria);

  // Step 6: Delete category using alias 5: 'default'
  const tmplsDefault = loadTemplatesStore('default');
  tmplsDefault.categories = tmplsDefault.categories.filter((c) => c !== uniqueTmplCategory);
  saveTemplatesStore('default', tmplsDefault);

  // Step 7: Verify deletion convergence under alias 1: 'danmax_wa_owner'
  const verifyDeleted = loadTemplatesStore('danmax_wa_owner');
  check(
    !verifyDeleted.templates.some((t) => t.id === tmplId),
    'Deleted template via "pizzeria" is removed when read by "danmax_wa_owner"'
  );
  check(
    !verifyDeleted.categories.includes(uniqueTmplCategory),
    'Deleted category via "default" is removed when read by "danmax_wa_owner"'
  );

  // --------------------------------------------------------------------------
  // STORE 2: groups_categories.json
  // --------------------------------------------------------------------------
  console.log('  -> Testing Store: groups_categories.json');

  const uniqueGroupCategory = `GrpCatEmp_${Date.now()}`;
  const testGroupId = `120363000000000000@g.us`;
  const hiddenGroupId = `120363999999999999@g.us`;

  // Step 1: Add category using alias 2: 'super_admin'
  const groupStore1 = loadGroupStore('super_admin');
  groupStore1.categories.push(uniqueGroupCategory);
  saveGroupStore('super_admin', groupStore1);

  // Step 2: Assign group category using alias 3: 'global_whatsapp_line'
  const groupStore2 = loadGroupStore('global_whatsapp_line');
  groupStore2.groupCategoryMap[testGroupId] = uniqueGroupCategory;
  saveGroupStore('global_whatsapp_line', groupStore2);

  // Step 3: Hide group using alias 4: 'pizzeria'
  const groupStore3 = loadGroupStore('pizzeria');
  groupStore3.hiddenGroupIds.push(hiddenGroupId);
  saveGroupStore('pizzeria', groupStore3);

  // Step 4: Verify raw disk contents
  const rawGroupsOnDisk = PersistentStore.readJSON<Record<string, any>>('groups_categories.json', {});
  check(
    !!rawGroupsOnDisk[CANONICAL_ADMIN_TENANT],
    `groups_categories.json contains canonical key "${CANONICAL_ADMIN_TENANT}"`
  );
  for (const alias of MANDATORY_ADMIN_ALIASES) {
    if (alias !== CANONICAL_ADMIN_TENANT) {
      check(
        rawGroupsOnDisk[alias] === undefined,
        `groups_categories.json has NO fragmented key for alias "${alias}" on disk`
      );
    }
  }

  // Step 5: Read under alias 1 ('danmax_wa_owner') and alias 5 ('default')
  const readGroupOwner = loadGroupStore('danmax_wa_owner');
  check(
    readGroupOwner.categories.includes(uniqueGroupCategory),
    'Group category written under super_admin visible in "danmax_wa_owner"'
  );
  check(
    readGroupOwner.groupCategoryMap[testGroupId] === uniqueGroupCategory,
    'Group assignment written under global_whatsapp_line visible in "danmax_wa_owner"'
  );
  check(
    readGroupOwner.hiddenGroupIds.includes(hiddenGroupId),
    'Hidden group written under pizzeria visible in "danmax_wa_owner"'
  );

  const readGroupDefault = loadGroupStore('default');
  check(
    readGroupDefault.categories.includes(uniqueGroupCategory) &&
    readGroupDefault.groupCategoryMap[testGroupId] === uniqueGroupCategory &&
    readGroupDefault.hiddenGroupIds.includes(hiddenGroupId),
    'All group mutations visible in "default" alias'
  );

  // Clean up test category & assignments
  readGroupDefault.categories = readGroupDefault.categories.filter((c) => c !== uniqueGroupCategory);
  delete readGroupDefault.groupCategoryMap[testGroupId];
  readGroupDefault.hiddenGroupIds = readGroupDefault.hiddenGroupIds.filter((id) => id !== hiddenGroupId);
  saveGroupStore('default', readGroupDefault);

  // --------------------------------------------------------------------------
  // STORE 3: kanban_store.json
  // --------------------------------------------------------------------------
  console.log('  -> Testing Store: kanban_store.json');

  const leadId1 = `lead_emp_1_${Date.now()}`;
  const leadId2 = `lead_emp_2_${Date.now()}`;

  // Step 1: Add lead to col_1 using alias 3: 'global_whatsapp_line'
  const kanbanGlobal = getOrCreateKanban('global_whatsapp_line');
  kanbanGlobal[0].leads.unshift({
    id: leadId1,
    chatId: '56911223344@c.us',
    contactName: 'Cliente Global WA',
    phone: '+56911223344',
    value: '$30.000',
    items: 'Lead created under global_whatsapp_line',
    createdAt: new Date().toISOString().split('T')[0],
  });
  saveKanban('global_whatsapp_line', kanbanGlobal);

  // Step 2: Add lead to col_2 using alias 4: 'pizzeria'
  const kanbanPizzeria = getOrCreateKanban('pizzeria');
  kanbanPizzeria[1].leads.unshift({
    id: leadId2,
    chatId: '56955667788@c.us',
    contactName: 'Cliente Pizzeria Alias',
    phone: '+56955667788',
    value: '$45.000',
    items: 'Lead created under pizzeria alias',
    createdAt: new Date().toISOString().split('T')[0],
  });
  saveKanban('pizzeria', kanbanPizzeria);

  // Step 3: Verify raw disk structure
  const rawKanbanOnDisk = PersistentStore.readJSON<Record<string, any>>('kanban_store.json', {});
  check(
    !!rawKanbanOnDisk[CANONICAL_ADMIN_TENANT],
    `kanban_store.json contains canonical key "${CANONICAL_ADMIN_TENANT}"`
  );
  for (const alias of MANDATORY_ADMIN_ALIASES) {
    if (alias !== CANONICAL_ADMIN_TENANT) {
      check(
        rawKanbanOnDisk[alias] === undefined,
        `kanban_store.json has NO fragmented key for alias "${alias}" on disk`
      );
    }
  }

  // Step 4: Move leadId1 from col_1 to col_4 using alias 5: 'default'
  const kanbanDefault = getOrCreateKanban('default');
  const targetCol1 = kanbanDefault.find((c) => c.id === 'col_1')!;
  const targetCol4 = kanbanDefault.find((c) => c.id === 'col_4')!;
  const movedLeadIdx = targetCol1.leads.findIndex((l) => l.id === leadId1);
  check(movedLeadIdx !== -1, 'Found leadId1 in col_1 under "default" alias before move');
  const [movedLead] = targetCol1.leads.splice(movedLeadIdx, 1);
  targetCol4.leads.unshift(movedLead);
  saveKanban('default', kanbanDefault);

  // Step 5: Read under alias 1 ('danmax_wa_owner') and alias 2 ('super_admin')
  const kanbanOwner = getOrCreateKanban('danmax_wa_owner');
  const foundMovedInCol4 = kanbanOwner.find((c) => c.id === 'col_4')?.leads.some((l) => l.id === leadId1);
  const foundLead2InCol2 = kanbanOwner.find((c) => c.id === 'col_2')?.leads.some((l) => l.id === leadId2);
  check(!!foundMovedInCol4, 'Moved lead correctly appears in col_4 when read by "danmax_wa_owner"');
  check(!!foundLead2InCol2, 'Lead 2 in col_2 is visible when read by "danmax_wa_owner"');

  const kanbanSuper = getOrCreateKanban('super_admin');
  const superSeesBoth =
    kanbanSuper.find((c) => c.id === 'col_4')?.leads.some((l) => l.id === leadId1) &&
    kanbanSuper.find((c) => c.id === 'col_2')?.leads.some((l) => l.id === leadId2);
  check(!!superSeesBoth, 'All moved and created leads converge identically in "super_admin"');

  // Clean up test leads
  const kanbanCleanup = getOrCreateKanban('danmax_wa_owner');
  for (const col of kanbanCleanup) {
    col.leads = col.leads.filter((l) => l.id !== leadId1 && l.id !== leadId2);
  }
  saveKanban('danmax_wa_owner', kanbanCleanup);

  // --------------------------------------------------------------------------
  // STORE 4: tenant_lines.json
  // --------------------------------------------------------------------------
  console.log('  -> Testing Store: tenant_lines.json');

  const lineIdEmp = `line_emp_${Date.now()}`;
  const lineNameEmp = `Línea Empírica Test ${Date.now()}`;

  // Step 1: Add WhatsApp Line using alias 4: 'pizzeria'
  const tenantDataPizzeria = getOrCreateTenant('pizzeria');
  tenantDataPizzeria.lines.push({
    id: lineIdEmp,
    name: lineNameEmp,
    whatsappPhone: '+56999887766',
    status: 'READY',
    openwaSessionId: 'line_emp_session',
    createdAt: new Date().toISOString(),
  });
  tenantDataPizzeria.activeLineId = lineIdEmp;
  const currentTenantStore = loadTenantStore();
  currentTenantStore[CANONICAL_ADMIN_TENANT] = tenantDataPizzeria;
  saveTenantStore(currentTenantStore);

  // Step 2: Verify raw disk contents
  const rawTenantLinesOnDisk = PersistentStore.readJSON<Record<string, any>>('tenant_lines.json', {});
  check(
    !!rawTenantLinesOnDisk[CANONICAL_ADMIN_TENANT],
    `tenant_lines.json contains canonical key "${CANONICAL_ADMIN_TENANT}"`
  );
  for (const alias of MANDATORY_ADMIN_ALIASES) {
    if (alias !== CANONICAL_ADMIN_TENANT) {
      check(
        rawTenantLinesOnDisk[alias] === undefined,
        `tenant_lines.json has NO fragmented key for alias "${alias}" on disk`
      );
    }
  }

  // Step 3: Verify read convergence across aliases: 'danmax_wa_owner', 'super_admin', 'global_whatsapp_line', 'default'
  const readOwnerTenant = getOrCreateTenant('danmax_wa_owner');
  check(
    readOwnerTenant.lines.some((l) => l.id === lineIdEmp),
    'WhatsApp Line created via "pizzeria" is present in "danmax_wa_owner"'
  );
  check(
    readOwnerTenant.activeLineId === lineIdEmp,
    'Active line ID is synchronized in "danmax_wa_owner"'
  );

  const readSuperTenant = getOrCreateTenant('super_admin');
  check(
    readSuperTenant.lines.some((l) => l.id === lineIdEmp) && readSuperTenant.activeLineId === lineIdEmp,
    'WhatsApp line is synchronized in "super_admin"'
  );

  const readGlobalTenant = getOrCreateTenant('global_whatsapp_line');
  check(
    readGlobalTenant.lines.some((l) => l.id === lineIdEmp),
    'WhatsApp line is synchronized in "global_whatsapp_line"'
  );

  const readDefaultTenant = getOrCreateTenant('default');
  check(
    readDefaultTenant.lines.some((l) => l.id === lineIdEmp),
    'WhatsApp line is synchronized in "default"'
  );

  // Step 4: Delete WhatsApp line using alias 1: 'danmax_wa_owner'
  const cleanupTenantStore = loadTenantStore();
  const adminRecord = cleanupTenantStore[CANONICAL_ADMIN_TENANT];
  adminRecord.lines = adminRecord.lines.filter((l) => l.id !== lineIdEmp);
  if (adminRecord.activeLineId === lineIdEmp) {
    adminRecord.activeLineId = adminRecord.lines[0]?.id || null;
  }
  saveTenantStore(cleanupTenantStore);

  // Step 5: Verify deletion converged in alias 5: 'default'
  const verifyLineDeleted = getOrCreateTenant('default');
  check(
    !verifyLineDeleted.lines.some((l) => l.id === lineIdEmp),
    'Line deleted via "danmax_wa_owner" is confirmed deleted when queried by "default"'
  );

  // ==========================================================================
  // MODULE 4: Strict Multi-Tenant Client Partition Isolation
  // ==========================================================================
  console.log('\n--- MODULE 4: Strict Multi-Tenant Client Partition Isolation ---');

  const clientAlpha = `tenant_emp_alpha_${Date.now()}`;
  const clientBeta = `tenant_emp_beta_${Date.now()}`;

  // 1. Templates isolation
  const alphaTmplStore = loadTemplatesStore(clientAlpha);
  alphaTmplStore.templates.push({
    id: `tmpl_alpha_${Date.now()}`,
    tenantId: clientAlpha,
    isGlobal: false,
    title: 'Plantilla Exclusiva Alpha',
    category: 'Ventas',
    headerType: 'TEXT',
    headerContent: null,
    content: 'Contenido confidencial Alpha',
    footer: null,
    variables: [],
    mediaUrl: null,
    createdAt: new Date().toISOString(),
  });
  saveTemplatesStore(clientAlpha, alphaTmplStore);

  const betaTmplStore = loadTemplatesStore(clientBeta);
  check(
    !betaTmplStore.templates.some((t) => t.title === 'Plantilla Exclusiva Alpha'),
    'Client Beta does NOT see Client Alpha templates (Strict Isolation)'
  );

  const adminTmplCheck = loadTemplatesStore('danmax_wa_owner');
  check(
    !adminTmplCheck.templates.some((t) => t.title === 'Plantilla Exclusiva Alpha'),
    'Admin aliases do NOT see Client Alpha templates (Zero Leaking)'
  );

  // 2. Groups isolation
  const alphaGroupStore = loadGroupStore(clientAlpha);
  alphaGroupStore.categories.push('Alpha VIP Only');
  alphaGroupStore.groupCategoryMap['alpha_group_1'] = 'Alpha VIP Only';
  alphaGroupStore.hiddenGroupIds.push('alpha_hidden_1');
  saveGroupStore(clientAlpha, alphaGroupStore);

  const betaGroupStore = loadGroupStore(clientBeta);
  check(
    !betaGroupStore.categories.includes('Alpha VIP Only') &&
    betaGroupStore.groupCategoryMap['alpha_group_1'] === undefined &&
    !betaGroupStore.hiddenGroupIds.includes('alpha_hidden_1'),
    'Client Beta does NOT see Client Alpha group categories, mappings, or hidden IDs'
  );

  const adminGroupCheck = loadGroupStore('super_admin');
  check(
    !adminGroupCheck.categories.includes('Alpha VIP Only') &&
    adminGroupCheck.groupCategoryMap['alpha_group_1'] === undefined,
    'Admin aliases do NOT see Client Alpha group data'
  );

  // 3. Kanban isolation
  const alphaKanban = getOrCreateKanban(clientAlpha);
  alphaKanban[0].leads.push({
    id: `lead_alpha_${Date.now()}`,
    chatId: '56900001111@c.us',
    contactName: 'Lead Secreto Alpha',
    phone: '+56900001111',
    value: '$100.000',
    items: 'Confidencial Alpha',
    createdAt: new Date().toISOString().split('T')[0],
  });
  saveKanban(clientAlpha, alphaKanban);

  const betaKanban = getOrCreateKanban(clientBeta);
  check(
    !betaKanban.some((c) => c.leads.some((l) => l.contactName === 'Lead Secreto Alpha')),
    'Client Beta does NOT see Client Alpha Kanban leads'
  );

  const adminKanbanCheck = getOrCreateKanban('pizzeria');
  check(
    !adminKanbanCheck.some((c) => c.leads.some((l) => l.contactName === 'Lead Secreto Alpha')),
    'Admin aliases do NOT see Client Alpha Kanban leads'
  );

  // 4. Tenant Lines isolation
  const alphaTenant = getOrCreateTenant(clientAlpha);
  alphaTenant.lines.push({
    id: `line_alpha_${Date.now()}`,
    name: 'Línea Privada Alpha',
    whatsappPhone: '+56912340000',
    status: 'READY',
    openwaSessionId: 'sess_alpha_priv',
    createdAt: new Date().toISOString(),
  });
  const tStoreWithAlpha = loadTenantStore();
  tStoreWithAlpha[clientAlpha] = alphaTenant;
  saveTenantStore(tStoreWithAlpha);

  const betaTenant = getOrCreateTenant(clientBeta);
  check(
    !betaTenant.lines.some((l) => l.name === 'Línea Privada Alpha'),
    'Client Beta does NOT see Client Alpha WhatsApp lines'
  );

  const adminTenantCheck = getOrCreateTenant('default');
  check(
    !adminTenantCheck.lines.some((l) => l.name === 'Línea Privada Alpha'),
    'Admin aliases do NOT see Client Alpha WhatsApp lines'
  );

  // ==========================================================================
  // MODULE 5: Multi-Disk Synchronization & Auto-Recovery Under Aliasing
  // ==========================================================================
  console.log('\n--- MODULE 5: Multi-Disk Synchronization & Auto-Recovery Under Aliasing ---');

  const diskDirs = getPersistentDirs();
  check(diskDirs.length >= 3, `Discovered ${diskDirs.length} persistent disk directories`);

  // Write a verified canary template through an alias
  const canaryTmplId = `tmpl_canary_${Date.now()}`;
  const canaryStore = loadTemplatesStore('global_whatsapp_line');
  canaryStore.templates.unshift({
    id: canaryTmplId,
    tenantId: 'tenant_demo_pizzeria',
    isGlobal: false,
    title: 'Canary Disk Sync Template',
    category: 'General',
    headerType: 'TEXT',
    headerContent: null,
    content: 'Canary for multi-disk verification',
    footer: null,
    variables: [],
    mediaUrl: null,
    createdAt: new Date().toISOString(),
  });
  saveTemplatesStore('global_whatsapp_line', canaryStore);

  // Check that every reachable directory was written with the canary
  let allDiskWritesMatched = true;
  for (const dir of diskDirs) {
    const fPath = path.join(dir, 'templates_db.json');
    if (fs.existsSync(fPath)) {
      try {
        const content = JSON.parse(fs.readFileSync(fPath, 'utf-8'));
        const hasCanary = content[CANONICAL_ADMIN_TENANT]?.templates?.some((t: any) => t.id === canaryTmplId);
        if (!hasCanary) {
          allDiskWritesMatched = false;
        }
      } catch {
        allDiskWritesMatched = false;
      }
    }
  }
  check(allDiskWritesMatched, 'Simultaneous multi-disk write succeeded across all persistent locations');

  // Corrupt or wipe one disk location
  const firstDir = diskDirs[0];
  const targetWipeFile = path.join(firstDir, 'templates_db.json');
  if (fs.existsSync(targetWipeFile)) {
    fs.writeFileSync(targetWipeFile, JSON.stringify({ corrupted: true }));
  }

  // Read via an alias: should pick best candidate and auto-backfill the corrupted location
  const recoveredStore = loadTemplatesStore('pizzeria');
  check(
    recoveredStore.templates.some((t) => t.id === canaryTmplId),
    'PersistentStore recovered intact data despite corrupted disk replica'
  );

  // Check that the corrupted location was auto-backfilled
  let backfilled = false;
  try {
    const healedContent = JSON.parse(fs.readFileSync(targetWipeFile, 'utf-8'));
    if (healedContent[CANONICAL_ADMIN_TENANT]?.templates?.some((t: any) => t.id === canaryTmplId)) {
      backfilled = true;
    }
  } catch {}
  check(backfilled, 'Corrupted disk location automatically backfilled and healed on read');

  // Clean up canary template
  const cleanupCanary = loadTemplatesStore('default');
  cleanupCanary.templates = cleanupCanary.templates.filter((t) => t.id !== canaryTmplId);
  saveTemplatesStore('default', cleanupCanary);

  // ==========================================================================
  // MODULE 6: Express Route Handler Simulation via All 5 Aliases
  // ==========================================================================
  console.log('\n--- MODULE 6: Express Route Handler End-to-End Simulation ---');

  // 1. Templates router simulation
  const getTemplatesHandler = (templatesRouter.stack as any[]).find((s) => s.route?.path === '/' && s.route?.methods?.get)?.route?.stack[0]?.handle;
  const postCategoryHandler = (templatesRouter.stack as any[]).find((s) => s.route?.path === '/categories' && s.route?.methods?.post)?.route?.stack[0]?.handle;

  for (const alias of MANDATORY_ADMIN_ALIASES) {
    const mockRes = createMockRes();
    if (getTemplatesHandler) {
      getTemplatesHandler({ headers: { 'x-tenant-id': alias }, query: {}, body: {} }, mockRes, noopNext);
    }
    check(
      mockRes.data?.success === true && mockRes.data?.tenantId === CANONICAL_ADMIN_TENANT,
      `GET /api/templates with header "x-tenant-id: ${alias}" returns tenantId "${CANONICAL_ADMIN_TENANT}"`
    );
  }

  // 2. Groups router simulation
  const postGroupCatHandler = (groupsRouter.stack as any[]).find((s) => s.route?.path === '/categories' && s.route?.methods?.post)?.route?.stack[0]?.handle;
  for (const alias of MANDATORY_ADMIN_ALIASES) {
    const mockRes = createMockRes();
    if (postGroupCatHandler) {
      postGroupCatHandler(
        { headers: { 'x-tenant-id': alias }, body: { categoryName: `RouteCat_${alias}` } },
        mockRes,
        noopNext
      );
    }
    check(
      mockRes.data?.success === true && mockRes.data?.tenantId === CANONICAL_ADMIN_TENANT,
      `POST /api/groups/categories with header "${alias}" normalizes tenantId to "${CANONICAL_ADMIN_TENANT}"`
    );
  }

  // 3. Kanban router simulation
  const getKanbanHandler = (kanbanRouter.stack as any[]).find((s) => s.route?.path === '/' && s.route?.methods?.get)?.route?.stack[0]?.handle;
  for (const alias of MANDATORY_ADMIN_ALIASES) {
    const mockRes = createMockRes();
    if (getKanbanHandler) {
      getKanbanHandler({ query: { sessionName: alias }, headers: {}, body: {} }, mockRes, noopNext);
    }
    check(
      mockRes.data?.success === true && mockRes.data?.tenantId === CANONICAL_ADMIN_TENANT,
      `GET /api/kanban with query "sessionName: ${alias}" normalizes tenantId to "${CANONICAL_ADMIN_TENANT}"`
    );
  }

  // 4. Tenant router simulation
  const getMySessionHandler = (tenantRouter.stack as any[]).find((s) => s.route?.path === '/my-session' && s.route?.methods?.get)?.route?.stack[0]?.handle;
  for (const alias of MANDATORY_ADMIN_ALIASES) {
    const mockRes = createMockRes();
    if (getMySessionHandler) {
      await getMySessionHandler({ body: { tenant: alias }, headers: {}, query: {} }, mockRes, noopNext);
    }
    check(
      mockRes.data?.success === true && mockRes.data?.tenantId === CANONICAL_ADMIN_TENANT,
      `GET /api/tenant/my-session with body "tenant: ${alias}" normalizes tenantId to "${CANONICAL_ADMIN_TENANT}"`
    );
  }

  // ==========================================================================
  // MODULE 7: Socket Service Room Normalization
  // ==========================================================================
  console.log('\n--- MODULE 7: Socket Service Room Normalization ---');

  let socketTestPassed = true;
  for (const alias of MANDATORY_ADMIN_ALIASES) {
    try {
      socketService.emitToTenant(alias, 'test_event', { test: true, alias });
    } catch {
      socketTestPassed = false;
    }
  }
  check(socketTestPassed, 'socketService.emitToTenant successfully dispatches to all mandatory admin aliases');

  // ==========================================================================
  // SUMMARY & VERDICT
  // ==========================================================================
  console.log('\n================================================================');
  console.log(`📊 EMPIRICAL CHALLENGER 1 SUMMARY: Total: ${testCount} | Passed: ${passCount} | Failed: ${failCount}`);
  console.log('================================================================\n');

  if (failCount > 0) {
    console.error('❌ FAILURES DETECTED:');
    for (const f of failureDetails) {
      console.error(`  - ${f}`);
    }
    process.exit(1);
  } else {
    console.log('🎉 ALL EMPIRICAL CHALLENGE TESTS PASSED WITH ZERO FAILURES!');
    process.exit(0);
  }
}

runEmpiricalChallenge().catch((err) => {
  console.error('Fatal error during empirical challenge:', err);
  process.exit(1);
});
