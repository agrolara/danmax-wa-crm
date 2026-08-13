import React, { useState, useEffect } from 'react';
import { API } from '../services/api';
import { socket } from '../services/socket';
import { QrCode, CheckCircle2, RefreshCw, Smartphone, Server, Wifi, Plus, LogOut, AlertCircle, Tag, Check, Trash2 } from 'lucide-react';

export const WhatsAppQRView: React.FC = () => {
  const [lines, setLines] = useState<any[]>([]);
  const [activeLineId, setActiveLineId] = useState<string>('line_1');
  const [loading, setLoading] = useState<boolean>(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  // Form inputs
  const [sessionNameLabel, setSessionNameLabel] = useState<string>('Línea WhatsApp Principal');
  const [newSessionName, setNewSessionName] = useState<string>('');
  const [showAddLineModal, setShowAddLineModal] = useState<boolean>(false);

  // Master server config
  const [apiUrl, setApiUrl] = useState<string>('https://whatsapp-autopublicaciones.agrolara.dedyn.io');
  const [adminKey, setAdminKey] = useState<string>('');
  const [isServerConnected, setIsServerConnected] = useState<boolean>(false);
  const [configStatus, setConfigStatus] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);

  const fetchTenantSessions = async () => {
    try {
      const res = await API.get('/tenant/my-session?tenantId=tenant_demo_pizzeria');
      if (res.data.success) {
        setLines(res.data.lines || []);
        setActiveLineId(res.data.activeLineId || res.data.lines[0]?.id);
        const currentActive = res.data.lines.find((l: any) => l.id === res.data.activeLineId);
        if (currentActive) {
          setSessionNameLabel(currentActive.name);
          setQrCodeUrl(currentActive.qrCodeUrl || null);
        }
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
    fetchTenantSessions();

    socket.emit('join_tenant', 'tenant_demo_pizzeria');

    socket.on('whatsapp_qr', (data: any) => {
      setQrCodeUrl(data.qrCodeUrl);
      setLines((prev) =>
        prev.map((l) => (l.id === data.lineId ? { ...l, status: 'SCAN_QR', qrCodeUrl: data.qrCodeUrl, name: data.sessionNameLabel || l.name } : l))
      );
    });

    socket.on('whatsapp_status', (data: any) => {
      if (data.status === 'READY') {
        setLines((prev) =>
          prev.map((l) => (l.id === data.lineId ? { ...l, status: 'READY', whatsappPhone: data.whatsappPhone } : l))
        );
        setQrCodeUrl(null);
      } else if (data.status === 'DISCONNECTED') {
        setLines((prev) =>
          prev.map((l) => (l.id === data.lineId ? { ...l, status: 'DISCONNECTED', whatsappPhone: null } : l))
        );
        setQrCodeUrl(null);
      }
    });

    return () => {
      socket.off('whatsapp_qr');
      socket.off('whatsapp_status');
    };
  }, []);

  const activeLine = lines.find((l) => l.id === activeLineId) || lines[0] || {
    id: 'line_1',
    name: sessionNameLabel,
    status: 'DISCONNECTED',
  };

  const handleStartSession = async (lineIdToConnect?: string) => {
    setLoading(true);
    const targetLineId = lineIdToConnect || activeLineId;
    try {
      const res = await API.post('/tenant/connect-whatsapp', {
        tenantId: 'tenant_demo_pizzeria',
        lineId: targetLineId,
        sessionNameLabel: sessionNameLabel.trim() || 'Línea WhatsApp',
      });

      if (res.data.success) {
        if (res.data.sessionStatus === 'READY') {
          setLines((prev) =>
            prev.map((l) => (l.id === targetLineId ? { ...l, status: 'READY', whatsappPhone: res.data.whatsappPhone, name: sessionNameLabel } : l))
          );
          setQrCodeUrl(null);
        } else {
          setQrCodeUrl(res.data.qrCodeUrl);
          setLines((prev) =>
            prev.map((l) => (l.id === targetLineId ? { ...l, status: 'SCAN_QR', qrCodeUrl: res.data.qrCodeUrl, name: sessionNameLabel } : l))
          );
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al conectar con OpenWA');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectSession = async (targetLineId?: string) => {
    setLoading(true);
    const idToDisconnect = targetLineId || activeLineId;
    try {
      await API.post('/tenant/disconnect-whatsapp', {
        tenantId: 'tenant_demo_pizzeria',
        lineId: idToDisconnect,
      });
      setLines((prev) =>
        prev.map((l) => (l.id === idToDisconnect ? { ...l, status: 'DISCONNECTED', whatsappPhone: null, qrCodeUrl: null } : l))
      );
      if (idToDisconnect === activeLineId) {
        setQrCodeUrl(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchLine = async (lineId: string) => {
    try {
      const res = await API.post('/tenant/switch-line', {
        tenantId: 'tenant_demo_pizzeria',
        lineId,
      });
      if (res.data.success) {
        setActiveLineId(lineId);
        const sel = lines.find((l) => l.id === lineId);
        if (sel) {
          setSessionNameLabel(sel.name);
          setQrCodeUrl(sel.qrCodeUrl || null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateNewLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;

    try {
      const res = await API.post('/tenant/add-line', {
        tenantId: 'tenant_demo_pizzeria',
        name: newSessionName.trim(),
      });

      if (res.data.success) {
        setLines(res.data.lines);
        setActiveLineId(res.data.line.id);
        setSessionNameLabel(res.data.line.name);
        setNewSessionName('');
        setShowAddLineModal(false);
      }
    } catch (err) {
      console.error(err);
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
        setAdminKey('');
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

  const isConnected = activeLine?.status === 'READY';

  return (
    <div style={{ padding: '2rem', maxWidth: '950px', margin: '0 auto' }}>
      {/* ⚙️ Panel Configuración Servidor OpenWA API */}
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Server size={20} color="var(--primary)" /> Servidor Maestro OpenWA API
          </h3>
          <span className={`badge ${isServerConnected ? 'badge-green' : 'badge-amber'}`}>
            {isServerConnected ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {isServerConnected ? 'SERVIDOR AUTENTICADO 🟢' : 'CLAVE PENDIENTE'}
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
          <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: isServerConnected ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
            {configStatus}
          </div>
        )}
      </div>

      {/* 📱 Muestreo Multi-Sesión de Líneas de WhatsApp */}
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Smartphone size={22} color="var(--primary)" /> Líneas de WhatsApp de tu Negocio (Multi-Sesión)
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
              Administra múltiples números de WhatsApp en el mismo panel de control.
            </p>
          </div>
          <button className="btn btn-primary" style={{ padding: '0.5rem 0.85rem', fontSize: '0.85rem' }} onClick={() => setShowAddLineModal(true)}>
            <Plus size={16} /> Agregar Nueva Línea de WhatsApp
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {lines.map((line) => {
            const isActive = line.id === activeLineId;
            const isLineConnected = line.status === 'READY';

            return (
              <div
                key={line.id}
                style={{
                  background: isActive ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-main)',
                  border: isActive ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: isActive ? 'var(--primary)' : 'var(--text-main)' }}>
                    🏷️ {line.name}
                  </span>
                  <span className={`badge ${isLineConnected ? 'badge-green' : 'badge-amber'}`} style={{ fontSize: '0.7rem' }}>
                    {isLineConnected ? 'CONECTADO 🟢' : 'DESCONECTADO'}
                  </span>
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  {line.whatsappPhone ? `📱 ${line.whatsappPhone}` : 'Sin número vinculado'}
                </p>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {!isActive ? (
                    <button className="btn btn-secondary" style={{ flex: 1, fontSize: '0.75rem', padding: '0.4rem' }} onClick={() => handleSwitchLine(line.id)}>
                      Seleccionar Línea
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Check size={14} /> Línea Activa
                    </span>
                  )}

                  {isLineConnected && (
                    <button className="btn btn-danger" style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }} onClick={() => handleDisconnectSession(line.id)}>
                      <LogOut size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ⚡ Vinculación Autoservicio QR para la Línea Seleccionada */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>
              ⚡ Vincular Línea: <span style={{ color: 'var(--primary)' }}>{activeLine?.name}</span>
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Asigna un nombre descriptivo a tu sesión y escanea el código QR desde tu teléfono.
            </p>
          </div>
          <span className={`badge ${isConnected ? 'badge-green' : 'badge-amber'}`}>
            {isConnected ? <CheckCircle2 size={14} /> : <RefreshCw size={14} className="spin" />}
            {isConnected ? 'OPERATIVO / READY' : 'DESCONECTADO'}
          </span>
        </div>

        {/* Input para Nombre Identificador de la Sesión */}
        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '6px' }}>
            <Tag size={16} color="var(--primary)" /> Nombre Identificador de esta Sesión / WhatsApp
          </label>
          <input
            type="text"
            className="chat-input"
            style={{ width: '100%' }}
            placeholder="Ej: Ventas Sucursal Centro, Atención al Cliente, Línea 2..."
            value={sessionNameLabel}
            onChange={(e) => setSessionNameLabel(e.target.value)}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Este nombre te permitirá identificar rápidamente a qué número de WhatsApp está conectada esta sesión dentro de tu panel.
          </p>
        </div>

        {isConnected ? (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--accent-green)', padding: '1.5rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <Smartphone size={48} color="var(--accent-green)" style={{ marginBottom: '0.5rem' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-green)' }}>
              ¡La línea "{activeLine.name}" está Vinculada y Operativa!
            </h3>
            <p style={{ marginTop: '0.5rem', fontSize: '0.95rem' }}>
              Línea activa: <strong>{activeLine.whatsappPhone || '+56986176136'}</strong>
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Tus chats, grupos y campañas de esta línea están listos para trabajar.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1.25rem' }}>
              <button className="btn btn-secondary" onClick={() => handleDisconnectSession()} disabled={loading}>
                <LogOut size={16} /> Cerrar Sesión de esta Línea
              </button>
            </div>
          </div>
        ) : (
          <div className="qr-card">
            {qrCodeUrl ? (
              <div>
                <h4 style={{ fontWeight: 700 }}>Escanea este código QR desde tu teléfono ({activeLine.name}):</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Abre WhatsApp ➔ Dispositivos vinculados ➔ Vincular un dispositivo
                </p>
                <div className="qr-image">
                  <img src={qrCodeUrl} alt="WhatsApp QR Code" style={{ width: '100%', height: '100%' }} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}>
                  <button className="btn btn-secondary" onClick={() => handleDisconnectSession()}>
                    <RefreshCw size={16} /> Reiniciar Sesión
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <QrCode size={64} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                <h3>Genera el Código QR para "{sessionNameLabel}"</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  Haz clic a continuación para solicitar al servidor de OpenWA el inicio de la sesión con este nombre.
                </p>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                  <button className="btn btn-primary" onClick={() => handleStartSession()} disabled={loading}>
                    {loading ? 'Iniciando en OpenWA...' : `Conectar mi WhatsApp (${sessionNameLabel})`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal para Agregar Nueva Línea de WhatsApp */}
      {showAddLineModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 250 }}>
          <div className="glass-card" style={{ width: '400px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>➕ Conectar Nueva Línea de WhatsApp</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Ingresa el nombre identificador para esta nueva sesión de WhatsApp en tu negocio.
            </p>
            <form onSubmit={handleCreateNewLine}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Nombre de la Línea / Sucursal
                </label>
                <input
                  type="text"
                  className="chat-input"
                  style={{ width: '100%' }}
                  placeholder="Ej: Soporte Técnico, Línea Ventas 2..."
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddLineModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Crear e Iniciar QR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
