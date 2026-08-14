import { Router, Request, Response } from 'express';
import { OpenWAService } from '../services/openwa.service';
import { PersistentStore } from '../services/storage.service';

export const groupsRouter = Router();

interface GroupCategoryStore {
  categories: string[];
  groupCategoryMap: Record<string, string>;
  hiddenGroupIds: string[];
}

const DEFAULT_STORE: GroupCategoryStore = {
  categories: ['Todas'],
  groupCategoryMap: {},
  hiddenGroupIds: [],
};

const GLOBAL_SESSION_KEY = 'global_whatsapp_line';

// Load and auto-merge persistent data across ALL session keys to guarantee ZERO category loss
function loadGroupStore(phoneOrTenant?: string): GroupCategoryStore {
  const allStores = PersistentStore.readJSON<Record<string, GroupCategoryStore>>('groups_categories.json', {});

  // Collect and merge ALL categories, maps, and hidden IDs across all keys
  const mergedCategoriesSet = new Set<string>(['Todas']);
  const mergedMap: Record<string, string> = {};
  const mergedHidden: string[] = [];

  for (const storeKey of Object.keys(allStores)) {
    const s = allStores[storeKey];
    if (s && Array.isArray(s.categories)) {
      s.categories.forEach((cat) => {
        if (cat && typeof cat === 'string' && cat.trim()) {
          mergedCategoriesSet.add(cat.trim());
        }
      });
    }
    if (s && s.groupCategoryMap) {
      Object.assign(mergedMap, s.groupCategoryMap);
    }
    if (s && Array.isArray(s.hiddenGroupIds)) {
      s.hiddenGroupIds.forEach((id) => {
        if (!mergedHidden.includes(id)) mergedHidden.push(id);
      });
    }
  }

  const mergedCategories = Array.from(mergedCategoriesSet);

  const mergedStore: GroupCategoryStore = {
    categories: mergedCategories,
    groupCategoryMap: mergedMap,
    hiddenGroupIds: mergedHidden,
  };

  const key = phoneOrTenant && phoneOrTenant !== 'undefined' ? phoneOrTenant : GLOBAL_SESSION_KEY;
  allStores[key] = mergedStore;
  allStores[GLOBAL_SESSION_KEY] = mergedStore;
  allStores['tenant_demo_pizzeria'] = mergedStore;

  PersistentStore.writeJSON('groups_categories.json', allStores);

  return mergedStore;
}

function saveGroupStore(phoneOrTenant: string | undefined, storeData: GroupCategoryStore) {
  const allStores = PersistentStore.readJSON<Record<string, GroupCategoryStore>>('groups_categories.json', {});

  const key = phoneOrTenant && phoneOrTenant !== 'undefined' ? phoneOrTenant : GLOBAL_SESSION_KEY;
  allStores[key] = storeData;
  allStores[GLOBAL_SESSION_KEY] = storeData;
  allStores['tenant_demo_pizzeria'] = storeData;

  PersistentStore.writeJSON('groups_categories.json', allStores);
}

async function fetchLiveGroups(sessionName?: string) {
  const store = loadGroupStore(sessionName);
  const hiddenSet = new Set(store.hiddenGroupIds);
  const liveChats = await OpenWAService.getLiveChats(sessionName);

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

// GET /api/groups
groupsRouter.get('/', async (req: Request, res: Response) => {
  const sessionName = req.query.sessionName as string;
  const groups = await fetchLiveGroups(sessionName);
  const store = loadGroupStore(sessionName);

  return res.json({
    success: true,
    groups,
    categories: Array.from(new Set(['Todas', ...store.categories])),
    total: groups.length,
  });
});

// POST /api/groups/sync (Force re-sync of WhatsApp groups from OpenWA Engine)
groupsRouter.post('/sync', async (req: Request, res: Response) => {
  const { sessionName } = req.body;
  const groups = await fetchLiveGroups(sessionName);
  const store = loadGroupStore(sessionName);

  return res.json({
    success: true,
    message: `Sincronización completada. ${groups.length} grupos encontrados en WhatsApp.`,
    groups,
    categories: Array.from(new Set(['Todas', ...store.categories])),
    total: groups.length,
  });
});

// POST /api/groups/hide (Delete group ONLY from CRM view)
groupsRouter.post('/hide', async (req: Request, res: Response) => {
  const { groupId, sessionName } = req.body;
  if (!groupId) {
    return res.status(400).json({ success: false, error: 'groupId es requerido' });
  }

  const store = loadGroupStore(sessionName);
  if (!store.hiddenGroupIds.includes(groupId)) {
    store.hiddenGroupIds.push(groupId);
    saveGroupStore(sessionName, store);
  }

  const updatedGroups = await fetchLiveGroups(sessionName);

  return res.json({
    success: true,
    message: 'Grupo eliminado únicamente de la vista del CRM.',
    groups: updatedGroups,
    total: updatedGroups.length,
  });
});

// POST /api/groups/categories (Persistent user-created categories linked to session/phone)
groupsRouter.post('/categories', (req: Request, res: Response) => {
  const { categoryName, sessionName } = req.body;
  const cleanName = categoryName?.trim();
  const store = loadGroupStore(sessionName);

  if (cleanName && !store.categories.includes(cleanName)) {
    store.categories.push(cleanName);
    saveGroupStore(sessionName, store);
  }

  return res.json({
    success: true,
    categories: Array.from(new Set(['Todas', ...store.categories])),
    message: 'Nueva categoría creada y guardada de forma 100% permanente',
  });
});

// DELETE /api/groups/categories (Delete category)
groupsRouter.delete('/categories', (req: Request, res: Response) => {
  const { categoryName, sessionName } = req.body;
  const store = loadGroupStore(sessionName);

  if (categoryName && categoryName !== 'Todas') {
    store.categories = store.categories.filter((c) => c !== categoryName);
    saveGroupStore(sessionName, store);
  }

  return res.json({
    success: true,
    categories: Array.from(new Set(['Todas', ...store.categories])),
    message: 'Categoría eliminada',
  });
});

// POST /api/groups/assign-category (Persistent group-to-category mapping)
groupsRouter.post('/assign-category', (req: Request, res: Response) => {
  const { groupId, category, sessionName } = req.body;
  const store = loadGroupStore(sessionName);

  if (groupId && category) {
    store.groupCategoryMap[groupId] = category;
    saveGroupStore(sessionName, store);
  }

  return res.json({ success: true, message: 'Categoría de grupo actualizada y guardada de forma permanente' });
});

// POST /api/groups/broadcast
groupsRouter.post('/broadcast', async (req: Request, res: Response) => {
  const { groupIds, messageText, headerText, footerText, mediaUrl, sessionName } = req.body;
  const targetSession = sessionName || 'ventas-online';

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
      targetSession,
      '',
      groupId,
      compiledFullMessage
    );
    results.push({ groupId, status: resSend.status });
  }

  return res.json({
    success: true,
    message: `¡Difusión enviada con éxito a ${groupIds.length} grupos de WhatsApp!`,
    results,
  });
});
