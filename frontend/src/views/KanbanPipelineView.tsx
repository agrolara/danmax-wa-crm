import React, { useState, useEffect } from 'react';
import { API } from '../services/api';
import { socket } from '../services/socket';
import { Zap, MessageSquare, Plus, ArrowRight, CheckCircle } from 'lucide-react';

export const KanbanPipelineView: React.FC = () => {
  const [columns, setColumns] = useState<any[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

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

    return () => {
      socket.off('kanban_updated');
    };
  }, []);

  const handleMoveLead = async (leadId: string, targetColumnId: string) => {
    try {
      const res = await API.post('/kanban/move-lead', {
        leadId,
        targetColumnId,
        tenantId: 'tenant_demo_pizzeria',
      });
      if (res.data.success) {
        setColumns(res.data.columns);
        setNotification(res.data.message);
        setTimeout(() => setNotification(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🎯 Embudo de Ventas Kanban Automatizado
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Mueve las oportunidades entre columnas. Al arrastrar un cliente, se enviará la plantilla de WhatsApp configurada automáticamente.
          </p>
        </div>
        <button className="btn btn-primary">
          <Plus size={16} /> Nueva Oportunidad
        </button>
      </div>

      {notification && (
        <div style={{ background: 'rgba(99, 102, 241, 0.2)', border: '1px solid var(--primary)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <Zap size={16} color="var(--primary)" />
          <span>{notification}</span>
        </div>
      )}

      <div className="kanban-board" style={{ padding: 0 }}>
        {columns.map((col) => (
          <div key={col.id} className="kanban-column">
            <div className="column-header">
              <div className="column-title">
                <span className="column-badge" style={{ backgroundColor: col.color }}></span>
                <span>{col.name}</span>
              </div>
              <span className="badge badge-blue">{col.leads.length}</span>
            </div>

            {col.autoTemplateText && (
              <div style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Zap size={12} color="var(--accent-amber)" /> Auto-Template Activo
              </div>
            )}

            <div className="column-cards-container">
              {col.leads.map((lead: any) => (
                <div key={lead.id} className="kanban-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{lead.contactName}</span>
                    <span className="badge badge-green">{lead.value}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    {lead.items}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.75rem' }}>
                    📱 {lead.phone}
                  </div>

                  {/* Move action buttons for quick pipeline transition */}
                  <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem' }}>
                    {columns.map(
                      (targetCol) =>
                        targetCol.id !== col.id && (
                          <button
                            key={targetCol.id}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.68rem', padding: '2px 6px', flex: 1 }}
                            title={`Mover a ${targetCol.name}`}
                            onClick={() => handleMoveLead(lead.id, targetCol.id)}
                          >
                            <ArrowRight size={10} /> {targetCol.name}
                          </button>
                        )
                    )}
                  </div>
                </div>
              ))}

              {col.leads.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem', padding: '2rem 0' }}>
                  Sin oportunidades en esta columna
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
