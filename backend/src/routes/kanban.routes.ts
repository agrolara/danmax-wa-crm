import { Router, Request, Response } from 'express';

export const kanbanRouter = Router();

// Clean Kanban Columns & Leads (NO dummy demo leads)
let kanbanData: any = {
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
      name: 'Venta Cerrada / Cliente',
      color: '#10b981',
      autoTemplateText: '🎉 ¡Muchas gracias por tu preferencia {{nombre}}!',
      leads: [],
    },
  ],
};

// GET /api/kanban
kanbanRouter.get('/', (req: Request, res: Response) => {
  const tenantId = (req.query.tenantId as string) || 'tenant_demo_pizzeria';
  const columns = kanbanData[tenantId] || kanbanData.tenant_demo_pizzeria;
  return res.json({ success: true, columns });
});

// POST /api/kanban/move
kanbanRouter.post('/move', (req: Request, res: Response) => {
  const { tenantId = 'tenant_demo_pizzeria', leadId, sourceColId, targetColId } = req.body;
  const columns = kanbanData[tenantId];
  if (!columns) return res.status(400).json({ success: false, error: 'Embudo no encontrado' });

  const sourceCol = columns.find((c: any) => c.id === sourceColId);
  const targetCol = columns.find((c: any) => c.id === targetColId);

  if (!sourceCol || !targetCol) return res.status(404).json({ success: false, error: 'Columna no encontrada' });

  const leadIndex = sourceCol.leads.findIndex((l: any) => l.id === leadId);
  if (leadIndex === -1) return res.status(404).json({ success: false, error: 'Lead no encontrado' });

  const [movedLead] = sourceCol.leads.splice(leadIndex, 1);
  targetCol.leads.push(movedLead);

  return res.json({
    success: true,
    message: `Lead movido a ${targetCol.name}`,
    autoTriggerText: targetCol.autoTemplateText?.replace('{{nombre}}', movedLead.contactName),
  });
});

// POST /api/kanban/leads
kanbanRouter.post('/leads', (req: Request, res: Response) => {
  const { tenantId = 'tenant_demo_pizzeria', columnId = 'col_1', contactName, phone, value, items } = req.body;
  const columns = kanbanData[tenantId];

  const targetCol = columns.find((c: any) => c.id === columnId) || columns[0];
  const newLead = {
    id: `lead_${Date.now()}`,
    contactName: contactName || 'Nuevo Cliente',
    phone: phone || '+56900000000',
    value: value || '$0',
    items: items || 'Consulta General',
    createdAt: new Date().toISOString().split('T')[0],
  };

  targetCol.leads.push(newLead);
  return res.json({ success: true, lead: newLead });
});
