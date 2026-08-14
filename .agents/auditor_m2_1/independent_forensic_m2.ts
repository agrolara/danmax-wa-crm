/**
 * Independent Forensic Integrity Verification for Milestone 2
 * Executed by Forensic Auditor (auditor_m2_1)
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from '../../frontend/node_modules/socket.io-client';

import {
  PersistentStore,
  normalizeTenantId,
  getTenantIdFromReq,
  CANONICAL_ADMIN_TENANT,
  getPersistentDirs,
} from '../../backend/src/services/storage.service';
import {
  templatesRouter,
  loadTemplatesStore,
  saveTemplatesStore,
  DEFAULT_TEMPLATE_CATEGORIES,
} from '../../backend/src/routes/templates.routes';
import {
  kanbanRouter,
  getOrCreateKanban,
  saveKanban,
} from '../../backend/src/routes/kanban.routes';
import {
  tenantRouter,
  loadTenantStore,
  saveTenantStore,
  getOrCreateTenant,
} from '../../backend/src/routes/tenant.routes';
import {
  groupsRouter,
  loadGroupStore,
  saveGroupStore,
} from '../../backend/src/routes/groups.routes';
import { socketService } from '../../backend/src/services/socket.service';

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

const noop = () => {};

let testCount = 0;
let passedCount = 0;
let failedCount = 0;
const failureDetails: string[] = [];

function check(assertion: boolean, description: string, detail?: string) {
  testCount++;
  if (assertion) {
    passedCount++;
    console.log(`  [PASS] ${description}`);
  } else {
    failedCount++;
    const errMsg = `[FAIL] ${description} ${detail ? ' -> ' + detail : ''}`;
    failureDetails.push(errMsg);
    console.error(`  ❌ ${errMsg}`);
  }
}

async function runForensicAudit() {
  console.log('================================================================================');
  console.log('🔬 INDEPENDENT FORENSIC INTEGRITY AUDIT — MILESTONE 2');
  console.log('================================================================================\n');

  // ============================================================================
  // PHASE 1: STATIC INTEGRITY & FACADE INSPECTION
  // ============================================================================
  console.log('--- PHASE 1: Static Code Analysis & Anti-Cheat Forensics ---');

  const backendSrcDir = path.resolve(__dirname, '../../backend/src');
  const targetFiles = [
    'services/storage.service.ts',
    'routes/templates.routes.ts',
    'routes/kanban.routes.ts',
    'routes/tenant.routes.ts',
    'routes/groups.routes.ts',
    'services/socket.service.ts',
  ];

  for (const relPath of targetFiles) {
    const fullPath = path.join(backendSrcDir, relPath);
    check(fs.existsSync(fullPath), `Target source file exists: ${relPath}`);

    const content = fs.readFileSync(fullPath, 'utf-8');

    // Check 1: No test-specific branching or hardcoded test response traps
    const hasTestBypass = /if\s*\(.*(isTest|NODE_ENV\s*===?\s*['"]test['"]|__TEST__).*\)/i.test(content);
    check(!hasTestBypass, `No test-specific conditional bypasses in ${relPath}`);

    // Check 2: No dummy return stubs
    const hasEmptyReturnStub = /function\s+\w+\([^)]*\)\s*:\s*\w+\s*\{\s*return\s+(null|undefined|""|\[\]|\{\});\s*\}/m.test(content);
    check(!hasEmptyReturnStub, `No dummy empty return stubs in ${relPath}`);

    // Check 3: Check genuine import and usage of PersistentStore
    if (relPath.includes('routes/')) {
      const usesPersistentStore = content.includes('PersistentStore.readJSON') && content.includes('PersistentStore.writeJSON');
      check(usesPersistentStore, `Route file genuine disk store integration in ${relPath}`);
      
      const usesNormalizeOrReqHelper = content.includes('getTenantIdFromReq') || content.includes('normalizeTenantId');
      check(usesNormalizeOrReqHelper, `Route file genuine tenant normalization in ${relPath}`);
    }
  }

  // ============================================================================
  // PHASE 2: NORMALIZATION ALIAS CONVERGENCE & CLIENT ISOLATION
  // ============================================================================
  console.log('\n--- PHASE 2: Normalization Convergence & Request Header Extraction ---');

  // All known admin aliases with bizarre cases and whitespace
  const adminTestCases = [
    'danmax_wa_owner',
    '  DANMAX_WA_OWNER  ',
    'super_admin',
    '  SUPER_ADMIN \t',
    'tenant_demo_pizzeria',
    'TENANT_DEMO_PIZZERIA',
    'global_whatsapp_line',
    'GLOBAL_WHATSAPP_LINE',
    'pizzeria',
    '  Pizzeria  ',
    'default',
    'admin',
    'owner',
    'undefined',
    'null',
    '',
    '   ',
    null,
    undefined,
  ];

  for (const alias of adminTestCases) {
    const result = normalizeTenantId(alias as any);
    check(
      result === CANONICAL_ADMIN_TENANT,
      `Alias "${alias}" securely maps to canonical admin "${CANONICAL_ADMIN_TENANT}"`,
      `Got: ${result}`
    );
  }

  // Client tenant identifiers with whitespace and mixed cases
  const clientTestCases = [
    { input: 'tenant_client_hospital', expected: 'tenant_client_hospital' },
    { input: '  Tenant_Client_Hospital  ', expected: 'tenant_client_hospital' },
    { input: 'client-123.abc', expected: 'client_123_abc' },
    { input: 'empresa@ventas#01', expected: 'empresa_ventas_01' },
  ];

  for (const tc of clientTestCases) {
    const res = normalizeTenantId(tc.input);
    check(res === tc.expected, `Client identifier "${tc.input}" normalizes to "${tc.expected}"`, `Got: ${res}`);
    check(res !== CANONICAL_ADMIN_TENANT, `Client identifier "${tc.input}" does NOT collide with admin`);
  }

  // Request hierarchy extraction
  const req1 = { headers: { 'x-tenant-id': 'Tenant_Client_Header' }, query: { tenantId: 'danmax_wa_owner' } };
  check(getTenantIdFromReq(req1) === 'tenant_client_header', 'Header takes highest priority over query');

  const req2 = { headers: {}, query: { tenant: 'Tenant_Client_Query' }, body: { tenantId: 'Tenant_Client_Body' } };
  check(getTenantIdFromReq(req2) === 'tenant_client_query', 'Query takes priority over body');

  const req3 = { headers: {}, query: {}, body: { sessionName: 'Tenant_Client_Body_Session' } };
  check(getTenantIdFromReq(req3) === 'tenant_client_body_session', 'Body extracted when header & query absent');

  const req4 = { headers: {}, query: {}, body: {} };
  check(getTenantIdFromReq(req4) === CANONICAL_ADMIN_TENANT, 'Empty request falls back to canonical admin');

  // ============================================================================
  // PHASE 3: REAL EXPRESS ROUTE HANDLER BEHAVIORAL FORENSICS
  // ============================================================================
  console.log('\n--- PHASE 3: Route Handler Behavioral Execution & Real Disk State ---');

  // Find Route Handlers
  const getTmplHandler = (templatesRouter.stack as any[]).find((s) => s.route?.path === '/' && s.route?.methods?.get)?.route?.stack[0]?.handle;
  const postTmplHandler = (templatesRouter.stack as any[]).find((s) => s.route?.path === '/' && s.route?.methods?.post)?.route?.stack[0]?.handle;
  const delTmplHandler = (templatesRouter.stack as any[]).find((s) => s.route?.path === '/:id' && s.route?.methods?.delete)?.route?.stack[0]?.handle;
  const getCatHandler = (templatesRouter.stack as any[]).find((s) => s.route?.path === '/categories' && s.route?.methods?.get)?.route?.stack[0]?.handle;
  const postCatHandler = (templatesRouter.stack as any[]).find((s) => s.route?.path === '/categories' && s.route?.methods?.post)?.route?.stack[0]?.handle;
  const delParamCatHandler = (templatesRouter.stack as any[]).find((s) => s.route?.path === '/categories/:name' && s.route?.methods?.delete)?.route?.stack[0]?.handle;

  check(typeof postTmplHandler === 'function', 'Found POST /templates route handler');
  check(typeof delTmplHandler === 'function', 'Found DELETE /templates/:id route handler');

  // Test 1: Variable extraction edge cases in templates
  const complexContent = 'Hola {{nombre}}, tu código es {codigo} y tu factura es {{ factura_id }}. Detalle: {item-desc}';
  const postRes1 = createMockRes();
  postTmplHandler(
    {
      headers: { 'x-tenant-id': 'danmax_wa_owner' },
      body: {
        title: 'Forensic Template Variable Test',
        category: 'Ventas',
        content: complexContent,
      },
    },
    postRes1,
    noop
  );

  check(postRes1.statusCode === 200, 'POST /templates returned 200 OK');
  check(postRes1.data?.success === true, 'POST /templates success is true');
  const createdTmpl = postRes1.data?.template;
  check(createdTmpl && Array.isArray(createdTmpl.variables), 'Template contains variables array');
  check(createdTmpl.variables.includes('nombre'), 'Extracted double bracket {{nombre}}');
  check(createdTmpl.variables.includes('codigo'), 'Extracted single bracket {codigo}');

  // Verify disk persistence in all disk directories
  const persistentDirs = getPersistentDirs();
  let foundOnDisk = 0;
  for (const dir of persistentDirs) {
    const tmplFile = path.join(dir, 'templates_db.json');
    if (fs.existsSync(tmplFile)) {
      try {
        const raw = fs.readFileSync(tmplFile, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed[CANONICAL_ADMIN_TENANT]?.templates?.some((t: any) => t.id === createdTmpl.id)) {
          foundOnDisk++;
        }
      } catch {}
    }
  }
  check(foundOnDisk > 0, `Template genuinely written to physical disk (${foundOnDisk} locations found)`);

  // Test 2: Admin Aliasing Convergence on Templates
  const getResSuperAdmin = createMockRes();
  getTmplHandler({ headers: { 'x-tenant-id': 'super_admin' }, query: {} }, getResSuperAdmin, noop);
  const foundInSuperAdmin = getResSuperAdmin.data?.templates?.some((t: any) => t.id === createdTmpl.id);
  check(foundInSuperAdmin, 'Template created under danmax_wa_owner is visible when queried via super_admin');

  const getResGlobal = createMockRes();
  getTmplHandler({ headers: { 'x-tenant-id': 'global_whatsapp_line' }, query: {} }, getResGlobal, noop);
  const foundInGlobal = getResGlobal.data?.templates?.some((t: any) => t.id === createdTmpl.id);
  check(foundInGlobal, 'Template created under danmax_wa_owner is visible when queried via global_whatsapp_line');

  // Test 3: Strict Client Isolation on Templates
  const isolatedClientTenant = `tenant_audit_client_${Date.now()}`;
  const getResClient = createMockRes();
  getTmplHandler({ headers: { 'x-tenant-id': isolatedClientTenant }, query: {} }, getResClient, noop);
  const clientHasAdminTmpl = getResClient.data?.templates?.some((t: any) => t.id === createdTmpl.id);
  check(!clientHasAdminTmpl, 'Client tenant CANNOT see admin template (Strict Isolation)');

  // Attempt delete from client of admin template -> must 404
  const delAttackRes = createMockRes();
  delTmplHandler({ headers: { 'x-tenant-id': isolatedClientTenant }, params: { id: createdTmpl.id } }, delAttackRes, noop);
  check(delAttackRes.statusCode === 404, 'Client deleting Admin template returns 404 Not Found');

  // Delete template under another admin alias
  const delResAliased = createMockRes();
  delTmplHandler({ headers: { 'x-tenant-id': 'pizzeria' }, params: { id: createdTmpl.id } }, delResAliased, noop);
  check(delResAliased.data?.success === true, 'Admin alias "pizzeria" successfully deletes template');

  // ============================================================================
  // PHASE 4: KANBAN & GROUPS DEEP VERIFICATION
  // ============================================================================
  console.log('\n--- PHASE 4: Kanban & Groups Multi-Tenant Isolation Forensics ---');

  const postKanbanLeadHandler = (kanbanRouter.stack as any[]).find((s) => s.route?.path === '/leads' && s.route?.methods?.post)?.route?.stack[0]?.handle;
  const moveKanbanHandler = (kanbanRouter.stack as any[]).find((s) => s.route?.path === '/move' && s.route?.methods?.post)?.route?.stack[0]?.handle;
  const clearKanbanHandler = (kanbanRouter.stack as any[]).find((s) => s.route?.path === '/clear' && s.route?.methods?.post)?.route?.stack[0]?.handle;

  const clientKanbanA = `tenant_client_kanban_a_${Date.now()}`;
  const clientKanbanB = `tenant_client_kanban_b_${Date.now()}`;

  const addLeadResA = createMockRes();
  postKanbanLeadHandler(
    {
      headers: { 'x-tenant-id': clientKanbanA },
      body: { contactName: 'Lead VIP Tenant A', phone: '+56900000001', columnId: 'col_1' },
    },
    addLeadResA,
    noop
  );
  check(addLeadResA.data?.success === true, 'Tenant A created Kanban lead');
  const leadA = addLeadResA.data?.lead;

  // Move Lead in Tenant A
  const moveResA = createMockRes();
  moveKanbanHandler(
    {
      headers: { 'x-tenant-id': clientKanbanA },
      body: { leadId: leadA.id, sourceColId: 'col_1', targetColId: 'col_4' },
    },
    moveResA,
    noop
  );
  check(moveResA.data?.success === true, 'Tenant A moved lead to Venta Cerrada (col_4)');
  check(moveResA.data?.columns?.find((c: any) => c.id === 'col_4')?.leads?.some((l: any) => l.id === leadA.id), 'Lead is in col_4');

  // Verify Tenant B has empty Kanban columns
  const kanbanStoreB = getOrCreateKanban(clientKanbanB);
  const tenantBHasLeadA = kanbanStoreB.some((c) => c.leads.some((l) => l.id === leadA.id));
  check(!tenantBHasLeadA, 'Tenant B Kanban is completely isolated from Tenant A');

  // Groups Default Protection
  const delGrpParamHandler = (groupsRouter.stack as any[]).find((s) => s.route?.path === '/categories/:name' && s.route?.methods?.delete)?.route?.stack[0]?.handle;
  const delTodasRes = createMockRes();
  delGrpParamHandler({ headers: { 'x-tenant-id': 'danmax_wa_owner' }, params: { name: 'Todas' } }, delTodasRes, noop);
  check(delTodasRes.statusCode === 400, 'Attempt to delete "Todas" category returns HTTP 400 Bad Request');

  // ============================================================================
  // PHASE 5: REAL-TIME SOCKET.IO CLIENT-SERVER HARNESS
  // ============================================================================
  console.log('\n--- PHASE 5: Live Socket Room Segregation & Multi-Client Broadcast Harness ---');

  const testHttpServer = http.createServer();
  socketService.init(testHttpServer);

  await new Promise<void>((resolve) => {
    testHttpServer.listen(0, '127.0.0.1', () => resolve());
  });

  const port = (testHttpServer.address() as any).port;
  const socketUrl = `http://127.0.0.1:${port}`;

  const clientAlpha: ClientSocketType = ClientSocket(socketUrl);
  const clientBeta: ClientSocketType = ClientSocket(socketUrl);
  const clientAdminOwner: ClientSocketType = ClientSocket(socketUrl);
  const clientAdminSuper: ClientSocketType = ClientSocket(socketUrl);

  await Promise.all([
    new Promise((r) => clientAlpha.on('connect', r)),
    new Promise((r) => clientBeta.on('connect', r)),
    new Promise((r) => clientAdminOwner.on('connect', r)),
    new Promise((r) => clientAdminSuper.on('connect', r)),
  ]);

  // Join rooms
  clientAlpha.emit('join_tenant', 'tenant_client_alpha');
  clientBeta.emit('join_tenant', 'tenant_client_beta');
  clientAdminOwner.emit('join_tenant', 'danmax_wa_owner');
  clientAdminSuper.emit('join_tenant', 'super_admin');

  await new Promise((r) => setTimeout(r, 200));

  let alphaReceived = 0;
  let betaReceived = 0;
  let ownerReceived = 0;
  let superReceived = 0;

  clientAlpha.on('forensic_event', () => alphaReceived++);
  clientBeta.on('forensic_event', () => betaReceived++);
  clientAdminOwner.on('forensic_event', () => ownerReceived++);
  clientAdminSuper.on('forensic_event', () => superReceived++);

  // Emit to Client Alpha
  socketService.emitToTenant('tenant_client_alpha', 'forensic_event', { msg: 'Alpha only' });
  await new Promise((r) => setTimeout(r, 100));

  check(alphaReceived === 1, 'Client Alpha received message');
  check(betaReceived === 0, 'Client Beta did NOT receive Alpha message (0% Leakage)');
  check(ownerReceived === 0, 'Admin Owner did NOT receive Alpha message (0% Leakage)');
  check(superReceived === 0, 'Admin Super did NOT receive Alpha message (0% Leakage)');

  // Emit to Admin via alias 'global_whatsapp_line' -> should reach BOTH Admin Owner and Admin Super
  socketService.emitToTenant('global_whatsapp_line', 'forensic_event', { msg: 'Admin broadcast' });
  await new Promise((r) => setTimeout(r, 100));

  check(ownerReceived === 1, 'Admin Owner received broadcast sent to global_whatsapp_line (Room Convergence)');
  check(superReceived === 1, 'Admin Super received broadcast sent to global_whatsapp_line (Room Convergence)');
  check(alphaReceived === 1, 'Client Alpha did NOT receive Admin message (0% Leakage)');
  check(betaReceived === 0, 'Client Beta did NOT receive Admin message (0% Leakage)');

  // Close live sockets and server
  clientAlpha.disconnect();
  clientBeta.disconnect();
  clientAdminOwner.disconnect();
  clientAdminSuper.disconnect();
  testHttpServer.close();

  // ============================================================================
  // PHASE 6: FINAL FORENSIC VERDICT SUMMARY
  // ============================================================================
  console.log('\n================================================================================');
  console.log(`📊 FORENSIC AUDIT RESULTS: Total: ${testCount} | Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log('================================================================================\n');

  if (failedCount > 0) {
    console.error('❌ INTEGRITY VIOLATION DETECTED! Failures:');
    failureDetails.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  } else {
    console.log('🌟 VERDICT: CLEAN');
    console.log('All anti-cheat checks, multi-tenant isolation, admin convergence, and disk persistence verified.');
    process.exit(0);
  }
}

runForensicAudit().catch((err) => {
  console.error('Fatal forensic error:', err);
  process.exit(1);
});
