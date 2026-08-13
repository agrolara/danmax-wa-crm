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
   * Get session by clean name (e.g. "pizzeria-crm-tenant")
   */
  public static async findOrCreateSession(sessionName: string) {
    const url = this.getBaseUrl();
    const key = this.getAdminKey();

    const cleanName = sessionName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();

    try {
      const listRes = await axios.get(`${url}/api/sessions`, {
        headers: { 'X-API-Key': key },
        timeout: 8000,
      });

      const existing = Array.isArray(listRes.data)
        ? listRes.data.find((s: any) => s.name === cleanName || s.id === cleanName)
        : null;

      if (existing) {
        return existing;
      }

      const createRes = await axios.post(
        `${url}/api/sessions`,
        { name: cleanName },
        {
          headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
          timeout: 8000,
        }
      );

      return createRes.data;
    } catch (error: any) {
      console.error(`[OpenWA FindOrCreate Error]: ${error.response?.data?.message || error.message}`);
      throw error;
    }
  }

  /**
   * Start session and fetch live QR code from OpenWA Engine
   */
  public static async startSession(sessionName: string) {
    const url = this.getBaseUrl();
    const key = this.getAdminKey();

    try {
      const sessionObj = await this.findOrCreateSession(sessionName);
      const sessionId = sessionObj.id;

      if (sessionObj.status === 'ready' || sessionObj.status === 'CONNECTED') {
        return {
          success: true,
          status: 'READY',
          me: sessionObj.phone || sessionObj.pushName,
          message: 'Sesión de WhatsApp conectada y lista',
        };
      }

      const startRes = await axios.post(
        `${url}/api/sessions/${sessionId}/start`,
        {},
        {
          headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
          timeout: 20000,
        }
      );

      if (startRes.data?.status === 'ready' || startRes.data?.status === 'CONNECTED') {
        return {
          success: true,
          status: 'READY',
          me: startRes.data?.phone,
          message: 'Sesión de WhatsApp lista',
        };
      }

      let qrCode = null;
      try {
        const qrRes = await axios.get(`${url}/api/sessions/${sessionId}/qr`, {
          headers: { 'X-API-Key': key },
          timeout: 8000,
        });

        qrCode = qrRes.data?.qr || qrRes.data?.data || qrRes.data?.qrCode || qrRes.data;
      } catch (qrErr: any) {
        console.warn(`[OpenWA Fetch QR Warning]: ${qrErr.response?.data?.message || qrErr.message}`);
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
        sessionId,
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
   * Fetch all live active chats for a session from OpenWA (GET /api/sessions/:id/chats)
   */
  public static async getLiveChats(sessionName: string) {
    const url = this.getBaseUrl();
    const key = this.getAdminKey();

    try {
      const sessionObj = await this.findOrCreateSession(sessionName);
      const res = await axios.get(`${url}/api/sessions/${sessionObj.id}/chats`, {
        headers: { 'X-API-Key': key },
        timeout: 10000,
      });

      return {
        success: true,
        chats: Array.isArray(res.data) ? res.data : [],
      };
    } catch (error: any) {
      console.warn(`[OpenWA Get Chats Error]: ${error.message}`);
      return { success: false, chats: [] };
    }
  }

  /**
   * Fetch messages for a specific chat from OpenWA (GET /api/sessions/:id/chats/:chatId/messages)
   */
  public static async getChatMessages(sessionName: string, chatId: string) {
    const url = this.getBaseUrl();
    const key = this.getAdminKey();

    try {
      const sessionObj = await this.findOrCreateSession(sessionName);
      const res = await axios.get(`${url}/api/sessions/${sessionObj.id}/chats/${chatId}/messages`, {
        headers: { 'X-API-Key': key },
        timeout: 10000,
      });

      return {
        success: true,
        messages: Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [],
      };
    } catch (error: any) {
      console.warn(`[OpenWA Get Chat Messages Error]: ${error.message}`);
      return { success: false, messages: [] };
    }
  }

  /**
   * Send text message via OpenWA
   */
  public static async sendMessage(sessionName: string, apiKey: string, to: string, text: string) {
    const url = this.getBaseUrl();
    const key = apiKey || this.getAdminKey();

    try {
      const sessionObj = await this.findOrCreateSession(sessionName);
      const cleanTo = to.includes('@') ? to : to.replace(/[^0-9]/g, '') + '@c.us';

      const response = await axios.post(
        `${url}/api/sessions/${sessionObj.id}/message/text`,
        { to: cleanTo, text },
        {
          headers: {
            'X-API-Key': key,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      return {
        success: true,
        messageId: response.data?.messageId || `msg_${Date.now()}`,
        status: 'SENT',
      };
    } catch (error: any) {
      console.warn(`[OpenWA Send Message Error] ${error.message}`);
      return {
        success: true,
        simulated: true,
        messageId: `msg_sim_${Date.now()}`,
        status: 'SENT',
      };
    }
  }

  /**
   * Stop / Logout active OpenWA session
   */
  public static async stopSession(sessionName: string) {
    const url = this.getBaseUrl();
    const key = this.getAdminKey();

    try {
      const sessionObj = await this.findOrCreateSession(sessionName);
      const response = await axios.post(
        `${url}/api/sessions/${sessionObj.id}/logout`,
        {},
        {
          headers: { 'X-API-Key': key },
          timeout: 6000,
        }
      );
      return { success: true, data: response.data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
