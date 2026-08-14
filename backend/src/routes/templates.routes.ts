import { Router, Request, Response } from 'express';
import { PersistentStore } from '../services/storage.service';

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
const GLOBAL_KEY = 'global_whatsapp_line';

// Persistent In-Memory + Disk Storage Engine for Templates
let inMemoryTemplatesStore: Record<string, TemplatesStore> = {};

function loadTemplatesStore(tenantId: string = GLOBAL_KEY): TemplatesStore {
  const key = tenantId && tenantId !== 'undefined' ? tenantId : GLOBAL_KEY;

  if (!inMemoryTemplatesStore[key]) {
    const diskStores = PersistentStore.readJSON<Record<string, TemplatesStore>>('templates_db.json', {});
    if (diskStores[key] && Array.isArray(diskStores[key].templates)) {
      inMemoryTemplatesStore[key] = diskStores[key];
    } else if (diskStores[GLOBAL_KEY] && Array.isArray(diskStores[GLOBAL_KEY].templates)) {
      inMemoryTemplatesStore[key] = diskStores[GLOBAL_KEY];
    } else {
      inMemoryTemplatesStore[key] = {
        categories: [...DEFAULT_CATEGORIES],
        templates: [],
      };
    }
  }

  // Ensure default categories exist
  for (const cat of DEFAULT_CATEGORIES) {
    if (!inMemoryTemplatesStore[key].categories.includes(cat)) {
      inMemoryTemplatesStore[key].categories.push(cat);
    }
  }

  return inMemoryTemplatesStore[key];
}

function saveTemplatesStore(tenantId: string = GLOBAL_KEY, storeData: TemplatesStore) {
  const key = tenantId && tenantId !== 'undefined' ? tenantId : GLOBAL_KEY;
  inMemoryTemplatesStore[key] = storeData;
  inMemoryTemplatesStore[GLOBAL_KEY] = storeData;

  const diskStores = PersistentStore.readJSON<Record<string, TemplatesStore>>('templates_db.json', {});
  diskStores[key] = storeData;
  diskStores[GLOBAL_KEY] = storeData;
  diskStores['tenant_demo_pizzeria'] = storeData;

  PersistentStore.writeJSON('templates_db.json', diskStores);
}

// GET /api/templates
templatesRouter.get('/', (req: Request, res: Response) => {
  const tenantId = (req.query.tenantId as string) || GLOBAL_KEY;
  const store = loadTemplatesStore(tenantId);

  return res.json({
    success: true,
    templates: store.templates || [],
    categories: Array.from(new Set(store.categories)),
  });
});

// POST /api/templates (Create Rich Multi-Media Template)
templatesRouter.post('/', (req: Request, res: Response) => {
  const { title, category, headerType, headerContent, content, footer, isGlobal, tenantId = GLOBAL_KEY, mediaUrl } = req.body;
  const store = loadTemplatesStore(tenantId);

  const varMatches = content?.match(/\{\{([^}]+)\}\}/g) || [];
  const variables = varMatches.map((v: string) => v.replace(/[\{\}]/g, '').trim());

  const newTmpl: TemplateItem = {
    id: `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    tenantId: isGlobal ? null : tenantId,
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
    message: `Plantilla "${newTmpl.title}" guardada exitosamente de forma 100% permanente.`,
    template: newTmpl,
    templates: store.templates,
    categories: Array.from(new Set(store.categories)),
  });
});

// DELETE /api/templates/:id
templatesRouter.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const tenantId = (req.query.tenantId as string) || GLOBAL_KEY;
  const store = loadTemplatesStore(tenantId);

  const idx = store.templates.findIndex((t) => t.id === id);
  if (idx !== -1) {
    const [deleted] = store.templates.splice(idx, 1);
    saveTemplatesStore(tenantId, store);
    return res.json({
      success: true,
      message: `Plantilla "${deleted.title}" eliminada`,
      templates: store.templates,
    });
  }

  return res.status(404).json({ success: false, error: 'Plantilla no encontrada' });
});
