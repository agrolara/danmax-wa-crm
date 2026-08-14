import React, { useState, useEffect, useRef } from 'react';
import { API } from '../services/api';
import { Users, Search, Send, CheckSquare, Square, Zap, RefreshCw, CheckCircle2, Folder, Plus, Tag, X, FileText, Upload, Link as LinkIcon, Trash2, Check, MessageSquare } from 'lucide-react';

export const GroupsView: React.FC = () => {
  const [groups, setGroups] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(['Todas']);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('Todas');
  const [syncing, setSyncing] = useState<boolean>(false);

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
          // Ensure deduplicated categories
          const cleanCats = Array.from(new Set(['Todas', ...resGroups.data.categories]));
          setCategories(cleanCats);
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

  const handleSyncGroups = async () => {
    setSyncing(true);
    setStatusNotification(null);
    try {
      const res = await API.post('/groups/sync');
      if (res.data.success) {
        setGroups(res.data.groups);
        if (res.data.categories) {
          const cleanCats = Array.from(new Set(['Todas', ...res.data.categories]));
          setCategories(cleanCats);
        }
        setStatusNotification(res.data.message || 'Sincronización de grupos realizada con éxito.');
        setTimeout(() => setStatusNotification(null), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const handleHideGroupFromCRM = async (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation();
    if (!confirm('¿Deseas eliminar este grupo ÚNICAMENTE de la vista del CRM? (El grupo real en WhatsApp no se verá afectado).')) {
      return;
    }

    try {
      const res = await API.post('/groups/hide', { groupId });
      if (res.data.success) {
        setGroups(res.data.groups);
        setSelectedGroupIds((prev) => prev.filter((id) => id !== groupId));
        setStatusNotification('Grupo eliminado de la vista del CRM.');
        setTimeout(() => setStatusNotification(null), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

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
    const tmpl = templates.find((t) => t.id === tmplId);
    if (tmpl) {
      setHeaderText(tmpl.title || tmpl.headerText || '');
      setBroadcastMessage(tmpl.content || tmpl.bodyText || '');
      setFooterText(tmpl.footer || tmpl.footerText || '');
      const media = tmpl.mediaUrl || tmpl.headerContent || '';
      if (media) {
        setMediaUrl(media);
        setMediaMode('URL');
      }
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryInput.trim()) return;

    try {
      const res = await API.post('/groups/categories', { categoryName: newCategoryInput.trim() });
      if (res.data.success) {
        const cleanCats = Array.from(new Set(['Todas', ...res.data.categories]));
        setCategories(cleanCats);
        setActiveCategory(newCategoryInput.trim());
        setNewCategoryInput('');
        setShowCategoryModal(false);
        setStatusNotification('Nueva categoría creada exitosamente.');
        setTimeout(() => setStatusNotification(null), 3000);
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
    if (selectedGroupIds.length === filteredGroups.length) {
      setSelectedGroupIds([]);
    } else {
      setSelectedGroupIds(filteredGroups.map((g) => g.id));
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

  const handleBulkAssignCategory = async (newCategory: string) => {
    if (selectedGroupIds.length === 0 || !newCategory) return;
    try {
      for (const gid of selectedGroupIds) {
        await API.post('/groups/assign-category', { groupId: gid, category: newCategory });
      }
      fetchGroupsAndTemplates();
      setStatusNotification(`Categoría "${newCategory}" asignada a ${selectedGroupIds.length} grupos.`);
      setTimeout(() => setStatusNotification(null), 3000);
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

  // Deduplicate categories list
  const uniqueCategories = Array.from(new Set(categories.includes('Todas') ? categories : ['Todas', ...categories]));

  return (
    <div style={{ padding: '2rem' }}>
      {/* Header del Módulo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            👥 Grupos de WhatsApp & Difusiones Masivas ({groups.length} detectados)
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Organiza tus grupos en categorías personalizadas o envía mensajes masivos a los grupos seleccionados.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-primary" onClick={() => setShowCategoryModal(true)}>
            <Plus size={16} /> Crear Categoría
          </button>

          <button className="btn btn-secondary" onClick={handleSyncGroups} disabled={syncing}>
            <RefreshCw size={14} className={syncing ? 'spin' : ''} /> {syncing ? 'Sincronizando...' : 'Actualizar Grupos'}
          </button>
        </div>
      </div>

      {statusNotification && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--accent-green)', color: 'var(--accent-green)', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
          <CheckCircle2 size={18} /> {statusNotification}
        </div>
      )}

      {/* Pill Filters por Categorías (Deduplicadas) */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '4px' }}>
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

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Pie de Firma / Empresa (Opcional)</label>
                <input
                  type="text"
                  className="chat-input"
                  style={{ width: '100%' }}
                  placeholder="Ej: DanMax WA - Soluciones Comerciales"
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Tipo de Archivo Adjunto (Imágenes, Videos, PDF)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <button
                    type="button"
                    className={`btn ${mediaMode === 'UPLOAD' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                    onClick={() => setMediaMode('UPLOAD')}
                  >
                    <Upload size={14} /> 📁 Subir Archivo de PC
                  </button>
                  <button
                    type="button"
                    className={`btn ${mediaMode === 'URL' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                    onClick={() => setMediaMode('URL')}
                  >
                    <LinkIcon size={14} /> 🌐 Pegar Enlace / URL
                  </button>
                </div>

                {mediaMode === 'UPLOAD' ? (
                  <div>
                    <input
                      type="file"
                      ref={groupFileInputRef}
                      style={{ display: 'none' }}
                      accept="image/*,video/*,application/pdf"
                      onChange={handleGroupFileUpload}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ width: '100%', justifyContent: 'center', borderStyle: 'dashed' }}
                      onClick={() => groupFileInputRef.current?.click()}
                    >
                      <Upload size={16} /> {uploadedFileName ? `Adjunto: ${uploadedFileName}` : 'Seleccionar Imagen, Video o Documento...'}
                    </button>
                  </div>
                ) : (
                  <input
                    type="url"
                    className="chat-input"
                    style={{ width: '100%' }}
                    placeholder="https://ejemplo.com/imagen.jpg"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                  />
                )}
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.25rem', padding: '0.65rem' }} disabled={sending}>
                <Send size={16} /> {sending ? 'Transmitiendo...' : `Transmitir Mensaje a ${selectedGroupIds.length} Grupos`}
              </button>
            </div>

            {/* Vista Previa Formato WhatsApp Burbuja Completa */}
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                👁️ Vista Previa Burbuja WhatsApp Real (Sin Recortes)
              </label>
              <div style={{ background: '#0b141a', borderRadius: '12px', padding: '12px', minHeight: '230px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ background: '#005c4b', borderRadius: '8px', padding: '10px', color: '#e9edef', fontSize: '0.85rem', maxWidth: '100%' }}>
                  {mediaUrl && (
                    <div style={{ marginBottom: '8px', width: '100%', maxHeight: '180px', overflow: 'hidden', borderRadius: '6px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {mediaUrl.startsWith('data:video') || mediaUrl.endsWith('.mp4') ? (
                        <video src={mediaUrl} controls style={{ width: '100%', maxHeight: '180px', objectFit: 'contain' }} />
                      ) : (
                        <img src={mediaUrl} alt="Adjunto" style={{ width: '100%', maxHeight: '180px', objectFit: 'contain' }} />
                      )}
                    </div>
                  )}

                  {headerText && <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '4px' }}>{headerText.toUpperCase()}</div>}
                  <div style={{ whiteSpace: 'pre-wrap' }}>{broadcastMessage || 'Tu texto explicativo aparecerá aquí...'}</div>
                  {footerText && <div style={{ fontSize: '0.75rem', opacity: 0.8, fontStyle: 'italic', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '4px' }}>{footerText}</div>}
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Barra de Búsqueda, Selección y Asignación Masiva */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem' }}>
          <Search size={18} color="var(--text-dim)" />
          <input
            type="text"
            placeholder="Buscar grupo por nombre completo..."
            style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', marginLeft: '0.5rem', width: '100%', fontSize: '0.875rem' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <button className="btn btn-secondary" onClick={handleSelectAll} style={{ fontSize: '0.85rem' }}>
          {selectedGroupIds.length === filteredGroups.length && filteredGroups.length > 0 ? <CheckSquare size={16} color="var(--primary)" /> : <Square size={16} />}
          <span>{selectedGroupIds.length === filteredGroups.length && filteredGroups.length > 0 ? 'Deseleccionar Todos' : 'Seleccionar Todos'}</span>
        </button>

        {/* Asignador de Categoría Masivo */}
        {selectedGroupIds.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Tag size={16} color="var(--primary)" />
            <select
              className="chat-input"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', fontWeight: 700 }}
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkAssignCategory(e.target.value);
                  e.target.value = '';
                }
              }}
            >
              <option value="">🏷️ Asignar Categoría a ({selectedGroupIds.length}) Seleccionados ▾</option>
              {uniqueCategories.map((cat) => (
                <option key={cat} value={cat}>
                  Mover a Categoría: {cat}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Listado Vertical de Grupos (Formato Lista Hacia Abajo para Nombres Completos) */}
      {filteredGroups.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <Users size={48} color="var(--primary)" style={{ marginBottom: '1rem', opacity: 0.7 }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>No se encontraron grupos en esta categoría</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '1rem' }}>
            Presiona "Actualizar Grupos" para sincronizar automáticamente los grupos donde está unida tu sesión de WhatsApp.
          </p>
          <button className="btn btn-primary" onClick={handleSyncGroups} disabled={syncing}>
            <RefreshCw size={16} className={syncing ? 'spin' : ''} /> {syncing ? 'Sincronizando...' : 'Actualizar Grupos'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredGroups.map((group) => {
            const isSelected = selectedGroupIds.includes(group.id);
            return (
              <div
                key={group.id}
                className={`glass-card ${isSelected ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem 1.25rem',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-card)',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-md)',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
                onClick={() => handleToggleSelect(group.id)}
              >
                {/* Lado Izquierdo: Checkbox + Icono + Nombre Completo + Subtítulo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '280px' }}>
                  <div style={{ cursor: 'pointer' }}>
                    {isSelected ? <CheckSquare size={22} color="var(--primary)" /> : <Square size={22} color="var(--text-dim)" />}
                  </div>

                  <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, var(--accent-blue), var(--primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.2rem', fontWeight: 800, flexShrink: 0 }}>
                    👥
                  </div>

                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)', marginBottom: '2px', wordBreak: 'break-word' }}>
                      {group.name}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                      <span>ID: {group.id.split('@')[0]}</span>
                      <span>•</span>
                      <span style={{ color: 'var(--text-muted)' }}>💬 {group.lastMessage}</span>
                    </div>
                  </div>
                </div>

                {/* Lado Derecho: Asignación de Categoría + Badge + Eliminar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Tag size={14} color="var(--primary)" />
                    <select
                      className="chat-input"
                      style={{
                        background: 'var(--bg-main)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-main)',
                        borderRadius: 'var(--radius-md)',
                        padding: '6px 12px',
                        fontSize: '0.8rem',
                        outline: 'none',
                        fontWeight: 600,
                        minWidth: '150px',
                      }}
                      value={group.category || 'Todas'}
                      onChange={(e) => handleAssignCategory(group.id, e.target.value)}
                    >
                      {uniqueCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          Categoría: {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {group.unreadCount > 0 && (
                    <span className="badge badge-amber">{group.unreadCount} no leídos</span>
                  )}

                  <button
                    className="btn btn-secondary"
                    style={{ padding: '6px 10px', color: 'var(--accent-rose)' }}
                    title="Eliminar grupo únicamente de la vista del CRM"
                    onClick={(e) => handleHideGroupFromCRM(e, group.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
