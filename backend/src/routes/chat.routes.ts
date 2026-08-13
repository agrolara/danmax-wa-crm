import { Router, Request, Response } from 'express';
import { OpenWAService } from '../services/openwa.service';
import { socketService } from '../services/socket.service';

export const chatRouter = Router();

// GET /api/chats (Fetch live chats from OpenWA session GET /api/sessions/:id/chats)
chatRouter.get('/', async (req: Request, res: Response) => {
  const sessionName = 'pizzeria-crm-tenant';

  // Fetch live chats from OpenWA
  const liveChats = await OpenWAService.getLiveChats(sessionName);

  if (liveChats.success && liveChats.chats.length > 0) {
    const formattedChats = liveChats.chats
      .filter((c: any) => !c.isGroup) // Only show individual chats in CRM inbox
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
          assignedAgent: 'Juan Vendedor',
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

    if (formattedChats.length > 0) {
      return res.json({ success: true, chats: formattedChats });
    }
  }

  // Fallback if no individual chats yet
  return res.json({
    success: true,
    chats: [
      {
        id: 'chat_demo_01',
        tenantId: 'tenant_demo_pizzeria',
        contactName: 'Cliente Demostración',
        phone: '+56998765432',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        assignedAgent: 'Juan Vendedor',
        lastMessageText: 'Esperando chats entrantes de OpenWA...',
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0,
        messages: [],
      },
    ],
  });
});

// GET /api/chats/:chatId/messages (Fetch detailed messages for a chat)
chatRouter.get('/:chatId/messages', async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const sessionName = 'pizzeria-crm-tenant';

  const liveMsgs = await OpenWAService.getChatMessages(sessionName, chatId);

  if (liveMsgs.success && liveMsgs.messages.length > 0) {
    const formatted = liveMsgs.messages.map((m: any) => ({
      id: m.id || `msg_${Date.now()}`,
      direction: m.direction === 'incoming' || m.from !== 'me' ? 'INBOUND' : 'OUTBOUND',
      content: m.body || m.content || '[Mensaje]',
      sentAt: m.createdAt || new Date(m.timestamp * 1000).toISOString(),
      status: 'READ',
    }));
    return res.json({ success: true, messages: formatted });
  }

  return res.json({ success: true, messages: [] });
});

// POST /api/chats/send (Send message via OpenWA)
chatRouter.post('/send', async (req: Request, res: Response) => {
  const { chatId, tenantId, text } = req.body;
  const targetTenantId = tenantId || 'tenant_demo_pizzeria';
  const sessionName = 'pizzeria-crm-tenant';

  const newMsg = {
    id: `msg_${Date.now()}`,
    direction: 'OUTBOUND',
    content: text,
    sentAt: new Date().toISOString(),
    status: 'SENT',
  };

  // Send via OpenWA
  await OpenWAService.sendMessage(
    sessionName,
    'op_key_pizzeria_abc123',
    chatId,
    text
  );

  // Emit to socket room for live UI update
  socketService.emitToTenant(targetTenantId, 'new_message', {
    chatId,
    message: newMsg,
  });

  return res.json({ success: true, message: newMsg });
});
