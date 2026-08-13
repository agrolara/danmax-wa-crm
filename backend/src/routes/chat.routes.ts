import { Router, Request, Response } from 'express';
import { OpenWAService } from '../services/openwa.service';

export const chatRouter = Router();

// GET /api/chats (Fetch live chats from connected OpenWA session, return [] if none)
chatRouter.get('/', async (req: Request, res: Response) => {
  const sessionName = 'pizzeria-crm-tenant';

  // Fetch live chats from OpenWA
  const liveChats = await OpenWAService.getLiveChats(sessionName);

  if (liveChats.success && liveChats.chats.length > 0) {
    const formattedChats = liveChats.chats
      .filter((c: any) => !c.isGroup) // Only show individual contact chats
      .map((c: any) => {
        const lastMsgText = c.lastMessage?.body || c.lastMessage || 'Mensaje de WhatsApp';
        const formattedTime = c.timestamp
          ? new Date(c.timestamp * 1000).toISOString()
          : new Date().toISOString();

        return {
          id: c.id,
          tenantId: 'tenant_demo_pizzeria',
          contactName: c.name || `Cliente ${c.id.replace(/@.*/, '')}`,
          phone: c.id.includes('@') ? `+${c.id.replace(/@.*/, '')}` : c.id,
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

    return res.json({ success: true, chats: formattedChats });
  }

  // Return clean empty array (NO dummy demo chats)
  return res.json({
    success: true,
    chats: [],
  });
});

// POST /api/chats/send (Send message via OpenWA live session)
chatRouter.post('/send', async (req: Request, res: Response) => {
  const { chatId, content } = req.body;
  const sessionName = 'pizzeria-crm-tenant';

  const sendResult: any = await OpenWAService.sendMessage(sessionName, '', chatId, content);

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
