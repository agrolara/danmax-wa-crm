import { Router, Request, Response } from 'express';
import {
  PersistentStore,
  getTenantIdFromReq,
  normalizeTenantId,
  CANONICAL_ADMIN_TENANT,
} from '../services/storage.service';
import { socketService } from '../services/socket.service';

export const templatesRouter = Router();

export interface TemplateItem {
  id: string;
  tenantId: string | null;
  isGlobal: boolean;
  title: string;
  category: string;
  headerType: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'TEXT' | string;
  headerContent: string | null;
  content: string;
  footer: string | null;
  variables: string[];
  mediaUrl: string | null;
  createdAt: string;
}

export interface TemplatesStore {
  categories: string[];
  templates: TemplateItem[];
}

export const DEFAULT_TEMPLATE_CATEGORIES = [
  'General',
  'Ventas',
  'Promociones',
  'Operaciones',
  'Atención al Cliente',
];

/**
 * Loads the template store for a specific tenant.
 * Guarantees that admin aliases resolve to CANONICAL_ADMIN_TENANT (tenant_demo_pizzeria)
 * and distinct client tenants have isolated partitions.
 */
export function loadTemplatesStore(tenantId: string): TemplatesStore {
  const cleanTenant = normalizeTenantId(tenantId);
  const allStores = PersistentStore.readJSON<Record<string, TemplatesStore>>('templates_db.json', {});

  if (!allStores[cleanTenant]) {
    // Check if any legacy admin alias exists to migrate
    if (cleanTenant === CANONICAL_ADMIN_TENANT) {
      const legacyKeys = ['danmax_wa_owner', 'super_admin', 'global_whatsapp_line', 'pizzeria', 'default', 'admin'];
      for (const legacy of legacyKeys) {
        if (allStores[legacy] && (allStores[legacy].templates?.length > 0 || allStores[legacy].categories?.length > 0)) {
          allStores[cleanTenant] = allStores[legacy];
          break;
        }
      }
    }

    if (!allStores[cleanTenant]) {
      allStores[cleanTenant] = {
        categories: [...DEFAULT_TEMPLATE_CATEGORIES],
        templates: [],
      };
    }
    PersistentStore.writeJSON('templates_db.json', allStores);
  }

  // Defensive sanitization: ensure categories and templates arrays exist
  if (!Array.isArray(allStores[cleanTenant].categories)) {
    allStores[cleanTenant].categories = [...DEFAULT_TEMPLATE_CATEGORIES];
  }
  if (!Array.isArray(allStores[cleanTenant].templates)) {
    allStores[cleanTenant].templates = [];
  }

  // Ensure default categories are populated
  for (const cat of DEFAULT_TEMPLATE_CATEGORIES) {
    if (!allStores[cleanTenant].categories.includes(cat)) {
      allStores[cleanTenant].categories.push(cat);
    }
  }

  return allStores[cleanTenant];
}

/**
 * Atomically saves the template store for a specific tenant across all persistent disk tiers.
 */
export function saveTemplatesStore(tenantId: string, storeData: TemplatesStore): void {
  const cleanTenant = normalizeTenantId(tenantId);
  const allStores = PersistentStore.readJSON<Record<string, TemplatesStore>>('templates_db.json', {});
  allStores[cleanTenant] = {
    categories: Array.from(new Set(storeData.categories || DEFAULT_TEMPLATE_CATEGORIES)),
    templates: Array.isArray(storeData.templates) ? storeData.templates : [],
  };
  PersistentStore.writeJSON('templates_db.json', allStores);
}

// ============================================================================
// TEMPLATE ROUTES
// ============================================================================

// GET /api/templates — Retrieve all templates and categories for the normalized tenant
// Automatically merges global templates (isGlobal: true) from canonical admin if current tenant is a client
templatesRouter.get('/', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const cleanTenant = normalizeTenantId(tenantId);
  const allStores = PersistentStore.readJSON<Record<string, TemplatesStore>>('templates_db.json', {});
  const tenantStore = loadTemplatesStore(cleanTenant);

  // Merge global templates from canonical admin store if current tenant is a client
  let mergedTemplates = [...(tenantStore.templates || [])];
  if (cleanTenant !== CANONICAL_ADMIN_TENANT && allStores[CANONICAL_ADMIN_TENANT]) {
    const globalTemplates = (allStores[CANONICAL_ADMIN_TENANT].templates || []).filter((t) => t.isGlobal);
    const existingIds = new Set(mergedTemplates.map((t) => t.id));
    for (const gt of globalTemplates) {
      if (!existingIds.has(gt.id)) {
        mergedTemplates.push(gt);
      }
    }
  }

  return res.json({
    success: true,
    tenantId: cleanTenant,
    templates: mergedTemplates,
    categories: Array.from(new Set(tenantStore.categories)),
    total: mergedTemplates.length,
  });
});

// GET /api/templates/categories — Retrieve categories list only for the normalized tenant
templatesRouter.get('/categories', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const store = loadTemplatesStore(tenantId);

  return res.json({
    success: true,
    tenantId,
    categories: Array.from(new Set(store.categories)),
    total: store.categories.length,
  });
});

// POST /api/templates/categories — Create a new template category for the normalized tenant
templatesRouter.post('/categories', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const { categoryName, name } = req.body;
  const targetCategory = (categoryName || name)?.trim();

  if (!targetCategory) {
    return res.status(400).json({ success: false, error: 'categoryName es requerido' });
  }

  const store = loadTemplatesStore(tenantId);
  if (!store.categories.includes(targetCategory)) {
    store.categories.push(targetCategory);
    saveTemplatesStore(tenantId, store);
    socketService.emitToTenant(tenantId, 'templates_updated', store);
  }

  return res.json({
    success: true,
    tenantId,
    categories: Array.from(new Set(store.categories)),
    message: `Categoría "${targetCategory}" creada y guardada exclusivamente para tu cuenta`,
  });
});

// DELETE /api/templates/categories/:name — Delete template category by URL param
templatesRouter.delete('/categories/:name', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const categoryName = decodeURIComponent(req.params.name || '').trim();
  const store = loadTemplatesStore(tenantId);

  if (categoryName && store.categories.includes(categoryName)) {
    store.categories = store.categories.filter((c) => c !== categoryName);
    saveTemplatesStore(tenantId, store);
    socketService.emitToTenant(tenantId, 'templates_updated', store);
    return res.json({
      success: true,
      tenantId,
      categories: Array.from(new Set(store.categories)),
      message: `Categoría "${categoryName}" eliminada de tu cuenta`,
    });
  }

  return res.status(404).json({ success: false, error: 'Categoría no encontrada en tu cuenta' });
});

// DELETE /api/templates/categories — Delete template category by body or query
templatesRouter.delete('/categories', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const { categoryName, name } = req.body;
  const targetCategory = (categoryName || name || (req.query.categoryName as string) || (req.query.name as string))?.trim();
  const store = loadTemplatesStore(tenantId);

  if (targetCategory && store.categories.includes(targetCategory)) {
    store.categories = store.categories.filter((c) => c !== targetCategory);
    saveTemplatesStore(tenantId, store);
    socketService.emitToTenant(tenantId, 'templates_updated', store);
    return res.json({
      success: true,
      tenantId,
      categories: Array.from(new Set(store.categories)),
      message: `Categoría "${targetCategory}" eliminada de tu cuenta`,
    });
  }

  return res.status(404).json({ success: false, error: 'Categoría no encontrada en tu cuenta' });
});

// POST /api/templates — Create rich multimedia template for normalized tenant
templatesRouter.post('/', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const { title, category, headerType, headerContent, content, footer, isGlobal, mediaUrl } = req.body;

  if (!title?.trim() && !content?.trim()) {
    return res.status(400).json({ success: false, error: 'Título y contenido son requeridos' });
  }

  const store = loadTemplatesStore(tenantId);

  // Robust variable extractor supporting both {{var}} and {var}
  const varMatches = (content || '').match(/\{{1,2}([a-zA-Z0-9_\-]+)\}{1,2}/g) || [];
  const variables: string[] = Array.from(
    new Set<string>(varMatches.map((v: string) => v.replace(/[\{\}]/g, '').trim()).filter(Boolean))
  );

  const newTmpl: TemplateItem = {
    id: `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    tenantId: isGlobal ? 'global' : tenantId,
    isGlobal: !!isGlobal,
    title: title?.trim() || 'Plantilla sin título',
    category: category?.trim() || 'General',
    headerType: headerType || 'TEXT',
    headerContent: headerContent || null,
    content: content?.trim() || '',
    footer: footer?.trim() || null,
    variables,
    mediaUrl: mediaUrl || null,
    createdAt: new Date().toISOString(),
  };

  store.templates.unshift(newTmpl);
  if (newTmpl.category && !store.categories.includes(newTmpl.category)) {
    store.categories.push(newTmpl.category);
  }

  saveTemplatesStore(tenantId, store);
  socketService.emitToTenant(tenantId, 'templates_updated', store);

  return res.json({
    success: true,
    tenantId,
    message: `Plantilla "${newTmpl.title}" creada y guardada exclusivamente para tu cuenta de forma 100% permanente.`,
    template: newTmpl,
    templates: store.templates,
    categories: Array.from(new Set(store.categories)),
  });
});

// PUT /api/templates/:id — Update existing rich template
templatesRouter.put('/:id', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const { id } = req.params;
  const { title, category, headerType, headerContent, content, footer, isGlobal, mediaUrl } = req.body;
  const store = loadTemplatesStore(tenantId);

  const targetTmpl = store.templates.find((t) => t.id === id);
  if (!targetTmpl) {
    return res.status(404).json({ success: false, error: 'Plantilla no encontrada en tu cuenta' });
  }

  if (title !== undefined) targetTmpl.title = title.trim();
  if (headerType !== undefined) targetTmpl.headerType = headerType;
  if (headerContent !== undefined) targetTmpl.headerContent = headerContent;
  if (footer !== undefined) targetTmpl.footer = footer ? footer.trim() : null;
  if (mediaUrl !== undefined) targetTmpl.mediaUrl = mediaUrl || null;
  if (isGlobal !== undefined) {
    targetTmpl.isGlobal = !!isGlobal;
    targetTmpl.tenantId = isGlobal ? 'global' : tenantId;
  }

  if (content !== undefined) {
    targetTmpl.content = content.trim();
    const varMatches = (targetTmpl.content || '').match(/\{{1,2}([a-zA-Z0-9_\-]+)\}{1,2}/g) || [];
    targetTmpl.variables = Array.from(
      new Set<string>(varMatches.map((v: string) => v.replace(/[\{\}]/g, '').trim()).filter(Boolean))
    );
  }

  if (category !== undefined) {
    targetTmpl.category = category.trim();
    if (targetTmpl.category && !store.categories.includes(targetTmpl.category)) {
      store.categories.push(targetTmpl.category);
    }
  }

  saveTemplatesStore(tenantId, store);
  socketService.emitToTenant(tenantId, 'templates_updated', store);

  return res.json({
    success: true,
    tenantId,
    message: `Plantilla "${targetTmpl.title}" actualizada exitosamente.`,
    template: targetTmpl,
    templates: store.templates,
    categories: Array.from(new Set(store.categories)),
  });
});

// DELETE /api/templates/:id — Delete template owned by normalized tenant
templatesRouter.delete('/:id', (req: Request, res: Response) => {
  const tenantId = getTenantIdFromReq(req);
  const { id } = req.params;
  const store = loadTemplatesStore(tenantId);

  const idx = store.templates.findIndex((t) => t.id === id);
  if (idx !== -1) {
    const [deleted] = store.templates.splice(idx, 1);
    saveTemplatesStore(tenantId, store);
    socketService.emitToTenant(tenantId, 'templates_updated', store);
    return res.json({
      success: true,
      tenantId,
      message: `Plantilla "${deleted.title}" eliminada de tu cuenta`,
      templates: store.templates,
      categories: Array.from(new Set(store.categories)),
    });
  }

  return res.status(404).json({ success: false, error: 'Plantilla no encontrada en tu cuenta' });
});


