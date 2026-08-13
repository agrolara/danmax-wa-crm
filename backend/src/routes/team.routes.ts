import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { usersDb } from './auth.routes';

export const teamRouter = Router();

// GET /api/team
teamRouter.get('/', (req: Request, res: Response) => {
  const tenantId = (req.query.tenantId as string) || 'tenant_demo_pizzeria';
  const teamMembers = usersDb.filter((u) => u.tenantId === tenantId);
  return res.json({ success: true, team: teamMembers });
});

// POST /api/team (Create new sales agent for tenant)
teamRouter.post('/', (req: Request, res: Response) => {
  const { fullName, email, role, tenantId } = req.body;
  const targetTenantId = tenantId || 'tenant_demo_pizzeria';

  const newAgent = {
    id: `agent_${Date.now()}`,
    tenantId: targetTenantId,
    fullName,
    email,
    passwordHash: bcrypt.hashSync('vendedor123', 10),
    role: role || 'AGENT',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    createdAt: new Date().toISOString(),
  };

  usersDb.push(newAgent);

  return res.json({
    success: true,
    message: 'Agente de ventas creado exitosamente',
    agent: newAgent,
  });
});
