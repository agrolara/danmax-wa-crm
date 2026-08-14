/**
 * Adversarial & Edge Case Verification Suite for Milestone 2
 */

import { templatesRouter } from './routes/templates.routes';
import { kanbanRouter } from './routes/kanban.routes';
import { tenantRouter } from './routes/tenant.routes';
import { groupsRouter } from './routes/groups.routes';
import { CANONICAL_ADMIN_TENANT } from './services/storage.service';

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

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${msg}`);
  } else {
    failed++;
    console.error(`  ❌ ${msg}`);
  }
}

async function runAdversarialM2() {
  console.log('================================================================');
  console.log('🛡️ RUNNING ADVERSARIAL & EDGE-CASE SUITE FOR MILESTONE 2');
  console.log('================================================================\n');

  // --- 1. Templates Route Handler Direct Invocation ---
  console.log('--- 1. Testing Templates Route Handlers ---');
  const getTemplatesHandler = (templatesRouter.stack as any[]).find((s) => s.route?.path === '/' && s.route?.methods?.get)?.route?.stack[0]?.handle;
  const postTemplatesHandler = (templatesRouter.stack as any[]).find((s) => s.route?.path === '/' && s.route?.methods?.post)?.route?.stack[0]?.handle;
  const getCategoriesHandler = (templatesRouter.stack as any[]).find((s) => s.route?.path === '/categories' && s.route?.methods?.get)?.route?.stack[0]?.handle;
  const postCategoriesHandler = (templatesRouter.stack as any[]).find((s) => s.route?.path === '/categories' && s.route?.methods?.post)?.route?.stack[0]?.handle;
  const deleteParamCategoryHandler = (templatesRouter.stack as any[]).find((s) => s.route?.path === '/categories/:name' && s.route?.methods?.delete)?.route?.stack[0]?.handle;
  const deleteBodyCategoryHandler = (templatesRouter.stack as any[]).find((s) => s.route?.path === '/categories' && s.route?.methods?.delete)?.route?.stack[0]?.handle;
  const deleteTemplateHandler = (templatesRouter.stack as any[]).find((s) => s.route?.path === '/:id' && s.route?.methods?.delete)?.route?.stack[0]?.handle;

  assert(typeof getTemplatesHandler === 'function', 'Found GET /templates handler');
  assert(typeof postTemplatesHandler === 'function', 'Found POST /templates handler');
  assert(typeof getCategoriesHandler === 'function', 'Found GET /templates/categories handler');
  assert(typeof postCategoriesHandler === 'function', 'Found POST /templates/categories handler');
  assert(typeof deleteParamCategoryHandler === 'function', 'Found DELETE /templates/categories/:name handler');
  assert(typeof deleteBodyCategoryHandler === 'function', 'Found DELETE /templates/categories handler');
  assert(typeof deleteTemplateHandler === 'function', 'Found DELETE /templates/:id handler');

  // Test POST category under admin alias 'danmax_wa_owner'
  const postCatRes = createMockRes();
  if (postCategoriesHandler) {
    postCategoriesHandler({ headers: { 'x-tenant-id': 'danmax_wa_owner' }, body: { categoryName: 'Postres M2' } }, postCatRes, noopNext);
  }
  assert(postCatRes.data?.success === true, 'POST /categories succeeds for danmax_wa_owner');
  assert(postCatRes.data?.categories?.includes('Postres M2'), 'Category Postres M2 returned in response');

  // Test GET category under admin alias 'super_admin'
  const getCatRes = createMockRes();
  if (getCategoriesHandler) {
    getCategoriesHandler({ headers: { 'x-tenant-id': 'super_admin' } }, getCatRes, noopNext);
  }
  assert(getCatRes.data?.categories?.includes('Postres M2'), 'GET /categories under super_admin sees Postres M2 (Aliasing convergence)');

  // Test DELETE category via URL param under alias 'global_whatsapp_line'
  const delParamRes = createMockRes();
  if (deleteParamCategoryHandler) {
    deleteParamCategoryHandler({ headers: { 'x-tenant-id': 'global_whatsapp_line' }, params: { name: encodeURIComponent('Postres M2') } }, delParamRes, noopNext);
  }
  assert(delParamRes.data?.success === true, 'DELETE /categories/:name succeeds under global_whatsapp_line');

  // Re-verify category is gone
  const getCatAfterDel = createMockRes();
  if (getCategoriesHandler) {
    getCategoriesHandler({ headers: { 'x-tenant-id': 'tenant_demo_pizzeria' } }, getCatAfterDel, noopNext);
  }
  assert(!getCatAfterDel.data?.categories?.includes('Postres M2'), 'Category successfully removed across all admin aliases');

  // Test POST template with single and double bracket variables
  const postTmplRes = createMockRes();
  if (postTemplatesHandler) {
    postTemplatesHandler(
      {
        headers: { 'x-tenant-id': 'danmax_wa_owner' },
        body: {
          title: 'Oferta Especial M2',
          category: 'Promociones',
          content: 'Hola {{nombre}}, tu descuento de {porcentaje}% está listo en {{ciudad}}',
        },
      },
      postTmplRes,
      noopNext
    );
  }
  assert(postTmplRes.data?.success === true, 'POST /templates creates template');
  const createdTmplId = postTmplRes.data?.template?.id;
  assert(postTmplRes.data?.template?.variables?.length === 3, 'Extracted all 3 variables (single and double bracket)');

  // DELETE template under another alias
  const delTmplRes = createMockRes();
  if (deleteTemplateHandler) {
    deleteTemplateHandler({ headers: { 'x-tenant-id': 'pizzeria' }, params: { id: createdTmplId } }, delTmplRes, noopNext);
  }
  assert(delTmplRes.data?.success === true, 'DELETE /templates/:id under pizzeria alias deletes template created by danmax_wa_owner');

  // --- 2. Kanban Route Handler Direct Invocation ---
  console.log('\n--- 2. Testing Kanban Route Handlers ---');
  const getKanbanHandler = (kanbanRouter.stack as any[]).find((s) => s.route?.path === '/' && s.route?.methods?.get)?.route?.stack[0]?.handle;
  const syncKanbanHandler = (kanbanRouter.stack as any[]).find((s) => s.route?.path === '/sync' && s.route?.methods?.post)?.route?.stack[0]?.handle;
  const addFromChatHandler = (kanbanRouter.stack as any[]).find((s) => s.route?.path === '/add-from-chat' && s.route?.methods?.post)?.route?.stack[0]?.handle;
  const bulkAddHandler = (kanbanRouter.stack as any[]).find((s) => s.route?.path === '/bulk-add' && s.route?.methods?.post)?.route?.stack[0]?.handle;
  const moveHandler = (kanbanRouter.stack as any[]).find((s) => s.route?.path === '/move' && s.route?.methods?.post)?.route?.stack[0]?.handle;
  const deleteLeadHandler = (kanbanRouter.stack as any[]).find((s) => s.route?.path === '/lead/:id' && s.route?.methods?.delete)?.route?.stack[0]?.handle;
  const clearHandler = (kanbanRouter.stack as any[]).find((s) => s.route?.path === '/clear' && s.route?.methods?.post)?.route?.stack[0]?.handle;

  assert(typeof getKanbanHandler === 'function', 'Found GET /kanban handler');
  assert(typeof syncKanbanHandler === 'function', 'Found POST /kanban/sync handler');
  assert(typeof addFromChatHandler === 'function', 'Found POST /kanban/add-from-chat handler');
  assert(typeof bulkAddHandler === 'function', 'Found POST /kanban/bulk-add handler');
  assert(typeof moveHandler === 'function', 'Found POST /kanban/move handler');
  assert(typeof deleteLeadHandler === 'function', 'Found DELETE /kanban/lead/:id handler');
  assert(typeof clearHandler === 'function', 'Found POST /kanban/clear handler');

  // Test POST /kanban/add-from-chat with client isolation
  const clientTenantX = `tenant_client_adv_${Date.now()}`;
  const addChatResClient = createMockRes();
  if (addFromChatHandler) {
    addChatResClient && addFromChatHandler(
      {
        headers: { 'x-tenant-id': clientTenantX },
        body: { chatId: '56999887766@c.us', contactName: 'Cliente Privado X', phone: '+56999887766' },
      },
      addChatResClient,
      noopNext
    );
  }
  assert(addChatResClient.data?.success === true, 'POST /kanban/add-from-chat succeeds for client tenant');

  // Verify Admin Kanban does NOT contain Cliente Privado X
  const getAdminKanbanRes = createMockRes();
  if (getKanbanHandler) {
    getKanbanHandler({ headers: { 'x-tenant-id': 'danmax_wa_owner' }, query: {} }, getAdminKanbanRes, noopNext);
  }
  const adminHasClientLead = getAdminKanbanRes.data?.columns?.some((c: any) =>
    c.leads.some((l: any) => l.contactName === 'Cliente Privado X')
  );
  assert(!adminHasClientLead, 'Admin Kanban does NOT contain client tenant lead (Strict Isolation)');

  // Test bulk add for admin
  const bulkRes = createMockRes();
  if (bulkAddHandler) {
    bulkAddHandler(
      {
        headers: { 'x-tenant-id': 'super_admin' },
        body: {
          contacts: [
            { chatId: '56911111111@c.us', contactName: 'Bulk 1', phone: '+56911111111' },
            { chatId: '56922222222@c.us', contactName: 'Bulk 2', phone: '+56922222222' },
          ],
        },
      },
      bulkRes,
      noopNext
    );
  }
  assert(bulkRes.data?.success === true, 'POST /kanban/bulk-add succeeds under super_admin');

  // Sync kanban
  const syncRes = createMockRes();
  if (syncKanbanHandler) {
    syncKanbanHandler({ headers: { 'x-tenant-id': 'global_whatsapp_line' } }, syncRes, noopNext);
  }
  assert(syncRes.data?.success === true, 'POST /kanban/sync succeeds');
  const foundBulkInSync = syncRes.data?.columns?.[0]?.leads?.some((l: any) => l.contactName === 'Bulk 1');
  assert(foundBulkInSync, 'Bulk added contact visible across admin aliases after sync');

  // --- 3. Tenant Route Handlers ---
  console.log('\n--- 3. Testing Tenant Route Handlers ---');
  const addLineHandler = (tenantRouter.stack as any[]).find((s) => s.route?.path === '/add-line' && s.route?.methods?.post)?.route?.stack[0]?.handle;
  const switchLineHandler = (tenantRouter.stack as any[]).find((s) => s.route?.path === '/switch-line' && s.route?.methods?.post)?.route?.stack[0]?.handle;
  const deleteLineHandler = (tenantRouter.stack as any[]).find((s) => s.route?.path === '/delete-line' && s.route?.methods?.post)?.route?.stack[0]?.handle;
  const mySessionHandler = (tenantRouter.stack as any[]).find((s) => s.route?.path === '/my-session' && s.route?.methods?.get)?.route?.stack[0]?.handle;

  assert(typeof addLineHandler === 'function', 'Found POST /tenant/add-line handler');
  assert(typeof switchLineHandler === 'function', 'Found POST /tenant/switch-line handler');
  assert(typeof deleteLineHandler === 'function', 'Found POST /tenant/delete-line handler');
  assert(typeof mySessionHandler === 'function', 'Found GET /tenant/my-session handler');

  const addLineRes = createMockRes();
  if (addLineHandler) {
    await addLineHandler({ headers: { 'x-tenant-id': 'danmax_wa_owner' }, body: { name: 'Línea Sucursal Norte' } }, addLineRes, noopNext);
  }
  assert(addLineRes.data?.success === true, 'POST /tenant/add-line created line');
  const createdLineId = addLineRes.data?.line?.id;

  const mySessionRes = createMockRes();
  if (mySessionHandler) {
    await mySessionHandler({ headers: { 'x-tenant-id': 'super_admin' }, query: {} }, mySessionRes, noopNext);
  }
  const foundLineInSession = mySessionRes.data?.lines?.some((l: any) => l.id === createdLineId);
  assert(foundLineInSession, 'Line created under danmax_wa_owner visible in super_admin my-session');

  // Delete line
  const delLineRes = createMockRes();
  if (deleteLineHandler) {
    await deleteLineHandler({ headers: { 'x-tenant-id': 'global_whatsapp_line' }, body: { lineId: createdLineId } }, delLineRes, noopNext);
  }
  assert(delLineRes.data?.success === true, 'POST /tenant/delete-line successfully removed line across aliases');

  // --- 4. Groups Route Handlers ---
  console.log('\n--- 4. Testing Groups Route Handlers ---');
  const postGroupCatHandler = (groupsRouter.stack as any[]).find((s) => s.route?.path === '/categories' && s.route?.methods?.post)?.route?.stack[0]?.handle;
  const delParamGroupCatHandler = (groupsRouter.stack as any[]).find((s) => s.route?.path === '/categories/:name' && s.route?.methods?.delete)?.route?.stack[0]?.handle;
  const delBodyGroupCatHandler = (groupsRouter.stack as any[]).find((s) => s.route?.path === '/categories' && s.route?.methods?.delete)?.route?.stack[0]?.handle;
  const assignGroupCatHandler = (groupsRouter.stack as any[]).find((s) => s.route?.path === '/assign-category' && s.route?.methods?.post)?.route?.stack[0]?.handle;

  assert(typeof postGroupCatHandler === 'function', 'Found POST /groups/categories handler');
  assert(typeof delParamGroupCatHandler === 'function', 'Found DELETE /groups/categories/:name handler');
  assert(typeof delBodyGroupCatHandler === 'function', 'Found DELETE /groups/categories handler');
  assert(typeof assignGroupCatHandler === 'function', 'Found POST /groups/assign-category handler');

  const addGrpCatRes = createMockRes();
  if (postGroupCatHandler) {
    postGroupCatHandler({ headers: { 'x-tenant-id': 'danmax_wa_owner' }, body: { categoryName: 'Distribuidores' } }, addGrpCatRes, noopNext);
  }
  assert(addGrpCatRes.data?.success === true, 'POST /groups/categories added Distribuidores');

  const delGrpCatRes = createMockRes();
  if (delParamGroupCatHandler) {
    delParamGroupCatHandler({ headers: { 'x-tenant-id': 'super_admin' }, params: { name: encodeURIComponent('Distribuidores') } }, delGrpCatRes, noopNext);
  }
  assert(delGrpCatRes.data?.success === true, 'DELETE /groups/categories/:name deleted Distribuidores');

  // Test protection of "Todas"
  const delTodasRes = createMockRes();
  if (delParamGroupCatHandler) {
    delParamGroupCatHandler({ headers: { 'x-tenant-id': 'super_admin' }, params: { name: 'Todas' } }, delTodasRes, noopNext);
  }
  assert(delTodasRes.statusCode === 400, 'Cannot delete default category "Todas" (Returns 400 Bad Request)');

  console.log('\n================================================================');
  console.log(`🛡️ ADVERSARIAL RESULTS: Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL ADVERSARIAL & EDGE-CASE TESTS PASSED!');
    process.exit(0);
  }
}

runAdversarialM2().catch((err) => {
  console.error('Fatal adversarial error:', err);
  process.exit(1);
});
