import { Router, Request, Response } from 'express';

export const templatesRouter = Router();

export let categoriesDb: string[] = ['General', 'Ventas', 'Promociones', 'Operaciones', 'Atención al Cliente'];

export let templatesDb: any[] = [
  {
    id: 'tmpl_rich_01',
    tenantId: 'tenant_demo_pizzeria',
    isGlobal: false,
    title: '🍕 Promo Combo Pizzería con PDF Catálogo',
    category: 'Promociones',
    headerType: 'IMAGE', // IMAGE, VIDEO, DOCUMENT, TEXT
    headerContent: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800',
    content: '¡Hola {{nombre}}! Disfruta de nuestro combo familiar con 2 Pizzas Medianas + Bebida 1.5L. Adjuntamos nuestro catálogo oficial en PDF.',
    footer: 'Pizzería Don Luigi • Pide al +56986176136',
    variables: ['nombre'],
    mediaUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tmpl_rich_02',
    tenantId: null,
    isGlobal: true,
    title: '🎬 Lanzamiento de Producto & Video',
    category: 'Ventas',
    headerType: 'VIDEO',
    headerContent: 'https://www.w3schools.com/html/mov_bbb.mp4',
    content: '¡Estimado cliente! Te invitamos a conocer el nuevo servicio de automatizaciones WhatsApp de DanMax WA.',
    footer: 'DanMax WA • Plataforma SaaS Marca Blanca',
    variables: [],
    mediaUrl: null,
    createdAt: new Date().toISOString(),
  },
];

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
