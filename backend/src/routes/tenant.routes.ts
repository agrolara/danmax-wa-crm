import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { OpenWAService } from '../services/openwa.service';
import { socketService } from '../services/socket.service';
import { ENV } from '../config/env';

export const tenantRouter = Router();

export interface WhatsAppLine {
  id: string;
  name: string;
  whatsappPhone: string | null;
  status: 'DISCONNECTED' | 'STARTING' | 'SCAN_QR' | 'READY';
  qrCodeUrl?: string | null;
  openwaSessionId: string;
  createdAt: string;
}

interface TenantData {
  tenantId: string;
  name: string;
  activeLineId: string | null;
  lines: WhatsAppLine[];
}

const tenantStore: Record<string, TenantData> = {
  tenant_demo_pizzeria: {
    tenantId: 'tenant_demo_pizzeria',
    name: 'Mi Negocio DanMax WA',
    activeLineId: null,
    lines: [],
  },
};

function getOrCreateTenant(tenantId: string = 'tenant_demo_pizzeria'): TenantData {
  if (!tenantStore[tenantId]) {
    tenantStore[tenantId] = {
      tenantId,
      name: 'Mi Negocio DanMax WA',
      activeLineId: null,
      lines: [],
    };
  }
  return tenantStore[tenantId];
}

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

// POST /api/tenant/config-openwa
tenantRouter.post('/config-openwa', async (req: Request, res: Response) => {
  const { apiUrl, adminKey } = req.body;

  if (apiUrl) {
    ENV.OPENWA_API_URL = apiUrl;
    process.env.OPENWA_API_URL = apiUrl;
    updateEnvFile('OPENWA_API_URL', apiUrl);
  }

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

// GET /api/tenant/my-session (Auto-discovers and persists all active running OpenWA sessions)
tenantRouter.get('/my-session', async (req: Request, res: Response) => {
  const tenantId = (req.query.tenantId as string) || 'tenant_demo_pizzeria';
  const tenant = getOrCreateTenant(tenantId);

  // Sync state with live OpenWA sessions
  if (ENV.OPENWA_ADMIN_KEY) {
    try {
      const openwaSessions = await OpenWAService.getSessions();
      for (const owaSess of openwaSessions) {
        if (!owaSess.name) continue;

        const isReady = owaSess.status === 'ready' || owaSess.status === 'CONNECTED';
        const formattedPhone = owaSess.phone ? (owaSess.phone.startsWith('+') ? owaSess.phone : `+${owaSess.phone}`) : null;

        // Check if line exists in tenant
        let existingLine = tenant.lines.find(
          (l) =>
            l.openwaSessionId === owaSess.id ||
            l.name.toLowerCase() === owaSess.name.toLowerCase() ||
            l.openwaSessionId === owaSess.name
        );

        if (existingLine) {
          existingLine.status = isReady ? 'READY' : existingLine.status;
          existingLine.whatsappPhone = formattedPhone || existingLine.whatsappPhone;
        } else if (isReady) {
          // Auto-discover active session and persist in tenant!
          const newPersistentLine: WhatsAppLine = {
            id: `line_${owaSess.id || Date.now()}`,
            name: owaSess.name,
            whatsappPhone: formattedPhone,
            status: 'READY',
            openwaSessionId: owaSess.id || owaSess.name,
            createdAt: new Date().toISOString(),
          };
          tenant.lines.push(newPersistentLine);
          if (!tenant.activeLineId) {
            tenant.activeLineId = newPersistentLine.id;
          }
        }
      }
    } catch (e) {
      console.warn('[Session Auto-Discovery Error]:', e);
    }
  }

  const activeLine = tenant.lines.find((l) => l.id === tenant.activeLineId) || tenant.lines[0] || null;

  return res.json({
    success: true,
    tenant,
    session: activeLine,
    lines: tenant.lines,
    activeLineId: tenant.activeLineId,
  });
});

// POST /api/tenant/add-line
tenantRouter.post('/add-line', async (req: Request, res: Response) => {
  const { tenantId, name } = req.body;
  const targetTenantId = tenantId || 'tenant_demo_pizzeria';
  const tenant = getOrCreateTenant(targetTenantId);

  const customName = name?.trim() || `Línea WhatsApp ${tenant.lines.length + 1}`;
  const openwaSessionId = OpenWAService.sanitizeSessionName(customName);
  const lineId = `line_${openwaSessionId}_${Date.now()}`;

  const newLine: WhatsAppLine = {
    id: lineId,
    name: customName,
    whatsappPhone: null,
    status: 'DISCONNECTED',
    openwaSessionId,
    createdAt: new Date().toISOString(),
  };

  tenant.lines.push(newLine);
  tenant.activeLineId = lineId;

  return res.json({
    success: true,
    message: `Línea "${customName}" creada exitosamente`,
    line: newLine,
    lines: tenant.lines,
  });
});

// POST /api/tenant/delete-line
tenantRouter.post('/delete-line', async (req: Request, res: Response) => {
  const { tenantId, lineId } = req.body;
  const targetTenantId = tenantId || 'tenant_demo_pizzeria';
  const tenant = getOrCreateTenant(targetTenantId);

  const lineIndex = tenant.lines.findIndex((l) => l.id === lineId);
  if (lineIndex === -1) {
    return res.status(404).json({ success: false, error: 'Línea de WhatsApp no encontrada' });
  }

  const [deletedLine] = tenant.lines.splice(lineIndex, 1);
  if (deletedLine.openwaSessionId) {
    await OpenWAService.stopSession(deletedLine.openwaSessionId);
  }

  if (tenant.activeLineId === lineId) {
    tenant.activeLineId = tenant.lines[0]?.id || null;
  }

  return res.json({
    success: true,
    message: `Línea "${deletedLine.name}" eliminada exitosamente`,
    lines: tenant.lines,
    activeLineId: tenant.activeLineId,
  });
});

// POST /api/tenant/switch-line
tenantRouter.post('/switch-line', (req: Request, res: Response) => {
  const { tenantId, lineId } = req.body;
  const targetTenantId = tenantId || 'tenant_demo_pizzeria';
  const tenant = getOrCreateTenant(targetTenantId);

  const targetLine = tenant.lines.find((l) => l.id === lineId);
  if (!targetLine) {
    return res.status(404).json({ success: false, error: 'Línea de WhatsApp no encontrada' });
  }

  tenant.activeLineId = lineId;

  return res.json({
    success: true,
    message: `Cambiado a la línea "${targetLine.name}"`,
    activeLine: targetLine,
    lines: tenant.lines,
  });
});

// POST /api/tenant/connect-whatsapp
tenantRouter.post('/connect-whatsapp', async (req: Request, res: Response) => {
  const { tenantId, lineId, sessionNameLabel } = req.body;
  const targetTenantId = tenantId || 'tenant_demo_pizzeria';
  const tenant = getOrCreateTenant(targetTenantId);

  let line = tenant.lines.find((l) => l.id === (lineId || tenant.activeLineId));

  if (!line) {
    const customName = sessionNameLabel?.trim() || 'Pizzeria';
    const openwaSessionId = OpenWAService.sanitizeSessionName(customName);
    const newLineId = `line_${openwaSessionId}_${Date.now()}`;

    line = {
      id: newLineId,
      name: customName,
      whatsappPhone: null,
      status: 'DISCONNECTED',
      openwaSessionId,
      createdAt: new Date().toISOString(),
    };
    tenant.lines.push(line);
    tenant.activeLineId = newLineId;
  } else if (sessionNameLabel?.trim()) {
    line.name = sessionNameLabel.trim();
  }

  if (!ENV.OPENWA_ADMIN_KEY) {
    return res.status(400).json({
      success: false,
      error: 'Se requiere guardar tu OPENWA_ADMIN_KEY en el panel superior antes de generar un código QR real.',
    });
  }

  line.status = 'STARTING';
  const openwaResult = await OpenWAService.startSession(line.openwaSessionId);

  if (!openwaResult.success) {
    line.status = 'DISCONNECTED';
    return res.status(500).json({
      success: false,
      error: openwaResult.error || 'Error al iniciar sesión en OpenWA',
    });
  }

  if (openwaResult.status === 'READY') {
    line.status = 'READY';
    line.whatsappPhone = openwaResult.me ? (openwaResult.me.startsWith('+') ? openwaResult.me : `+${openwaResult.me}`) : '+56986176136';

    socketService.emitToTenant(targetTenantId, 'whatsapp_status', {
      status: 'READY',
      lineId: line.id,
      whatsappPhone: line.whatsappPhone,
      sessionNameLabel: line.name,
      message: openwaResult.message,
    });

    return res.json({
      success: true,
      message: openwaResult.message,
      sessionStatus: 'READY',
      whatsappPhone: line.whatsappPhone,
      line,
    });
  }

  const qrUrl = openwaResult.qrCode;
  line.status = 'SCAN_QR';
  line.qrCodeUrl = qrUrl;

  socketService.emitToTenant(targetTenantId, 'whatsapp_qr', {
    status: 'SCAN_QR',
    lineId: line.id,
    qrCodeUrl: qrUrl,
    sessionId: line.openwaSessionId,
    sessionNameLabel: line.name,
  });

  return res.json({
    success: true,
    message: `Proceso de vinculación iniciado para "${line.name}" en OpenWA`,
    sessionStatus: 'SCAN_QR',
    qrCodeUrl: qrUrl,
    line,
  });
});

// POST /api/tenant/disconnect-whatsapp
tenantRouter.post('/disconnect-whatsapp', async (req: Request, res: Response) => {
  const { tenantId, lineId } = req.body;
  const targetTenantId = tenantId || 'tenant_demo_pizzeria';
  const tenant = getOrCreateTenant(targetTenantId);

  const line = tenant.lines.find((l) => l.id === (lineId || tenant.activeLineId));
  if (line) {
    await OpenWAService.stopSession(line.openwaSessionId);
    line.status = 'DISCONNECTED';
    line.whatsappPhone = null;
    line.qrCodeUrl = null;
  }

  socketService.emitToTenant(targetTenantId, 'whatsapp_status', {
    status: 'DISCONNECTED',
    lineId: line?.id,
    message: 'Sesión de WhatsApp desconectada.',
  });

  return res.json({ success: true, message: 'Sesión cerrada exitosamente en OpenWA', lines: tenant.lines });
});
