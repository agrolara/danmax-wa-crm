import { Router, Request, Response } from 'express';
import { socketService } from '../services/socket.service';
import { PersistentStore } from '../services/storage.service';

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

const DEFAULT_KANBAN: KanbanColumn[] = [
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
];

// Persistent storage for Kanban board
export function getOrCreateKanban(tenantId: string = 'tenant_demo_pizzeria'): KanbanColumn[] {
  const allStores = PersistentStore.readJSON<Record<string, KanbanColumn[]>>('kanban_store.json', {});
  if (!allStores[tenantId]) {
    allStores[tenantId] = JSON.parse(JSON.stringify(DEFAULT_KANBAN));
    PersistentStore.writeJSON('kanban_store.json', allStores);
  }
  return allStores[tenantId];
}

export function saveKanban(tenantId: string = 'tenant_demo_pizzeria', columns: KanbanColumn[]): void {
  const allStores = PersistentStore.readJSON<Record<string, KanbanColumn[]>>('kanban_store.json', {});
  allStores[tenantId] = columns;
  PersistentStore.writeJSON('kanban_store.json', allStores);
}

// GET /api/kanban
kanbanRouter.get('/', (req: Request, res: Response) => {
  const tenantId = (req.query.tenantId as string) || 'tenant_demo_pizzeria';
  const columns = getOrCreateKanban(tenantId);
  return res.json({ success: true, columns });
});

// POST /api/kanban/clear (Vaciar Embudo Kanban a 0 tarjetas)
kanbanRouter.post('/clear', (req: Request, res: Response) => {
  const { tenantId = 'tenant_demo_pizzeria' } = req.body;
  const columns = JSON.parse(JSON.stringify(DEFAULT_KANBAN));
  saveKanban(tenantId, columns);
  socketService.emitToTenant(tenantId, 'kanban_updated', columns);
  return res.json({ success: true, message: 'Embudo Kanban vaciado completamente', columns });
});

// POST /api/kanban/add-from-chat (Manual addition of a customer from Chat Inbox)
kanbanRouter.post('/add-from-chat', (req: Request, res: Response) => {
  const { tenantId = 'tenant_demo_pizzeria', chatId, contactName, phone, columnId = 'col_1', notes, value } = req.body;
  const columns = getOrCreateKanban(tenantId);
  const identifier = chatId || phone;

  // Check if lead already exists in any column
  let existingLead: KanbanLead | null = null;
  for (const col of columns) {
    const found = col.leads.find((l) => l.chatId === identifier || l.id === identifier || l.phone === phone);
    if (found) {
      existingLead = found;
      break;
    }
  }

  if (existingLead) {
    if (notes) existingLead.items = notes;
    if (value) existingLead.value = value;
  } else {
    const targetCol = columns.find((c) => c.id === columnId) || columns[0];
    const newLead: KanbanLead = {
      id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      chatId: identifier,
      contactName: contactName || `Cliente ${identifier.replace(/@.*/, '')}`,
      phone: phone || identifier,
      value: value || '$50.000',
      items: notes || 'Oportunidad agregada desde la Bandeja Multi-Agente',
      createdAt: new Date().toISOString().split('T')[0],
    };
    targetCol.leads.unshift(newLead);
  }

  saveKanban(tenantId, columns);
  socketService.emitToTenant(tenantId, 'kanban_updated', columns);
  return res.json({ success: true, message: `Oportunidad "${contactName}" agregada al Embudo Kanban`, columns });
});

// POST /api/kanban/bulk-add (Bulk add selected contacts from Chat Inbox)
kanbanRouter.post('/bulk-add', (req: Request, res: Response) => {
  const { tenantId = 'tenant_demo_pizzeria', contacts, columnId = 'col_1' } = req.body;
  if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ success: false, error: 'Debes enviar al menos un contacto' });
  }

  const columns = getOrCreateKanban(tenantId);
  const targetCol = columns.find((c) => c.id === columnId) || columns[0];
  let addedCount = 0;

  for (const c of contacts) {
    const identifier = c.chatId || c.id || c.phone;
    const exists = columns.some((col) => col.leads.some((l) => l.chatId === identifier || l.id === identifier || l.phone === c.phone));

    if (!exists) {
      const newLead: KanbanLead = {
        id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        chatId: identifier,
        contactName: c.contactName || `Cliente ${identifier.replace(/@.*/, '')}`,
        phone: c.phone || identifier,
        value: '$50.000',
        items: c.lastMessageText || 'Agregado desde Selección Masiva de la Bandeja',
        createdAt: new Date().toISOString().split('T')[0],
      };
      targetCol.leads.unshift(newLead);
      addedCount++;
    }
  }

  saveKanban(tenantId, columns);
  socketService.emitToTenant(tenantId, 'kanban_updated', columns);
  return res.json({ success: true, message: `¡${addedCount} contactos agregados exitosamente al Embudo Kanban!`, columns });
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

  saveKanban(tenantId, columns);
  socketService.emitToTenant(tenantId, 'kanban_updated', columns);

  return res.json({
    success: true,
    message: `Oportunidad movida a ${targetCol.name}`,
    columns,
    autoTriggerText: targetCol.autoTemplateText?.replace('{{nombre}}', movedLead.contactName),
  });
});

// DELETE /api/kanban/lead/:id (Delete individual card from Kanban)
kanbanRouter.delete('/lead/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const tenantId = (req.query.tenantId as string) || 'tenant_demo_pizzeria';
  const columns = getOrCreateKanban(tenantId);

  for (const col of columns) {
    const idx = col.leads.findIndex((l) => l.id === id);
    if (idx !== -1) {
      col.leads.splice(idx, 1);
      break;
    }
  }

  saveKanban(tenantId, columns);
  socketService.emitToTenant(tenantId, 'kanban_updated', columns);
  return res.json({ success: true, message: 'Oportunidad eliminada del Embudo', columns });
});

// POST /api/kanban/leads (Manual creation endpoint)
kanbanRouter.post('/leads', (req: Request, res: Response) => {
  const { tenantId = 'tenant_demo_pizzeria', columnId = 'col_1', contactName, phone, value, items, chatId } = req.body;
  const columns = getOrCreateKanban(tenantId);

  const identifier = chatId || phone || `lead_${Date.now()}`;
  const targetCol = columns.find((c) => c.id === columnId) || columns[0];

  const newLead: KanbanLead = {
    id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    chatId: identifier,
    contactName: contactName || 'Nuevo Cliente',
    phone: phone || identifier,
    value: value || '$50.000',
    items: items || 'Creado manualmente',
    createdAt: new Date().toISOString().split('T')[0],
  };

  targetCol.leads.unshift(newLead);
  saveKanban(tenantId, columns);
  socketService.emitToTenant(tenantId, 'kanban_updated', columns);

  return res.json({ success: true, columns, lead: newLead });
});
