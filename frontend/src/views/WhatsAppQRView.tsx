import React, { useState, useEffect } from 'react';
import { API } from '../services/api';
import { socket } from '../services/socket';
import { QrCode, CheckCircle2, RefreshCw, Smartphone, ShieldCheck, Server, Wifi, Play, LogOut, AlertCircle, Check } from 'lucide-react';

export const WhatsAppQRView: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  const [apiUrl, setApiUrl] = useState<string>('https://whatsapp-autopublicaciones.agrolara.dedyn.io');
  const [adminKey, setAdminKey] = useState<string>('');
  const [isServerConnected, setIsServerConnected] = useState<boolean>(false);
  const [configStatus, setConfigStatus] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);

  const fetchSessionStatus = async () => {
    try {
      const res = await API.get('/tenant/my-session?tenantId=tenant_demo_pizzeria');
      if (res.data.success) {
        setSession(res.data.session);
      }

      const confRes = await API.get('/tenant/openwa-config');
      if (confRes.data.success) {
        setApiUrl(confRes.data.config.openwaApiUrl);
        setIsServerConnected(confRes.data.config.isConnected);
      }
    } catch (err) {
      console.error('Error fetching session:', err);
    }
  };

  useEffect(() => {
    fetchSessionStatus();

    socket.emit('join_tenant', 'tenant_demo_pizzeria');

    socket.on('whatsapp_qr', (data: any) => {
      setQrCodeUrl(data.qrCodeUrl);
      setSession((prev: any) => ({ ...prev, status: 'SCAN_QR' }));
    });

    socket.on('whatsapp_status', (data: any) => {
      if (data.status === 'READY') {
        setSession((prev: any) => ({
          ...prev,
          status: 'READY',
          whatsappPhone: data.whatsappPhone,
        }));
        setQrCodeUrl(null);
      } else if (data.status === 'DISCONNECTED') {
        setSession((prev: any) => ({
          ...prev,
          status: 'DISCONNECTED',
          whatsappPhone: null,
        }));
        setQrCodeUrl(null);
      }
    });

    return () => {
      socket.off('whatsapp_qr');
      socket.off('whatsapp_status');
    };
  }, []);

  const handleStartSession = async () => {
    setLoading(true);
    try {
      const res = await API.post('/tenant/connect-whatsapp', {
        tenantId: 'tenant_demo_pizzeria',
      });
      if (res.data.success) {
        if (res.data.sessionStatus === 'READY') {
          setSession((prev: any) => ({ ...prev, status: 'READY', whatsappPhone: res.data.whatsappPhone }));
          setQrCodeUrl(null);
        } else {
          setQrCodeUrl(res.data.qrCodeUrl);
          setSession((prev: any) => ({ ...prev, status: 'SCAN_QR' }));
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al conectar con OpenWA');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectSession = async () => {
    setLoading(true);
    try {
      await API.post('/tenant/disconnect-whatsapp', {
        tenantId: 'tenant_demo_pizzeria',
      });
      setSession((prev: any) => ({ ...prev, status: 'DISCONNECTED', whatsappPhone: null }));
      setQrCodeUrl(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOpenWAConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestingConnection(true);
    setConfigStatus(null);
    try {
      const res = await API.post('/tenant/config-openwa', {
        apiUrl,
        adminKey,
      });
      if (res.data.success) {
        setConfigStatus('✅ Conexión Exitosa con el Servidor OpenWA');
        setIsServerConnected(true);
        setAdminKey(''); // Clear input so placeholder takes over
      } else {
        setConfigStatus(`❌ ${res.data.message || 'Error de autenticación con OpenWA'}`);
        setIsServerConnected(false);
      }
    } catch (err) {
      setConfigStatus('❌ Error probando la conexión con OpenWA');
      setIsServerConnected(false);
    } finally {
      setTestingConnection(false);
    }
  };

  const isConnected = session?.status === 'READY';

  return (
    <div style={{ padding: '2rem', maxWidth: '850px', margin: '0 auto' }}>
      {/* ⚙️ Panel Configuración Servidor OpenWA API */}
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Server size={20} color="var(--primary)" /> Servidor Maestro OpenWA API
          </h3>
          <span className={`badge ${isServerConnected ? 'badge-green' : 'badge-amber'}`}>
            {isServerConnected ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {isServerConnected ? 'SERVIDOR AUTENTICADO 🟢' : 'CLAVE PENDIENTE / ERROR'}
          </span>
        </div>

        <form onSubmit={handleSaveOpenWAConfig} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              URL Servidor OpenWA
            </label>
            <input
              type="text"
              className="chat-input"
              style={{ width: '100%' }}
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Clave Maestra (`OPENWA_ADMIN_KEY`)
            </label>
            <input
              type="password"
              className="chat-input"
              style={{ width: '100%' }}
              placeholder={isServerConnected ? '•••••••• (Clave Registrada Activa)' : 'Ingresa tu Admin Key...'}
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={testingConnection}>
            {testingConnection ? <RefreshCw size={16} className="spin" /> : <Wifi size={16} />} Verificar
          </button>
        </form>

        {configStatus && (
          <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: isServerConnected ? 'var(--accent-green)' : 'var(--accent-rose)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {configStatus}
          </div>
        )}
      </div>

      {/* Módulo Autoservicio Vinculación QR */}
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>📱 Vinculación de WhatsApp Autoservicio</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Conecta la línea de WhatsApp de tu negocio solicitando la sesión a OpenWA API Engine.
            </p>
          </div>
          <span className={`badge ${isConnected ? 'badge-green' : 'badge-amber'}`}>
            {isConnected ? <CheckCircle2 size={14} /> : <RefreshCw size={14} className="spin" />}
            {isConnected ? 'READY / CONECTADO' : 'DESCONECTADO'}
          </span>
        </div>

        {isConnected ? (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--accent-green)', padding: '1.5rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <Smartphone size={48} color="var(--accent-green)" style={{ marginBottom: '0.5rem' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-green)' }}>¡Tu WhatsApp está Vinculado y Operativo!</h3>
            <p style={{ marginTop: '0.5rem', fontSize: '0.95rem' }}>
              Línea activa: <strong>{session.whatsappPhone || '+56987654321'}</strong>
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Tu panel comercial, bandeja multi-agente y campañas masivas están completamente desbloqueadas.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1.25rem' }}>
              <button className="btn btn-secondary" onClick={handleDisconnectSession} disabled={loading}>
                <LogOut size={16} /> Cerrar Sesión
              </button>
            </div>
          </div>
        ) : (
          <div className="qr-card">
            {qrCodeUrl ? (
              <div>
                <h4 style={{ fontWeight: 700 }}>Escanea este código QR oficial desde tu teléfono:</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Abre WhatsApp ➔ Dispositivos vinculados ➔ Vincular un dispositivo
                </p>
                <div className="qr-image">
                  <img src={qrCodeUrl} alt="WhatsApp QR Code" style={{ width: '100%', height: '100%' }} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}>
                  <button className="btn btn-secondary" onClick={handleDisconnectSession}>
                    <RefreshCw size={16} /> Reiniciar Sesión
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <QrCode size={64} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                <h3>Genera tu Código QR en Vivo</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  Haz clic a continuación para solicitar al servidor de OpenWA el inicio de tu sesión.
                </p>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                  <button className="btn btn-primary" onClick={handleStartSession} disabled={loading}>
                    {loading ? 'Iniciando sesión en OpenWA...' : 'Conectar mi WhatsApp'}
                  </button>
                  <button className="btn btn-secondary" onClick={handleDisconnectSession} disabled={loading}>
                    <RefreshCw size={16} /> Reiniciar Sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
