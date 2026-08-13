import React, { useState, useEffect, useRef } from 'react';
import { API } from '../services/api';
import { Users, Search, Send, CheckSquare, Square, Zap, RefreshCw, CheckCircle2, Folder, Plus, Tag, X, FileText, Image as ImageIcon, Video, File, Eye, Upload, Link as LinkIcon } from 'lucide-react';

export const GroupsView: React.FC = () => {
  const [groups, setGroups] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(['Ventas Directas', 'Grupos Vecinales', 'General']);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('Todas');

  // Rich Broadcast Form State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [headerText, setHeaderText] = useState<string>('');
  const [broadcastMessage, setBroadcastMessage] = useState<string>('');
  const [footerText, setFooterText] = useState<string>('');

  // Dual mode input: 'UPLOAD' vs 'URL'
  const [mediaMode, setMediaMode] = useState<'UPLOAD' | 'URL'>('UPLOAD');
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');

  const [sending, setSending] = useState<boolean>(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  // Category Modal State
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [newCategoryInput, setNewCategoryInput] = useState<string>('');

  const groupFileInputRef = useRef<HTMLInputElement>(null);

  const fetchGroupsAndTemplates = async () => {
    try {
      const resGroups = await API.get('/groups');
      if (resGroups.data.success) {
        setGroups(resGroups.data.groups);
        if (resGroups.data.categories) {
          setCategories(resGroups.data.categories);
        }
      }

      const resTmpl = await API.get('/templates');
      if (resTmpl.data.success) {
        setTemplates(resTmpl.data.templates);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchGroupsAndTemplates();
  }, []);

  const handleGroupFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setMediaUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelectTemplate = (tmplId: string) => {
    setSelectedTemplateId(tmplId);
    if (!tmplId) return;

    const found = templates.find((t) => t.id === tmplId);
    if (found) {
      setHeaderText(found.headerContent || '');
      setBroadcastMessage(found.content || '');
      setFooterText(found.footer || '');
      setMediaUrl(found.mediaUrl || found.headerContent || '');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryInput.trim()) return;

    try {
      const res = await API.post('/groups/categories', { categoryName: newCategoryInput.trim() });
      if (res.data.success) {
        setCategories(res.data.categories);
        setActiveCategory(newCategoryInput.trim());
        setNewCategoryInput('');
        setShowCategoryModal(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleSelect = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const handleSelectAll = () => {
    const filteredIds = filteredGroups.map((g) => g.id);
    if (selectedGroupIds.length === filteredIds.length) {
      setSelectedGroupIds([]);
    } else {
      setSelectedGroupIds(filteredIds);
    }
  };

  const handleAssignCategory = async (groupId: string, newCategory: string) => {
    try {
      await API.post('/groups/assign-category', { groupId, category: newCategory });
      fetchGroupsAndTemplates();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendGroupBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedGroupIds.length === 0 || !broadcastMessage.trim()) return;

    setSending(true);
    setStatusNotification(null);
    try {
      const res = await API.post('/groups/broadcast', {
        groupIds: selectedGroupIds,
        messageText: broadcastMessage,
        headerText,
        footerText,
        mediaUrl,
      });

      if (res.data.success) {
        setStatusNotification(res.data.message);
        setBroadcastMessage('');
        setHeaderText('');
        setFooterText('');
        setMediaUrl('');
        setUploadedFileName('');
        setSelectedGroupIds([]);
        setTimeout(() => setStatusNotification(null), 5000);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error enviando difusión a grupos');
    } finally {
      setSending(false);
    }
  };

  const filteredGroups = groups.filter((g) => {
    const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'Todas' || g.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            👥 Grupos de WhatsApp & Difusiones Ricas ({groups.length} detectados)
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Selecciona plantillas o sube archivos adjuntos locales (Imágenes, Videos, PDF) para transmitir difusiones masivas.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-primary" onClick={() => setShowCategoryModal(true)}>
            <Plus size={16} /> Crear Categoría
          </button>

          <button className="btn btn-secondary" onClick={fetchGroupsAndTemplates}>
            <RefreshCw size={14} /> Actualizar Grupos
          </button>
        </div>
      </div>

      {statusNotification && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--accent-green)', color: 'var(--accent-green)', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
          <CheckCircle2 size={18} /> {statusNotification}
        </div>
      )}

      {/* Pill Filters por Categorías */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '4px' }}>
        {['Todas', ...categories].map((cat) => (
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
            <Folder size={12} /> {cat}
          </button>
        ))}
      </div>

      {/* Formulario de Difusión Rica a Grupos Seleccionados */}
      {selectedGroupIds.length > 0 && (
        <div className="glass-card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(59, 130, 246, 0.1))', border: '1px solid var(--primary-glow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={18} color="var(--primary)" /> Configurar Difusión para {selectedGroupIds.length} Grupos Seleccionados
            </h3>

            {/* Selector de Plantillas Guardadas */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={16} color="var(--accent-blue)" />
              <select
                className="chat-input"
                style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                value={selectedTemplateId}
                onChange={(e) => handleSelectTemplate(e.target.value)}
              >
                <option value="">-- Cargar Plantilla Guardada --</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.category})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <form onSubmit={handleSendGroupBroadcast} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Encabezado Destacado (Opcional)</label>
                <input
                  type="text"
                  className="chat-input"
                  style={{ width: '100%' }}
                  placeholder="Ej: 🔥 PROMO EXCLUSIVA DE HOY"
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Cuerpo Explicativo Detallado</label>
                <textarea
                  className="chat-input"
                  style={{ width: '100%', height: '70px', resize: 'none' }}
                  placeholder="Escribe el mensaje explicativo..."
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  required
                />
              </div>

              {/* Selector de Adjunto: Subir Archivo Local vs URL */}
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '4px' }}>
                  <button
                    type="button"
                    className={`btn btn-secondary ${mediaMode === 'UPLOAD' ? 'active' : ''}`}
                    style={{ padding: '2px 8px', fontSize: '0.7rem', background: mediaMode === 'UPLOAD' ? 'var(--primary)' : 'var(--bg-main)', color: mediaMode === 'UPLOAD' ? 'white' : 'var(--text-muted)' }}
                    onClick={() => setMediaMode('UPLOAD')}
                  >
                    <Upload size={12} /> Subir Archivo de PC
                  </button>

                  <button
                    type="button"
                    className={`btn btn-secondary ${mediaMode === 'URL' ? 'active' : ''}`}
                    style={{ padding: '2px 8px', fontSize: '0.7rem', background: mediaMode === 'URL' ? 'var(--primary)' : 'var(--bg-main)', color: mediaMode === 'URL' ? 'white' : 'var(--text-muted)' }}
                    onClick={() => setMediaMode('URL')}
                  >
                    <LinkIcon size={12} /> Pegar URL / Enlace
                  </button>
                </div>

                {mediaMode === 'UPLOAD' ? (
                  <div
                    onClick={() => groupFileInputRef.current?.click()}
                    style={{
                      border: '1px dashed var(--primary-glow)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.65rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: 'rgba(99, 102, 241, 0.05)',
                    }}
                  >
                    <input
                      ref={groupFileInputRef}
                      type="file"
                      accept="image/*,video/*,.pdf"
                      style={{ display: 'none' }}
                      onChange={handleGroupFileUpload}
                    />
                    <Upload size={18} color="var(--primary)" style={{ margin: '0 auto 2px auto' }} />
                    <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      {uploadedFileName ? `Adjunto: ${uploadedFileName}` : 'Clic para seleccionar Imagen, PDF o Video'}
                    </div>
                  </div>
                ) : (
                  <input
                    type="text"
                    className="chat-input"
                    style={{ width: '100%' }}
                    placeholder="https://..."
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                  />
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Pie de Página / Firma (Opcional)</label>
                <input
                  type="text"
                  className="chat-input"
                  style={{ width: '100%' }}
                  placeholder="Ej: DanMax WA • Pedidos"
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.25rem', padding: '0.65rem' }} disabled={sending}>
                {sending ? <RefreshCw size={16} className="spin" /> : <Send size={16} />}
                {sending ? 'Enviando difusión a grupos...' : `Enviar Difusión Masiva a ${selectedGroupIds.length} Grupos`}
              </button>
            </div>

            {/* Vista Previa de la Difusión Rica */}
            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Eye size={12} /> Vista Previa del Mensaje Rico
                </div>

                {mediaUrl && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <File size={12} /> Adjunto: {uploadedFileName || 'Archivo Adjunto'}
                  </div>
                )}

                {headerText && (
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '4px' }}>
                    {headerText.toUpperCase()}
                  </div>
                )}

                <div className="msg-bubble outbound" style={{ width: '100%', fontSize: '0.8rem' }}>
                  {broadcastMessage || 'Escribe el mensaje explicativo para ver la vista previa...'}
                  {footerText && (
                    <div style={{ fontSize: '0.68rem', opacity: 0.8, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '4px', marginTop: '6px', fontStyle: 'italic' }}>
                      {footerText}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textAlign: 'center', marginTop: '0.5rem' }}>
                Formato WhatsApp Multi-Media
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Bar de Búsqueda y Selección */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.5rem 1rem', width: '340px' }}>
          <Search size={16} color="var(--text-dim)" />
          <input
            type="text"
            placeholder="Buscar grupos por nombre..."
            style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', marginLeft: '0.5rem', fontSize: '0.85rem', width: '100%' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={handleSelectAll}>
          {selectedGroupIds.length === filteredGroups.length ? <CheckSquare size={14} /> : <Square size={14} />}
          {selectedGroupIds.length === filteredGroups.length ? 'Desmarcar Todos' : `Seleccionar Todos (${filteredGroups.length})`}
        </button>
      </div>

      {/* Grid de Grupos Estilo OpenWA */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
        {filteredGroups.map((group) => {
          const isSelected = selectedGroupIds.includes(group.id);
          return (
            <div
              key={group.id}
              className={`glass-card ${isSelected ? 'active' : ''}`}
              style={{
                cursor: 'pointer',
                border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-card)',
                transition: 'all 0.2s ease',
              }}
              onClick={() => handleToggleSelect(group.id)}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, var(--accent-blue), var(--primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800 }}>
                    👥
                  </div>
                  <div>
                    <h4 style={{ fontWeight: 700, fontSize: '0.9rem', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {group.name}
                    </h4>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>ID: {group.id.split('@')[0]}</span>
                  </div>
                </div>
                {isSelected ? <CheckSquare size={20} color="var(--primary)" /> : <Square size={20} color="var(--text-dim)" />}
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-main)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                💬 {group.lastMessage}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                  <Tag size={12} color="var(--primary)" />
                  <select
                    style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: 'var(--radius-sm)', padding: '3px 8px', fontSize: '0.75rem', outline: 'none', fontWeight: 600 }}
                    value={group.category}
                    onChange={(e) => handleAssignCategory(group.id, e.target.value)}
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        Categoría: {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <span className="badge badge-amber">{group.unreadCount} no leídos</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Crear Nueva Categoría */}
      {showCategoryModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div className="glass-card" style={{ width: '380px', background: 'var(--bg-card-solid)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: 800, fontSize: '1.1rem' }}>📁 Crear Categoría de Grupos</h3>
              <button onClick={() => setShowCategoryModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Nombre de la Nueva Categoría
                </label>
                <input
                  type="text"
                  className="chat-input"
                  style={{ width: '100%' }}
                  placeholder="Ej: Clientes VIP, Ofertas Especiales..."
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCategoryModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Crear Categoría
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
