import { Router, Request, Response } from 'express';
import { socketService } from '../services/socket.service';

export const webhookRouter = Router();

// POST /api/webhooks/whatsapp
webhookRouter.post('/whatsapp', (req: Request, res: Response) => {
  const event = req.body;
  console.log('📩 [OpenWA Webhook Received]:', JSON.stringify(event, null, 2));

  // Extract session ID and event payload
  const sessionId = event.sessionId || event.session || 'tenant_demo_pizzeria';
  const tenantId = sessionId.replace('tenant_', '').split('_')[0];

  const eventType = event.event || event.type || 'message';

  switch (eventType) {
    case 'qr':
    case 'qr_code':
      socketService.emitToTenant(tenantId, 'whatsapp_qr', {
        status: 'SCAN_QR',
        qrCodeUrl: event.qr || event.data,
      });
      break;

    case 'ready':
    case 'authenticated':
      socketService.emitToTenant(tenantId, 'whatsapp_status', {
        status: 'READY',
        whatsappPhone: event.me || event.phone || '+56912345678',
      });
      break;

    case 'message':
    case 'onMessage':
      socketService.emitToTenant(tenantId, 'new_message', {
        chatId: event.from || 'chat_001',
        message: {
          id: event.id || `msg_in_${Date.now()}`,
          direction: 'INBOUND',
          content: event.body || event.content || 'Mensaje de WhatsApp',
          sentAt: new Date().toISOString(),
          status: 'DELIVERED',
        },
      });
      break;

    default:
      socketService.emitToTenant(tenantId, 'webhook_event', event);
      break;
  }

  return res.json({ status: 'SUCCESS', receivedAt: new Date().toISOString() });
});
