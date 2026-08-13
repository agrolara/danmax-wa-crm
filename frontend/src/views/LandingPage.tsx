import React from 'react';
import { Sparkles, MessageSquare, Kanban, Calendar, Users, ShieldCheck, Zap, ArrowRight, QrCode, FileText, LogIn } from 'lucide-react';

interface LandingPageProps {
  onOpenRegister: () => void;
  onOpenLogin: () => void;
  onGoToDashboard: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenRegister, onOpenLogin }) => {
  return (
    <div style={{ background: 'var(--bg-main)', minHeight: '100vh', color: 'var(--text-main)', paddingBottom: '5rem' }}>
      {/* Header Landing Navbar */}
      <nav style={{ padding: '1.25rem 3rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', backdropFilter: 'blur(12px)', background: 'var(--bg-card)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '42px', height: '42px', background: 'linear-gradient(135deg, var(--primary), var(--accent-blue))', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800 }}>
            WA
          </div>
          <div>
            <span style={{ fontSize: '1.4rem', fontWeight: 900, background: 'linear-gradient(135deg, #fff, var(--text-muted))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              DanMax WA
            </span>
            <span className="badge badge-blue" style={{ marginLeft: '8px', fontSize: '0.65rem' }}>Marca Blanca SaaS</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="btn btn-secondary" style={{ padding: '0.65rem 1.25rem', fontSize: '0.9rem' }} onClick={onOpenLogin}>
            <LogIn size={16} /> Iniciar Sesión
          </button>
          <button className="btn btn-primary" style={{ padding: '0.65rem 1.5rem', fontSize: '0.9rem' }} onClick={onOpenRegister}>
            <Sparkles size={16} /> Registrar Negocio
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{ maxWidth: '1200px', margin: '3.5rem auto 2rem auto', textAlign: 'center', padding: '0 1.5rem' }}>
        <div className="badge badge-amber" style={{ marginBottom: '1.25rem', padding: '6px 16px', fontSize: '0.85rem' }}>
          <Zap size={14} /> Potenciado por el Motor de OpenWA API
        </div>

        <h1 style={{ fontSize: '3.4rem', fontWeight: 900, lineHeight: 1.15, marginBottom: '1.25rem', letterSpacing: '-1px' }}>
          El CRM Multi-Tenant para <br />
          <span style={{ background: 'linear-gradient(135deg, var(--primary), #67e8f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Multiplicar las Ventas de tu Negocio por WhatsApp
          </span>
        </h1>

        <p style={{ fontSize: '1.15rem', color: 'var(--text-muted)', maxWidth: '780px', margin: '0 auto 2.5rem auto', lineHeight: 1.6 }}>
          Conecta el WhatsApp de tu empresa escaneando un código QR. Atiende a tus clientes con una bandeja multi-agente, automatiza etapas de venta en Kanban y envía difusiones masivas a grupos e individuales.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button className="btn btn-primary" style={{ padding: '1rem 2.5rem', fontSize: '1.1rem', borderRadius: 'var(--radius-md)' }} onClick={onOpenRegister}>
            📱 Registrar Negocio & Vincular WhatsApp <ArrowRight size={20} />
          </button>
        </div>
      </section>

      {/* Showcase Visual Hero Cards: Capturas del CRM */}
      <section style={{ maxWidth: '1150px', margin: '3rem auto', padding: '0 1.5rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(16, 185, 129, 0.08))', border: '1px solid var(--primary-glow)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '40px', height: '40px', background: '#25D366', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800 }}>
                💬
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Bandeja Multi-Agente & Difusión Masiva DanMax WA</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Múltiples vendedores conectados a la misma línea oficial</span>
              </div>
            </div>
            <span className="badge badge-green" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>🟢 Estado Conectado / READY</span>
          </div>

          {/* Grid de Vistas Previas Visuales del CRM */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            
            {/* Visual 1: Conversaciones & Bandeja */}
            <div style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem', color: 'var(--primary)', fontWeight: 800, fontSize: '0.9rem' }}>
                <MessageSquare size={18} /> 💬 Bandeja Multi-Agente
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ background: 'var(--bg-main)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #25D366' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700 }}>
                    <span>Mauricio Lara</span>
                    <span style={{ color: 'var(--accent-green)', fontSize: '0.7rem' }}>10:42 AM</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Hola, quisiera cotizar la pizza combo 2x1...
                  </div>
                </div>

                <div style={{ background: 'var(--bg-main)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent-blue)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700 }}>
                    <span>Cliente Pizzeria Don Luigi</span>
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>Ayer</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    ¡Excelente atención! Muchas gracias.
                  </div>
                </div>
              </div>
            </div>

            {/* Visual 2: Kanban Pipeline */}
            <div style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem', color: 'var(--accent-amber)', fontWeight: 800, fontSize: '0.9rem' }}>
                <Kanban size={18} /> 🎯 Embudo Kanban de Ventas
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--accent-amber)', borderRadius: 'var(--radius-sm)', padding: '0.6rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-amber)', marginBottom: '4px' }}>📥 Prospectos</div>
                  <div style={{ fontSize: '0.7rem', background: 'var(--bg-main)', padding: '4px', borderRadius: '4px', marginBottom: '2px' }}>🍕 Mauricio Lara ($15.990)</div>
                </div>

                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--accent-green)', borderRadius: 'var(--radius-sm)', padding: '0.6rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-green)', marginBottom: '4px' }}>✅ Vendidos</div>
                  <div style={{ fontSize: '0.7rem', background: 'var(--bg-main)', padding: '4px', borderRadius: '4px' }}>🎉 Juan Pérez ($28.500)</div>
                </div>
              </div>
            </div>

            {/* Visual 3: Calendario & Grupos */}
            <div style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem', color: 'var(--accent-blue)', fontWeight: 800, fontSize: '0.9rem' }}>
                <Calendar size={18} /> 📅 Difusión & Grupos WhatsApp
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ background: 'var(--bg-main)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>👥 <b>Quilicura Vende</b> (Categoría: Ventas)</span>
                  <span className="badge badge-amber" style={{ fontSize: '0.65rem' }}>18 msgs</span>
                </div>
                <div style={{ background: 'var(--bg-main)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>📢 <b>Promo Viernes 2x1</b> (15 de Agosto)</span>
                  <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>Agendado</span>
                </div>
              </div>
            </div>

            {/* Visual 4: Plantillas Ricas */}
            <div style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem', color: 'var(--primary)', fontWeight: 800, fontSize: '0.9rem' }}>
                <FileText size={18} /> 📚 Plantillas con Adjuntos Completo
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--accent-green)', borderRadius: 'var(--radius-sm)', padding: '0.65rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-green)', marginBottom: '2px' }}>📷 Afiche Promocional + PDF Catálogo</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {"¡Hola {{nombre}}! Te compartimos nuestra carta completa..."}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Feature Cards Grid */}
      <section style={{ maxWidth: '1150px', margin: '4rem auto', padding: '0 1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        <div className="glass-card">
          <div style={{ width: '48px', height: '48px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <QrCode size={24} color="var(--primary)" />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>📱 Vinculación Autoservicio QR</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Tu cliente escanea el código QR directamente desde su navegador. La sesión de WhatsApp se conecta de inmediato sin servidores manuales.
          </p>
        </div>

        <div className="glass-card">
          <div style={{ width: '48px', height: '48px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <MessageSquare size={24} color="var(--accent-green)" />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>💬 Bandeja Multi-Agente</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Permite que varios vendedores de tu empresa respondan desde la misma línea oficial con asignación de chats e historial en tiempo real.
          </p>
        </div>

        <div className="glass-card">
          <div style={{ width: '48px', height: '48px', background: 'rgba(245, 158, 11, 0.15)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <Kanban size={24} color="var(--accent-amber)" />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>🎯 Embudo Kanban de Ventas</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Visualiza el avance de tus negocios por columnas Drag & Drop y dispara plantillas automáticas por WhatsApp al cambiar de etapa.
          </p>
        </div>

        <div className="glass-card">
          <div style={{ width: '48px', height: '48px', background: 'rgba(59, 130, 246, 0.15)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <Users size={24} color="var(--accent-blue)" />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>👥 Búsqueda & Categorías de Grupos</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Organiza tus grupos de WhatsApp en categorías personalizadas y envía difusiones ricas con 1-clic a toda tu audiencia objetivo.
          </p>
        </div>

        <div className="glass-card">
          <div style={{ width: '48px', height: '48px', background: 'rgba(244, 63, 94, 0.15)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <Calendar size={24} color="var(--accent-rose)" />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>📅 Calendario Visual de Difusión</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Planifica tus campañas publicitarias de WhatsApp en una vista mensual estilo Google Calendar integrada al motor de agendamiento.
          </p>
        </div>

        <div className="glass-card">
          <div style={{ width: '48px', height: '48px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <ShieldCheck size={24} color="var(--primary)" />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>🔒 Marca Blanca & Aislamiento SaaS</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Cada empresa opera en su entorno multi-tenant aislado con Llave API de operador dedicada y protección total de datos.
          </p>
        </div>
      </section>

      {/* CTA Final */}
      <section style={{ maxWidth: '950px', margin: '4rem auto 0 auto', textAlign: 'center', padding: '3rem 2rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(59, 130, 246, 0.1))', border: '1px solid var(--primary-glow)', borderRadius: 'var(--radius-lg)' }}>
        <h2 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '1rem' }}>¿Listo para potenciar las ventas de tu empresa?</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '2rem' }}>
          Registra tu negocio en DanMax WA y vincula tu línea oficial de WhatsApp en menos de 2 minutos.
        </p>
        <button className="btn btn-primary" style={{ padding: '0.9rem 2.2rem', fontSize: '1.05rem' }} onClick={onOpenRegister}>
          Registrar Negocio & Vincular WhatsApp
        </button>
      </section>
    </div>
  );
};
