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

// Load persistent data per WhatsApp session / Tenant ID
function loadGroupStore(phoneOrTenant: string = 'tenant_demo_pizzeria'): GroupCategoryStore {
  const allStores = PersistentStore.readJSON<Record<string, GroupCategoryStore>>('groups_categories.json', {});
  if (!allStores[phoneOrTenant]) {
    allStores[phoneOrTenant] = { ...DEFAULT_STORE };
  }
  return allStores[phoneOrTenant];
}

function saveGroupStore(phoneOrTenant: string = 'tenant_demo_pizzeria', storeData: GroupCategoryStore) {
  const allStores = PersistentStore.readJSON<Record<string, GroupCategoryStore>>('groups_categories.json', {});
  allStores[phoneOrTenant] = storeData;
  PersistentStore.writeJSON('groups_categories.json', allStores);
}

async function fetchLiveGroups(sessionName?: string, phoneOrTenant: string = 'tenant_demo_pizzeria') {
  const store = loadGroupStore(phoneOrTenant);
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
  const sessionName = (req.query.sessionName as string) || 'tenant_demo_pizzeria';
  const groups = await fetchLiveGroups(sessionName, sessionName);
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
  const { sessionName = 'tenant_demo_pizzeria' } = req.body;
  const groups = await fetchLiveGroups(sessionName, sessionName);
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
  const { groupId, sessionName = 'tenant_demo_pizzeria' } = req.body;
  if (!groupId) {
    return res.status(400).json({ success: false, error: 'groupId es requerido' });
  }

  const store = loadGroupStore(sessionName);
  if (!store.hiddenGroupIds.includes(groupId)) {
    store.hiddenGroupIds.push(groupId);
    saveGroupStore(sessionName, store);
  }

  const updatedGroups = await fetchLiveGroups(sessionName, sessionName);

  return res.json({
    success: true,
    message: 'Grupo eliminado únicamente de la vista del CRM.',
    groups: updatedGroups,
    total: updatedGroups.length,
  });
});

// POST /api/groups/categories (Persistent user-created categories linked to session/phone)
groupsRouter.post('/categories', (req: Request, res: Response) => {
  const { categoryName, sessionName = 'tenant_demo_pizzeria' } = req.body;
  const cleanName = categoryName?.trim();
  const store = loadGroupStore(sessionName);

  if (cleanName && !store.categories.includes(cleanName)) {
    store.categories.push(cleanName);
    saveGroupStore(sessionName, store);
  }

  return res.json({
    success: true,
    categories: Array.from(new Set(['Todas', ...store.categories])),
    message: 'Nueva categoría creada y guardada de forma persistente',
  });
});

// DELETE /api/groups/categories (Delete category)
groupsRouter.delete('/categories', (req: Request, res: Response) => {
  const { categoryName, sessionName = 'tenant_demo_pizzeria' } = req.body;
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
  const { groupId, category, sessionName = 'tenant_demo_pizzeria' } = req.body;
  const store = loadGroupStore(sessionName);

  if (groupId && category) {
    store.groupCategoryMap[groupId] = category;
    saveGroupStore(sessionName, store);
  }

  return res.json({ success: true, message: 'Categoría de grupo actualizada y guardada de forma persistente' });
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
