import { Router, Request, Response } from 'express';
import { PersistentStore } from '../services/storage.service';

export const templatesRouter = Router();

interface TemplatesStore {
  categories: string[];
  templates: any[];
}

const DEFAULT_TEMPLATES_STORE: TemplatesStore = {
  categories: ['General', 'Ventas', 'Promociones', 'Operaciones', 'Atención al Cliente'],
  templates: [],
};

function loadTemplatesStore(tenantId: string = 'tenant_demo_pizzeria'): TemplatesStore {
  const allStores = PersistentStore.readJSON<Record<string, TemplatesStore>>('templates_db.json', {});
  if (!allStores[tenantId]) {
    allStores[tenantId] = { ...DEFAULT_TEMPLATES_STORE };
  }
  return allStores[tenantId];
}

function saveTemplatesStore(tenantId: string = 'tenant_demo_pizzeria', storeData: TemplatesStore) {
  const allStores = PersistentStore.readJSON<Record<string, TemplatesStore>>('templates_db.json', {});
  allStores[tenantId] = storeData;
  PersistentStore.writeJSON('templates_db.json', allStores);
}

// GET /api/templates
templatesRouter.get('/', (req: Request, res: Response) => {
  const tenantId = (req.query.tenantId as string) || 'tenant_demo_pizzeria';
  const store = loadTemplatesStore(tenantId);

  return res.json({
    success: true,
    templates: store.templates,
    categories: store.categories,
  });
});

// POST /api/templates (Create Rich Multi-Media Template)
templatesRouter.post('/', (req: Request, res: Response) => {
  const { title, category, headerType, headerContent, content, footer, isGlobal, tenantId = 'tenant_demo_pizzeria', mediaUrl } = req.body;
  const store = loadTemplatesStore(tenantId);

  const varMatches = content?.match(/\{\{([^}]+)\}\}/g) || [];
  const variables = varMatches.map((v: string) => v.replace(/[\{\}]/g, '').trim());

  const newTmpl = {
    id: `tmpl_${Date.now()}`,
    tenantId: isGlobal ? null : tenantId,
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

  store.templates.push(newTmpl);
  if (category && !store.categories.includes(category)) {
    store.categories.push(category);
  }

  saveTemplatesStore(tenantId, store);

  return res.json({ success: true, template: newTmpl, categories: store.categories });
});

// DELETE /api/templates/:id
templatesRouter.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const tenantId = (req.query.tenantId as string) || 'tenant_demo_pizzeria';
  const store = loadTemplatesStore(tenantId);

  const idx = store.templates.findIndex((t) => t.id === id);
  if (idx !== -1) {
    store.templates.splice(idx, 1);
    saveTemplatesStore(tenantId, store);
  }

  return res.json({ success: true, message: 'Plantilla eliminada' });
});
