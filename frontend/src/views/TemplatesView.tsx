import React, { useState, useEffect, useRef } from 'react';
import { API } from '../services/api';
import { FileText, Globe, Lock, Plus, Copy, Check, Trash2, Tag, Eye, Image as ImageIcon, Video, File, Type, Sparkles, Upload, Link as LinkIcon, FolderOpen, CheckCircle2, X } from 'lucide-react';

export const TemplatesView: React.FC = () => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(['Todas']);
  const [activeCategory, setActiveCategory] = useState<string>('Todas');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  // Modal Rich Template Builder State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Promociones');
  const [headerType, setHeaderType] = useState<'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'TEXT'>('IMAGE');

  // Input Mode: 'UPLOAD' vs 'URL'
  const [inputMode, setInputMode] = useState<'UPLOAD' | 'URL'>('UPLOAD');
  const [headerContent, setHeaderContent] = useState('https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800');
  const [fileName, setFileName] = useState<string>('');

  const [content, setContent] = useState('');
  const [footer, setFooter] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [isGlobal, setIsGlobal] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchTemplates = async () => {
    try {
      const res = await API.get('/templates?tenantId=global_whatsapp_line');
      if (res.data.success) {
        setTemplates(res.data.templates || []);
        if (res.data.categories) {
          setCategories(Array.from(new Set(['Todas', ...res.data.categories])));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setHeaderContent(event.target.result as string);
        setMediaUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setSaving(true);
    try {
      const res = await API.post('/templates', {
        title: title.trim(),
        category,
        headerType,
        headerContent,
        content: content.trim(),
        footer: footer.trim(),
        isGlobal,
        mediaUrl,
        tenantId: 'global_whatsapp_line',
      });

      if (res.data.success) {
        if (res.data.templates) setTemplates(res.data.templates);
        if (res.data.categories) setCategories(Array.from(new Set(['Todas', ...res.data.categories])));

        setShowModal(false);
        setTitle('');
        setContent('');
        setFooter('');
        setHeaderContent('');
        setFileName('');
        setMediaUrl('');
        setStatusNotification(res.data.message || `✨ Plantilla "${title}" guardada exitosamente de forma 100% permanente.`);
        setTimeout(() => setStatusNotification(null), 4000);
        fetchTemplates();
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Error al guardar la plantilla';
      alert(`Error al guardar la plantilla: ${errorMsg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('¿Deseas eliminar esta plantilla?')) return;
    try {
      const res = await API.delete(`/templates/${id}?tenantId=global_whatsapp_line`);
      if (res.data.success) {
        if (res.data.templates) setTemplates(res.data.templates);
        setStatusNotification('Plantilla eliminada.');
        setTimeout(() => setStatusNotification(null), 3000);
        fetchTemplates();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const insertVariable = (varName: string) => {
    setContent((prev) => `${prev} {{${varName}}}`);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredTemplates = templates.filter((t) => {
    if (activeCategory === 'Todas') return true;
    return t.category === activeCategory;
  });

  const uniqueCategories = Array.from(new Set(categories.includes('Todas') ? categories : ['Todas', ...categories]));

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📚 Biblioteca de Plantillas Ricas ({templates.length} guardadas)
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Crea plantillas con imágenes completas sin recortar, videos, PDF y texto explicativo. Se guardan de forma 100% permanente.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Crear Plantilla Rica
        </button>
      </div>

      {statusNotification && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--accent-green)', color: 'var(--accent-green)', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
          <CheckCircle2 size={18} /> {statusNotification}
        </div>
      )}

      {/* Pill Filter por Categorías */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
        {uniqueCategories.map((cat) => (
          <button
            key={cat}
            className={`btn btn-secondary ${activeCategory === cat ? 'active' : ''}`}
            style={{
              padding: '0.4rem 1rem',
              fontSize: '0.8rem',
              borderRadius: 'var(--radius-full)',
              background: activeCategory === cat ? 'var(--primary)' : 'var(--bg-card)',
              color: activeCategory === cat ? 'white' : 'var(--text-muted)',
              border: '1px solid var(--border-color)',
            }}
            onClick={() => setActiveCategory(cat)}
          >
            <Tag size={12} /> {cat}
          </button>
        ))}
      </div>

      {/* Lista de Plantillas */}
      {filteredTemplates.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <FileText size={48} color="var(--primary)" style={{ marginBottom: '1rem', opacity: 0.7 }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>No hay plantillas guardadas en esta categoría</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '1rem' }}>
            Haz clic en "Crear Plantilla Rica" para agregar tu primera plantilla con imagen, PDF o video.
          </p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Crear Plantilla Rica
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {filteredTemplates.map((t) => (
            <div key={t.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <span className="badge badge-purple" style={{ marginBottom: '4px', display: 'inline-block' }}>
                      {t.category}
                    </span>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>{t.title}</h3>
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '4px 6px', color: 'var(--accent-rose)' }}
                    title="Eliminar Plantilla"
                    onClick={() => handleDeleteTemplate(t.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Adjunto Multimedia Header */}
                {(t.mediaUrl || t.headerContent) && (
                  <div style={{ marginBottom: '0.75rem', borderRadius: 'var(--radius-md)', overflow: 'hidden', maxHeight: '140px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {t.headerType === 'VIDEO' ? (
                      <video src={t.mediaUrl || t.headerContent} controls style={{ width: '100%', maxHeight: '140px', objectFit: 'contain' }} />
                    ) : t.headerType === 'DOCUMENT' ? (
                      <div style={{ padding: '1rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                        <File size={20} color="var(--primary)" /> 📄 Documento Adjunto PDF
                      </div>
                    ) : (
                      <img src={t.mediaUrl || t.headerContent} alt={t.title} style={{ width: '100%', maxHeight: '140px', objectFit: 'contain' }} />
                    )}
                  </div>
                )}

                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', marginBottom: '0.75rem', background: 'var(--bg-main)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  {t.content}
                </div>

                {t.footer && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: '0.75rem' }}>
                    _{t.footer}_
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {t.variables && t.variables.map((v: string) => (
                    <span key={v} className="badge badge-blue" style={{ fontSize: '0.65rem' }}>
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>

                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                  onClick={() => copyToClipboard(t.content, t.id)}
                >
                  {copiedId === t.id ? <Check size={14} color="var(--accent-green)" /> : <Copy size={14} />}
                  <span>{copiedId === t.id ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear Plantilla Rica */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="glass-card modal-content" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={20} color="var(--primary)" />
                <span>Crear Nueva Plantilla Rica</span>
              </h3>
              <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setShowModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                  Título de la Plantilla *
                </label>
                <input
                  type="text"
                  required
                  className="chat-input"
                  style={{ width: '100%' }}
                  placeholder="Ej: 🔥 Oferta Especial Combo Familiar"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                    Categoría
                  </label>
                  <select
                    className="chat-input"
                    style={{ width: '100%' }}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {uniqueCategories.filter((c) => c !== 'Todas').map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                    Tipo de Archivo Adjunto
                  </label>
                  <select
                    className="chat-input"
                    style={{ width: '100%' }}
                    value={headerType}
                    onChange={(e) => setHeaderType(e.target.value as any)}
                  >
                    <option value="IMAGE">🖼️ Imagen</option>
                    <option value="VIDEO">🎬 Video</option>
                    <option value="DOCUMENT">📄 Documento PDF</option>
                    <option value="TEXT">💬 Solo Texto</option>
                  </select>
                </div>
              </div>

              {headerType !== 'TEXT' && (
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                    Archivo Adjunto (Subir de PC o Enlace URL)
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <button
                      type="button"
                      className={`btn ${inputMode === 'UPLOAD' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                      onClick={() => setInputMode('UPLOAD')}
                    >
                      <Upload size={14} /> 📁 Subir de PC
                    </button>
                    <button
                      type="button"
                      className={`btn ${inputMode === 'URL' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                      onClick={() => setInputMode('URL')}
                    >
                      <LinkIcon size={14} /> 🌐 Pegar Enlace URL
                    </button>
                  </div>

                  {inputMode === 'UPLOAD' ? (
                    <div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept="image/*,video/*,application/pdf"
                        onChange={handleFileUpload}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ width: '100%', justifyContent: 'center', borderStyle: 'dashed' }}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload size={16} /> {fileName ? `Adjunto: ${fileName}` : 'Seleccionar Archivo de tu PC...'}
                      </button>
                    </div>
                  ) : (
                    <input
                      type="url"
                      className="chat-input"
                      style={{ width: '100%' }}
                      placeholder="https://ejemplo.com/imagen.jpg"
                      value={mediaUrl}
                      onChange={(e) => {
                        setMediaUrl(e.target.value);
                        setHeaderContent(e.target.value);
                      }}
                    />
                  )}
                </div>
              )}

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Cuerpo del Mensaje Explicativo *
                  </label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                      onClick={() => insertVariable('nombre')}
                    >
                      + {"{{nombre}}"}
                    </button>
                  </div>
                </div>
                <textarea
                  required
                  className="chat-input"
                  rows={4}
                  style={{ width: '100%', resize: 'vertical' }}
                  placeholder="¡Hola {{nombre}}! Escribe el texto explicativo de tu plantilla aquí..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                  Pie de Firma / Nombre de Empresa (Opcional)
                </label>
                <input
                  type="text"
                  className="chat-input"
                  style={{ width: '100%' }}
                  placeholder="Ej: Pizzería Don Luigi • Pedidos al +56986176136"
                  value={footer}
                  onChange={(e) => setFooter(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving || !title.trim() || !content.trim()}>
                  {saving ? 'Guardando...' : 'Guardar Plantilla Rica'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
