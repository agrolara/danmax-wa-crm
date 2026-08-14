import React, { useState, useEffect } from 'react';
import { API } from '../services/api';
import { Users, Plus, Mail, Shield, UserCheck, X } from 'lucide-react';

export const TeamView: React.FC = () => {
  const [team, setTeam] = useState<any[]>([]);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [form, setForm] = useState({ fullName: '', email: '', role: 'AGENT' });

  const fetchTeam = async () => {
    try {
      const res = await API.get('/team');
      if (res.data.success) {
        setTeam(res.data.team);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await API.post('/team', {
        ...form,
      });
      if (res.data.success) {
        setShowModal(false);
        setForm({ fullName: '', email: '', role: 'AGENT' });
        fetchTeam();
      }
    } catch (err) {
      console.error(err);
    }
  };


  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            👥 Equipo de Ventas Multi-Agente ({team.length} integrantes)
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Crea vendedores y agentes para atender la bandeja compartida de WhatsApp de tu negocio.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Crear Vendedor
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {team.map((agent) => (
          <div key={agent.id} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <img
              src={agent.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
              alt={agent.fullName}
              style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-color)' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{agent.fullName}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{agent.email}</div>
              <span className={`badge ${agent.role === 'TENANT_ADMIN' ? 'badge-amber' : 'badge-blue'}`} style={{ fontSize: '0.65rem' }}>
                {agent.role === 'TENANT_ADMIN' ? 'Administrador' : 'Agente Vendedor'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div className="glass-card" style={{ width: '400px', background: 'var(--bg-card-solid)' }}>
            <h3 style={{ marginBottom: '1rem', fontWeight: 800 }}>👤 Agregar Nuevo Agente de Ventas</h3>
            <form onSubmit={handleCreateAgent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Nombre Completo</label>
                <input
                  type="text"
                  className="chat-input"
                  style={{ width: '100%' }}
                  placeholder="Ej: María José Silva"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Correo Electrónico</label>
                <input
                  type="email"
                  className="chat-input"
                  style={{ width: '100%' }}
                  placeholder="vendedor@empresa.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Rol en la Plataforma</label>
                <select
                  className="chat-input"
                  style={{ width: '100%' }}
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="AGENT">Agente Vendedor</option>
                  <option value="TENANT_ADMIN">Administrador de Negocio</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Crear Agente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
