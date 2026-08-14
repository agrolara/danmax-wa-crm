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

// Persistent Auto-Merging Storage Engine for Templates
function loadTemplatesStore(tenantId: string = GLOBAL_KEY): TemplatesStore {
  const allStores = PersistentStore.readJSON<Record<string, TemplatesStore>>('templates_db.json', {});

  const mergedCategoriesSet = new Set<string>(DEFAULT_CATEGORIES);
  const mergedTemplatesMap = new Map<string, TemplateItem>();

  for (const storeKey of Object.keys(allStores)) {
    const s = allStores[storeKey];
    if (s && Array.isArray(s.categories)) {
      s.categories.forEach((c) => {
        if (c && typeof c === 'string' && c.trim()) mergedCategoriesSet.add(c.trim());
      });
    }
    if (s && Array.isArray(s.templates)) {
      s.templates.forEach((tmpl) => {
        if (tmpl && tmpl.id) {
          mergedTemplatesMap.set(tmpl.id, tmpl);
        }
      });
    }
  }

  const mergedTemplates = Array.from(mergedTemplatesMap.values());
  const mergedCategories = Array.from(mergedCategoriesSet);

  const resultStore: TemplatesStore = {
    categories: mergedCategories,
    templates: mergedTemplates,
  };

  const key = tenantId && tenantId !== 'undefined' ? tenantId : GLOBAL_KEY;
  allStores[key] = resultStore;
  allStores[GLOBAL_KEY] = resultStore;
  allStores['tenant_demo_pizzeria'] = resultStore;

  PersistentStore.writeJSON('templates_db.json', allStores);

  return resultStore;
}

function saveTemplatesStore(tenantId: string = GLOBAL_KEY, storeData: TemplatesStore) {
  const allStores = PersistentStore.readJSON<Record<string, TemplatesStore>>('templates_db.json', {});

  const key = tenantId && tenantId !== 'undefined' ? tenantId : GLOBAL_KEY;
  allStores[key] = storeData;
  allStores[GLOBAL_KEY] = storeData;
  allStores['tenant_demo_pizzeria'] = storeData;

  PersistentStore.writeJSON('templates_db.json', allStores);
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
