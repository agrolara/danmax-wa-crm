import { Router, Request, Response } from 'express';
import { OpenWAService } from '../services/openwa.service';
import { socketService } from '../services/socket.service';

export const kanbanRouter = Router();

// Mock Kanban Columns & Leads
let kanbanData: any = {
  tenant_demo_pizzeria: [
    {
      id: 'col_1',
      name: 'Pedido Nuevo',
      color: '#6366f1', // Indigo
      autoTemplateText: '¡Hola {{nombre}}! Hemos recibido tu pedido y entrará a cocina de inmediato.',
      leads: [
        {
          id: 'lead_101',
          contactName: 'Carlos Mendoza',
          phone: '+56998765432',
          value: '$18.990',
          items: 'Pizza Gigante Pepperoni + Bebida 1.5L',
          createdAt: '2026-08-13',
        },
      ],
    },
    {
      id: 'col_2',
      name: 'En Preparación',
      color: '#f59e0b', // Amber
      autoTemplateText: '🔥 Tu pedido de {{items}} ya está en el horno.',
      leads: [
        {
          id: 'lead_102',
          contactName: 'Andrea Rojas',
          phone: '+56977112233',
          value: '$24.500',
          items: '2 Pizzas Medias Napolitanas',
          createdAt: '2026-08-13',
        },
      ],
    },
    {
      id: 'col_3',
      name: 'En Reparto',
      color: '#3b82f6', // Blue
      autoTemplateText: '🛵 ¡Buenas noticias! El repartidor va en camino a tu domicilio.',
      leads: [],
    },
    {
      id: 'col_4',
      name: 'Entregado',
      color: '#10b981', // Emerald
      autoTemplateText: '🎉 ¡Gracias por tu compra {{nombre}}! ¡Que disfrutes tu pizza!',
      leads: [
        {
          id: 'lead_103',
          contactName: 'Gabriel Soto',
          phone: '+56955443322',
          value: '$12.990',
          items: '1 Pizza Individual + Postre',
          createdAt: '2026-08-12',
        },
      ],
    },
  ],
};

// GET /api/kanban
kanbanRouter.get('/', (req: Request, res: Response) => {
  const tenantId = (req.query.tenantId as string) || 'tenant_demo_pizzeria';
  const columns = kanbanData[tenantId] || [];
  return res.json({ success: true, columns });
});

// POST /api/kanban/move-lead (Drag and drop event with auto WhatsApp template trigger)
kanbanRouter.post('/move-lead', async (req: Request, res: Response) => {
  const { leadId, targetColumnId, tenantId } = req.body;
  const targetTenantId = tenantId || 'tenant_demo_pizzeria';
  const columns = kanbanData[targetTenantId] || [];

  let foundLead: any = null;

  // Remove lead from source column
  columns.forEach((col: any) => {
    const idx = col.leads.findIndex((l: any) => l.id === leadId);
    if (idx !== -1) {
      foundLead = col.leads.splice(idx, 1)[0];
    }
  });

  if (!foundLead) {
    return res.status(404).json({ success: false, error: 'Lead no encontrado' });
  }

  // Push to target column
  const targetCol = columns.find((c: any) => c.id === targetColumnId);
  if (targetCol) {
    targetCol.leads.push(foundLead);

    // Auto-Trigger WhatsApp Template if configured for column
    if (targetCol.autoTemplateText) {
      const compiledText = targetCol.autoTemplateText
        .replace(/{{nombre}}/g, foundLead.contactName)
        .replace(/{{items}}/g, foundLead.items);

      await OpenWAService.sendMessage(
        `tenant_${targetTenantId}`,
        'op_key_pizzeria_abc123',
        foundLead.phone,
        compiledText
      );
    }
  }

  // Emit to socket
  socketService.emitToTenant(targetTenantId, 'kanban_updated', columns);

  return res.json({
    success: true,
    message: 'Lead movido exitosamente y mensaje automático enviado por WhatsApp',
    columns,
  });
});
