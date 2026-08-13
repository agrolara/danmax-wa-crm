import { Router, Request, Response } from 'express';
import { OpenWAService } from '../services/openwa.service';

export const chatRouter = Router();

function formatPhoneNumber(chatObj: any): string {
  const rawId = chatObj.id || '';
  const rawName = chatObj.name || '';

  // 1. If name contains a phone number (e.g. "+56 9 9108 8424")
  if (rawName.startsWith('+') || /^\+?[0-9\s-]{8,}$/.test(rawName)) {
    return rawName.startsWith('+') ? rawName : `+${rawName}`;
  }

  // 2. If ID is standard @c.us phone ID (e.g. "56986176136@c.us")
  if (rawId.includes('@c.us') || /^[0-9]{8,}@/.test(rawId)) {
    const digits = rawId.replace(/[^0-9]/g, '');
    return digits ? `+${digits}` : rawId;
  }

  // 3. Fallback for @lid privacy identifiers
  return rawName || `Contacto ${rawId.replace(/@.*/, '')}`;
}

// GET /api/chats (Fetch live chats from connected OpenWA session, return [] if none)
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

        const contactName = c.name || `Cliente ${c.id.replace(/@.*/, '')}`;
        const phone = formatPhoneNumber(c);

        return {
          id: c.id,
          tenantId: 'tenant_demo_pizzeria',
          contactName,
          phone,
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          assignedAgent: 'Agente Ventas',
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

// POST /api/chats/send (Send message via OpenWA live session)
chatRouter.post('/send', async (req: Request, res: Response) => {
  const { chatId, content, sessionName } = req.body;
  const targetSession = sessionName || 'ventas-online';

  const sendResult: any = await OpenWAService.sendMessage(targetSession, '', chatId, content);

  if (!sendResult.success) {
    return res.status(500).json({ success: false, error: sendResult.error || 'Error enviando mensaje por WhatsApp' });
  }

  return res.json({
    success: true,
    message: {
      id: sendResult.messageId || `msg_${Date.now()}`,
      direction: 'OUTBOUND',
      content,
      sentAt: new Date().toISOString(),
      status: 'SENT',
    },
  });
});
