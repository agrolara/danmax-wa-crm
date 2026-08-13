import { Router, Request, Response } from 'express';
import { OpenWAService } from '../services/openwa.service';

export const broadcastRouter = Router();

let broadcastsDb: any[] = [
  {
    id: 'broad_001',
    tenantId: 'tenant_demo_pizzeria',
    title: '🍕 Promoción 2x1 Jueves de Pizza',
    messageContent: '¡Hola! Este Jueves lleva 2 Pizzas Medianas al precio de 1. ¡Pide la tuya por aquí!',
    targetTag: 'Clientes VIP',
    scheduledFor: '2026-08-20T19:00:00Z',
    status: 'SCHEDULED',
    sentCount: 145,
  },
  {
    id: 'broad_002',
    tenantId: 'tenant_demo_pizzeria',
    title: '🥤 Bebida Gratis en tu Pedido Superior a $20.000',
    messageContent: '¡Aprovecha nuestro fin de semana especial! Bebida 1.5L gratis en compras sobre $20.000',
    targetTag: 'Todos los contactos',
    scheduledFor: '2026-08-28T18:30:00Z',
    status: 'SCHEDULED',
    sentCount: 320,
  },
];

// GET /api/broadcasts
broadcastRouter.get('/', (req: Request, res: Response) => {
  const tenantId = (req.query.tenantId as string) || 'tenant_demo_pizzeria';
  const filtered = broadcastsDb.filter((b) => b.tenantId === tenantId);
  return res.json({ success: true, broadcasts: filtered });
});

// POST /api/broadcasts (Schedule new broadcast)
broadcastRouter.post('/', async (req: Request, res: Response) => {
  const { title, messageContent, targetTag, scheduledFor, tenantId } = req.body;
  const targetTenantId = tenantId || 'tenant_demo_pizzeria';

  const newBroadcast = {
    id: `broad_${Date.now()}`,
    tenantId: targetTenantId,
    title,
    messageContent,
    targetTag: targetTag || 'Todos los contactos',
    scheduledFor,
    status: 'SCHEDULED',
    sentCount: 0,
  };

  broadcastsDb.push(newBroadcast);

  // Call OpenWA schedule API
  await OpenWAService.scheduleMessage(
    `tenant_${targetTenantId}`,
    'op_key_pizzeria_abc123',
    'GROUP_VIP_TAG',
    messageContent,
    scheduledFor
  );

  return res.json({
    success: true,
    message: 'Difusión agendada en OpenWA exitosamente',
    broadcast: newBroadcast,
  });
});
