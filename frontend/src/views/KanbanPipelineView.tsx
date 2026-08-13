import React, { useState, useEffect } from 'react';
import { API } from '../services/api';
import { socket } from '../services/socket';
import { Zap, Plus, ArrowRight, X, Phone, DollarSign, RefreshCw, User, MessageSquare, ExternalLink, CheckCircle } from 'lucide-react';

interface KanbanProps {
  setCurrentTab?: (tab: string) => void;
}

export const KanbanPipelineView: React.FC<KanbanProps> = ({ setCurrentTab }) => {
  const [columns, setColumns] = useState<any[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  // Create Opportunity Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [contactName, setContactName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [value, setValue] = useState<string>('');
  const [items, setItems] = useState<string>('');
  const [targetColumnId, setTargetColumnId] = useState<string>('col_1');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchKanban = async () => {
    try {
      const res = await API.get('/kanban?tenantId=tenant_demo_pizzeria');
      if (res.data.success) {
        setColumns(res.data.columns);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchKanban();

    socket.on('kanban_updated', (updatedCols: any[]) => {
      setColumns(updatedCols);
    });

    // Auto-add ONLY NEW incoming WhatsApp messages/contacts to "Contacto Nuevo"
    socket.on('new_message', (data: any) => {
      if (data && data.chatId && data.message && data.message.direction === 'INBOUND') {
        API.post('/kanban/leads', {
          tenantId: 'tenant_demo_pizzeria',
          columnId: 'col_1',
          contactName: data.contactName || `Cliente ${data.chatId.replace(/@.*/, '')}`,
          phone: data.phone || data.chatId,
          value: '$50.000',
          items: data.message.content || 'Nuevo Mensaje Entrante de WhatsApp',
          chatId: data.chatId,
        }).then(() => fetchKanban());
      }
    });

    return () => {
      socket.off('kanban_updated');
      socket.off('new_message');
    };
  }, []);

  const handleOpenChatInbox = (lead: any) => {
    const targetIdentifier = lead.chatId || lead.phone || lead.contactName || lead.id;
    localStorage.setItem('danmax_target_chat', targetIdentifier);

    if (setCurrentTab) {
      setCurrentTab('chat');
    }
  };

  const handleMoveLead = async (leadId: string, sourceColId: string, targetColId: string) => {
    try {
      const res = await API.post('/kanban/move', {
        tenantId: 'tenant_demo_pizzeria',
        leadId,
        sourceColId,
        targetColId,
      });

      if (res.data.success) {
        fetchKanban();
        if (res.data.autoTriggerText) {
          setNotification(`🤖 Mensaje Enviado Automáticamente al Cliente: "${res.data.autoTriggerText}"`);
        } else {
          setNotification(res.data.message || 'Oportunidad movida de etapa.');
        }
        setTimeout(() => setNotification(null), 5000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim()) return;

    setSubmitting(true);
    try {
      const res = await API.post('/kanban/leads', {
        tenantId: 'tenant_demo_pizzeria',
        columnId: targetColumnId,
        contactName: contactName.trim(),
        phone: phone.trim() || '+56986176136',
        value: value.trim() ? (value.startsWith('$') ? value : `$${value}`) : '$50.000',
        items: items.trim() || 'Consulta Comercial WhatsApp',
      });

      if (res.data.success) {
        fetchKanban();
        setShowModal(false);
        setContactName('');
        setPhone('');
        setValue('');
        setItems('');
        setNotification(`✨ Nueva Oportunidad "${contactName}" agregada en "Contacto Nuevo".`);
        setTimeout(() => setNotification(null), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header y Botón Principal */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🎯 Embudo de Ventas Kanban Automatizado (5 Etapas)
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Cada vez que alguien nuevo escriba por WhatsApp llegará a <strong>Contacto Nuevo</strong>. Haz clic en "Abrir Chat con Cliente" para chatear directamente en la Bandeja Multi-Agente.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={fetchKanban}>
            <RefreshCw size={16} />
            <span>Actualizar Embudo</span>
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Nueva Oportunidad
          </button>
        </div>
      </div>

      {/* Notificación de Automatización */}
      {notification && (
        <div style={{ background: 'rgba(99, 102, 241, 0.2)', border: '1px solid var(--primary)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <Zap size={16} color="var(--primary)" />
          <span>{notification}</span>
        </div>
      )}

      {/* Tablero Kanban (5 Columnas: Contacto Nuevo -> En Cotización -> En Seguimiento -> Venta Cerrada -> Terminado) */}
      <div className="kanban-board" style={{ padding: 0 }}>
        {columns.map((col) => (
          <div key={col.id} className="kanban-column">
            <div className="kanban-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: col.color, display: 'inline-block' }}></span>
                <span>{col.name}</span>
              </div>
              <span className="badge badge-blue">{col.leads.length}</span>
            </div>

            {col.autoTemplateText && (
              <div style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Zap size={12} color="var(--accent-amber)" /> Auto-Respuesta Activa
              </div>
            )}

            <div className="kanban-cards">
              {col.leads.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem', padding: '2rem 1rem' }}>
                  Sin oportunidades en esta etapa
                </div>
              ) : (
                col.leads.map((lead: any) => (
                  <div
                    key={lead.id}
                    className="kanban-card"
                    style={{ borderLeft: `3px solid ${col.color}` }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>{lead.contactName}</span>
                      <span className="badge badge-green">{lead.value}</span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      {lead.items}
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Phone size={12} /> <span>{lead.phone}</span>
                    </div>

                    {/* Acciones: Redirección al Chat Específico & Mover Etapa */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                      <button
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '0.35rem', fontSize: '0.75rem', justifyContent: 'center' }}
                        onClick={() => handleOpenChatInbox(lead)}
                        title="Abrir el chat directamente con este cliente en la Bandeja Multi-Agente"
                      >
                        <MessageSquare size={13} />
                        <span>Abrir Chat con Cliente</span>
                        <ExternalLink size={11} />
                      </button>

                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {columns
                          .filter((c) => c.id !== col.id)
                          .map((c) => (
                            <button
                              key={c.id}
                              className="btn btn-secondary"
                              style={{ fontSize: '0.68rem', padding: '2px 6px', flex: 1, justifyContent: 'center' }}
                              title={`Mover a ${c.name}`}
                              onClick={() => handleMoveLead(lead.id, col.id, c.id)}
                            >
                              ➡️ {c.name.split(' ')[0]}
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal Interactivo de Nueva Oportunidad / Lead */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="glass-card modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={20} color="var(--primary)" />
                <span>Agregar Nueva Oportunidad / Lead</span>
              </h3>
              <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setShowModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateLead}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                  Nombre del Cliente / Empresa *
                </label>
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.4rem 0.75rem' }}>
                  <User size={16} color="var(--text-dim)" />
                  <input
                    type="text"
                    required
                    className="chat-input"
                    style={{ border: 'none', background: 'transparent' }}
                    placeholder="Ej: Pizzería del Valle / Don Juan"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                  Teléfono de WhatsApp
                </label>
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.4rem 0.75rem' }}>
                  <Phone size={16} color="var(--text-dim)" />
                  <input
                    type="text"
                    className="chat-input"
                    style={{ border: 'none', background: 'transparent' }}
                    placeholder="+569 8617 6136"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                    Valor Estimado
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.4rem 0.75rem' }}>
                    <DollarSign size={16} color="var(--text-dim)" />
                    <input
                      type="text"
                      className="chat-input"
                      style={{ border: 'none', background: 'transparent' }}
                      placeholder="$150.000"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                    Etapa Inicial del Embudo
                  </label>
                  <select
                    className="chat-input"
                    style={{ width: '100%', padding: '0.55rem' }}
                    value={targetColumnId}
                    onChange={(e) => setTargetColumnId(e.target.value)}
                  >
                    {columns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                  Notas / Detalles del Pedido o Consulta
                </label>
                <textarea
                  className="chat-input"
                  rows={3}
                  style={{ width: '100%', resize: 'vertical' }}
                  placeholder="Ej: Interesado en 10 Pizzas Familiares para evento el fin de semana."
                  value={items}
                  onChange={(e) => setItems(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting || !contactName.trim()}>
                  {submitting ? 'Creando...' : 'Crear Oportunidad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
