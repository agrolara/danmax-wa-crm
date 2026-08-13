import { Router, Request, Response } from 'express';

export const templatesRouter = Router();

export let categoriesDb: string[] = ['General', 'Ventas', 'Promociones', 'Operaciones', 'Atención al Cliente'];

// Clean 0 demo templates (starts completely empty)
export let templatesDb: any[] = [];

// GET /api/templates
templatesRouter.get('/', (req: Request, res: Response) => {
  const tenantId = (req.query.tenantId as string) || 'tenant_demo_pizzeria';
  const available = templatesDb.filter((t) => t.isGlobal || t.tenantId === tenantId);
  return res.json({ success: true, templates: available, categories: categoriesDb });
});

// POST /api/templates (Create Rich Multi-Media Template)
templatesRouter.post('/', (req: Request, res: Response) => {
  const { title, category, headerType, headerContent, content, footer, isGlobal, tenantId, mediaUrl } = req.body;

  const varMatches = content?.match(/\{\{([^}]+)\}\}/g) || [];
  const variables = varMatches.map((v: string) => v.replace(/[\{\}]/g, '').trim());

  const newTmpl = {
    id: `tmpl_${Date.now()}`,
    tenantId: isGlobal ? null : tenantId || 'tenant_demo_pizzeria',
    isGlobal: !!isGlobal,
    title,
    category: category || 'General',
    headerType: headerType || 'TEXT',
    headerContent: headerContent || null,
    content,
    footer: footer || null,
    variables,
    mediaUrl: mediaUrl || null,
    createdAt: new Date().toISOString(),
  };

  templatesDb.push(newTmpl);

  if (category && !categoriesDb.includes(category)) {
    categoriesDb.push(category);
  }

  return res.json({ success: true, template: newTmpl, categories: categoriesDb });
});

// DELETE /api/templates/:id
templatesRouter.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = templatesDb.findIndex((t) => t.id === id);
  if (idx !== -1) {
    templatesDb.splice(idx, 1);
  }
  return res.json({ success: true, message: 'Plantilla eliminada' });
});
