import React, { useState, useEffect, useRef } from 'react';
import { API } from '../services/api';
import { FileText, Globe, Lock, Plus, Copy, Check, Trash2, Tag, Eye, Image as ImageIcon, Video, File, Type, Sparkles, Upload, Link as LinkIcon, FolderOpen } from 'lucide-react';

export const TemplatesView: React.FC = () => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('Todas');
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchTemplates = async () => {
    try {
      const res = await API.get('/templates?tenantId=tenant_demo_pizzeria');
      if (res.data.success) {
        setTemplates(res.data.templates);
        setCategories(['Todas', ...(res.data.categories || [])]);
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
    try {
      const res = await API.post('/templates', {
        title,
        category,
        headerType,
        headerContent,
        content,
        footer,
        isGlobal,
        mediaUrl,
        tenantId: 'tenant_demo_pizzeria',
      });
      if (res.data.success) {
        setShowModal(false);
        setTitle('');
        setContent('');
        setFooter('');
        setHeaderContent('');
        setFileName('');
        setMediaUrl('');
        fetchTemplates();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('¿Deseas eliminar esta plantilla?')) return;
    try {
      await API.delete(`/templates/${id}`);
      fetchTemplates();
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

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📚 Biblioteca de Plantillas Ricas (Adjuntos Completos)
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Crea plantillas con imágenes completas sin recortar, videos, PDF y texto explicativo.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Crear Plantilla Rica
        </button>
      </div>

      {/* Pill Filter por Categorías */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
        {categories.map((cat) => (
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

      {/* Grid de Plantillas Ricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.25rem' }}>
        {filteredTemplates.map((tmpl) => (
          <div key={tmpl.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {tmpl.isGlobal ? (
                    <Globe size={16} color="var(--primary)" />
                  ) : (
                    <Lock size={16} color="var(--accent-amber)" />
                  )}
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{tmpl.title}</span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <span className="badge badge-blue">{tmpl.category}</span>
                  {!tmpl.isGlobal && (
                    <button
                      onClick={() => handleDeleteTemplate(tmpl.id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', padding: '2px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Burbuja Estilo WhatsApp Nativo con Imagen Completa y Texto abajo */}
              <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid var(--accent-green)', borderRadius: 'var(--radius-md)', padding: '0.5rem', marginBottom: '0.75rem' }}>
                {tmpl.headerType === 'IMAGE' && tmpl.headerContent && (
                  <img
                    src={tmpl.headerContent}
                    alt="Imagen Completa"
                    style={{ width: '100%', maxHeight: '240px', objectFit: 'contain', background: '#0a0a0c', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem' }}
                  />
                )}

                {tmpl.headerType === 'VIDEO' && tmpl.headerContent && (
                  <video
                    src={tmpl.headerContent}
                    controls
                    style={{ width: '100%', maxHeight: '200px', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem', background: '#0a0a0c' }}
                  />
                )}

                {tmpl.headerType === 'TEXT' && tmpl.headerContent && (
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--primary)', marginBottom: '0.5rem', padding: '0 0.5rem' }}>
                    {tmpl.headerContent.toUpperCase()}
                  </div>
                )}

                <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.5, padding: '0.25rem 0.5rem' }}>
                  {tmpl.content}
                  {tmpl.footer && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '4px', fontStyle: 'italic' }}>
                      {tmpl.footer}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {tmpl.variables?.map((v: string) => (
                  <span key={v} className="badge badge-amber" style={{ fontSize: '0.65rem' }}>
                    {`{{${v}}}`}
                  </span>
                ))}
              </div>
              <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => copyToClipboard(tmpl.content, tmpl.id)}>
                {copiedId === tmpl.id ? <Check size={12} color="var(--accent-green)" /> : <Copy size={12} />} Copiar
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Creador de Plantillas Ricas */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div className="glass-card" style={{ width: '740px', background: 'var(--bg-card-solid)', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            {/* Formulario */}
            <div>
              <h3 style={{ marginBottom: '1rem', fontWeight: 800 }}>✨ Creador de Plantilla WhatsApp</h3>
              <form onSubmit={handleCreateTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Título de la Plantilla</label>
                  <input
                    type="text"
                    className="chat-input"
                    style={{ width: '100%' }}
                    placeholder="Ej: Promo Pizza Combo 2x1"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Categoría</label>
                    <input
                      type="text"
                      className="chat-input"
                      style={{ width: '100%' }}
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Tipo de Archivo Adjunto</label>
                    <select
                      className="chat-input"
                      style={{ width: '100%' }}
                      value={headerType}
                      onChange={(e: any) => setHeaderType(e.target.value)}
                    >
                      <option value="IMAGE">📷 Imagen</option>
                      <option value="VIDEO">🎬 Video</option>
                      <option value="DOCUMENT">📄 Documento PDF</option>
                      <option value="TEXT">✏️ Texto Destacado</option>
                    </select>
                  </div>
                </div>

                {/* Dual Mode Switcher: Subir Archivo vs Usar URL */}
                {headerType !== 'TEXT' && (
                  <div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '6px' }}>
                      <button
                        type="button"
                        className={`btn btn-secondary ${inputMode === 'UPLOAD' ? 'active' : ''}`}
                        style={{ padding: '3px 10px', fontSize: '0.75rem', background: inputMode === 'UPLOAD' ? 'var(--primary)' : 'var(--bg-main)', color: inputMode === 'UPLOAD' ? 'white' : 'var(--text-muted)' }}
                        onClick={() => setInputMode('UPLOAD')}
                      >
                        <Upload size={12} /> Subir Archivo de PC
                      </button>

                      <button
                        type="button"
                        className={`btn btn-secondary ${inputMode === 'URL' ? 'active' : ''}`}
                        style={{ padding: '3px 10px', fontSize: '0.75rem', background: inputMode === 'URL' ? 'var(--primary)' : 'var(--bg-main)', color: inputMode === 'URL' ? 'white' : 'var(--text-muted)' }}
                        onClick={() => setInputMode('URL')}
                      >
                        <LinkIcon size={12} /> Pegar Enlace / URL
                      </button>
                    </div>

                    {inputMode === 'UPLOAD' ? (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          border: '2px dashed var(--primary-glow)',
                          borderRadius: 'var(--radius-md)',
                          padding: '0.85rem',
                          textAlign: 'center',
                          cursor: 'pointer',
                          background: 'rgba(99, 102, 241, 0.05)',
                        }}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept={headerType === 'IMAGE' ? 'image/*' : headerType === 'VIDEO' ? 'video/*' : '.pdf,application/pdf'}
                          style={{ display: 'none' }}
                          onChange={handleFileUpload}
                        />
                        <Upload size={22} color="var(--primary)" style={{ margin: '0 auto 4px auto' }} />
                        <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                          {fileName ? `Archivo cargado: ${fileName}` : 'Haz clic para subir tu Imagen, Video o PDF'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                          Soporta JPG, PNG, MP4, PDF
                        </div>
                      </div>
                    ) : (
                      <input
                        type="text"
                        className="chat-input"
                        style={{ width: '100%' }}
                        placeholder="https://..."
                        value={headerContent}
                        onChange={(e) => setHeaderContent(e.target.value)}
                      />
                    )}
                  </div>
                )}

                {headerType === 'TEXT' && (
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Texto del Encabezado</label>
                    <input
                      type="text"
                      className="chat-input"
                      style={{ width: '100%' }}
                      placeholder="Ej: 🔥 PROMO EXCLUSIVA DE VIERNES"
                      value={headerContent}
                      onChange={(e) => setHeaderContent(e.target.value)}
                    />
                  </div>
                )}

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cuerpo Explicativo Largo</label>
                    <span style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>+ Variables:</span>
                  </div>

                  <div style={{ display: 'flex', gap: '4px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    {['nombre', 'empresa', 'pedido', 'fecha', 'precio'].map((v) => (
                      <button
                        key={v}
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: '0.65rem', padding: '2px 6px' }}
                        onClick={() => insertVariable(v)}
                      >
                        + {`{{${v}}}`}
                      </button>
                    ))}
                  </div>

                  <textarea
                    className="chat-input"
                    style={{ width: '100%', height: '80px', resize: 'none' }}
                    placeholder="Escribe el texto detallado..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Pie de Página (Opcional - Firma)
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

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Guardar Plantilla Rica
                  </button>
                </div>
              </form>
            </div>

            {/* Vista Previa WhatsApp Nativa: Imagen Completa sin recortes y Texto hacia abajo */}
            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Eye size={14} /> Vista Previa WhatsApp Nativa
                </div>

                {/* Contenedor Nativo Estilo WhatsApp Mensaje Multi-Media */}
                <div className="msg-bubble outbound" style={{ width: '100%', padding: '0.4rem', borderRadius: 'var(--radius-md)' }}>
                  {headerType === 'IMAGE' && headerContent && (
                    <img
                      src={headerContent}
                      alt="Imagen Completa"
                      style={{
                        width: '100%',
                        maxHeight: '260px',
                        objectFit: 'contain',
                        background: '#0a0a0c',
                        borderRadius: 'var(--radius-sm)',
                        marginBottom: '0.5rem',
                        display: 'block',
                      }}
                    />
                  )}

                  {headerType === 'VIDEO' && headerContent && (
                    <video
                      src={headerContent}
                      controls
                      style={{ width: '100%', maxHeight: '220px', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem', background: '#0a0a0c' }}
                    />
                  )}

                  {headerType === 'DOCUMENT' && (
                    <div style={{ background: 'rgba(255,255,255,0.1)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                      <File size={22} color="white" />
                      <span>{fileName || 'Documento PDF Adjunto'}</span>
                    </div>
                  )}

                  {headerType === 'TEXT' && headerContent && (
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#67e8f9', marginBottom: '0.35rem', padding: '0.25rem' }}>
                      {headerContent.toUpperCase()}
                    </div>
                  )}

                  <div style={{ fontSize: '0.85rem', lineHeight: 1.5, padding: '0.25rem' }}>
                    {content || 'Escribe el cuerpo explicativo largo para ver la vista previa...'}
                    {footer && (
                      <div style={{ fontSize: '0.7rem', opacity: 0.8, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '4px', marginTop: '6px', fontStyle: 'italic' }}>
                        {footer}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textAlign: 'center', marginTop: '1rem' }}>
                OpenWA Rich Template Format
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
