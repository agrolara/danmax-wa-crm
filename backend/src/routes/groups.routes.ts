import { Router, Request, Response } from 'express';
import { OpenWAService } from '../services/openwa.service';

export const groupsRouter = Router();

export let groupCategoriesList: string[] = ['Ventas Directas', 'Grupos Vecinales', 'General'];

let groupCategoriesMap: Record<string, string> = {
  '120363047285645104@g.us': 'Ventas Directas',
  '120363040673899979@g.us': 'Grupos Vecinales',
};

// Hidden groups map (CRM local deletion only)
const hiddenGroupIdsSet: Set<string> = new Set();

async function fetchLiveGroups(sessionName: string = 'pizzeria-crm-tenant') {
  const liveChats = await OpenWAService.getLiveChats(sessionName);

  if (liveChats.success && liveChats.chats.length > 0) {
    return liveChats.chats
      .filter((c: any) => c.isGroup && !hiddenGroupIdsSet.has(c.id))
      .map((g: any) => ({
        id: g.id,
        name: g.name || 'Grupo sin nombre',
        unreadCount: g.unreadCount || 0,
        category: groupCategoriesMap[g.id] || 'General',
        timestamp: g.timestamp ? new Date(g.timestamp * 1000).toISOString() : new Date().toISOString(),
        lastMessage: typeof g.lastMessage === 'string' ? g.lastMessage : g.lastMessage?.body || 'Mensaje de grupo',
      }));
  }
  return [];
}

// GET /api/groups
groupsRouter.get('/', async (req: Request, res: Response) => {
  const sessionName = 'pizzeria-crm-tenant';
  const groups = await fetchLiveGroups(sessionName);

  return res.json({
    success: true,
    groups,
    categories: groupCategoriesList,
    total: groups.length,
  });
});

// POST /api/groups/sync (Force re-sync of WhatsApp groups from OpenWA Engine)
groupsRouter.post('/sync', async (req: Request, res: Response) => {
  const sessionName = 'pizzeria-crm-tenant';
  const groups = await fetchLiveGroups(sessionName);

  return res.json({
    success: true,
    message: `Sincronización completada. ${groups.length} grupos encontrados.`,
    groups,
    categories: groupCategoriesList,
    total: groups.length,
  });
});

// POST /api/groups/hide (Delete group ONLY from CRM view, preserving actual WhatsApp group)
groupsRouter.post('/hide', async (req: Request, res: Response) => {
  const { groupId } = req.body;
  if (!groupId) {
    return res.status(400).json({ success: false, error: 'groupId es requerido' });
  }

  hiddenGroupIdsSet.add(groupId);

  const sessionName = 'pizzeria-crm-tenant';
  const updatedGroups = await fetchLiveGroups(sessionName);

  return res.json({
    success: true,
    message: 'Grupo eliminado únicamente del CRM DanMax WA.',
    groups: updatedGroups,
    total: updatedGroups.length,
  });
});

// POST /api/groups/categories
groupsRouter.post('/categories', (req: Request, res: Response) => {
  const { categoryName } = req.body;
  if (categoryName && !groupCategoriesList.includes(categoryName)) {
    groupCategoriesList.push(categoryName);
  }
  return res.json({ success: true, categories: groupCategoriesList, message: 'Nueva categoría creada' });
});

// POST /api/groups/assign-category
groupsRouter.post('/assign-category', (req: Request, res: Response) => {
  const { groupId, category } = req.body;
  if (groupId && category) {
    groupCategoriesMap[groupId] = category;
  }
  return res.json({ success: true, message: 'Categoría de grupo actualizada' });
});

// POST /api/groups/broadcast (Send Rich Multi-Media Broadcast to selected groups)
groupsRouter.post('/broadcast', async (req: Request, res: Response) => {
  const { groupIds, messageText, headerText, footerText, mediaUrl } = req.body;
  const sessionName = 'pizzeria-crm-tenant';

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
      sessionName,
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
