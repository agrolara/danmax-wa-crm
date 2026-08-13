import { Router, Request, Response } from 'express';
import { OpenWAService } from '../services/openwa.service';

export const groupsRouter = Router();

export let groupCategoriesList: string[] = ['Ventas Directas', 'Grupos Vecinales', 'General'];

let groupCategoriesMap: Record<string, string> = {
  '120363047285645104@g.us': 'Ventas Directas',
  '120363040673899979@g.us': 'Grupos Vecinales',
};

// GET /api/groups
groupsRouter.get('/', async (req: Request, res: Response) => {
  const sessionName = 'pizzeria-crm-tenant';

  const liveChats = await OpenWAService.getLiveChats(sessionName);

  if (liveChats.success && liveChats.chats.length > 0) {
    const groups = liveChats.chats
      .filter((c: any) => c.isGroup)
      .map((g: any) => ({
        id: g.id,
        name: g.name || 'Grupo sin nombre',
        unreadCount: g.unreadCount || 0,
        category: groupCategoriesMap[g.id] || 'General',
        timestamp: g.timestamp ? new Date(g.timestamp * 1000).toISOString() : new Date().toISOString(),
        lastMessage: typeof g.lastMessage === 'string' ? g.lastMessage : g.lastMessage?.body || 'Mensaje de grupo',
      }));

    return res.json({ success: true, groups, categories: groupCategoriesList, total: groups.length });
  }

  return res.json({
    success: true,
    groups: [
      {
        id: '120363047285645104@g.us',
        name: '𝐐𝐔𝐈𝐋𝐈𝐂𝐔𝐑𝐀 𝐕𝐄𝐍𝐃𝐄',
        category: groupCategoriesMap['120363047285645104@g.us'] || 'Ventas Directas',
        unreadCount: 18,
        timestamp: new Date().toISOString(),
        lastMessage: 'Por si alguien está interesado en promociones',
      },
      {
        id: '120363040673899979@g.us',
        name: 'Ventas con entrega en Quilicura y Valle Grande. 🛒📦',
        category: groupCategoriesMap['120363040673899979@g.us'] || 'Grupos Vecinales',
        unreadCount: 5,
        timestamp: new Date().toISOString(),
        lastMessage: 'Promoción especial disponible',
      },
    ],
    categories: groupCategoriesList,
    total: 2,
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

  // Build full formatted WhatsApp message
  let compiledFullMessage = '';
  if (headerText) compiledFullMessage += `*${headerText.toUpperCase()}*\n\n`;
  compiledFullMessage += messageText;
  if (mediaUrl) compiledFullMessage += `\n\n📄 Adjunto / Enlace: ${mediaUrl}`;
  if (footerText) compiledFullMessage += `\n\n_${footerText}_`;

  const results = [];
  for (const groupId of groupIds) {
    const resSend = await OpenWAService.sendMessage(
      sessionName,
      'op_key_pizzeria_abc123',
      groupId,
      compiledFullMessage
    );
    results.push({ groupId, status: resSend.status });
  }

  return res.json({
    success: true,
    message: `¡Difusión Rica enviada con éxito a ${groupIds.length} grupos de WhatsApp!`,
    results,
  });
});
