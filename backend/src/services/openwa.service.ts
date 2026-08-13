import axios from 'axios';
import { ENV } from '../config/env';

export class OpenWAService {
  private static getBaseUrl() {
    return ENV.OPENWA_API_URL.replace(/\/$/, '');
  }

  private static getAdminKey() {
    return ENV.OPENWA_ADMIN_KEY;
  }

  /**
   * Sanitize session name to valid OpenWA session identifier
   */
  public static sanitizeSessionName(name: string): string {
    const clean = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
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
        error: error.response?.data || error.message,
        message: 'No se pudo verificar la llave con OpenWA.',
      };
    }
  }

  /**
   * Get all active sessions or session info
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
   * Find or inspect session in OpenWA
   */
  public static async findOrCreateSession(sessionName: string) {
    const url = this.getBaseUrl();
    const key = this.getAdminKey();
    const cleanName = this.sanitizeSessionName(sessionName);

    try {
      const sessions = await this.getSessions();
      const existing = sessions.find(
        (s: any) =>
          s.id === cleanName ||
          s.name === cleanName ||
          s.sessionId === cleanName ||
          s.id === sessionName ||
          s.name === sessionName
      );

      if (existing) {
        return {
          id: existing.id || existing.name || cleanName,
          name: existing.name || cleanName,
          status: existing.status || 'READY',
          phone: existing.phone || existing.me || null,
        };
      }

      return {
        id: cleanName,
        name: cleanName,
        status: 'DISCONNECTED',
        phone: null,
      };
    } catch (error: any) {
      return { id: cleanName, name: cleanName, status: 'DISCONNECTED', phone: null };
    }
  }

  /**
   * Start a new session in OpenWA with exact session name
   */
  public static async startSession(sessionName: string) {
    const url = this.getBaseUrl();
    const key = this.getAdminKey();
    const cleanName = this.sanitizeSessionName(sessionName);

    try {
      console.log(`[OpenWA] Starting session with name: "${cleanName}"...`);
      const startRes = await axios.post(
        `${url}/api/sessions/${cleanName}/start`,
        { name: cleanName },
        {
          headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
          timeout: 20000,
        }
      );

      if (startRes.data?.status === 'ready' || startRes.data?.status === 'CONNECTED') {
        return {
          success: true,
          sessionId: cleanName,
          status: 'READY',
          me: startRes.data?.phone || startRes.data?.me,
          message: `Sesión "${cleanName}" conectada y lista`,
        };
      }

      let qrCode = null;
      try {
        const qrRes = await axios.get(`${url}/api/sessions/${cleanName}/qr`, {
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
        sessionId: cleanName,
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
   * Stop/delete a session in OpenWA
   */
  public static async stopSession(sessionName: string) {
    const url = this.getBaseUrl();
    const key = this.getAdminKey();
    const cleanName = this.sanitizeSessionName(sessionName);

    try {
      await axios.post(
        `${url}/api/sessions/${cleanName}/stop`,
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
   * Fetch all live active chats for a session from OpenWA
   */
  public static async getLiveChats(sessionName?: string) {
    const url = this.getBaseUrl();
    const key = this.getAdminKey();

    try {
      const sessions = await this.getSessions();
      let targetSessionId = sessionName ? this.sanitizeSessionName(sessionName) : null;

      if (!targetSessionId && sessions.length > 0) {
        targetSessionId = sessions[0].id || sessions[0].name;
      }

      if (!targetSessionId) {
        return { success: true, chats: [] };
      }

      const res = await axios.get(`${url}/api/sessions/${targetSessionId}/chats`, {
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
        sessionId: targetSessionId,
        chats: chatsData,
      };
    } catch (error: any) {
      console.warn(`[OpenWA Get Chats Warning]: ${error.message}`);
      return { success: false, chats: [] };
    }
  }

  /**
   * Send text message via OpenWA
   */
  public static async sendMessage(sessionName: string, apiKey: string, to: string, text: string) {
    const url = this.getBaseUrl();
    const key = apiKey || this.getAdminKey();
    const cleanName = this.sanitizeSessionName(sessionName);

    try {
      const cleanTo = to.includes('@') ? to : to.replace(/[^0-9]/g, '') + '@c.us';

      const response = await axios.post(
        `${url}/api/sessions/${cleanName}/message/text`,
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
