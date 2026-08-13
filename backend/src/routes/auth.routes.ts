import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { OpenWAService } from '../services/openwa.service';

export const authRouter = Router();

// Storage for Tenants & Users
export let tenantsDb: any[] = [
  {
    id: 'tenant_demo_pizzeria',
    name: 'Pizzeria Don Luigi',
    slug: 'pizzeria-crm-tenant',
    openwaOperatorKey: 'op_key_pizzeria_abc123',
    status: 'APPROVED',
    createdAt: new Date().toISOString(),
  },
];

export let usersDb: any[] = [
  {
    id: 'user_admin_001',
    email: 'mateiales.integrity@gmail.com',
    passwordHash: bcrypt.hashSync('Agro1280@', 10),
    fullName: 'Super Admin DanMax WA',
    role: 'SUPER_ADMIN',
    tenantId: null,
  },
  {
    id: 'user_admin_002',
    email: 'materiales.integrity@gmail.com',
    passwordHash: bcrypt.hashSync('Agro1280@', 10),
    fullName: 'Super Admin DanMax WA',
    role: 'SUPER_ADMIN',
    tenantId: null,
  },
  {
    id: 'user_tenant_001',
    email: 'demo@pizzeria.com',
    passwordHash: bcrypt.hashSync('demo123', 10),
    fullName: 'Juan Vendedor',
    role: 'TENANT_ADMIN',
    tenantId: 'tenant_demo_pizzeria',
  },
];

// POST /api/auth/register-tenant (Public registration from DanMax WA Landing Page)
authRouter.post('/register-tenant', async (req: Request, res: Response) => {
  const { businessName, email, password, fullName } = req.body;

  if (!businessName || !email || !password) {
    return res.status(400).json({ success: false, error: 'Todos los campos son obligatorios' });
  }

  const existingUser = usersDb.find((u) => u.email === email);
  if (existingUser) {
    return res.status(400).json({ success: false, error: 'El correo electrónico ya está registrado' });
  }

  const slug = `tenant-${businessName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`;
  const tenantId = `tenant_${Date.now()}`;

  const newTenant = {
    id: tenantId,
    name: businessName,
    slug,
    openwaOperatorKey: `op_key_${tenantId}`,
    status: 'PENDING_APPROVAL',
    createdAt: new Date().toISOString(),
  };
  tenantsDb.push(newTenant);

  const newUser = {
    id: `user_${Date.now()}`,
    tenantId,
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    fullName: fullName || businessName,
    role: 'TENANT_ADMIN',
    createdAt: new Date().toISOString(),
  };
  usersDb.push(newUser);

  return res.json({
    success: true,
    message: '¡Registro recibido con éxito! Tu cuenta está en revisión por el Super Administrador de DanMax WA.',
    status: 'PENDING_APPROVAL',
    tenant: newTenant,
  });
});

// SUPER ADMIN ROUTES: List & Manage Tenants
authRouter.get('/admin/tenants', (req: Request, res: Response) => {
  const tenantsWithUsers = tenantsDb.map((t) => {
    const owner = usersDb.find((u) => u.tenantId === t.id && u.role === 'TENANT_ADMIN');
    return {
      ...t,
      ownerEmail: owner?.email || 'N/A',
      ownerName: owner?.fullName || 'N/A',
    };
  });
  return res.json({ success: true, tenants: tenantsWithUsers });
});

// POST /api/auth/admin/approve-tenant
authRouter.post('/admin/approve-tenant', async (req: Request, res: Response) => {
  const { tenantId } = req.body;
  const tenant = tenantsDb.find((t) => t.id === tenantId);

  if (!tenant) {
    return res.status(404).json({ success: false, error: 'Tenant no encontrado' });
  }

  tenant.status = 'APPROVED';

  if (ENV.OPENWA_ADMIN_KEY) {
    try {
      await OpenWAService.findOrCreateSession(tenant.slug);
    } catch (e) {
      console.warn(`[OpenWA Auto-Provision Warning]: ${e}`);
    }
  }

  return res.json({
    success: true,
    message: `¡Negocio "${tenant.name}" aprobado exitosamente! Sesión de WhatsApp aprovisionada.`,
    tenant,
  });
});

// POST /api/auth/admin/reject-tenant
authRouter.post('/admin/reject-tenant', (req: Request, res: Response) => {
  const { tenantId } = req.body;
  const tenant = tenantsDb.find((t) => t.id === tenantId);

  if (tenant) {
    tenant.status = 'REJECTED';
  }

  return res.json({ success: true, message: 'Acceso rechazado/suspendido' });
});

// POST /api/auth/login
authRouter.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = usersDb.find((u) => u.email?.toLowerCase() === email?.toLowerCase());

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
  }

  const tenant = tenantsDb.find((t) => t.id === user.tenantId);

  if (user.role !== 'SUPER_ADMIN' && tenant && tenant.status !== 'APPROVED') {
    return res.status(403).json({
      success: false,
      error: `Tu cuenta se encuentra en estado "${tenant.status === 'PENDING_APPROVAL' ? 'Pendiente de Aprobación' : 'Suspendida'}". Contacta al Administrador de DanMax WA.`,
    });
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      fullName: user.fullName,
      businessName: tenant?.name || 'DanMax WA Owner',
      slug: tenant?.slug || 'default',
    },
    ENV.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return res.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      tenantId: user.tenantId,
      businessName: tenant?.name || 'DanMax WA Owner',
      slug: tenant?.slug || 'default',
    },
  });
});

// GET /api/auth/me
authRouter.get('/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No autorizado' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded: any = jwt.verify(token, ENV.JWT_SECRET);
    return res.json({ success: true, user: decoded });
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Token inválido o expirado' });
  }
});
