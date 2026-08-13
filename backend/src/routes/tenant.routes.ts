import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { OpenWAService } from '../services/openwa.service';
import { socketService } from '../services/socket.service';
import { ENV } from '../config/env';

export const tenantRouter = Router();

const tenantSessions: Record<string, any> = {
  tenant_demo_pizzeria: {
    tenantId: 'tenant_demo_pizzeria',
    name: 'Pizzeria Don Luigi',
    whatsappPhone: '+56987654321',
    status: 'DISCONNECTED',
    openwaSessionId: 'tenant_demo_pizzeria',
    openwaOperatorKey: 'op_key_pizzeria_abc123',
  },
};

function updateEnvFile(key: string, value: string) {
  const envPath = path.join(__dirname, '../../.env');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, `${key}="${value}"`);
  } else {
    envContent += `\n${key}="${value}"`;
  }

  fs.writeFileSync(envPath, envContent, 'utf8');
}

// GET /api/tenant/openwa-config
tenantRouter.get('/openwa-config', async (req: Request, res: Response) => {
  const isConnected = ENV.OPENWA_ADMIN_KEY
    ? (await OpenWAService.testConnection()).success
    : false;

  return res.json({
    success: true,
    config: {
      openwaApiUrl: ENV.OPENWA_API_URL,
      hasAdminKey: !!ENV.OPENWA_ADMIN_KEY,
      isConnected,
      openwaAdminKeyMasked: ENV.OPENWA_ADMIN_KEY ? '••••••••' + ENV.OPENWA_ADMIN_KEY.slice(-4) : '',
      webhookPublicUrl: ENV.WEBHOOK_PUBLIC_URL,
    },
  });
});

// POST /api/tenant/config-openwa (Do not overwrite if key is empty)
tenantRouter.post('/config-openwa', async (req: Request, res: Response) => {
  const { apiUrl, adminKey } = req.body;

  if (apiUrl) {
    ENV.OPENWA_API_URL = apiUrl;
    process.env.OPENWA_API_URL = apiUrl;
    updateEnvFile('OPENWA_API_URL', apiUrl);
  }

  // Only update adminKey if provided and not masked bullets
  if (adminKey && !adminKey.includes('•')) {
    ENV.OPENWA_ADMIN_KEY = adminKey;
    process.env.OPENWA_ADMIN_KEY = adminKey;
    updateEnvFile('OPENWA_ADMIN_KEY', adminKey);
  }

  const testResult = await OpenWAService.testConnection(ENV.OPENWA_API_URL, ENV.OPENWA_ADMIN_KEY);

  return res.json({
    success: testResult.success,
    message: testResult.message,
    testResult,
    config: {
      openwaApiUrl: ENV.OPENWA_API_URL,
      hasAdminKey: !!ENV.OPENWA_ADMIN_KEY,
      isConnected: testResult.success,
    },
  });
});

// GET /api/tenant/my-session
tenantRouter.get('/my-session', async (req: Request, res: Response) => {
  const tenantId = (req.query.tenantId as string) || 'tenant_demo_pizzeria';
  const session = tenantSessions[tenantId] || {
    tenantId,
    name: 'Mi Negocio',
    status: 'DISCONNECTED',
    openwaSessionId: `tenant_${tenantId}`,
  };

  if (ENV.OPENWA_ADMIN_KEY) {
    // Check if session exists in OpenWA
    const sessionName = 'pizzeria-crm-tenant';
    try {
      const list = await OpenWAService.findOrCreateSession(sessionName);
      if (list && (list.status === 'ready' || list.status === 'CONNECTED')) {
        session.status = 'READY';
        session.whatsappPhone = list.phone || list.pushName || '+56987654321';
      }
    } catch (e) {}
  }

  return res.json({ success: true, session });
});

// POST /api/tenant/connect-whatsapp
tenantRouter.post('/connect-whatsapp', async (req: Request, res: Response) => {
  const { tenantId } = req.body;
  const targetTenantId = tenantId || 'tenant_demo_pizzeria';
  const sessionName = 'pizzeria-crm-tenant';

  if (!ENV.OPENWA_ADMIN_KEY) {
    return res.status(400).json({
      success: false,
      error: 'Se requiere guardar tu OPENWA_ADMIN_KEY en el panel superior antes de generar un código QR real.',
    });
  }

  tenantSessions[targetTenantId] = {
    ...tenantSessions[targetTenantId],
    status: 'STARTING',
    openwaSessionId: sessionName,
  };

  const openwaResult = await OpenWAService.startSession(sessionName);

  if (!openwaResult.success) {
    return res.status(500).json({
      success: false,
      error: openwaResult.error || 'Error al iniciar sesión en OpenWA',
    });
  }

  if (openwaResult.status === 'READY') {
    tenantSessions[targetTenantId].status = 'READY';
    tenantSessions[targetTenantId].whatsappPhone = openwaResult.me || '+56987654321';

    socketService.emitToTenant(targetTenantId, 'whatsapp_status', {
      status: 'READY',
      whatsappPhone: tenantSessions[targetTenantId].whatsappPhone,
      message: openwaResult.message,
    });

    return res.json({
      success: true,
      message: openwaResult.message,
      sessionStatus: 'READY',
      whatsappPhone: tenantSessions[targetTenantId].whatsappPhone,
    });
  }

  const qrUrl = openwaResult.qrCode;
  tenantSessions[targetTenantId].status = 'SCAN_QR';

  socketService.emitToTenant(targetTenantId, 'whatsapp_qr', {
    status: 'SCAN_QR',
    qrCodeUrl: qrUrl,
    sessionId: sessionName,
  });

  return res.json({
    success: true,
    message: 'Proceso de vinculación de WhatsApp iniciado con OpenWA',
    sessionStatus: 'SCAN_QR',
    qrCodeUrl: qrUrl,
    sessionId: sessionName,
    openwaResult,
  });
});

// POST /api/tenant/disconnect-whatsapp
tenantRouter.post('/disconnect-whatsapp', async (req: Request, res: Response) => {
  const { tenantId } = req.body;
  const targetTenantId = tenantId || 'tenant_demo_pizzeria';
  const sessionName = 'pizzeria-crm-tenant';

  await OpenWAService.stopSession(sessionName);

  tenantSessions[targetTenantId] = {
    ...tenantSessions[targetTenantId],
    status: 'DISCONNECTED',
    whatsappPhone: null,
  };

  socketService.emitToTenant(targetTenantId, 'whatsapp_status', {
    status: 'DISCONNECTED',
    message: 'Sesión de WhatsApp desconectada.',
  });

  return res.json({ success: true, message: 'Sesión cerrada exitosamente en OpenWA' });
});

// POST /api/tenant/simulate-ready
tenantRouter.post('/simulate-ready', (req: Request, res: Response) => {
  const { tenantId, phone } = req.body;
  const targetTenantId = tenantId || 'tenant_demo_pizzeria';

  tenantSessions[targetTenantId] = {
    ...tenantSessions[targetTenantId],
    status: 'READY',
    whatsappPhone: phone || '+56987654321',
    openwaOperatorKey: `op_key_${targetTenantId}_real`,
  };

  socketService.emitToTenant(targetTenantId, 'whatsapp_status', {
    status: 'READY',
    whatsappPhone: tenantSessions[targetTenantId].whatsappPhone,
    message: '¡WhatsApp vinculado exitosamente con OpenWA Engine!',
  });

  return res.json({
    success: true,
    session: tenantSessions[targetTenantId],
  });
});
