import React, { useState } from 'react';
import { API } from '../services/api';
import { X, Sparkles, Building2, Mail, Lock, User } from 'lucide-react';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (userData: any) => void;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await API.post('/auth/register-tenant', {
        businessName,
        email,
        password,
        fullName,
      });

      if (res.data.success) {
        localStorage.setItem('danmax_token', res.data.token);
        onSuccess(res.data.user);
        onClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al registrar el negocio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div className="glass-card" style={{ width: '440px', background: 'var(--bg-card-solid)', position: 'relative' }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, var(--primary), var(--accent-blue))', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem auto', color: 'white', fontWeight: 800 }}>
            WA
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Registra tu Negocio en DanMax WA</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Obtén tu cuenta multi-tenant aislada y conecta tu WhatsApp de inmediato.
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(244, 63, 94, 0.15)', border: '1px solid var(--accent-rose)', color: 'var(--accent-rose)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Nombre de tu Negocio / Empresa
            </label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem' }}>
              <Building2 size={16} color="var(--text-dim)" />
              <input
                type="text"
                placeholder="Ej: Pizzería Don Luigi, Inmobiliaria..."
                style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', marginLeft: '0.5rem', width: '100%', fontSize: '0.875rem' }}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Tu Nombre Completo
            </label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem' }}>
              <User size={16} color="var(--text-dim)" />
              <input
                type="text"
                placeholder="Ej: Carlos Mendoza"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', marginLeft: '0.5rem', width: '100%', fontSize: '0.875rem' }}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Correo Electrónico Corporativo
            </label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem' }}>
              <Mail size={16} color="var(--text-dim)" />
              <input
                type="email"
                placeholder="contacto@tunegocio.com"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', marginLeft: '0.5rem', width: '100%', fontSize: '0.875rem' }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Contraseña
            </label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem' }}>
              <Lock size={16} color="var(--text-dim)" />
              <input
                type="password"
                placeholder="••••••••"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', marginLeft: '0.5rem', width: '100%', fontSize: '0.875rem' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', padding: '0.75rem' }} disabled={loading}>
            {loading ? 'Creando cuenta de negocio...' : 'Registrar Negocio & Conectar WhatsApp'}
          </button>
        </form>
      </div>
    </div>
  );
};
