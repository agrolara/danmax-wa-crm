import React, { useState, useEffect } from 'react';
import { API } from '../services/api';
import { Shield, CheckCircle2, XCircle, Clock, Building2, Mail, RefreshCw, Trash2, Edit, X } from 'lucide-react';

export const SuperAdminView: React.FC = () => {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Edit Modal State
  const [editingTenant, setEditingTenant] = useState<any | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editOwnerName, setEditOwnerName] = useState<string>('');
  const [editOwnerEmail, setEditOwnerEmail] = useState<string>('');
  const [editStatus, setEditStatus] = useState<string>('APPROVED');

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const res = await API.get('/auth/admin/tenants');
      if (res.data.success) {
        setTenants(res.data.tenants);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleApprove = async (tenantId: string) => {
    try {
      const res = await API.post('/auth/admin/approve-tenant', { tenantId });
      if (res.data.success) {
        setNotification(res.data.message);
        fetchTenants();
        setTimeout(() => setNotification(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (tenantId: string) => {
    try {
      const res = await API.post('/auth/admin/reject-tenant', { tenantId });
      if (res.data.success) {
        setNotification(res.data.message);
        fetchTenants();
        setTimeout(() => setNotification(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTenant = async (tenantId: string, tenantName: string) => {
    if (!confirm(`¿Estás seguro de eliminar PERMANENTEMENTE el negocio "${tenantName}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const res = await API.post('/auth/admin/delete-tenant', { tenantId });
      if (res.data.success) {
        setNotification(res.data.message);
        fetchTenants();
        setTimeout(() => setNotification(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenEditModal = (t: any) => {
    setEditingTenant(t);
    setEditName(t.name);
    setEditOwnerName(t.ownerName);
    setEditOwnerEmail(t.ownerEmail);
    setEditStatus(t.status);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;

    try {
      const res = await API.post('/auth/admin/edit-tenant', {
        tenantId: editingTenant.id,
        name: editName,
        ownerName: editOwnerName,
        ownerEmail: editOwnerEmail,
        status: editStatus,
      });

      if (res.data.success) {
        setNotification(res.data.message);
        setEditingTenant(null);
        fetchTenants();
        setTimeout(() => setNotification(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const pendingCount = tenants.filter((t) => t.status === 'PENDING_APPROVAL').length;
  const approvedCount = tenants.filter((t) => t.status === 'APPROVED').length;

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            👑 Panel de Control Super Administrador DanMax WA
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Revisa, aprueba, edita o elimina las solicitudes de registro de negocios.
          </p>
        </div>

        <button className="btn btn-secondary" onClick={fetchTenants} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Actualizar Solicitudes
        </button>
      </div>

      {notification && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--accent-green)', color: 'var(--accent-green)', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
          <CheckCircle2 size={18} /> {notification}
        </div>
      )}

      {/* Top Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-amber)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pendientes de Aprobación</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent-amber)', marginTop: '4px' }}>
            {pendingCount}
          </div>
        </div>

        <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-green)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Clientes / Tenants Activos</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent-green)', marginTop: '4px' }}>
            {approvedCount}
          </div>
        </div>

        <div className="glass-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total de Solicitudes Registradas</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--primary)', marginTop: '4px' }}>
            {tenants.length}
          </div>
        </div>
      </div>

      {/* Tabla de Solicitudes de Clientes */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem' }}>
          📋 Solicitudes de Registro de Clientes
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem' }}>Empresa / Negocio</th>
                <th style={{ padding: '0.75rem' }}>Contacto / Dueño</th>
                <th style={{ padding: '0.75rem' }}>Identificador (Slug)</th>
                <th style={{ padding: '0.75rem' }}>Estado</th>
                <th style={{ padding: '0.75rem' }}>Fecha</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Acción del Administrador</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 700 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Building2 size={16} color="var(--primary)" /> {t.name}
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <div style={{ fontWeight: 600 }}>{t.ownerName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{t.ownerEmail}</div>
                  </td>
                  <td style={{ padding: '0.75rem', fontFamily: 'monospace', color: 'var(--accent-blue)' }}>
                    {t.slug}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {t.status === 'APPROVED' && (
                      <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={12} /> Aprobado & Activo
                      </span>
                    )}
                    {t.status === 'PENDING_APPROVAL' && (
                      <span className="badge badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} /> Pendiente Aprobación
                      </span>
                    )}
                    {t.status === 'REJECTED' && (
                      <span className="badge badge-rose" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <XCircle size={12} /> Suspendido / Rechazado
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-dim)' }}>
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                      {t.status !== 'APPROVED' ? (
                        <button
                          className="btn btn-primary"
                          style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                          onClick={() => handleApprove(t.id)}
                        >
                          <CheckCircle2 size={14} /> Aprobar
                        </button>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', color: 'var(--accent-rose)' }}
                          onClick={() => handleReject(t.id)}
                          title="Suspender acceso"
                        >
                          <XCircle size={14} />
                        </button>
                      )}

                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}
                        title="Editar datos del negocio"
                        onClick={() => handleOpenEditModal(t)}
                      >
                        <Edit size={14} />
                      </button>

                      <button
                        className="btn btn-danger"
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}
                        title="Eliminar permanentemente del CRM"
                        onClick={() => handleDeleteTenant(t.id, t.name)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Editar Negocio / Cliente */}
      {editingTenant && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 250 }}>
          <div className="glass-card" style={{ width: '420px', background: 'var(--bg-card-solid)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: 800, fontSize: '1.1rem' }}>✏️ Editar Registro de Cliente</h3>
              <button onClick={() => setEditingTenant(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Nombre de la Empresa / Negocio
                </label>
                <input
                  type="text"
                  className="chat-input"
                  style={{ width: '100%' }}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Nombre del Propietario / Dueño
                </label>
                <input
                  type="text"
                  className="chat-input"
                  style={{ width: '100%' }}
                  value={editOwnerName}
                  onChange={(e) => setEditOwnerName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  className="chat-input"
                  style={{ width: '100%' }}
                  value={editOwnerEmail}
                  onChange={(e) => setEditOwnerEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Estado de la Cuenta
                </label>
                <select
                  className="chat-input"
                  style={{ width: '100%' }}
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  <option value="APPROVED">APPROVED (Aprobado y Activo)</option>
                  <option value="PENDING_APPROVAL">PENDING_APPROVAL (Pendiente)</option>
                  <option value="REJECTED">REJECTED (Suspendido)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingTenant(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
