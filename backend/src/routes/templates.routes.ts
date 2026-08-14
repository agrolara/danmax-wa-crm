import { Router, Request, Response } from 'express';
import { PersistentStore, getTenantIdFromReq } from '../services/storage.service';

export const templatesRouter = Router();

interface TemplateItem {
  id: string;
  tenantId: string | null;
  isGlobal: boolean;
  title: string;
  category: string;
  headerType: string;
  headerContent: string | null;
  content: string;
  footer: string | null;
  variables: string[];
  mediaUrl: string | null;
  createdAt: string;
}

interface TemplatesStore {
  categories: string[];
  templates: TemplateItem[];
}

const DEFAULT_CATEGORIES = ['General', 'Ventas', 'Promociones', 'Operaciones', 'Atención al Cliente'];

// Persistent Isolated Storage Engine for Templates per Client / Tenant
function loadTemplatesStore(tenantId: string): TemplatesStore {
  const cleanTenant = tenantId || 'tenant_demo_pizzeria';
  const allStores = PersistentStore.readJSON<Record<string, TemplatesStore>>('templates_db.json', {});

  if (!allStores[cleanTenant]) {
    allStores[cleanTenant] = {
      categories: [...DEFAULT_CATEGORIES],
      templates: [],
    };
    PersistentStore.writeJSON('templates_db.json', allStores);
  }

  // Ensure default categories exist
  for (const cat of DEFAULT_CATEGORIES) {
    if (!allStores[cleanTenant].categories.includes(cat)) {
      allStores[cleanTenant].categories.push(cat);
    }
  }

  return allStores[cleanTenant];
}

function saveTemplatesStore(tenantId: string, storeData: TemplatesStore) {
  const cleanTenant = tenantId || 'tenant_demo_pizzeria';
  const allStores = PersistentStore.readJSON<Record<string, TemplatesStore>>('templates_db.json', {});
  allStores[cleanTenant] = storeData;
  PersistentStore.writeJSON('templates_db.json', allStores);
}

// GET /api/templates (Strictly isolated by client/tenant)
templatesRouter.get('/', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const store = loadTemplatesStore(tenantId);

  return res.json({
    success: true,
    tenantId,
    templates: store.templates || [],
    categories: Array.from(new Set(store.categories)),
  });
});

// POST /api/templates (Create Rich Multi-Media Template strictly owned by this client)
templatesRouter.post('/', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const { title, category, headerType, headerContent, content, footer, isGlobal, mediaUrl } = req.body;
  const store = loadTemplatesStore(tenantId);

  const varMatches = content?.match(/\{\{([^}]+)\}\}/g) || [];
  const variables = varMatches.map((v: string) => v.replace(/[\{\}]/g, '').trim());

  const newTmpl: TemplateItem = {
    id: `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    tenantId: isGlobal ? 'global' : tenantId,
    isGlobal: !!isGlobal,
    title: title || 'Plantilla sin título',
    category: category || 'General',
    headerType: headerType || 'TEXT',
    headerContent: headerContent || null,
    content: content || '',
    footer: footer || null,
    variables,
    mediaUrl: mediaUrl || null,
    createdAt: new Date().toISOString(),
  };

  store.templates.unshift(newTmpl);
  if (category && !store.categories.includes(category)) {
    store.categories.push(category);
  }

  saveTemplatesStore(tenantId, store);

  return res.json({
    success: true,
    message: `Plantilla "${newTmpl.title}" creada y guardada exclusivamente para tu cuenta de forma 100% permanente.`,
    template: newTmpl,
    templates: store.templates,
    categories: Array.from(new Set(store.categories)),
  });
});

// DELETE /api/templates/:id (Delete template owned by this client)
templatesRouter.delete('/:id', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const { id } = req.params;
  const store = loadTemplatesStore(tenantId);

  const idx = store.templates.findIndex((t) => t.id === id);
  if (idx !== -1) {
    const [deleted] = store.templates.splice(idx, 1);
    saveTemplatesStore(tenantId, store);
    return res.json({
      success: true,
      message: `Plantilla "${deleted.title}" eliminada de tu cuenta`,
      templates: store.templates,
    });
  }

  return res.status(404).json({ success: false, error: 'Plantilla no encontrada en tu cuenta' });
});
