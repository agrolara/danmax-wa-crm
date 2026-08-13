import { Router, Request, Response } from 'express';
import { OpenWAService } from '../services/openwa.service';

export const chatRouter = Router();

// Storage for agent chat assignments and custom contact names
const chatAgentMap: Record<string, string> = {};
const contactNameMap: Record<string, string> = {};

function formatPhoneNumber(chatObj: any): string {
  const rawId = chatObj.id || '';
  const rawName = chatObj.name || '';

  // 1. If ID contains @lid, do NOT format as a phone number with fake "+"!
  if (rawId.includes('@lid')) {
    if (rawName.startsWith('+') || /^\+?[0-9\s-]{8,}$/.test(rawName.trim())) {
      return rawName.startsWith('+') ? rawName : `+${rawName}`;
    }
    return `ID WhatsApp: ${rawId}`;
  }

  // 2. If name starts with + or is a phone number (e.g. "+56 9 5178 2341")
  if (rawName.startsWith('+') || /^\+?[0-9\s-]{8,}$/.test(rawName.trim())) {
    return rawName.startsWith('+') ? rawName : `+${rawName}`;
  }

  // 3. If ID is standard @c.us or @s.whatsapp.net phone ID
  if (rawId.endsWith('@c.us') || rawId.endsWith('@s.whatsapp.net')) {
    const digits = rawId.replace(/[^0-9]/g, '');
    return digits ? `+${digits}` : rawId;
  }

  return rawName || `Contacto ${rawId.replace(/@.*/, '')}`;
}

// GET /api/chats (Fetch live chats from connected OpenWA session)
chatRouter.get('/', async (req: Request, res: Response) => {
  const sessionName = req.query.sessionName as string;

  // Fetch live chats from OpenWA
  const liveChats = await OpenWAService.getLiveChats(sessionName);

  if (liveChats.success && liveChats.chats.length > 0) {
    const formattedChats = liveChats.chats
      .filter((c: any) => !c.isGroup && c.kind !== 'group' && (!c.id || !c.id.includes('@g.us')))
      .map((c: any) => {
        const lastMsgText = c.lastMessage?.body || c.lastMessage || 'Mensaje de WhatsApp';
        const formattedTime = c.timestamp
          ? new Date(c.timestamp * 1000).toISOString()
          : new Date().toISOString();

        // Persistent custom contact name OR default name from WhatsApp
        const contactName = contactNameMap[c.id] || c.name || `Cliente ${c.id.replace(/@.*/, '')}`;
        const phone = formatPhoneNumber(c);
        const assignedAgent = chatAgentMap[c.id] || null;

        return {
          id: c.id,
          tenantId: 'tenant_demo_pizzeria',
          contactName,
          phone,
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          assignedAgent,
          lastMessageText: typeof lastMsgText === 'string' ? lastMsgText : 'Mensaje recibido',
          lastMessageAt: formattedTime,
          unreadCount: c.unreadCount || 0,
          messages: [
            {
              id: `msg_${c.id}_last`,
              direction: 'INBOUND',
              content: typeof lastMsgText === 'string' ? lastMsgText : 'Mensaje de WhatsApp',
              sentAt: formattedTime,
              status: 'READ',
            },
          ],
        };
      });

    return res.json({ success: true, chats: formattedChats, sessionId: liveChats.sessionId });
  }

  return res.json({
    success: true,
    chats: [],
  });
});

// POST /api/chats/update-contact-name (Renames and saves contact persistently)
chatRouter.post('/update-contact-name', (req: Request, res: Response) => {
  const { chatId, contactName } = req.body;
  if (!chatId || !contactName) {
    return res.status(400).json({ success: false, error: 'chatId y contactName son requeridos' });
  }

  const cleanName = contactName.trim();
  contactNameMap[chatId] = cleanName;

  return res.json({
    success: true,
    message: `Contacto agendado como "${cleanName}"`,
    chatId,
    contactName: cleanName,
  });
});

// POST /api/chats/assign-agent (Assign sales representative / agent to a chat)
chatRouter.post('/assign-agent', (req: Request, res: Response) => {
  const { chatId, agentName } = req.body;
  if (!chatId) {
    return res.status(400).json({ success: false, error: 'chatId es requerido' });
  }

  if (agentName) {
    chatAgentMap[chatId] = agentName;
  } else {
    delete chatAgentMap[chatId];
  }

  return res.json({
    success: true,
    message: agentName ? `Chat asignado exitosamente a "${agentName}"` : 'Chat desasignado',
    chatId,
    assignedAgent: agentName || null,
  });
});

// POST /api/chats/broadcast-contacts (Send mass broadcast message to multiple selected contacts)
chatRouter.post('/broadcast-contacts', async (req: Request, res: Response) => {
  const { chatIds, messageText, sessionName } = req.body;
  const targetSession = sessionName || 'ventas-online';

  if (!chatIds || !Array.isArray(chatIds) || chatIds.length === 0 || !messageText) {
    return res.status(400).json({ success: false, error: 'Debes seleccionar al menos un contacto e ingresar el mensaje' });
  }

  const results = [];
  for (const cid of chatIds) {
    const resSend = await OpenWAService.sendMessage(targetSession, '', cid, messageText);
    results.push({ chatId: cid, status: resSend.status });
  }

  return res.json({
    success: true,
    message: `¡Difusión masiva enviada a ${chatIds.length} contactos de WhatsApp!`,
    results,
  });
});

// POST /api/chats/send (Send message via OpenWA live session)
chatRouter.post('/send', async (req: Request, res: Response) => {
  const { chatId, text, content, sessionName } = req.body;
  const targetSession = sessionName || 'ventas-online';
  const textToSend = content || text;

  if (!chatId || !textToSend) {
    return res.status(400).json({ success: false, error: 'chatId y contenido del mensaje son requeridos' });
  }

  const sendResult: any = await OpenWAService.sendMessage(targetSession, '', chatId, textToSend);

  if (!sendResult.success) {
    return res.status(500).json({ success: false, error: sendResult.error || 'Error enviando mensaje por WhatsApp' });
  }

  return res.json({
    success: true,
    message: {
      id: sendResult.messageId || `msg_${Date.now()}`,
      direction: 'OUTBOUND',
      content: textToSend,
      sentAt: new Date().toISOString(),
      status: 'SENT',
    },
  });
});
