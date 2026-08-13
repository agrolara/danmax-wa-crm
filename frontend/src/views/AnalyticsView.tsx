import React from 'react';
import { BarChart3, TrendingUp, MessageSquare, CheckCheck, Users, Zap } from 'lucide-react';

export const AnalyticsView: React.FC = () => {
  const stats = [
    { title: 'Mensajes Enviados', value: '4,892', change: '+18%', icon: MessageSquare, color: 'var(--primary)' },
    { title: 'Tasa de Lectura OpenWA', value: '96.4%', change: '+3.2%', icon: CheckCheck, color: 'var(--accent-green)' },
    { title: 'Contactos Activos', value: '1,240', change: '+24 nuevos', icon: Users, color: 'var(--accent-blue)' },
    { title: 'Automatizaciones Disparadas', value: '648', change: '+42 hoy', icon: Zap, color: 'var(--accent-amber)' },
  ];

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>📊 Tablero de Analítica y Estadísticas</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Métricas en tiempo real sobre la actividad de WhatsApp, rendimiento del equipo de ventas y conversión.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        {stats.map((st) => {
          const Icon = st.icon;
          return (
            <div key={st.title} className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>{st.title}</span>
                <Icon size={20} color={st.color} />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{st.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '2px', marginTop: '0.25rem' }}>
                <TrendingUp size={12} /> {st.change} este mes
              </div>
            </div>
          );
        })}
      </div>

      <div className="glass-card">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>📈 Actividad por Hora de Envío</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', height: '180px', padding: '1rem 0' }}>
          {[35, 60, 45, 90, 120, 80, 150, 190, 110, 75, 40].map((h, idx) => (
            <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '100%',
                  height: `${h}px`,
                  background: 'linear-gradient(180deg, var(--primary), var(--accent-blue))',
                  borderRadius: 'var(--radius-sm)',
                }}
              ></div>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>{idx + 9}h</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
