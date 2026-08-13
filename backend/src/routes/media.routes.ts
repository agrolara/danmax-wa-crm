import { Router, Request, Response } from 'express';

export const mediaRouter = Router();

// Clean 0 media items (starts completely empty)
let mediaDb: any[] = [];

// GET /api/media
mediaRouter.get('/', (req: Request, res: Response) => {
  const tenantId = (req.query.tenantId as string) || 'tenant_demo_pizzeria';
  const items = mediaDb.filter((m) => m.tenantId === tenantId);
  return res.json({ success: true, media: items });
});

// POST /api/media
mediaRouter.post('/', (req: Request, res: Response) => {
  const { title, type, fileUrl, tenantId } = req.body;
  const newMedia = {
    id: `media_${Date.now()}`,
    tenantId: tenantId || 'tenant_demo_pizzeria',
    title,
    type: type || 'IMAGE',
    fileUrl,
    createdAt: new Date().toISOString(),
  };

  mediaDb.push(newMedia);
  return res.json({ success: true, media: newMedia });
});

// DELETE /api/media/:id
mediaRouter.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = mediaDb.findIndex((m) => m.id === id);
  if (idx !== -1) {
    mediaDb.splice(idx, 1);
  }
  return res.json({ success: true, message: 'Archivo eliminado' });
});
