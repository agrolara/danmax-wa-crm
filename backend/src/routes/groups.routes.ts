import { Router, Request, Response } from 'express';
import { OpenWAService } from '../services/openwa.service';
import {
  PersistentStore,
  getTenantIdFromReq,
  normalizeTenantId,
  CANONICAL_ADMIN_TENANT,
} from '../services/storage.service';
import { socketService } from '../services/socket.service';

export const groupsRouter = Router();

export interface GroupCategoryStore {
  categories: string[];
  groupCategoryMap: Record<string, string>;
  hiddenGroupIds: string[];
}

const DEFAULT_STORE: GroupCategoryStore = {
  categories: ['Todas'],
  groupCategoryMap: {},
  hiddenGroupIds: [],
};

// Load persistent data strictly isolated per Tenant / Client ID with legacy admin migration
export function loadGroupStore(tenantId: string): GroupCategoryStore {
  const cleanTenant = normalizeTenantId(tenantId);
  const allStores = PersistentStore.readJSON<Record<string, GroupCategoryStore>>('groups_categories.json', {});

  if (!allStores[cleanTenant]) {
    // If canonical admin, check if any legacy admin alias has data to migrate
    if (cleanTenant === CANONICAL_ADMIN_TENANT) {
      const legacyKeys = ['danmax_wa_owner', 'super_admin', 'global_whatsapp_line', 'pizzeria', 'default', 'admin'];
      for (const legacy of legacyKeys) {
        if (
          allStores[legacy] &&
          (allStores[legacy].categories?.length > 0 ||
            Object.keys(allStores[legacy].groupCategoryMap || {}).length > 0 ||
            (allStores[legacy].hiddenGroupIds && allStores[legacy].hiddenGroupIds.length > 0))
        ) {
          allStores[cleanTenant] = allStores[legacy];
          break;
        }
      }
    }

    if (!allStores[cleanTenant]) {
      allStores[cleanTenant] = JSON.parse(JSON.stringify(DEFAULT_STORE));
    }
    PersistentStore.writeJSON('groups_categories.json', allStores);
  }

  // Defensive sanitization: ensure categories, groupCategoryMap, and hiddenGroupIds exist with proper types
  if (!Array.isArray(allStores[cleanTenant].categories)) {
    allStores[cleanTenant].categories = ['Todas'];
  }
  if (!allStores[cleanTenant].categories.includes('Todas')) {
    allStores[cleanTenant].categories.unshift('Todas');
  }
  if (typeof allStores[cleanTenant].groupCategoryMap !== 'object' || !allStores[cleanTenant].groupCategoryMap) {
    allStores[cleanTenant].groupCategoryMap = {};
  }
  if (!Array.isArray(allStores[cleanTenant].hiddenGroupIds)) {
    allStores[cleanTenant].hiddenGroupIds = [];
  }

  return allStores[cleanTenant];
}

export function saveGroupStore(tenantId: string, storeData: GroupCategoryStore): void {
  const cleanTenant = normalizeTenantId(tenantId);
  const allStores = PersistentStore.readJSON<Record<string, GroupCategoryStore>>('groups_categories.json', {});
  allStores[cleanTenant] = {
    categories: Array.from(new Set(['Todas', ...(storeData.categories || [])])),
    groupCategoryMap: storeData.groupCategoryMap || {},
    hiddenGroupIds: Array.isArray(storeData.hiddenGroupIds) ? storeData.hiddenGroupIds : [],
  };
  PersistentStore.writeJSON('groups_categories.json', allStores);
}

async function fetchLiveGroups(tenantId: string) {
  const store = loadGroupStore(tenantId);
  const hiddenSet = new Set(store.hiddenGroupIds);
  const liveChats = await OpenWAService.getLiveChats(tenantId);

  if (liveChats.success && liveChats.chats.length > 0) {
    return liveChats.chats
      .filter((c: any) => {
        const isGrp = c.isGroup || c.kind === 'group' || (typeof c.id === 'string' && c.id.includes('@g.us'));
        return isGrp && !hiddenSet.has(c.id);
      })
      .map((g: any) => ({
        id: g.id,
        name: g.name || 'Grupo sin nombre',
        unreadCount: g.unreadCount || 0,
        category: store.groupCategoryMap[g.id] || 'Todas',
        timestamp: g.timestamp ? new Date(g.timestamp * 1000).toISOString() : new Date().toISOString(),
        lastMessage: typeof g.lastMessage === 'string' ? g.lastMessage : g.lastMessage?.body || 'Mensaje de grupo',
      }));
  }
  return [];
}

// GET /api/groups (Strictly isolated by client/tenant)
groupsRouter.get('/', async (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const groups = await fetchLiveGroups(tenantId);
  const store = loadGroupStore(tenantId);

  return res.json({
    success: true,
    tenantId,
    groups,
    categories: Array.from(new Set(['Todas', ...store.categories])),
    total: groups.length,
  });
});

// POST /api/groups/sync (Force re-sync of WhatsApp groups for tenant)
groupsRouter.post('/sync', async (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const groups = await fetchLiveGroups(tenantId);
  const store = loadGroupStore(tenantId);

  return res.json({
    success: true,
    tenantId,
    message: `Sincronización completada. ${groups.length} grupos encontrados en WhatsApp.`,
    groups,
    categories: Array.from(new Set(['Todas', ...store.categories])),
    total: groups.length,
  });
});

// POST /api/groups/hide (Hide group from tenant CRM view)
groupsRouter.post('/hide', async (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const { groupId } = req.body;
  if (!groupId) {
    return res.status(400).json({ success: false, error: 'groupId es requerido' });
  }

  const store = loadGroupStore(tenantId);
  if (!store.hiddenGroupIds.includes(groupId)) {
    store.hiddenGroupIds.push(groupId);
    saveGroupStore(tenantId, store);
    socketService.emitToTenant(tenantId, 'groups_updated', store);
  }

  const updatedGroups = await fetchLiveGroups(tenantId);

  return res.json({
    success: true,
    tenantId,
    message: 'Grupo eliminado únicamente de la vista del CRM.',
    groups: updatedGroups,
    total: updatedGroups.length,
  });
});

// POST /api/groups/unhide (Unhide/restore group in tenant CRM view)
groupsRouter.post('/unhide', async (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const { groupId } = req.body;
  if (!groupId) {
    return res.status(400).json({ success: false, error: 'groupId es requerido' });
  }

  const store = loadGroupStore(tenantId);
  store.hiddenGroupIds = store.hiddenGroupIds.filter((id) => id !== groupId);
  saveGroupStore(tenantId, store);
  socketService.emitToTenant(tenantId, 'groups_updated', store);

  const updatedGroups = await fetchLiveGroups(tenantId);

  return res.json({
    success: true,
    tenantId,
    message: 'Grupo restaurado en la vista del CRM.',
    groups: updatedGroups,
    total: updatedGroups.length,
  });
});

// POST /api/groups/categories (Create category strictly for this client/tenant)
groupsRouter.post('/categories', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const { categoryName, name } = req.body;
  const cleanName = (categoryName || name)?.trim();

  if (!cleanName) {
    return res.status(400).json({ success: false, error: 'categoryName es requerido' });
  }

  const store = loadGroupStore(tenantId);

  if (cleanName && !store.categories.includes(cleanName)) {
    store.categories.push(cleanName);
    saveGroupStore(tenantId, store);
    socketService.emitToTenant(tenantId, 'groups_updated', store);
  }

  return res.json({
    success: true,
    tenantId,
    categories: Array.from(new Set(['Todas', ...store.categories])),
    message: 'Nueva categoría creada y guardada exclusivamente para tu cuenta',
  });
});

// DELETE /api/groups/categories/:name (Delete category by URL param and sanitize assigned groups)
groupsRouter.delete('/categories/:name', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const categoryName = decodeURIComponent(req.params.name || '').trim();
  const store = loadGroupStore(tenantId);

  if (categoryName && categoryName !== 'Todas' && store.categories.includes(categoryName)) {
    store.categories = store.categories.filter((c) => c !== categoryName);
    // Sanitize groupCategoryMap: revert assigned groups from deleted category to 'Todas'
    if (store.groupCategoryMap) {
      for (const [gid, cat] of Object.entries(store.groupCategoryMap)) {
        if (cat === categoryName) {
          store.groupCategoryMap[gid] = 'Todas';
        }
      }
    }
    saveGroupStore(tenantId, store);
    socketService.emitToTenant(tenantId, 'groups_updated', store);

    return res.json({
      success: true,
      tenantId,
      categories: Array.from(new Set(['Todas', ...store.categories])),
      message: `Categoría "${categoryName}" eliminada de tu cuenta`,
    });
  }

  if (categoryName === 'Todas') {
    return res.status(400).json({ success: false, error: 'No se puede eliminar la categoría predeterminada' });
  }

  return res.status(404).json({ success: false, error: 'Categoría no encontrada en tu cuenta' });
});

// DELETE /api/groups/categories (Delete category strictly for this tenant via body or query and sanitize assigned groups)
groupsRouter.delete('/categories', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const { categoryName, name } = req.body;
  const targetCategory = (categoryName || name || (req.query.categoryName as string) || (req.query.name as string))?.trim();
  const store = loadGroupStore(tenantId);

  if (targetCategory && targetCategory !== 'Todas' && store.categories.includes(targetCategory)) {
    store.categories = store.categories.filter((c) => c !== targetCategory);
    // Sanitize groupCategoryMap: revert assigned groups from deleted category to 'Todas'
    if (store.groupCategoryMap) {
      for (const [gid, cat] of Object.entries(store.groupCategoryMap)) {
        if (cat === targetCategory) {
          store.groupCategoryMap[gid] = 'Todas';
        }
      }
    }
    saveGroupStore(tenantId, store);
    socketService.emitToTenant(tenantId, 'groups_updated', store);

    return res.json({
      success: true,
      tenantId,
      categories: Array.from(new Set(['Todas', ...store.categories])),
      message: `Categoría "${targetCategory}" eliminada de tu cuenta`,
    });
  }

  if (targetCategory === 'Todas') {
    return res.status(400).json({ success: false, error: 'No se puede eliminar la categoría predeterminada' });
  }

  return res.status(404).json({ success: false, error: 'Categoría no encontrada en tu cuenta' });
});

// POST /api/groups/assign-category (Assign group category strictly for this tenant)
groupsRouter.post('/assign-category', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const { groupId, category } = req.body;
  const store = loadGroupStore(tenantId);

  if (groupId && category) {
    store.groupCategoryMap[groupId] = category;
    saveGroupStore(tenantId, store);
    socketService.emitToTenant(tenantId, 'groups_updated', store);
  }

  return res.json({ success: true, tenantId, message: 'Categoría de grupo actualizada exclusivamente para tu cuenta' });
});

// POST /api/groups/broadcast
groupsRouter.post('/broadcast', async (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const { groupIds, messageText, headerText, footerText, mediaUrl } = req.body;

  if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0 || !messageText) {
    return res.status(400).json({ success: false, error: 'Debes seleccionar al menos un grupo e ingresar el mensaje' });
  }

  let compiledFullMessage = '';
  if (headerText) compiledFullMessage += `*${headerText.toUpperCase()}*\n\n`;
  compiledFullMessage += messageText;
  if (mediaUrl) compiledFullMessage += `\n\n📄 Adjunto / Enlace: ${mediaUrl}`;
  if (footerText) compiledFullMessage += `\n\n_${footerText}_`;

  const results = [];
  for (const groupId of groupIds) {
    const resSend = await OpenWAService.sendMessage(
      tenantId,
      '',
      groupId,
      compiledFullMessage
    );
    results.push({ groupId, status: resSend.status });
  }

  return res.json({
    success: true,
    tenantId,
    message: `¡Difusión enviada con éxito a ${groupIds.length} grupos de WhatsApp!`,
    results,
  });
});


