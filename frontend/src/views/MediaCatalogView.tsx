import React, { useState, useEffect } from 'react';
import { API } from '../services/api';
import { FolderOpen, FileText, Image as ImageIcon, Music, Send, Plus } from 'lucide-react';

export const MediaCatalogView: React.FC = () => {
  const [mediaItems, setMediaItems] = useState<any[]>([]);

  const fetchMedia = async () => {
    try {
      const res = await API.get('/media');
      if (res.data.success) {
        setMediaItems(res.data.media);
      }
    } catch (err) {
      console.error(err);
    }
  };


  useEffect(() => {
    fetchMedia();
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'PDF':
        return <FileText size={24} color="var(--accent-rose)" />;
      case 'IMAGE':
        return <ImageIcon size={24} color="var(--accent-blue)" />;
      case 'AUDIO':
        return <Music size={24} color="var(--accent-green)" />;
      default:
        return <FolderOpen size={24} color="var(--primary)" />;
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>🖼️ Galería de Medios y Catálogo Rápido</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Envío rápido con 1 clic de catálogos PDF, imágenes promocionales y notas de voz pregrabadas por WhatsApp.
          </p>
        </div>
        <button className="btn btn-primary">
          <Plus size={16} /> Subir Archivo
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
        {mediaItems.map((item) => (
          <div key={item.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                {getIcon(item.type)}
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{item.title}</span>
              </div>
              {item.type === 'IMAGE' && (
                <img src={item.fileUrl} alt={item.title} style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: '0.75rem' }} />
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                {(item.sizeBytes / (1024 * 1024)).toFixed(2)} MB
              </span>
              <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                <Send size={12} /> Envío Rápido
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
