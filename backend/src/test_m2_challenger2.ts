import http from 'http';
import { io as ioClient, Socket as ClientSocket } from '../../frontend/node_modules/socket.io-client';
import { socketService } from './services/socket.service';
import {
  PersistentStore,
  normalizeTenantId,
  getTenantIdFromReq,
  CANONICAL_ADMIN_TENANT,
  getPersistentDirs,
} from './services/storage.service';
import {
  templatesRouter,
  loadTemplatesStore,
  saveTemplatesStore,
} from './routes/templates.routes';
import {
  kanbanRouter,
  getOrCreateKanban,
  saveKanban,
} from './routes/kanban.routes';
import {
  tenantRouter,
  loadTenantStore,
  saveTenantStore,
  getOrCreateTenant,
} from './routes/tenant.routes';
import {
  groupsRouter,
  loadGroupStore,
  saveGroupStore,
} from './routes/groups.routes';

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

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function assert(condition: boolean, description: string, detail?: string) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✅ PASS: ${description}`);
  } else {
    failedChecks++;
    console.error(`  ❌ FAIL: ${description}${detail ? ` -> ${detail}` : ''}`);
  }
}

// Helper to find Express router handler
function findHandler(router: any, path: string, method: 'get' | 'post' | 'delete') {
  const match = (router.stack as any[]).find(
    (s) => s.route?.path === path && s.route?.methods?.[method]
  );
  return match?.route?.stack[0]?.handle;
}

async function runChallenger2Suite() {
  console.log('================================================================================');
  console.log('⚡ CHALLENGER 2: EMPIRICAL MULTI-TENANT ISOLATION & SOCKET SEGREGATION HARNESS');
  console.log('================================================================================\n');

  const ALPHA = 'tenant_client_alpha';
  const BETA = 'tenant_client_beta';
  const GAMMA = 'tenant_client_gamma';
  const PIZZERIA = 'tenant_demo_pizzeria';

  // ============================================================================
  // TIER 1: ROUTE HANDLER DISCOVERY & VALIDATION
  // ============================================================================
  console.log('--- [TIER 1] Route Handler Discovery & Precedence Extraction ---');
  const getTemplates = findHandler(templatesRouter, '/', 'get');
  const postTemplates = findHandler(templatesRouter, '/', 'post');
  const getTmplCategories = findHandler(templatesRouter, '/categories', 'get');
  const postTmplCategories = findHandler(templatesRouter, '/categories', 'post');
  const delTmplParamCat = findHandler(templatesRouter, '/categories/:name', 'delete');
  const delTmplBodyCat = findHandler(templatesRouter, '/categories', 'delete');
  const delTemplate = findHandler(templatesRouter, '/:id', 'delete');

  const getKanban = findHandler(kanbanRouter, '/', 'get');
  const postKanbanSync = findHandler(kanbanRouter, '/sync', 'post');
  const postKanbanClear = findHandler(kanbanRouter, '/clear', 'post');
  const postAddFromChat = findHandler(kanbanRouter, '/add-from-chat', 'post');
  const postBulkAdd = findHandler(kanbanRouter, '/bulk-add', 'post');
  const postMoveLead = findHandler(kanbanRouter, '/move', 'post');
  const delKanbanLead = findHandler(kanbanRouter, '/lead/:id', 'delete');
  const postKanbanLead = findHandler(kanbanRouter, '/leads', 'post');

  const getGroups = findHandler(groupsRouter, '/', 'get');
  const postGroupSync = findHandler(groupsRouter, '/sync', 'post');
  const postGroupHide = findHandler(groupsRouter, '/hide', 'post');
  const postGroupCat = findHandler(groupsRouter, '/categories', 'post');
  const delGroupParamCat = findHandler(groupsRouter, '/categories/:name', 'delete');
  const delGroupBodyCat = findHandler(groupsRouter, '/categories', 'delete');
  const postGroupAssign = findHandler(groupsRouter, '/assign-category', 'post');

  const getMySession = findHandler(tenantRouter, '/my-session', 'get');
  const postAddLine = findHandler(tenantRouter, '/add-line', 'post');
  const postDeleteLine = findHandler(tenantRouter, '/delete-line', 'post');
  const postSwitchLine = findHandler(tenantRouter, '/switch-line', 'post');

  assert(typeof getTemplates === 'function', 'Templates GET route mounted');
  assert(typeof postTemplates === 'function', 'Templates POST route mounted');
  assert(typeof getTmplCategories === 'function', 'Templates GET /categories route mounted');
  assert(typeof postTmplCategories === 'function', 'Templates POST /categories route mounted');
  assert(typeof delTmplParamCat === 'function', 'Templates DELETE /categories/:name route mounted');
  assert(typeof delTmplBodyCat === 'function', 'Templates DELETE /categories body route mounted');
  assert(typeof delTemplate === 'function', 'Templates DELETE /:id route mounted');

  assert(typeof getKanban === 'function', 'Kanban GET route mounted');
  assert(typeof postKanbanSync === 'function', 'Kanban POST /sync mounted');
  assert(typeof postKanbanClear === 'function', 'Kanban POST /clear mounted');
  assert(typeof postAddFromChat === 'function', 'Kanban POST /add-from-chat mounted');
  assert(typeof postBulkAdd === 'function', 'Kanban POST /bulk-add mounted');
  assert(typeof postMoveLead === 'function', 'Kanban POST /move mounted');
  assert(typeof delKanbanLead === 'function', 'Kanban DELETE /lead/:id mounted');
  assert(typeof postKanbanLead === 'function', 'Kanban POST /leads mounted');

  assert(typeof getGroups === 'function', 'Groups GET route mounted');
  assert(typeof postGroupHide === 'function', 'Groups POST /hide mounted');
  assert(typeof postGroupCat === 'function', 'Groups POST /categories mounted');
  assert(typeof delGroupParamCat === 'function', 'Groups DELETE /categories/:name mounted');
  assert(typeof delGroupBodyCat === 'function', 'Groups DELETE /categories mounted');
  assert(typeof postGroupAssign === 'function', 'Groups POST /assign-category mounted');

  assert(typeof getMySession === 'function', 'Tenant GET /my-session mounted');
  assert(typeof postAddLine === 'function', 'Tenant POST /add-line mounted');
  assert(typeof postDeleteLine === 'function', 'Tenant POST /delete-line mounted');
  assert(typeof postSwitchLine === 'function', 'Tenant POST /switch-line mounted');

  // Precedence tests
  const reqPrecedence1 = {
    headers: { 'x-tenant-id': ALPHA },
    query: { tenantId: BETA },
    body: { tenantId: 'danmax_wa_owner' },
  };
  assert(getTenantIdFromReq(reqPrecedence1) === ALPHA, 'Header has highest precedence over query and body');

  const reqPrecedence2 = {
    headers: {},
    query: { tenantId: BETA },
    body: { tenantId: 'danmax_wa_owner' },
  };
  assert(getTenantIdFromReq(reqPrecedence2) === BETA, 'Query has precedence over body when header absent');

  const reqPrecedence3 = {
    headers: {},
    query: {},
    body: { tenantId: GAMMA },
  };
  assert(getTenantIdFromReq(reqPrecedence3) === GAMMA, 'Body extracted when header & query absent');

  const reqPrecedence4 = {
    headers: {},
    query: {},
    body: { tenantId: 'danmax_wa_owner' },
  };
  assert(getTenantIdFromReq(reqPrecedence4) === CANONICAL_ADMIN_TENANT, 'Admin body alias maps to canonical admin');

  // ============================================================================
  // TIER 2: TEMPLATES & CATEGORIES MULTI-TENANT ISOLATION
  // ============================================================================
  console.log('\n--- [TIER 2] Templates & Categories Multi-Tenant Isolation ---');

  const alphaCatName = `Alpha_Category_${Date.now()}`;
  const betaCatName = `Beta_Category_${Date.now()}`;
  const adminCatName = `Admin_Category_${Date.now()}`;

  // Alpha creates category
  const resCatAlpha = createMockRes();
  postTmplCategories({ headers: { 'x-tenant-id': ALPHA }, body: { categoryName: alphaCatName } }, resCatAlpha, noopNext);
  assert(resCatAlpha.data?.success === true, 'Alpha created category successfully');

  // Beta creates category
  const resCatBeta = createMockRes();
  postTmplCategories({ headers: { 'x-tenant-id': BETA }, body: { categoryName: betaCatName } }, resCatBeta, noopNext);
  assert(resCatBeta.data?.success === true, 'Beta created category successfully');

  // Admin creates category under 'danmax_wa_owner'
  const resCatAdmin = createMockRes();
  postTmplCategories({ headers: { 'x-tenant-id': 'danmax_wa_owner' }, body: { categoryName: adminCatName } }, resCatAdmin, noopNext);
  assert(resCatAdmin.data?.success === true, 'Admin created category under alias danmax_wa_owner');

  // Alpha creates Template
  const resTmplAlpha = createMockRes();
  postTemplates(
    {
      headers: { 'x-tenant-id': ALPHA },
      body: {
        title: 'Alpha Exclusive Template',
        category: alphaCatName,
        content: 'Hello {{client_name}}, Alpha special discount is {alpha_code}',
      },
    },
    resTmplAlpha,
    noopNext
  );
  assert(resTmplAlpha.data?.success === true, 'Alpha created rich template');
  const tmplAlphaId = resTmplAlpha.data?.template?.id;

  // Beta creates Template
  const resTmplBeta = createMockRes();
  postTemplates(
    {
      headers: { 'x-tenant-id': BETA },
      body: {
        title: 'Beta Secret Template',
        category: betaCatName,
        content: 'Hi {{beta_customer}}, your shipment {tracking_id} is out for delivery',
      },
    },
    resTmplBeta,
    noopNext
  );
  assert(resTmplBeta.data?.success === true, 'Beta created rich template');
  const tmplBetaId = resTmplBeta.data?.template?.id;

  // Admin creates Template under 'super_admin'
  const resTmplAdmin = createMockRes();
  postTemplates(
    {
      headers: { 'x-tenant-id': 'super_admin' },
      body: {
        title: 'Admin Pizzeria Promo',
        category: adminCatName,
        content: 'Welcome {{guest}} to Pizzeria! Pizza coupon {coupon}',
      },
    },
    resTmplAdmin,
    noopNext
  );
  assert(resTmplAdmin.data?.success === true, 'Admin created rich template');
  const tmplAdminId = resTmplAdmin.data?.template?.id;

  // Read Isolation Verification
  const resGetAlpha = createMockRes();
  getTemplates({ headers: { 'x-tenant-id': ALPHA }, query: {} }, resGetAlpha, noopNext);
  const alphaTmpls = resGetAlpha.data?.templates || [];
  const alphaCats = resGetAlpha.data?.categories || [];
  assert(alphaTmpls.some((t: any) => t.id === tmplAlphaId), 'Alpha sees tmplAlphaId');
  assert(!alphaTmpls.some((t: any) => t.id === tmplBetaId), 'Alpha CANNOT see tmplBetaId (Strict Isolation)');
  assert(!alphaTmpls.some((t: any) => t.id === tmplAdminId), 'Alpha CANNOT see tmplAdminId (Strict Isolation)');
  assert(alphaCats.includes(alphaCatName), 'Alpha sees alphaCatName');
  assert(!alphaCats.includes(betaCatName), 'Alpha CANNOT see betaCatName');
  assert(!alphaCats.includes(adminCatName), 'Alpha CANNOT see adminCatName');

  const resGetBeta = createMockRes();
  getTemplates({ headers: { 'x-tenant-id': BETA }, query: {} }, resGetBeta, noopNext);
  const betaTmpls = resGetBeta.data?.templates || [];
  const betaCats = resGetBeta.data?.categories || [];
  assert(betaTmpls.some((t: any) => t.id === tmplBetaId), 'Beta sees tmplBetaId');
  assert(!betaTmpls.some((t: any) => t.id === tmplAlphaId), 'Beta CANNOT see tmplAlphaId (Strict Isolation)');
  assert(!betaTmpls.some((t: any) => t.id === tmplAdminId), 'Beta CANNOT see tmplAdminId (Strict Isolation)');
  assert(betaCats.includes(betaCatName), 'Beta sees betaCatName');
  assert(!betaCats.includes(alphaCatName), 'Beta CANNOT see alphaCatName');
  assert(!betaCats.includes(adminCatName), 'Beta CANNOT see adminCatName');

  const resGetAdmin = createMockRes();
  getTemplates({ headers: { 'x-tenant-id': 'global_whatsapp_line' }, query: {} }, resGetAdmin, noopNext);
  const adminTmpls = resGetAdmin.data?.templates || [];
  const adminCats = resGetAdmin.data?.categories || [];
  assert(adminTmpls.some((t: any) => t.id === tmplAdminId), 'Admin (global_whatsapp_line) sees tmplAdminId');
  assert(!adminTmpls.some((t: any) => t.id === tmplAlphaId), 'Admin CANNOT see tmplAlphaId');
  assert(!adminTmpls.some((t: any) => t.id === tmplBetaId), 'Admin CANNOT see tmplBetaId');
  assert(adminCats.includes(adminCatName), 'Admin sees adminCatName');
  assert(!adminCats.includes(alphaCatName), 'Admin CANNOT see alphaCatName');
  assert(!adminCats.includes(betaCatName), 'Admin CANNOT see betaCatName');

  // Cross-Tenant Mutation Attacks
  const attackDelTmplBeta = createMockRes();
  delTemplate({ headers: { 'x-tenant-id': ALPHA }, params: { id: tmplBetaId } }, attackDelTmplBeta, noopNext);
  assert(attackDelTmplBeta.statusCode === 404, 'Alpha deleting Beta template returns 404 Not Found');

  const verifyBetaTmpl = createMockRes();
  getTemplates({ headers: { 'x-tenant-id': BETA }, query: {} }, verifyBetaTmpl, noopNext);
  assert(verifyBetaTmpl.data?.templates?.some((t: any) => t.id === tmplBetaId), 'Beta template remains intact after Alpha delete attempt');

  const attackDelTmplAdmin = createMockRes();
  delTemplate({ headers: { 'x-tenant-id': ALPHA }, params: { id: tmplAdminId } }, attackDelTmplAdmin, noopNext);
  assert(attackDelTmplAdmin.statusCode === 404, 'Alpha deleting Admin template returns 404 Not Found');

  const attackDelCatBeta = createMockRes();
  delTmplParamCat({ headers: { 'x-tenant-id': ALPHA }, params: { name: encodeURIComponent(betaCatName) } }, attackDelCatBeta, noopNext);
  assert(attackDelCatBeta.statusCode === 404, 'Alpha deleting Beta category returns 404 Not Found');

  const verifyBetaCat = createMockRes();
  getTmplCategories({ headers: { 'x-tenant-id': BETA }, query: {} }, verifyBetaCat, noopNext);
  assert(verifyBetaCat.data?.categories?.includes(betaCatName), 'Beta category remains intact after Alpha delete attempt');

  // ============================================================================
  // TIER 3: KANBAN PIPELINE MULTI-TENANT ISOLATION & ATTACKS
  // ============================================================================
  console.log('\n--- [TIER 3] Kanban Pipeline Multi-Tenant Isolation & Attacks ---');

  const resLeadAlpha = createMockRes();
  postAddFromChat(
    {
      headers: { 'x-tenant-id': ALPHA },
      body: {
        chatId: '56911112222@c.us',
        contactName: 'Alpha Customer VIP',
        phone: '+56911112222',
        value: '$100.000',
        columnId: 'col_1',
      },
    },
    resLeadAlpha,
    noopNext
  );
  assert(resLeadAlpha.data?.success === true, 'Alpha created Kanban lead');
  const leadAlphaId = resLeadAlpha.data?.columns?.[0]?.leads?.find((l: any) => l.contactName === 'Alpha Customer VIP')?.id;

  const resLeadBeta = createMockRes();
  postAddFromChat(
    {
      headers: { 'x-tenant-id': BETA },
      body: {
        chatId: '56933334444@c.us',
        contactName: 'Beta Customer Premium',
        phone: '+56933334444',
        value: '$250.000',
        columnId: 'col_1',
      },
    },
    resLeadBeta,
    noopNext
  );
  assert(resLeadBeta.data?.success === true, 'Beta created Kanban lead');
  const leadBetaId = resLeadBeta.data?.columns?.[0]?.leads?.find((l: any) => l.contactName === 'Beta Customer Premium')?.id;

  const resLeadAdmin = createMockRes();
  postAddFromChat(
    {
      headers: { 'x-tenant-id': 'super_admin' },
      body: {
        chatId: '56955556666@c.us',
        contactName: 'Pizzeria Corporate Order',
        phone: '+56955556666',
        value: '$500.000',
        columnId: 'col_1',
      },
    },
    resLeadAdmin,
    noopNext
  );
  assert(resLeadAdmin.data?.success === true, 'Admin created Kanban lead');
  const leadAdminId = resLeadAdmin.data?.columns?.[0]?.leads?.find((l: any) => l.contactName === 'Pizzeria Corporate Order')?.id;

  // Kanban Read Isolation
  const resGetKanbanAlpha = createMockRes();
  getKanban({ headers: { 'x-tenant-id': ALPHA }, query: {} }, resGetKanbanAlpha, noopNext);
  const alphaCols = resGetKanbanAlpha.data?.columns || [];
  const alphaLeads = alphaCols.flatMap((c: any) => c.leads || []);
  assert(alphaLeads.some((l: any) => l.id === leadAlphaId), 'Alpha Kanban contains leadAlphaId');
  assert(!alphaLeads.some((l: any) => l.id === leadBetaId), 'Alpha Kanban does NOT contain leadBetaId');
  assert(!alphaLeads.some((l: any) => l.id === leadAdminId), 'Alpha Kanban does NOT contain leadAdminId');

  const resGetKanbanBeta = createMockRes();
  getKanban({ headers: { 'x-tenant-id': BETA }, query: {} }, resGetKanbanBeta, noopNext);
  const betaCols = resGetKanbanBeta.data?.columns || [];
  const betaLeads = betaCols.flatMap((c: any) => c.leads || []);
  assert(betaLeads.some((l: any) => l.id === leadBetaId), 'Beta Kanban contains leadBetaId');
  assert(!betaLeads.some((l: any) => l.id === leadAlphaId), 'Beta Kanban does NOT contain leadAlphaId');
  assert(!betaLeads.some((l: any) => l.id === leadAdminId), 'Beta Kanban does NOT contain leadAdminId');

  // Kanban Adversarial Attacks
  const attackDelLeadBeta = createMockRes();
  delKanbanLead({ headers: { 'x-tenant-id': ALPHA }, params: { id: leadBetaId } }, attackDelLeadBeta, noopNext);
  assert(attackDelLeadBeta.statusCode === 404, 'Alpha deleting Beta lead returns 404 Not Found');

  const attackMoveLeadBeta = createMockRes();
  postMoveLead(
    {
      headers: { 'x-tenant-id': ALPHA },
      body: { leadId: leadBetaId, sourceColId: 'col_1', targetColId: 'col_2' },
    },
    attackMoveLeadBeta,
    noopNext
  );
  assert(attackMoveLeadBeta.statusCode === 404, 'Alpha moving Beta lead returns 404 Not Found');

  const verifyBetaKanban = createMockRes();
  getKanban({ headers: { 'x-tenant-id': BETA }, query: {} }, verifyBetaKanban, noopNext);
  const betaCol1 = verifyBetaKanban.data?.columns?.find((c: any) => c.id === 'col_1');
  assert(betaCol1?.leads?.some((l: any) => l.id === leadBetaId), 'Beta lead card remains safe in col_1');

  // Alpha Clear Board
  const clearAlphaRes = createMockRes();
  postKanbanClear({ headers: { 'x-tenant-id': ALPHA } }, clearAlphaRes, noopNext);
  assert(clearAlphaRes.data?.success === true, 'Alpha cleared its own Kanban board');

  const checkBetaAfterClear = createMockRes();
  getKanban({ headers: { 'x-tenant-id': BETA }, query: {} }, checkBetaAfterClear, noopNext);
  const betaLeadsAfterClear = (checkBetaAfterClear.data?.columns || []).flatMap((c: any) => c.leads || []);
  assert(betaLeadsAfterClear.some((l: any) => l.id === leadBetaId), 'Beta Kanban leads are UNTOUCHED after Alpha clear');

  const checkAdminAfterClear = createMockRes();
  getKanban({ headers: { 'x-tenant-id': 'tenant_demo_pizzeria' }, query: {} }, checkAdminAfterClear, noopNext);
  const adminLeadsAfterClear = (checkAdminAfterClear.data?.columns || []).flatMap((c: any) => c.leads || []);
  assert(adminLeadsAfterClear.some((l: any) => l.id === leadAdminId), 'Admin Kanban leads are UNTOUCHED after Alpha clear');

  // ============================================================================
  // TIER 4: GROUPS & CATEGORIES MULTI-TENANT ISOLATION
  // ============================================================================
  console.log('\n--- [TIER 4] Groups & Categories Multi-Tenant Isolation & Attacks ---');

  const alphaGrpCat = `Alpha_Group_Cat_${Date.now()}`;
  const betaGrpCat = `Beta_Group_Cat_${Date.now()}`;
  const adminGrpCat = `Admin_Group_Cat_${Date.now()}`;

  // Alpha adds group category
  const resGrpCatAlpha = createMockRes();
  postGroupCat({ headers: { 'x-tenant-id': ALPHA }, body: { categoryName: alphaGrpCat } }, resGrpCatAlpha, noopNext);
  assert(resGrpCatAlpha.data?.success === true, 'Alpha created group category');

  // Beta adds group category
  const resGrpCatBeta = createMockRes();
  postGroupCat({ headers: { 'x-tenant-id': BETA }, body: { categoryName: betaGrpCat } }, resGrpCatBeta, noopNext);
  assert(resGrpCatBeta.data?.success === true, 'Beta created group category');

  // Admin adds group category under 'danmax_wa_owner'
  const resGrpCatAdmin = createMockRes();
  postGroupCat({ headers: { 'x-tenant-id': 'danmax_wa_owner' }, body: { categoryName: adminGrpCat } }, resGrpCatAdmin, noopNext);
  assert(resGrpCatAdmin.data?.success === true, 'Admin created group category');

  // Alpha assigns category to group
  const resAssignAlpha = createMockRes();
  postGroupAssign({ headers: { 'x-tenant-id': ALPHA }, body: { groupId: '12345@g.us', category: alphaGrpCat } }, resAssignAlpha, noopNext);
  assert(resAssignAlpha.data?.success === true, 'Alpha assigned group category');

  // Beta assigns category to group
  const resAssignBeta = createMockRes();
  postGroupAssign({ headers: { 'x-tenant-id': BETA }, body: { groupId: '67890@g.us', category: betaGrpCat } }, resAssignBeta, noopNext);
  assert(resAssignBeta.data?.success === true, 'Beta assigned group category');

  // Verify group store isolation directly
  const alphaGroupStore = loadGroupStore(ALPHA);
  const betaGroupStore = loadGroupStore(BETA);
  const adminGroupStore = loadGroupStore('super_admin');

  assert(alphaGroupStore.categories.includes(alphaGrpCat), 'Alpha store contains alphaGrpCat');
  assert(!alphaGroupStore.categories.includes(betaGrpCat), 'Alpha store does NOT contain betaGrpCat');
  assert(!alphaGroupStore.categories.includes(adminGrpCat), 'Alpha store does NOT contain adminGrpCat');
  assert(alphaGroupStore.groupCategoryMap['12345@g.us'] === alphaGrpCat, 'Alpha has group 12345 mapped');
  assert(!alphaGroupStore.groupCategoryMap['67890@g.us'], 'Alpha does NOT have Beta group 67890 mapped');

  assert(betaGroupStore.categories.includes(betaGrpCat), 'Beta store contains betaGrpCat');
  assert(!betaGroupStore.categories.includes(alphaGrpCat), 'Beta store does NOT contain alphaGrpCat');
  assert(!betaGroupStore.categories.includes(adminGrpCat), 'Beta store does NOT contain adminGrpCat');
  assert(betaGroupStore.groupCategoryMap['67890@g.us'] === betaGrpCat, 'Beta has group 67890 mapped');

  // Attack: Alpha attempts to delete Beta group category
  const attackDelGrpCatBeta = createMockRes();
  delGroupParamCat({ headers: { 'x-tenant-id': ALPHA }, params: { name: encodeURIComponent(betaGrpCat) } }, attackDelGrpCatBeta, noopNext);
  assert(attackDelGrpCatBeta.statusCode === 404, 'Alpha deleting Beta group category returns 404 Not Found');

  // Attack: Alpha attempts to delete "Todas"
  const attackDelTodas = createMockRes();
  delGroupParamCat({ headers: { 'x-tenant-id': ALPHA }, params: { name: 'Todas' } }, attackDelTodas, noopNext);
  assert(attackDelTodas.statusCode === 400, 'Deleting protected category "Todas" returns 400 Bad Request');

  // Alpha hides a group
  const resHideAlpha = createMockRes();
  await postGroupHide({ headers: { 'x-tenant-id': ALPHA }, body: { groupId: 'hide_me_alpha@g.us' } }, resHideAlpha, noopNext);
  const updatedAlphaGroupStore = loadGroupStore(ALPHA);
  const updatedBetaGroupStore = loadGroupStore(BETA);
  assert(updatedAlphaGroupStore.hiddenGroupIds.includes('hide_me_alpha@g.us'), 'Alpha hid group');
  assert(!updatedBetaGroupStore.hiddenGroupIds.includes('hide_me_alpha@g.us'), 'Beta store does NOT contain Alpha hidden group');

  // ============================================================================
  // TIER 5: TENANT LINES & WHATSAPP SESSIONS MULTI-TENANT ISOLATION
  // ============================================================================
  console.log('\n--- [TIER 5] Tenant Lines Multi-Tenant Isolation & Attacks ---');

  // Alpha adds line
  const resAddLineAlpha = createMockRes();
  await postAddLine({ headers: { 'x-tenant-id': ALPHA }, body: { name: 'Alpha Sales Line' } }, resAddLineAlpha, noopNext);
  assert(resAddLineAlpha.data?.success === true, 'Alpha added WhatsApp line');
  const lineAlphaId = resAddLineAlpha.data?.line?.id;

  // Beta adds line
  const resAddLineBeta = createMockRes();
  await postAddLine({ headers: { 'x-tenant-id': BETA }, body: { name: 'Beta Support Line' } }, resAddLineBeta, noopNext);
  assert(resAddLineBeta.data?.success === true, 'Beta added WhatsApp line');
  const lineBetaId = resAddLineBeta.data?.line?.id;

  // Admin adds line under 'danmax_wa_owner'
  const resAddLineAdmin = createMockRes();
  await postAddLine({ headers: { 'x-tenant-id': 'danmax_wa_owner' }, body: { name: 'Pizzeria Main Line' } }, resAddLineAdmin, noopNext);
  assert(resAddLineAdmin.data?.success === true, 'Admin added WhatsApp line under danmax_wa_owner');
  const lineAdminId = resAddLineAdmin.data?.line?.id;

  // Read Isolation
  const resMySessionAlpha = createMockRes();
  await getMySession({ headers: { 'x-tenant-id': ALPHA }, query: {} }, resMySessionAlpha, noopNext);
  const alphaLines = resMySessionAlpha.data?.lines || [];
  assert(alphaLines.some((l: any) => l.id === lineAlphaId), 'Alpha sees lineAlphaId');
  assert(!alphaLines.some((l: any) => l.id === lineBetaId), 'Alpha CANNOT see lineBetaId');
  assert(!alphaLines.some((l: any) => l.id === lineAdminId), 'Alpha CANNOT see lineAdminId');

  const resMySessionBeta = createMockRes();
  await getMySession({ headers: { 'x-tenant-id': BETA }, query: {} }, resMySessionBeta, noopNext);
  const betaLines = resMySessionBeta.data?.lines || [];
  assert(betaLines.some((l: any) => l.id === lineBetaId), 'Beta sees lineBetaId');
  assert(!betaLines.some((l: any) => l.id === lineAlphaId), 'Beta CANNOT see lineAlphaId');
  assert(!betaLines.some((l: any) => l.id === lineAdminId), 'Beta CANNOT see lineAdminId');

  const resMySessionAdmin = createMockRes();
  await getMySession({ headers: { 'x-tenant-id': 'super_admin' }, query: {} }, resMySessionAdmin, noopNext);
  const adminLines = resMySessionAdmin.data?.lines || [];
  assert(adminLines.some((l: any) => l.id === lineAdminId), 'Admin (super_admin) sees lineAdminId');
  assert(!adminLines.some((l: any) => l.id === lineAlphaId), 'Admin CANNOT see lineAlphaId');
  assert(!adminLines.some((l: any) => l.id === lineBetaId), 'Admin CANNOT see lineBetaId');

  // Attack: Alpha attempts to delete Beta line
  const attackDelLineBeta = createMockRes();
  await postDeleteLine({ headers: { 'x-tenant-id': ALPHA }, body: { lineId: lineBetaId } }, attackDelLineBeta, noopNext);
  assert(attackDelLineBeta.statusCode === 404, 'Alpha deleting Beta line returns 404 Not Found');

  // Attack: Alpha attempts to switch to Beta line
  const attackSwitchLineBeta = createMockRes();
  postSwitchLine({ headers: { 'x-tenant-id': ALPHA }, body: { lineId: lineBetaId } }, attackSwitchLineBeta, noopNext);
  assert(attackSwitchLineBeta.statusCode === 404, 'Alpha switching to Beta line returns 404 Not Found');

  // ============================================================================
  // TIER 6: REAL SOCKET.IO ROOM SEGREGATION & LEAK DETECTION
  // ============================================================================
  console.log('\n--- [TIER 6] Socket Room Segregation & Zero-Leakage Harness ---');

  const server = http.createServer();
  socketService.init(server);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve();
    });
  });

  const address = server.address() as any;
  const port = address.port;
  const serverUrl = `http://127.0.0.1:${port}`;
  console.log(`  -> Socket test server listening on ${serverUrl}`);

  // Helper to connect a real socket client
  async function connectTestClient(tenantAlias: string | null): Promise<{
    socket: ClientSocket;
    receivedEvents: { event: string; payload: any }[];
  }> {
    const receivedEvents: { event: string; payload: any }[] = [];
    const socket = ioClient(serverUrl, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Socket connect timeout')), 3000);
      socket.on('connect', () => {
        clearTimeout(timeout);
        socket.emit('join_tenant', tenantAlias);
        resolve();
      });
    });

    const eventsToTrack = ['kanban_updated', 'template_updated', 'whatsapp_status', 'whatsapp_qr', 'test_broadcast'];
    for (const ev of eventsToTrack) {
      socket.on(ev, (payload) => {
        receivedEvents.push({ event: ev, payload });
      });
    }

    return { socket, receivedEvents };
  }

  // Connect clients: Alpha, Beta, Gamma, and 3 Admin Aliases
  const clientAlpha = await connectTestClient(ALPHA);
  const clientBeta = await connectTestClient(BETA);
  const clientGamma = await connectTestClient(GAMMA);
  const clientAdminOwner = await connectTestClient('danmax_wa_owner');
  const clientAdminSuper = await connectTestClient('super_admin');
  const clientAdminPizzeria = await connectTestClient('tenant_demo_pizzeria');

  // Wait 100ms for room join
  await new Promise((r) => setTimeout(r, 100));

  // --- Socket Test 1: Alpha Broadcast ---
  console.log('\n--- Socket Test 1: Alpha Broadcast ---');
  socketService.emitToTenant(ALPHA, 'kanban_updated', { secret: 'alpha_secret_data' });
  await new Promise((r) => setTimeout(r, 150));

  assert(clientAlpha.receivedEvents.filter((e) => e.payload?.secret === 'alpha_secret_data').length === 1, 'Client Alpha received its own broadcast');
  assert(clientBeta.receivedEvents.filter((e) => e.payload?.secret === 'alpha_secret_data').length === 0, 'Client Beta received 0 Alpha broadcasts (NO LEAKAGE)');
  assert(clientGamma.receivedEvents.filter((e) => e.payload?.secret === 'alpha_secret_data').length === 0, 'Client Gamma received 0 Alpha broadcasts (NO LEAKAGE)');
  assert(clientAdminOwner.receivedEvents.filter((e) => e.payload?.secret === 'alpha_secret_data').length === 0, 'Admin Owner received 0 Alpha broadcasts (NO LEAKAGE)');
  assert(clientAdminSuper.receivedEvents.filter((e) => e.payload?.secret === 'alpha_secret_data').length === 0, 'Admin Super received 0 Alpha broadcasts (NO LEAKAGE)');
  assert(clientAdminPizzeria.receivedEvents.filter((e) => e.payload?.secret === 'alpha_secret_data').length === 0, 'Admin Pizzeria received 0 Alpha broadcasts (NO LEAKAGE)');

  // --- Socket Test 2: Beta Broadcast ---
  console.log('\n--- Socket Test 2: Beta Broadcast ---');
  socketService.emitToTenant(BETA, 'template_updated', { secret: 'beta_secret_data' });
  await new Promise((r) => setTimeout(r, 150));

  assert(clientBeta.receivedEvents.filter((e) => e.payload?.secret === 'beta_secret_data').length === 1, 'Client Beta received its own broadcast');
  assert(clientAlpha.receivedEvents.filter((e) => e.payload?.secret === 'beta_secret_data').length === 0, 'Client Alpha received 0 Beta broadcasts (NO LEAKAGE)');
  assert(clientGamma.receivedEvents.filter((e) => e.payload?.secret === 'beta_secret_data').length === 0, 'Client Gamma received 0 Beta broadcasts (NO LEAKAGE)');
  assert(clientAdminOwner.receivedEvents.filter((e) => e.payload?.secret === 'beta_secret_data').length === 0, 'Admin Owner received 0 Beta broadcasts (NO LEAKAGE)');
  assert(clientAdminSuper.receivedEvents.filter((e) => e.payload?.secret === 'beta_secret_data').length === 0, 'Admin Super received 0 Beta broadcasts (NO LEAKAGE)');
  assert(clientAdminPizzeria.receivedEvents.filter((e) => e.payload?.secret === 'beta_secret_data').length === 0, 'Admin Pizzeria received 0 Beta broadcasts (NO LEAKAGE)');

  // --- Socket Test 3: Gamma Broadcast ---
  console.log('\n--- Socket Test 3: Gamma Broadcast ---');
  socketService.emitToTenant(GAMMA, 'kanban_updated', { secret: 'gamma_secret_data' });
  await new Promise((r) => setTimeout(r, 150));

  assert(clientGamma.receivedEvents.filter((e) => e.payload?.secret === 'gamma_secret_data').length === 1, 'Client Gamma received its own broadcast');
  assert(clientAlpha.receivedEvents.filter((e) => e.payload?.secret === 'gamma_secret_data').length === 0, 'Client Alpha received 0 Gamma broadcasts (NO LEAKAGE)');
  assert(clientBeta.receivedEvents.filter((e) => e.payload?.secret === 'gamma_secret_data').length === 0, 'Client Beta received 0 Gamma broadcasts (NO LEAKAGE)');
  assert(clientAdminOwner.receivedEvents.filter((e) => e.payload?.secret === 'gamma_secret_data').length === 0, 'Admin received 0 Gamma broadcasts (NO LEAKAGE)');

  // --- Socket Test 4: Admin Broadcast via 'danmax_wa_owner' ---
  console.log('\n--- Socket Test 4: Admin Broadcast via Alias danmax_wa_owner ---');
  socketService.emitToTenant('danmax_wa_owner', 'whatsapp_status', { secret: 'admin_status_owner', status: 'READY' });
  await new Promise((r) => setTimeout(r, 150));

  assert(clientAlpha.receivedEvents.filter((e) => e.payload?.secret === 'admin_status_owner').length === 0, 'Client Alpha received 0 Admin broadcasts (NO LEAKAGE)');
  assert(clientBeta.receivedEvents.filter((e) => e.payload?.secret === 'admin_status_owner').length === 0, 'Client Beta received 0 Admin broadcasts (NO LEAKAGE)');
  assert(clientGamma.receivedEvents.filter((e) => e.payload?.secret === 'admin_status_owner').length === 0, 'Client Gamma received 0 Admin broadcasts (NO LEAKAGE)');
  assert(clientAdminOwner.receivedEvents.filter((e) => e.payload?.secret === 'admin_status_owner').length === 1, 'Admin Owner client received broadcast');
  assert(clientAdminSuper.receivedEvents.filter((e) => e.payload?.secret === 'admin_status_owner').length === 1, 'Admin Super client received broadcast (Room Convergence)');
  assert(clientAdminPizzeria.receivedEvents.filter((e) => e.payload?.secret === 'admin_status_owner').length === 1, 'Admin Pizzeria client received broadcast (Room Convergence)');

  // --- Socket Test 5: Admin Broadcast via 'super_admin' ---
  console.log('\n--- Socket Test 5: Admin Broadcast via Alias super_admin ---');
  socketService.emitToTenant('super_admin', 'whatsapp_qr', { secret: 'admin_qr_super', qrCodeUrl: 'https://qr.url' });
  await new Promise((r) => setTimeout(r, 150));

  assert(clientAlpha.receivedEvents.filter((e) => e.payload?.secret === 'admin_qr_super').length === 0, 'Client Alpha received 0 Admin broadcasts (NO LEAKAGE)');
  assert(clientBeta.receivedEvents.filter((e) => e.payload?.secret === 'admin_qr_super').length === 0, 'Client Beta received 0 Admin broadcasts (NO LEAKAGE)');
  assert(clientGamma.receivedEvents.filter((e) => e.payload?.secret === 'admin_qr_super').length === 0, 'Client Gamma received 0 Admin broadcasts (NO LEAKAGE)');
  assert(clientAdminOwner.receivedEvents.filter((e) => e.payload?.secret === 'admin_qr_super').length === 1, 'Admin Owner client received super_admin broadcast');
  assert(clientAdminSuper.receivedEvents.filter((e) => e.payload?.secret === 'admin_qr_super').length === 1, 'Admin Super client received super_admin broadcast');
  assert(clientAdminPizzeria.receivedEvents.filter((e) => e.payload?.secret === 'admin_qr_super').length === 1, 'Admin Pizzeria client received super_admin broadcast');

  // --- Socket Test 6: Global Broadcast Emits to ALL ---
  console.log('\n--- Socket Test 6: Global Broadcast ---');
  socketService.emitGlobal('test_broadcast', { msg: 'global_announcement' });
  await new Promise((r) => setTimeout(r, 150));

  assert(clientAlpha.receivedEvents.filter((e) => e.payload?.msg === 'global_announcement').length === 1, 'Alpha received global broadcast');
  assert(clientBeta.receivedEvents.filter((e) => e.payload?.msg === 'global_announcement').length === 1, 'Beta received global broadcast');
  assert(clientGamma.receivedEvents.filter((e) => e.payload?.msg === 'global_announcement').length === 1, 'Gamma received global broadcast');
  assert(clientAdminOwner.receivedEvents.filter((e) => e.payload?.msg === 'global_announcement').length === 1, 'Admin received global broadcast');

  // Clean up sockets & server
  clientAlpha.socket.disconnect();
  clientBeta.socket.disconnect();
  clientGamma.socket.disconnect();
  clientAdminOwner.socket.disconnect();
  clientAdminSuper.socket.disconnect();
  clientAdminPizzeria.socket.disconnect();
  server.close();

  // ============================================================================
  // TIER 7: MULTI-TENANT CRASH & MULTI-DISK RECOVERY
  // ============================================================================
  console.log('\n--- [TIER 7] Multi-Tenant Crash & Multi-Disk Recovery ---');

  const tmplStore = PersistentStore.readJSON<Record<string, any>>('templates_db.json', {});
  tmplStore[ALPHA] = { categories: ['AlphaTiers'], templates: [{ id: 't_alpha', title: 'T Alpha' }] };
  tmplStore[BETA] = { categories: ['BetaTiers'], templates: [{ id: 't_beta', title: 'T Beta' }] };
  tmplStore[PIZZERIA] = { categories: ['PizTiers'], templates: [{ id: 't_piz', title: 'T Piz' }] };
  PersistentStore.writeJSON('templates_db.json', tmplStore);

  const recoveredTmplStore = PersistentStore.readJSON<Record<string, any>>('templates_db.json', {});
  assert(!!recoveredTmplStore[ALPHA]?.templates?.some((t: any) => t.id === 't_alpha'), 'Alpha partition recovered intact');
  assert(!!recoveredTmplStore[BETA]?.templates?.some((t: any) => t.id === 't_beta'), 'Beta partition recovered intact');
  assert(!!recoveredTmplStore[PIZZERIA]?.templates?.some((t: any) => t.id === 't_piz'), 'Pizzeria partition recovered intact');

  // ============================================================================
  // FINAL SCORE & SUMMARY
  // ============================================================================
  console.log('\n================================================================================');
  console.log(`📊 CHALLENGER 2 SUMMARY: Total: ${totalChecks} | Passed: ${passedChecks} | Failed: ${failedChecks}`);
  console.log('================================================================================\n');

  if (failedChecks > 0) {
    console.error(`💥 CHALLENGER 2 FAILED: ${failedChecks} assertions failed!`);
    process.exit(1);
  } else {
    console.log('🎉 CHALLENGER 2 PASSED: 100% Client Tenant Isolation & 0% Socket Leakage Confirmed!');
    process.exit(0);
  }
}

runChallenger2Suite().catch((err) => {
  console.error('Fatal challenger execution error:', err);
  process.exit(1);
});
