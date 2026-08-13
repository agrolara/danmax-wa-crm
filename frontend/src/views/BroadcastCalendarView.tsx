import React, { useState, useEffect } from 'react';
import { API } from '../services/api';
import { Calendar as CalendarIcon, Plus, Send, Clock, Users, CheckCircle } from 'lucide-react';

export const BroadcastCalendarView: React.FC = () => {
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [form, setForm] = useState({
    title: '',
    messageContent: '',
    targetTag: 'Clientes VIP',
    scheduledFor: '2026-08-25T19:00',
  });

  const fetchBroadcasts = async () => {
    try {
      const res = await API.get('/broadcasts?tenantId=tenant_demo_pizzeria');
      if (res.data.success) {
        setBroadcasts(res.data.broadcasts);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await API.post('/broadcasts', {
        ...form,
        tenantId: 'tenant_demo_pizzeria',
      });
      if (res.data.success) {
        setShowModal(false);
        fetchBroadcasts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="calendar-view">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📅 Calendario Visual de Difusión Masiva
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Programa envíos masivos por WhatsApp usando <code>POST /api/sessions/:sessionId/message/schedule</code> de OpenWA.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Agendar Campaña Masiva
        </button>
      </div>

      {/* Modern Month Calendar Grid */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', fontWeight: 700 }}>
          <span style={{ fontSize: '1.1rem' }}>Agosto 2026</span>
          <span className="badge badge-blue">OpenWA Schedule Engine</span>
        </div>

        <div className="calendar-grid">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
            <div key={d} style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-dim)', paddingBottom: '0.5rem' }}>
              {d}
            </div>
          ))}

          {daysInMonth.map((day) => {
            const dayBroadcasts = broadcasts.filter((b) => {
              const date = new Date(b.scheduledFor);
              return date.getDate() === day;
            });

            return (
              <div key={day} className="calendar-day">
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>{day}</span>
                {dayBroadcasts.map((b) => (
                  <div key={b.id} className="calendar-event" title={b.messageContent}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title}</div>
                    <div style={{ fontSize: '0.65rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <Clock size={10} /> {new Date(b.scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Agendamiento */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-card" style={{ width: '450px', background: 'var(--bg-card-solid)' }}>
            <h3 style={{ marginBottom: '1rem', fontWeight: 800 }}>📢 Programar Campaña Masiva</h3>
            <form onSubmit={handleCreateBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Título de la Campaña</label>
                <input
                  type="text"
                  className="chat-input"
                  style={{ width: '100%' }}
                  placeholder="Ej: Promo 2x1 Jueves"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Etiqueta de Audiencia Objetivo</label>
                <select
                  className="chat-input"
                  style={{ width: '100%' }}
                  value={form.targetTag}
                  onChange={(e) => setForm({ ...form, targetTag: e.target.value })}
                >
                  <option value="Clientes VIP">Clientes VIP (145 contactos)</option>
                  <option value="Todos los contactos">Todos los contactos (320 contactos)</option>
                  <option value="Frecuentes">Frecuentes (89 contactos)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Fecha y Hora de Envío</label>
                <input
                  type="datetime-local"
                  className="chat-input"
                  style={{ width: '100%' }}
                  value={form.scheduledFor}
                  onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Contenido del Mensaje de WhatsApp</label>
                <textarea
                  className="chat-input"
                  style={{ width: '100%', height: '80px', resize: 'none' }}
                  placeholder="Escribe el mensaje masivo..."
                  value={form.messageContent}
                  onChange={(e) => setForm({ ...form, messageContent: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Agendar en OpenWA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
