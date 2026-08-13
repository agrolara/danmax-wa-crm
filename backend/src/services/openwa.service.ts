import axios from 'axios';
import { ENV } from '../config/env';

export class OpenWAService {
  private static getBaseUrl() {
    return ENV.OPENWA_API_URL.replace(/\/$/, '');
  }

  private static getAdminKey() {
    return ENV.OPENWA_ADMIN_KEY;
  }

  public static sanitizeSessionName(name: string): string {
    const clean = (name || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return clean || `session-${Date.now()}`;
  }

  /**
   * Test connection to OpenWA engine (GET /api/sessions)
   */
  public static async testConnection(apiUrl?: string, adminKey?: string) {
    const url = (apiUrl || this.getBaseUrl()).replace(/\/$/, '');
    const key = adminKey || this.getAdminKey();

    try {
      const response = await axios.get(`${url}/api/sessions`, {
        headers: {
          'X-API-Key': key,
          'Content-Type': 'application/json',
        },
        timeout: 8000,
      });

      return {
        success: true,
        data: response.data,
        message: 'Conexión exitosa con el servidor OpenWA',
      };
    } catch (error: any) {
      console.warn(`[OpenWA Connection Check] ${error.message}`);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        message: 'No se pudo verificar la llave con OpenWA.',
      };
    }
  }

  /**
   * Get all active sessions from OpenWA Engine
   */
  public static async getSessions() {
    const url = this.getBaseUrl();
    const key = this.getAdminKey();

    try {
      const res = await axios.get(`${url}/api/sessions`, {
        headers: { 'X-API-Key': key },
        timeout: 8000,
      });
      return Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Find existing session by Name or create a new session in OpenWA (returns UUID object)
   */
  public static async findOrCreateSession(sessionName: string) {
    const url = this.getBaseUrl();
    const key = this.getAdminKey();
    const cleanName = sessionName.trim();

    try {
      const sessions = await this.getSessions();
      const existing = sessions.find(
        (s: any) =>
          s.name?.toLowerCase() === cleanName.toLowerCase() ||
          s.id === cleanName ||
          s.name?.toLowerCase() === this.sanitizeSessionName(cleanName)
      );

      if (existing) {
        return {
          id: existing.id,
          name: existing.name || cleanName,
          status: existing.status || 'STOPPED',
          phone: existing.phone || existing.me || null,
        };
      }

      // Create new session in OpenWA to get UUID
      const createRes = await axios.post(
        `${url}/api/sessions`,
        { name: cleanName },
        {
          headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
          timeout: 10000,
        }
      );

      const createdObj = createRes.data?.data || createRes.data;
      return {
        id: createdObj?.id || cleanName,
        name: createdObj?.name || cleanName,
        status: createdObj?.status || 'STOPPED',
        phone: createdObj?.phone || null,
      };
    } catch (error: any) {
      console.warn(`[OpenWA findOrCreateSession Warning]: ${error.message}`);
      return { id: cleanName, name: cleanName, status: 'DISCONNECTED', phone: null };
    }
  }

  /**
   * Start a session in OpenWA using its valid UUID
   */
  public static async startSession(sessionName: string) {
    const url = this.getBaseUrl();
    const key = this.getAdminKey();

    try {
      const sessionObj = await this.findOrCreateSession(sessionName);
      const uuid = sessionObj.id;

      console.log(`[OpenWA] Starting session "${sessionName}" (UUID: ${uuid})...`);

      const startRes = await axios.post(
        `${url}/api/sessions/${uuid}/start`,
        {},
        {
          headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
          timeout: 20000,
        }
      );

      if (startRes.data?.status === 'ready' || startRes.data?.status === 'CONNECTED') {
        return {
          success: true,
          sessionId: uuid,
          sessionName,
          status: 'READY',
          me: startRes.data?.phone || startRes.data?.me,
          message: `Sesión "${sessionName}" conectada y lista`,
        };
      }

      let qrCode = null;
      try {
        const qrRes = await axios.get(`${url}/api/sessions/${uuid}/qr`, {
          headers: { 'X-API-Key': key },
          timeout: 8000,
        });

        qrCode = qrRes.data?.qr || qrRes.data?.data || qrRes.data?.qrCode || qrRes.data;
      } catch (qrErr: any) {
        console.warn(`[OpenWA Fetch QR Warning]: ${qrErr.message}`);
      }

      let formattedQrCode = qrCode;
      if (qrCode && typeof qrCode === 'string') {
        if (qrCode.startsWith('data:image') || qrCode.startsWith('http')) {
          formattedQrCode = qrCode;
        } else {
          formattedQrCode = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}`;
        }
      }

      return {
        success: true,
        sessionId: uuid,
        sessionName,
        status: 'SCAN_QR',
        qrCode: formattedQrCode,
        raw: startRes.data,
      };
    } catch (error: any) {
      console.error(`[OpenWA Start Session Error]: ${error.response?.data?.message || error.message}`);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Stop/delete a session in OpenWA using its valid UUID
   */
  public static async stopSession(sessionName: string) {
    const url = this.getBaseUrl();
    const key = this.getAdminKey();

    try {
      const sessionObj = await this.findOrCreateSession(sessionName);
      await axios.post(
        `${url}/api/sessions/${sessionObj.id}/stop`,
        {},
        {
          headers: { 'X-API-Key': key },
          timeout: 8000,
        }
      );
      return { success: true };
    } catch (e) {
      return { success: false };
    }
  }

  /**
   * Fetch all live active chats for a session from OpenWA (falls back to active READY session)
   */
  public static async getLiveChats(sessionName?: string) {
    const url = this.getBaseUrl();
    const key = this.getAdminKey();

    try {
      const sessions = await this.getSessions();
      let targetUuid: string | null = null;

      // 1. Try specified session name
      if (sessionName) {
        const found = sessions.find(
          (s: any) =>
            s.name?.toLowerCase() === sessionName.toLowerCase() ||
            s.id === sessionName ||
            s.name?.toLowerCase() === this.sanitizeSessionName(sessionName)
        );
        if (found && (found.status === 'ready' || found.status === 'CONNECTED')) {
          targetUuid = found.id;
        }
      }

      // 2. Fallback to any active READY session
      if (!targetUuid) {
        const readySession = sessions.find((s: any) => s.status === 'ready' || s.status === 'CONNECTED');
        if (readySession) {
          targetUuid = readySession.id;
        }
      }

      // 3. Fallback to first session if none is ready
      if (!targetUuid && sessions.length > 0) {
        targetUuid = sessions[0].id;
      }

      if (!targetUuid) {
        return { success: true, chats: [] };
      }

      const res = await axios.get(`${url}/api/sessions/${targetUuid}/chats`, {
        headers: { 'X-API-Key': key },
        timeout: 10000,
      });

      const chatsData = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.chats)
        ? res.data.chats
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];

      return {
        success: true,
        sessionId: targetUuid,
        chats: chatsData,
      };
    } catch (error: any) {
      console.warn(`[OpenWA Get Chats Warning]: ${error.message}`);
      return { success: false, chats: [] };
    }
  }

  /**
   * Send text message via OpenWA using session UUID
   */
  public static async sendMessage(sessionName: string, apiKey: string, to: string, text: string) {
    const url = this.getBaseUrl();
    const key = apiKey || this.getAdminKey();

    try {
      const sessionObj = await this.findOrCreateSession(sessionName);
      const uuid = sessionObj.id;
      const cleanTo = to.includes('@') ? to : to.replace(/[^0-9]/g, '') + '@c.us';

      const response = await axios.post(
        `${url}/api/sessions/${uuid}/message/text`,
        { to: cleanTo, text },
        {
          headers: {
            'X-API-Key': key,
            'Content-Type': 'application/json',
          },
          timeout: 12000,
        }
      );

      return {
        success: true,
        messageId: response.data?.messageId || response.data?.id,
        status: 'SENT',
      };
    } catch (error: any) {
      console.error(`[OpenWA Send Message Error]: ${error.response?.data?.message || error.message}`);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }
}
