import { Router, Request, Response } from 'express';

export const mediaRouter = Router();

let mediaDb: any[] = [
  {
    id: 'media_01',
    tenantId: 'tenant_demo_pizzeria',
    title: '📄 Catálogo de Pizzas & Promociones PDF',
    type: 'PDF',
    fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    sizeBytes: 1240000,
  },
  {
    id: 'media_02',
    tenantId: 'tenant_demo_pizzeria',
    title: '🖼️ Imagen Promocional Pizza Pepperoni',
    type: 'IMAGE',
    fileUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800',
    sizeBytes: 850000,
  },
  {
    id: 'media_03',
    tenantId: 'tenant_demo_pizzeria',
    title: '🎵 Saludo de Bienvenida Voz Pregrabada',
    type: 'AUDIO',
    fileUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    sizeBytes: 450000,
  },
];

// GET /api/media
mediaRouter.get('/', (req: Request, res: Response) => {
  const tenantId = (req.query.tenantId as string) || 'tenant_demo_pizzeria';
  const items = mediaDb.filter((m) => m.tenantId === tenantId);
  return res.json({ success: true, media: items });
});
