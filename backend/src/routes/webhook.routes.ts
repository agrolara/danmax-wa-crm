import { Router, Request, Response } from 'express';
import { socketService } from '../services/socket.service';
import { processIncomingKanbanMessage } from './kanban.routes';

export const webhookRouter = Router();

function handleIncomingWebhook(req: Request, res: Response) {
  const event = req.body || {};
  console.log('📩 [OpenWA Webhook Received]:', JSON.stringify(event, null, 2));

  const payload = event.data || event;
  const targetTenantId = 'tenant_demo_pizzeria';

  const eventType = event.event || event.type || (payload.body ? 'message' : 'generic');

  switch (eventType) {
    case 'qr':
    case 'qr_code':
    case 'onQrCode':
      socketService.emitToTenant(targetTenantId, 'whatsapp_qr', {
        status: 'SCAN_QR',
        qrCodeUrl: payload.qr || payload.qrCode || event.qr,
      });
      break;

    case 'ready':
    case 'authenticated':
    case 'onStateChanged':
      socketService.emitToTenant(targetTenantId, 'whatsapp_status', {
        status: 'READY',
        whatsappPhone: payload.me || payload.phone || '+56986176136',
      });
      break;

    case 'message':
    case 'onMessage':
    case 'message.create':
      const fromContact = payload.from || payload.chatId || event.from || 'contact_wa';
      const msgBody = payload.body || payload.content || event.body || 'Mensaje recibido de WhatsApp';
      const senderName = payload.pushname || payload.sender?.name || payload.name || `Cliente ${fromContact.replace(/@.*/, '')}`;
      const phoneNum = fromContact.includes('@') ? `+${fromContact.replace(/@.*/, '')}` : fromContact;

      const newMessagePayload = {
        chatId: fromContact,
        tenantId: targetTenantId,
        contactName: senderName,
        phone: phoneNum,
        direction: 'INBOUND',
        message: {
          id: payload.id || `msg_in_${Date.now()}`,
          direction: 'INBOUND',
          content: typeof msgBody === 'string' ? msgBody : 'Mensaje multimedia',
          sentAt: new Date().toISOString(),
          status: 'DELIVERED',
        },
      };

      // 1. Broadcast live message event to chat inbox socket clients
      socketService.emitToTenant(targetTenantId, 'new_message', newMessagePayload);

      // 2. Process strict Kanban business rules for incoming WhatsApp messages
      try {
        processIncomingKanbanMessage(
          targetTenantId,
          senderName,
          phoneNum,
          fromContact,
          typeof msgBody === 'string' ? msgBody : 'Mensaje multimedia'
        );
      } catch (errKanban) {
        console.error('Error processing kanban rule:', errKanban);
      }
      break;

    default:
      socketService.emitToTenant(targetTenantId, 'webhook_event', event);
      break;
  }

  return res.json({ status: 'SUCCESS', receivedAt: new Date().toISOString() });
}

// Handle POST /api/webhooks/whatsapp and /api/webhooks/openwa
webhookRouter.post('/whatsapp', handleIncomingWebhook);
webhookRouter.post('/openwa', handleIncomingWebhook);
