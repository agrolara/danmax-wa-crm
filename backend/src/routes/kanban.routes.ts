import { Router, Request, Response } from 'express';
import { socketService } from '../services/socket.service';

export const kanbanRouter = Router();

export interface KanbanLead {
  id: string;
  chatId: string;
  contactName: string;
  phone: string;
  value: string;
  items: string;
  createdAt: string;
}

export interface KanbanColumn {
  id: string;
  name: string;
  color: string;
  autoTemplateText: string;
  leads: KanbanLead[];
}

// Clean starting Kanban structure (0 initial leads in Contacto Nuevo)
export let kanbanData: Record<string, KanbanColumn[]> = {
  tenant_demo_pizzeria: [
    {
      id: 'col_1',
      name: 'Contacto Nuevo',
      color: '#6366f1',
      autoTemplateText: '¡Hola {{nombre}}! Gracias por comunicarte con nosotros.',
      leads: [],
    },
    {
      id: 'col_2',
      name: 'En Cotización / Negociación',
      color: '#f59e0b',
      autoTemplateText: 'Hola {{nombre}}, estamos preparando tu propuesta.',
      leads: [],
    },
    {
      id: 'col_3',
      name: 'En Seguimiento',
      color: '#3b82f6',
      autoTemplateText: 'Hola {{nombre}}, ¿tuviste oportunidad de revisar nuestra información?',
      leads: [],
    },
    {
      id: 'col_4',
      name: 'Venta Cerrada',
      color: '#10b981',
      autoTemplateText: '🎉 ¡Muchas gracias por tu preferencia {{nombre}}!',
      leads: [],
    },
    {
      id: 'col_5',
      name: 'Terminado',
      color: '#ec4899',
      autoTemplateText: '✅ Pedido y atención finalizada con éxito. ¡Gracias por preferirnos!',
      leads: [],
    },
  ],
};

function getOrCreateKanban(tenantId: string = 'tenant_demo_pizzeria'): KanbanColumn[] {
  if (!kanbanData[tenantId]) {
    kanbanData[tenantId] = [
      { id: 'col_1', name: 'Contacto Nuevo', color: '#6366f1', autoTemplateText: '¡Hola {{nombre}}! Gracias por comunicarte con nosotros.', leads: [] },
      { id: 'col_2', name: 'En Cotización / Negociación', color: '#f59e0b', autoTemplateText: 'Hola {{nombre}}, estamos preparando tu propuesta.', leads: [] },
      { id: 'col_3', name: 'En Seguimiento', color: '#3b82f6', autoTemplateText: 'Hola {{nombre}}, ¿tuviste oportunidad de revisar nuestra información?', leads: [] },
      { id: 'col_4', name: 'Venta Cerrada', color: '#10b981', autoTemplateText: '🎉 ¡Muchas gracias por tu preferencia {{nombre}}!', leads: [] },
      { id: 'col_5', name: 'Terminado', color: '#ec4899', autoTemplateText: '✅ Pedido y atención finalizada con éxito. ¡Gracias por preferirnos!', leads: [] },
    ];
  }
  return kanbanData[tenantId];
}

/**
 * Core Kanban Business Rule Engine for incoming WhatsApp Messages:
 * Rule 1: Active Deal Stage (col_2, col_3, col_4) -> Keep in current stage & update message text. NEVER regress to col_1.
 * Rule 2: Terminated Stage (col_5) -> Reopen deal & move back to "Contacto Nuevo" (col_1) for new sales cycle.
 * Rule 3: Contacto Nuevo (col_1) -> Update message text in col_1.
 * Rule 4: Completely New Client -> Add new card directly in "Contacto Nuevo" (col_1).
 */
export function processIncomingKanbanMessage(
  tenantId: string,
  contactName: string,
  phone: string,
  chatId: string,
  messageContent: string
) {
  const columns = getOrCreateKanban(tenantId);
  const identifier = chatId || phone;

  // Search if lead exists in any column
  let existingCol: KanbanColumn | null = null;
  let existingLeadIndex = -1;

  for (const col of columns) {
    const idx = col.leads.findIndex(
      (l) => l.chatId === identifier || l.id === identifier || l.phone === phone || l.chatId === chatId
    );
    if (idx !== -1) {
      existingCol = col;
      existingLeadIndex = idx;
      break;
    }
  }

  if (existingCol && existingLeadIndex !== -1) {
    const [lead] = existingCol.leads.splice(existingLeadIndex, 1);
    lead.items = messageContent || 'Nuevo mensaje de WhatsApp';
    lead.contactName = contactName || lead.contactName;

    // Rule 2: If lead was in "Terminado" (col_5), move back to "Contacto Nuevo" (col_1) for new sales cycle!
    if (existingCol.id === 'col_5') {
      const col1 = columns.find((c) => c.id === 'col_1') || columns[0];
      col1.leads.unshift(lead);
      console.log(`[Kanban Rule 2]: Lead "${lead.contactName}" reopened from Terminado -> Contacto Nuevo`);
    } else {
      // Rule 1 & 3: Maintain current active stage (col_2, col_3, col_4, col_1)
      existingCol.leads.unshift(lead);
      console.log(`[Kanban Rule 1]: Lead "${lead.contactName}" updated in active stage ${existingCol.name}`);
    }
  } else {
    // Rule 4: Completely new client -> Create card in "Contacto Nuevo" (col_1)
    const col1 = columns.find((c) => c.id === 'col_1') || columns[0];
    const newLead: KanbanLead = {
      id: `lead_${Date.now()}`,
      chatId: identifier,
      contactName: contactName || `Cliente ${identifier.replace(/@.*/, '')}`,
      phone: phone || identifier,
      value: '$50.000',
      items: messageContent || 'Nuevo mensaje de WhatsApp',
      createdAt: new Date().toISOString().split('T')[0],
    };
    col1.leads.unshift(newLead);
    console.log(`[Kanban Rule 4]: New client "${newLead.contactName}" added to Contacto Nuevo`);
  }

  // Emit real-time update to all connected Socket clients!
  socketService.emitToTenant(tenantId, 'kanban_updated', columns);
  return columns;
}

// GET /api/kanban
kanbanRouter.get('/', (req: Request, res: Response) => {
  const tenantId = (req.query.tenantId as string) || 'tenant_demo_pizzeria';
  const columns = getOrCreateKanban(tenantId);
  return res.json({ success: true, columns });
});

// POST /api/kanban/move (Move lead card between stages and emit real-time socket event)
kanbanRouter.post('/move', (req: Request, res: Response) => {
  const { tenantId = 'tenant_demo_pizzeria', leadId, sourceColId, targetColId } = req.body;
  const columns = getOrCreateKanban(tenantId);

  const sourceCol = columns.find((c: any) => c.id === sourceColId);
  const targetCol = columns.find((c: any) => c.id === targetColId);

  if (!sourceCol || !targetCol) return res.status(404).json({ success: false, error: 'Columna no encontrada' });

  const leadIndex = sourceCol.leads.findIndex((l: any) => l.id === leadId);
  if (leadIndex === -1) return res.status(404).json({ success: false, error: 'Lead no encontrado' });

  const [movedLead] = sourceCol.leads.splice(leadIndex, 1);
  targetCol.leads.unshift(movedLead);

  // Real-time socket broadcast
  socketService.emitToTenant(tenantId, 'kanban_updated', columns);

  return res.json({
    success: true,
    message: `Oportunidad movida a ${targetCol.name}`,
    columns,
    autoTriggerText: targetCol.autoTemplateText?.replace('{{nombre}}', movedLead.contactName),
  });
});

// POST /api/kanban/leads (Manual opportunity creation)
kanbanRouter.post('/leads', (req: Request, res: Response) => {
  const { tenantId = 'tenant_demo_pizzeria', columnId = 'col_1', contactName, phone, value, items, chatId } = req.body;

  const columns = processIncomingKanbanMessage(
    tenantId,
    contactName,
    phone,
    chatId || phone,
    items || 'Consulta Comercial WhatsApp'
  );

  return res.json({ success: true, columns });
});

// POST /api/kanban/process-message (Internal endpoint for webhooks/sockets)
kanbanRouter.post('/process-message', (req: Request, res: Response) => {
  const { tenantId = 'tenant_demo_pizzeria', contactName, phone, chatId, messageContent } = req.body;

  const columns = processIncomingKanbanMessage(
    tenantId,
    contactName,
    phone,
    chatId || phone,
    messageContent
  );

  return res.json({ success: true, columns });
});
